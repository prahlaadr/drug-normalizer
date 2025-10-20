# Drug Name Normalizer

## 🎯 Project Goal

Build a **web application** that normalizes messy medication names to standardized generic names using the public RxNorm API.

### Purpose
- **Product Goal:** Solve the drug name standardization problem that data engineers and research scientists face when working with multi-source healthcare data
- **Personal Goal:** Demonstrate technical competency and business process understanding for a PM (Product Manager) portfolio
- **User Value:** Convert 2-4 hours of manual drug name mapping into a 2-minute automated process

---

## 🏥 The Problem Being Solved

### Real-World Scenario
Healthcare data comes from multiple sources (hospitals, pharmacies, EHR systems) with inconsistent medication naming:

```
Hospital A: "Tylenol 500mg"
Hospital B: "acetaminophen 500 mg tablet"
Hospital C: "APAP 325mg"
Pharmacy:   "Paracetamol"
```

**Without normalization:** Analysis treats these as 4 different drugs
**With normalization:** All map to "acetaminophen" - accurate aggregation possible

### Use Cases
1. **Multi-site clinical trials** - Aggregate medication data across hospital systems
2. **Insurance claims analysis** - Group by generic for cost analysis
3. **Drug safety surveillance** - Detect adverse events across name variations
4. **Pharmacy research** - Utilization studies need standardized drug names
5. **Data warehouse ETL** - Clean data before loading into analytics systems

---

## 🏗️ Technical Architecture

### High-Level Flow
```
User Browser (All Processing Happens Client-Side)
    ↓
[1] CSV Upload or Sample Data Load
    ↓
[2] Parse CSV → Extract medication column
    ↓
[3] For each drug name:
    ├─→ Call RxNorm API #1: approximateTerm.json
    │   └─→ Returns: rxcui (RxNorm Concept Unique Identifier)
    ├─→ Call RxNorm API #2: rxcui/{id}/related.json?tty=IN
    │   └─→ Returns: generic name (active ingredient)
    └─→ Store result with progress tracking
    ↓
[4] Build enriched CSV with GENERIC_NAME column added
    ↓
[5] Display before/after comparison + Download button
```

