/**
 * RxNorm API Client
 *
 * Provides functions to interact with the NIH RxNorm API for drug name normalization.
 * Includes retry logic, timeout handling, and comprehensive error handling.
 */

import {
  RxNormApproximateResponse,
  RxNormRelatedResponse,
  NormalizationResult,
  RxNormConfig,
  DEFAULT_RXNORM_CONFIG,
  NORMALIZATION_STATUS,
} from './types';

/**
 * Custom error class for RxNorm API errors
 */
export class RxNormAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public drugName?: string
  ) {
    super(message);
    this.name = 'RxNormAPIError';
  }
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RxNormAPIError(
        `Request timeout after ${timeout}ms`,
        'TIMEOUT'
      );
    }
    throw error;
  }
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  config: RxNormConfig
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, config.timeout);

      if (!response.ok) {
        throw new RxNormAPIError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          response.status
        );
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on 4xx errors (client errors)
      if (
        error instanceof RxNormAPIError &&
        error.statusCode &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        throw error;
      }

      // If not the last attempt, wait before retrying
      if (attempt < config.retryAttempts) {
        await sleep(config.retryDelay * attempt); // Exponential backoff
      }
    }
  }

  throw new RxNormAPIError(
    `Failed after ${config.retryAttempts} attempts: ${lastError?.message}`,
    'MAX_RETRIES_EXCEEDED'
  );
}

/**
 * Search for a drug by name using RxNorm's approximate matching
 *
 * @param drugName - The drug name to search for (can be brand, generic, abbreviation)
 * @param config - Optional configuration override
 * @returns The RxCUI (RxNorm Concept Unique Identifier) or null if not found
 *
 * @example
 * ```ts
 * const rxcui = await searchDrug('Tylenol');
 * // Returns: "202433"
 * ```
 */
export async function searchDrug(
  drugName: string,
  config: RxNormConfig = DEFAULT_RXNORM_CONFIG
): Promise<string | null> {
  if (!drugName || drugName.trim() === '') {
    throw new RxNormAPIError('Drug name cannot be empty', 'INVALID_INPUT');
  }

  const encodedName = encodeURIComponent(drugName.trim());
  const url = `${config.baseUrl}/approximateTerm.json?term=${encodedName}`;

  try {
    const response = await fetchWithRetry(url, config);
    const data: RxNormApproximateResponse = await response.json();

    // Check if we got any candidates
    if (
      !data.approximateGroup ||
      !data.approximateGroup.candidate ||
      data.approximateGroup.candidate.length === 0
    ) {
      return null;
    }

    // Return the top candidate's rxcui
    return data.approximateGroup.candidate[0].rxcui;
  } catch (error) {
    if (error instanceof RxNormAPIError) {
      error.drugName = drugName;
      throw error;
    }
    throw new RxNormAPIError(
      `Unexpected error searching for drug: ${error}`,
      'UNKNOWN_ERROR',
      undefined,
      drugName
    );
  }
}

/**
 * Get the generic name (ingredient) for a drug using its RxCUI
 *
 * @param rxcui - The RxNorm Concept Unique Identifier
 * @param config - Optional configuration override
 * @returns The generic name or null if not found
 *
 * @example
 * ```ts
 * const genericName = await getGenericName('202433');
 * // Returns: "acetaminophen"
 * ```
 */
