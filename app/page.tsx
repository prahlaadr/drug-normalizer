'use client';

import { useState } from 'react';
import { readCSVFile, downloadCSV, generateCSV, addGenericNameColumn, detectMedicationColumn } from '@/lib/csv-processor';
import { normalizeDrugNameBatch } from '@/lib/rxnorm-client';
import { CSVRow, NormalizedRow, ParsedCSVData } from '@/lib/types';

export default function Home() {
  const [csvData, setCSVData] = useState<ParsedCSVData | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, drugName: '' });
  const [normalizedData, setNormalizedData] = useState<NormalizedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load sample data
  const loadSample = async () => {
    try {
      setError(null);
      const response = await fetch('/realistic-sample.csv');
      const text = await response.text();

      // Parse using csv-processor
      const Papa = await import('papaparse');
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const columns = results.meta.fields || [];
          setCSVData({
            data: results.data as CSVRow[],
            columns,
            meta: results.meta,
          });

          // Auto-detect medication column
          const detected = detectMedicationColumn(columns);
          if (detected) {
            setSelectedColumn(detected);
          }
        },
      });
    } catch (err) {
      setError(`Failed to load sample: ${err}`);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const parsed = await readCSVFile(file);
      setCSVData(parsed);

      // Auto-detect medication column
      const detected = detectMedicationColumn(parsed.columns);
      if (detected) {
        setSelectedColumn(detected);
      }
    } catch (err) {
      setError(`Failed to parse CSV: ${err}`);
    }
  };

  // Normalize drugs
  const handleNormalize = async () => {
    if (!csvData || !selectedColumn) return;

    try {
      setProcessing(true);
      setError(null);

      // Extract drug names from selected column
      const drugNames = csvData.data.map(row => String(row[selectedColumn] || '').trim()).filter(Boolean);
      const uniqueDrugs = Array.from(new Set(drugNames));

      // Normalize with progress
      const results = await normalizeDrugNameBatch(
        uniqueDrugs,
        (completed, total, current) => {
          setProgress({ current: completed, total, drugName: current });
        }
      );

      // Build map of original name → generic name
      const genericMap = new Map<string, string>();
      results.forEach(result => {
        genericMap.set(result.originalName, result.genericName || 'NOT_FOUND');
      });

      // Add generic name column
      const normalized = addGenericNameColumn(csvData.data, selectedColumn, genericMap);
      setNormalizedData(normalized);
    } catch (err) {
      setError(`Normalization failed: ${err}`);
    } finally {
      setProcessing(false);
    }
  };

  // Download results
  const handleDownload = () => {
    if (!normalizedData) return;

    const csv = generateCSV(normalizedData);
    downloadCSV(csv, 'normalized-medications.csv');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Drug Name Normalizer
          </h1>
          <p className="text-xl text-gray-600">
            Standardize medication names using RxNorm API
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Upload Section */}
        {!csvData && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="space-y-6">
              <button
                onClick={loadSample}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition"
              >
                Try Sample Data
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <label className="block">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-gray-600">Click to upload CSV file</p>
                  <p className="text-sm text-gray-400 mt-2">or drag and drop</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Column Selection */}
        {csvData && !normalizedData && !processing && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Select Medication Column</h2>
            <p className="text-gray-600 mb-6">
              Found {csvData.data.length} rows with {csvData.columns.length} columns
            </p>

            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-6"
            >
              <option value="">Select a column...</option>
              {csvData.columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>

            <button
              onClick={handleNormalize}
              disabled={!selectedColumn}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-4 px-6 rounded-lg transition"
            >
              Normalize Drug Names
            </button>
          </div>
        )}

        {/* Processing Status */}
        {processing && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Processing...</h2>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress: {progress.current} / {progress.total}</span>
                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-500 h-4 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
            {progress.drugName && (
              <p className="text-sm text-gray-500">
                Processing: {progress.drugName}
              </p>
            )}
          </div>
        )}

        {/* Results */}
        {normalizedData && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">✓ Normalization Complete</h2>
            <p className="text-gray-600 mb-6">
              Successfully processed {normalizedData.length} medications
            </p>

            <div className="mb-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Original</th>
                    <th className="text-left p-2">Generic Name</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedData.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{String(row[selectedColumn])}</td>
                      <td className="p-2 font-semibold">{row.GENERIC_NAME}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {normalizedData.length > 10 && (
                <p className="text-sm text-gray-500 mt-2">
                  Showing 10 of {normalizedData.length} rows
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleDownload}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg transition"
              >
                Download Normalized CSV
              </button>
              <button
                onClick={() => {
                  setCSVData(null);
                  setNormalizedData(null);
                  setSelectedColumn('');
                }}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-4 px-6 rounded-lg transition"
              >
                Process Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