### Technology Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **CSV Processing:** PapaParse library
- **API:** RxNorm REST API (https://rxnav.nlm.nih.gov)
- **Deployment:** Vercel (static site)
- **Package Manager:** npm

### Key Architecture Decisions

#### ✅ Client-Side Processing (NOT Server-Side)
**Why:**
- Privacy - Healthcare data never leaves user's browser (critical for HIPAA)
- RxNorm API has CORS enabled (`access-control-allow-origin: *`)
- No serverless function timeouts or costs
- Infinite scalability (just static file serving)
- User sees real-time progress

#### ✅ Vercel App (NOT MCP Server)
**Why:**
- Visual demo-ability for portfolio (send link to hiring managers)
- Shows UX/product thinking, not just backend logic
- Accessible to non-technical stakeholders
- Live URL for resume/portfolio
- Better for PM role demonstration

---

## 🔬 RxNorm API Details

### What is RxNorm?
- **Maintained by:** U.S. National Library of Medicine (NIH)
- **Purpose:** Standardized nomenclature for clinical drugs
- **Public Access:** Free REST API, no authentication required
- **CORS:** Fully enabled for browser-based applications

### API Endpoints Used

#### 1. Approximate Term Search
**Purpose:** Find drug match from messy input
```bash
GET https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term={drugName}
```

**Example Request:**
```bash
curl "https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=Tylenol"
```

**Example Response:**
```json
{
  "approximateGroup": {
    "candidate": [
      {
        "rxcui": "202433",
        "score": "12.05",
        "rank": "1",
        "name": "Tylenol"
      }
    ]
  }
}
```

#### 2. Get Related Concepts (Ingredient)
**Purpose:** Get generic name from rxcui
```bash
GET https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/related.json?tty=IN
```

**Parameters:**
- `tty=IN` - Term Type = Ingredient (generic name)

**Example Request:**
```bash
curl "https://rxnav.nlm.nih.gov/REST/rxcui/202433/related.json?tty=IN"
```

**Example Response:**
```json
{
  "relatedGroup": {
    "conceptGroup": [
      {
        "tty": "IN",
        "conceptProperties": [
          {
            "rxcui": "161",
            "name": "acetaminophen"
          }
        ]
      }
    ]
  }
}
```

---

## 📁 Project Structure

```
drug-normalizer/
├── README.md                          # This file
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript config
├── tailwind.config.ts                 # Tailwind config
├── next.config.ts                     # Next.js config
├── public/
│   ├── sample-medications.csv         # Simple test data (10 rows)
│   ├── sample-medications-normalized.csv  # Expected output example
│   └── realistic-sample.csv           # Synthea-format data (15 patients)
├── app/
│   ├── layout.tsx                     # Root layout
│   ├── page.tsx                       # Main app page (TO BE BUILT)
│   └── globals.css                    # Global styles
├── components/                        # (TO BE CREATED)
│   ├── FileUpload.tsx                # Drag-drop CSV upload
│   ├── ColumnSelector.tsx            # Pick medication column
│   ├── ProcessingStatus.tsx          # Progress bar
│   └── ResultsTable.tsx              # Before/after comparison
└── lib/                              # (TO BE CREATED)
    ├── rxnorm-client.ts              # RxNorm API calls
    ├── csv-processor.ts              # CSV parsing/generation
    └── types.ts                      # TypeScript types
```

---

## 📊 Sample Data Details

### 1. sample-medications.csv (Simple Test)
**Format:** Minimal columns for quick testing
```csv
PATIENT,ENCOUNTER,START,DESCRIPTION
patient-001,enc-12345,2024-01-15,Tylenol 500 MG Oral Tablet
patient-002,enc-12347,2024-02-10,Advil 200mg
patient-003,enc-12350,2024-03-05,APAP 325mg
```

**Demonstrates:**
- Brand names (Tylenol, Advil)
- Abbreviations (APAP)
- Mixed formatting

### 2. realistic-sample.csv (Synthea Format)
**Format:** Full Synthea medications.csv schema (15 patients)
```csv
START,STOP,PATIENT,PAYER,ENCOUNTER,CODE,DESCRIPTION,BASE_COST,PAYER_COVERAGE,DISPENSES,TOTALCOST,REASONCODE,REASONDESCRIPTION
2023-01-15T10:30:00Z,2023-07-15T10:30:00Z,7f8c1e42-9a5d-4b3e-8f2a-1d4c6e9b3a7f,Medicare,enc-001,849574,Simvastatin 20 MG Oral Tablet,12.50,10.00,6,75.00,13644009,Hyperlipidemia
...
```

**Columns Explained:**
- **START/STOP:** Prescription dates (ISO 8601 format)
- **PATIENT:** UUID (synthetic patient identifier)
- **PAYER:** Insurance provider (Medicare, UnitedHealthcare, etc.)
- **ENCOUNTER:** Visit ID where medication was prescribed
- **CODE:** RxNorm code (but may not match DESCRIPTION due to data quality issues)
- **DESCRIPTION:** Medication name (THE COLUMN WE NORMALIZE)
- **BASE_COST/PAYER_COVERAGE/TOTALCOST:** Financial data
- **REASONCODE/REASONDESCRIPTION:** Diagnosis (SNOMED-CT codes)

**Real-World Variations Included:**
- "APAP 500mg Tab" - Informal abbreviation
- "Acetaminophen 325 MG Oral Tablet [Tylenol]" - Formal with brand
- "Amox 500mg" - Shortened
- "Amoxicillin 250 MG Oral Capsule" - Full generic
- "Atorvastatin 20 MG Oral Tablet" - Standard format

### 3. sample-medications-normalized.csv (Expected Output)
Shows what the tool should produce - original columns + `GENERIC_NAME` column added

---

## 🔄 Data Processing Flow (Detailed)

### Step-by-Step Processing

#### Input Example
```csv
PATIENT,DESCRIPTION
001,Tylenol 500mg
002,Lipitor 20mg
003,APAP 325mg
```

#### Step 1: Parse CSV (PapaParse)
```javascript
import Papa from 'papaparse';

Papa.parse(csvText, {
  header: true,
  complete: (results) => {
    // results.data = [
    //   { PATIENT: "001", DESCRIPTION: "Tylenol 500mg" },
    //   { PATIENT: "002", DESCRIPTION: "Lipitor 20mg" },
    //   { PATIENT: "003", DESCRIPTION: "APAP 325mg" }
    // ]
  }
});
```

#### Step 2: Normalize Each Drug
```javascript
async function normalizeDrug(drugName: string): Promise<string> {
  try {
    // 2a. Find drug match (fuzzy search)
    const searchUrl = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(drugName)}`;
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();

    const rxcui = searchData.approximateGroup.candidate[0].rxcui;

    // 2b. Get ingredient (generic name)
    const ingredientUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=IN`;
    const ingredientResp = await fetch(ingredientUrl);
    const ingredientData = await ingredientResp.json();

    const genericName = ingredientData.relatedGroup.conceptGroup[0]
      .conceptProperties[0].name;

    return genericName;

  } catch (error) {
    return "NOT_FOUND"; // Handle drugs not in RxNorm
  }
}

// Process all rows
for (const row of data) {
  row.GENERIC_NAME = await normalizeDrug(row.DESCRIPTION);
  updateProgress(); // Update UI
}
```

#### Step 3: Generate Output CSV
```javascript
// Add new column to data
const enrichedData = [
  { PATIENT: "001", DESCRIPTION: "Tylenol 500mg", GENERIC_NAME: "acetaminophen" },
  { PATIENT: "002", DESCRIPTION: "Lipitor 20mg", GENERIC_NAME: "atorvastatin" },
  { PATIENT: "003", DESCRIPTION: "APAP 325mg", GENERIC_NAME: "acetaminophen" }
];

// Convert to CSV
const csvOutput = Papa.unparse(enrichedData);

// Trigger download
const blob = new Blob([csvOutput], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'normalized-medications.csv';
link.click();
```

#### Output Example
```csv
PATIENT,DESCRIPTION,GENERIC_NAME
001,Tylenol 500mg,acetaminophen
002,Lipitor 20mg,atorvastatin
003,APAP 325mg,acetaminophen
```

**Key Insight:** Rows 1 and 3 now have the same `GENERIC_NAME` despite different input names!

---

## 🎨 User Experience Flow

### Page 1: Landing / Upload
```
┌─────────────────────────────────────────────┐
│      Drug Name Normalizer                   │
│                                             │
│  Standardize medication names using RxNorm │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  [Try Sample Data]                 │    │
│  └────────────────────────────────────┘    │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  Drag & Drop CSV File              │    │
│  │  or click to browse                │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Page 2: Column Selection
```
┌─────────────────────────────────────────────┐
│  Select the column containing drug names:   │
│                                             │
│  ○ PATIENT                                  │
│  ● DESCRIPTION  ← Selected                  │
│  ○ START                                    │
│  ○ ENCOUNTER                                │
│                                             │
│  [Continue]                                 │
└─────────────────────────────────────────────┘
```

### Page 3: Processing
```
┌─────────────────────────────────────────────┐
│  Normalizing medications...                 │
│                                             │
│  ████████████░░░░░░░░░░░  60% (9/15)       │
│                                             │
│  Processing: "Atorvastatin 20 MG Tablet"   │
│  → Found: atorvastatin                      │
└─────────────────────────────────────────────┘
```

### Page 4: Results
```
┌─────────────────────────────────────────────┐
│  ✓ Successfully normalized 15 medications   │
│                                             │
│  Before                    After            │
│  ─────────────────────────────────────────  │
│  Tylenol 500mg         →  acetaminophen     │
│  APAP 325mg            →  acetaminophen     │
│  Lipitor 20mg          →  atorvastatin      │
│  Amox 500mg            →  amoxicillin       │
│  ...                                        │
│                                             │
│  [Download Normalized CSV]                  │
│  [Process Another File]                     │
└─────────────────────────────────────────────┘
```

---

## 🚀 Development Progress

### ✅ Completed
- [x] Architecture planning and technical decisions
- [x] Verified RxNorm API CORS compatibility
- [x] Created realistic sample data (Synthea format)
- [x] Initialized Next.js 15 project with TypeScript
- [x] Installed dependencies (papaparse, @types/papaparse)
- [x] Set up TailwindCSS
- [x] Sample data files in public/ folder

### 🔄 In Progress
- [ ] Create RxNorm API client utilities

### ⏳ To Do
- [ ] Build file upload component
- [ ] Create CSV parser and column selector
- [ ] Implement normalization processing with progress tracking
- [ ] Build results comparison table (before/after)
- [ ] Add CSV download functionality
- [ ] Test with realistic-sample.csv
- [ ] Deploy to Vercel

---

## 🧪 Testing Strategy

### Manual Testing Checklist
1. **Upload Sample Data**
   - [ ] Load sample-medications.csv
   - [ ] Load realistic-sample.csv
   - [ ] Upload custom CSV file

2. **Column Selection**
   - [ ] Auto-detect likely medication column
   - [ ] Manual column selection works
   - [ ] Handle CSVs with no header row

3. **API Processing**
   - [ ] Handle API rate limiting gracefully
   - [ ] Show progress for long files (50+ rows)
   - [ ] Handle drugs not found in RxNorm (show "NOT_FOUND")
   - [ ] Handle network errors (show retry option)

4. **Results**
   - [ ] Before/after comparison is clear
   - [ ] Download works on all browsers
   - [ ] Original data preserved (no data loss)
   - [ ] GENERIC_NAME column added correctly

5. **Edge Cases**
   - [ ] Empty CSV file
   - [ ] CSV with only headers
   - [ ] Very large files (1000+ rows)
   - [ ] Special characters in drug names
   - [ ] Duplicate drug names (should process each row)

---

## 📝 Known Limitations & Future Enhancements

### Current Limitations
1. **Single column normalization** - Only processes one medication column at a time
2. **No batch API calls** - Processes drugs sequentially (could optimize with batching)
3. **English only** - RxNorm is primarily English medication names
4. **No multi-ingredient handling** - Combination drugs return first ingredient only

### Potential Future Features
- **Module 1: Synthetic Patient Data Generator** (generate test data with parameters)
- **Batch processing optimization** (parallel API calls with rate limiting)
- **Export multiple formats** (JSON, Excel, Parquet)
- **Drug interaction checker** (using OpenFDA API)
- **API endpoint** (for programmatic access)
- **Multi-ingredient support** (return comma-separated list for combination drugs)
- **Confidence scores** (show RxNorm match quality)
- **Offline mode** (cache common drugs for faster processing)

---

## 🎯 Portfolio Talking Points

### For PM Interviews

**Problem Understanding:**
> "I identified drug name normalization as a critical pain point in healthcare data workflows. Data engineers at multi-site clinical trials spend 2-4 hours manually mapping medication names because Hospital A calls it 'Tylenol' while Hospital B uses 'acetaminophen' and Hospital C uses 'APAP' - they're all the same drug."

**Solution Design:**
> "I built a client-side web app that uses the NIH's public RxNorm API to automatically standardize drug names. The entire processing happens in the user's browser, which was critical for HIPAA compliance - sensitive patient data never leaves their machine."

**Technical Decision:**
> "I chose client-side processing over server-side because: (1) Privacy - healthcare data stays local, (2) Cost - no serverless function usage, (3) Scale - Vercel just serves static files, (4) UX - users see real-time progress. The RxNorm API supports CORS, so browser-to-API calls work perfectly."

**Impact:**
> "This reduces a 2-4 hour manual task to 2 minutes. It's especially valuable for research scientists who need to aggregate data across hospital systems. For my portfolio, it demonstrates both technical competency (API integration, file processing, async operations) and business understanding (real healthcare workflow pain point)."

**Trade-offs:**
> "I considered building an MCP server for developer tool integration, but chose a web UI instead because it's more demo-able to non-technical stakeholders, which is critical for a PM role. I also deprioritized the synthetic data generator (Module 1) to focus on shipping the core value first."

---

## 🔧 Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev
# Opens at http://localhost:3000

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Deploy to Vercel (from project root)
vercel deploy
# or
vercel deploy --prod
```

---

## 📚 Reference Documentation

### RxNorm API
- **Main Docs:** https://lhncbc.nlm.nih.gov/RxNav/APIs/
- **API Examples:** https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
- **RxNorm Browser:** https://mor.nlm.nih.gov/RxNav/ (for manual lookups)

### Synthea (Synthetic Patient Data)
- **Website:** https://synthetichealth.github.io/synthea/
- **Downloads:** https://synthea.mitre.org/downloads
- **CSV Data Dictionary:** https://github.com/synthetichealth/synthea/wiki/CSV-File-Data-Dictionary

### Healthcare Standards
- **FHIR Medication:** http://hl7.org/fhir/medicationrequest.html
- **RxNorm Overview:** https://www.nlm.nih.gov/research/umls/rxnorm/

### Technologies Used
- **Next.js:** https://nextjs.org/docs
- **PapaParse:** https://www.papaparse.com/docs
- **TailwindCSS:** https://tailwindcss.com/docs
- **TypeScript:** https://www.typescriptlang.org/docs

---

## 📞 Context for Future Sessions

### If Context Resets, Remember:
1. **This is NOT just a CSV processor** - It solves a specific healthcare data problem
2. **Privacy is critical** - All processing must be client-side (no server uploads)
3. **Sample data is ready** - Use realistic-sample.csv for testing
4. **RxNorm API works** - CORS verified, no auth needed, 2-step process (search → ingredient)
5. **Target user** - Data engineers and research scientists in healthcare
6. **Portfolio goal** - Demonstrate PM skills (product thinking + technical execution)
7. **Deployment** - Vercel static site (no API routes needed)

### Quick Start for New Session:
```bash
cd ~/Projects/drug-normalizer
npm run dev
# Check public/ folder for sample data
# Check this README for architecture details
```

---

## 📄 License & Disclaimer

This is a portfolio project demonstrating technical competency.

**Medical Disclaimer:** This tool is for data processing and standardization only. Do not use for clinical decision-making. Always verify medication information with licensed healthcare professionals.

**Data Privacy:** All processing happens client-side. No data is transmitted to servers other than public drug name queries to the NIH RxNorm API.

---

**Last Updated:** 2025-01-20
**Status:** In Development
**Next Step:** Build RxNorm API client utilities
