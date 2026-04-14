import { google } from 'googleapis';
import type { ExportSnapshot, ExportSuite, ExportTestCase, ExportStep } from './fetchExportSnapshot';
import { getSuiteColor, argbToSheetsRgb, HEADER_ROW_COLOR, INDEX_HEADER_COLOR } from './colorPalette';
import { deduplicateTabNames } from './sanitizeFilename';
import { guardForSheets } from './formulaGuard';

const COLUMNS = [
  { header: 'Id', width: 100 },
  { header: 'Description', width: 230 },
  { header: 'Precondition', width: 230 },
  { header: 'Test Step #', width: 80 },
  { header: 'Test Step Description', width: 300 },
  { header: 'Test Data', width: 190 },
  { header: 'Test Step Expected Result', width: 300 },
  { header: 'Pass/Fail/Comments if Fail', width: 160 },
  { header: 'Added to code', width: 110 },
  { header: 'Comments', width: 190 },
  { header: 'Bug report', width: 220 },
];

const AUTOMATION_STATUS_LABELS: Record<string, string> = {
  not_automated: 'Not Automated',
  scripted: 'Scripted',
  in_cicd: 'In CI/CD',
  out_of_sync: 'Out of Sync',
};

function getAutomationLabel(status: string | null): string {
  if (!status) return '';
  return AUTOMATION_STATUS_LABELS[status] ?? status;
}

function sv(v: string) {
  // userEnteredValue.stringValue — prevents formula injection per GAP-04 spec
  return { userEnteredValue: { stringValue: guardForSheets(v) } };
}

function numV(n: number) {
  return { userEnteredValue: { numberValue: n } };
}

function emptyCell() {
  return { userEnteredValue: { stringValue: '' } };
}

function colorFill(argb: string): object {
  const rgb = argbToSheetsRgb(argb);
  return {
    backgroundColor: rgb,
  };
}

interface SheetData {
  sheetId: number;
  title: string;
  rowData: object[];
  merges: object[];
  colorRequests: object[];
  boldRequests: object[];
}

function buildIndexSheet(snapshot: ExportSnapshot, sheetId: number): SheetData {
  const rowData: object[] = [];
  const colorRequests: object[] = [];
  const boldRequests: object[] = [];

  // Header row
  const headerCells = ['Suite Name', 'Test Case ID', 'Test Case Title', 'Status'].map((h) =>
    sv(h),
  );
  rowData.push({ values: headerCells });

  const rgb = argbToSheetsRgb(INDEX_HEADER_COLOR);
  colorRequests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
      cell: {
        userEnteredFormat: {
          backgroundColor: rgb,
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });

  for (const suite of snapshot.suites) {
    for (const tc of suite.test_cases ?? []) {
      rowData.push({
        values: [
          sv(suite.name),
          sv(tc.display_id),
          sv(tc.title),
          emptyCell(),
        ],
      });
    }
  }

  return { sheetId, title: 'Summary', rowData, merges: [], colorRequests, boldRequests };
}

function buildSuiteSheet(
  suite: ExportSuite,
  sheetId: number,
  tabName: string,
  annotationMap?: Record<string, string>,
): SheetData {
  const rowData: object[] = [];
  const merges: object[] = [];
  const colorRequests: object[] = [];
  const boldRequests: object[] = [];

  const colorArgb = getSuiteColor(suite.color_index);
  const colorRgb = argbToSheetsRgb(colorArgb);
  const headerRgb = argbToSheetsRgb(HEADER_ROW_COLOR);

  const testCases = suite.test_cases ?? [];

  if (testCases.length === 0) {
    rowData.push({ values: [sv(suite.name)] });
    rowData.push({ values: [sv('No test cases in this suite.')] });
    return { sheetId, title: tabName, rowData, merges, colorRequests, boldRequests };
  }

  let currentRowIndex = 0;

  for (const tc of testCases) {
    const steps = tc.steps ?? [];
    const firstBugUrl = tc.bug_links?.[0]?.url ?? '';
    const automationLabel = getAutomationLabel(tc.automation_status);

    // Title row
    const titleCells = [
      sv(`${tc.title} ${tc.display_id}`),
      sv(''), // merged with A
      sv(automationLabel),
      ...Array(COLUMNS.length - 3).fill(emptyCell()),
    ];
    rowData.push({ values: titleCells });

    // Merge A–B on title row
    merges.push({
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: currentRowIndex,
          endRowIndex: currentRowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        mergeType: 'MERGE_ALL',
      },
    });

    // Color and bold entire title row
    colorRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: currentRowIndex,
          endRowIndex: currentRowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: COLUMNS.length,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: colorRgb,
            textFormat: { bold: true },
            wrapStrategy: 'WRAP',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy)',
      },
    });

    currentRowIndex++;

    // Header row
    const headerCells = COLUMNS.map((col) => sv(col.header));
    rowData.push({ values: headerCells });

    colorRequests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: currentRowIndex,
          endRowIndex: currentRowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: COLUMNS.length,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerRgb,
            textFormat: { bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    currentRowIndex++;

    // Step rows
    const stepStartRow = currentRowIndex;

    if (steps.length === 0) {
      rowData.push({
        values: [
          sv(tc.display_id),
          sv(tc.description ?? ''),
          sv(tc.precondition ?? ''),
          emptyCell(),
          emptyCell(),
          emptyCell(),
          emptyCell(),
          emptyCell(),
          sv(automationLabel),
          emptyCell(), // No step id available for no-step rows
          sv(firstBugUrl),
        ],
      });
      currentRowIndex++;
    } else {
      steps.forEach((step: ExportStep) => {
        rowData.push({
          values: [
            sv(tc.display_id),
            sv(tc.description ?? ''),
            sv(tc.precondition ?? ''),
            numV(step.step_number),
            sv(step.description ?? ''),
            sv(step.test_data ?? ''),
            sv(step.expected_result ?? ''),
            emptyCell(), // Pass/Fail blank (GAP-04)
            sv(automationLabel), // Added to code (GAP-02)
            sv(annotationMap?.[step.id] ?? ''), // Comments (HIGH-03)
            sv(firstBugUrl),
          ],
        });
        currentRowIndex++;
      });

      // Vertical merge on A, B, C for multi-step test cases
      if (steps.length > 1) {
        for (const colIdx of [0, 1, 2]) {
          merges.push({
            mergeCells: {
              range: {
                sheetId,
                startRowIndex: stepStartRow,
                endRowIndex: currentRowIndex,
                startColumnIndex: colIdx,
                endColumnIndex: colIdx + 1,
              },
              mergeType: 'MERGE_ALL',
            },
          });
        }
      }

      // Wrap strategy for data rows
      colorRequests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: stepStartRow,
            endRowIndex: currentRowIndex,
            startColumnIndex: 0,
            endColumnIndex: COLUMNS.length,
          },
          cell: {
            userEnteredFormat: {
              wrapStrategy: 'WRAP',
              verticalAlignment: 'TOP',
            },
          },
          fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
        },
      });
    }

    // Blank separator row
    rowData.push({ values: COLUMNS.map(() => emptyCell()) });
    currentRowIndex++;
  }

  return { sheetId, title: tabName, rowData, merges, colorRequests, boldRequests };
}