export async function getGenericName(
  rxcui: string,
  config: RxNormConfig = DEFAULT_RXNORM_CONFIG
): Promise<string | null> {
  if (!rxcui || rxcui.trim() === '') {
    throw new RxNormAPIError('RxCUI cannot be empty', 'INVALID_INPUT');
  }

  const url = `${config.baseUrl}/rxcui/${rxcui}/related.json?tty=IN`;

  try {
    const response = await fetchWithRetry(url, config);
    const data: RxNormRelatedResponse = await response.json();

    // Navigate the response structure to find the ingredient
    if (
      !data.relatedGroup ||
      !data.relatedGroup.conceptGroup ||
      data.relatedGroup.conceptGroup.length === 0
    ) {
      return null;
    }

    // Find the concept group with tty=IN (Ingredient)
    const ingredientGroup = data.relatedGroup.conceptGroup.find(
      (group) => group.tty === 'IN'
    );

    if (
      !ingredientGroup ||
      !ingredientGroup.conceptProperties ||
      ingredientGroup.conceptProperties.length === 0
    ) {
      return null;
    }

    // Return the first ingredient name
    return ingredientGroup.conceptProperties[0].name;
  } catch (error) {
    if (error instanceof RxNormAPIError) {
      throw error;
    }
    throw new RxNormAPIError(
      `Unexpected error getting generic name: ${error}`,
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Normalize a drug name to its generic name (complete workflow)
 *
 * This is the main function that combines searchDrug and getGenericName
 *
 * @param drugName - The drug name to normalize
 * @param config - Optional configuration override
 * @returns Normalization result with status and data
 *
 * @example
 * ```ts
 * const result = await normalizeDrugName('Tylenol');
 * // Returns: {
 * //   originalName: "Tylenol",
 * //   genericName: "acetaminophen",
 * //   rxcui: "202433",
 * //   status: "success"
 * // }
 * ```
 */
export async function normalizeDrugName(
  drugName: string,
  config: RxNormConfig = DEFAULT_RXNORM_CONFIG
): Promise<NormalizationResult> {
  try {
    // Step 1: Search for the drug to get its RxCUI
    const rxcui = await searchDrug(drugName, config);

    if (!rxcui) {
      return {
        originalName: drugName,
        genericName: null,
        rxcui: null,
        status: NORMALIZATION_STATUS.NOT_FOUND,
        errorMessage: 'Drug not found in RxNorm database',
      };
    }

    // Step 2: Get the generic name using the RxCUI
    const genericName = await getGenericName(rxcui, config);

    if (!genericName) {
      return {
        originalName: drugName,
        genericName: null,
        rxcui,
        status: NORMALIZATION_STATUS.NOT_FOUND,
        errorMessage: 'Generic name not found for this drug',
      };
    }

    return {
      originalName: drugName,
      genericName,
      rxcui,
      status: NORMALIZATION_STATUS.SUCCESS,
    };
  } catch (error) {
    if (error instanceof RxNormAPIError) {
      return {
        originalName: drugName,
        genericName: null,
        rxcui: null,
        status: NORMALIZATION_STATUS.ERROR,
        errorMessage: error.message,
      };
    }

    return {
      originalName: drugName,
      genericName: null,
      rxcui: null,
      status: NORMALIZATION_STATUS.ERROR,
      errorMessage: `Unexpected error: ${error}`,
    };
  }
}

/**
 * Normalize multiple drug names in batch
 *
 * @param drugNames - Array of drug names to normalize
 * @param onProgress - Optional callback for progress updates
 * @param config - Optional configuration override
 * @returns Array of normalization results
 *
 * @example
 * ```ts
 * const results = await normalizeDrugNameBatch(
 *   ['Tylenol', 'Advil', 'Lipitor'],
 *   (progress) => console.log(`${progress.completed}/${progress.total}`)
 * );
 * ```
 */
export async function normalizeDrugNameBatch(
  drugNames: string[],
  onProgress?: (completed: number, total: number, current: string) => void,
  config: RxNormConfig = DEFAULT_RXNORM_CONFIG
): Promise<NormalizationResult[]> {
  const results: NormalizationResult[] = [];
  const total = drugNames.length;

  for (let i = 0; i < drugNames.length; i++) {
    const drugName = drugNames[i];

    // Call progress callback before processing
    if (onProgress) {
      onProgress(i, total, drugName);
    }

    const result = await normalizeDrugName(drugName, config);
    results.push(result);

    // Small delay to avoid overwhelming the API
    if (i < drugNames.length - 1) {
      await sleep(100); // 100ms between requests
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress(total, total, '');
  }

  return results;
}

/**
 * Validate RxNorm API connectivity
 *
 * @param config - Optional configuration override
 * @returns true if API is reachable, false otherwise
 *
 * @example
 * ```ts
 * const isOnline = await validateRxNormAPI();
 * if (!isOnline) {
 *   console.error('RxNorm API is not accessible');
 * }
 * ```
 */
export async function validateRxNormAPI(
  config: RxNormConfig = DEFAULT_RXNORM_CONFIG
): Promise<boolean> {
  try {
    // Try a simple known drug (aspirin)
    const rxcui = await searchDrug('aspirin', config);
    return rxcui !== null;
  } catch (error) {
    return false;
  }
}
