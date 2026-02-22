export interface DataRow {
  [key: string]: string | number | boolean | null;
}

export interface SpreadsheetData {
  headers: string[];
  rows: DataRow[];
  fileName: string;
}