/**
 * Build a Google Spreadsheet from an export snapshot.
 * Returns the spreadsheet URL.
 *
 * @param accessToken - Valid Google OAuth2 access token
 * @param title - Spreadsheet title
 * @param snapshot - Export data snapshot
 */
export async function buildGoogleSheets(
  accessToken: string,
  title: string,
  snapshot: ExportSnapshot,
): Promise<string> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const sheets = google.sheets({ version: 'v4', auth });

  // Step 1: Create the spreadsheet with a placeholder title
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId!;

  // Step 2: Prepare sheet data
  const tabNames = deduplicateTabNames(['Summary', ...snapshot.suites.map((s) => s.name)]);
  const summaryTabName = tabNames[0];
  const suiteTabNames = tabNames.slice(1);

  const allSheetData: SheetData[] = [];

  // Summary sheet (ID 0, the default sheet created with the spreadsheet)
  allSheetData.push(buildIndexSheet(snapshot, 0));

  // Suite sheets
  for (let i = 0; i < snapshot.suites.length; i++) {
    allSheetData.push(buildSuiteSheet(snapshot.suites[i], i + 1, suiteTabNames[i], snapshot.annotationMap));
  }

  // Step 3: Add sheets (skip the default sheet for summary, just rename it)
  const addSheetRequests: object[] = [
    // Rename the default sheet (id=0) to Summary
    {
      updateSheetProperties: {
        properties: { sheetId: 0, title: summaryTabName },
        fields: 'title',
      },
    },
  ];

  // Add one sheet per suite
  for (let i = 0; i < snapshot.suites.length; i++) {
    addSheetRequests.push({
      addSheet: {
        properties: {
          sheetId: i + 1,
          title: suiteTabNames[i],
          index: i + 1,
        },
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: addSheetRequests },
  });

  // Step 4: Write cell data per sheet
  const valueRanges = allSheetData
    .filter((sd) => sd.rowData.length > 0)
    .map((sd) => {
      const escapedTitle = sd.title.replace(/'/g, "''");
      return {
        range: `'${escapedTitle}'!A1`,
        values: sd.rowData.map((row: object) =>
          ((row as { values: Array<{ userEnteredValue: { stringValue?: string; numberValue?: number } }> }).values ?? []).map((cell) => {
            const v = cell.userEnteredValue;
            if (v.numberValue !== undefined) return v.numberValue;
            return v.stringValue ?? '';
          }),
        ),
      };
    });

  if (valueRanges.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: valueRanges,
      },
    });
  }

  // Step 5: Apply formatting — merges, colors, column widths
  const formatRequests: object[] = [];

  // Column width requests per sheet
  for (const sd of allSheetData) {
    COLUMNS.forEach((col, i) => {
      formatRequests.push({
        updateDimensionProperties: {
          range: {
            sheetId: sd.sheetId,
            dimension: 'COLUMNS',
            startIndex: i,
            endIndex: i + 1,
          },
          properties: { pixelSize: col.width },
          fields: 'pixelSize',
        },
      });
    });
  }

  // Merge and color requests per sheet
  for (const sd of allSheetData) {
    for (const m of sd.merges) {
      formatRequests.push(m);
    }
    for (const c of sd.colorRequests) {
      formatRequests.push(c);
    }
    for (const b of sd.boldRequests) {
      formatRequests.push(b);
    }
  }

  if (formatRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}
