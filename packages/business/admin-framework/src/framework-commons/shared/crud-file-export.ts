import type { CrudFieldConfig } from './types';

export interface BuildExcelXmlOptions<T extends Record<string, any>> {
  fields: CrudFieldConfig[];
  formatCellValue: (field: CrudFieldConfig, record: T) => any;
  getFieldHeader: (field: CrudFieldConfig) => any;
  getFieldWidth?: (field: CrudFieldConfig) => number | undefined;
  records: T[];
  worksheetName?: string;
}

const EXCEL_COLUMN_WIDTH_MAX = 255;
const EXCEL_COLUMN_WIDTH_MIN = 1;
const SPREADSHEET_ML_POINTS_PER_EXCEL_CHARACTER = 5.25;

export function getSpreadsheetMlColumnWidth(value: unknown) {
  const width = Number(value);

  if (
    !Number.isFinite(width) ||
    width < EXCEL_COLUMN_WIDTH_MIN ||
    width > EXCEL_COLUMN_WIDTH_MAX
  ) {
    return undefined;
  }

  return Number((width * SPREADSHEET_ML_POINTS_PER_EXCEL_CHARACTER).toFixed(2));
}

export function escapeExcelXmlValue(value: any) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function getSafeWorksheetName(name?: string) {
  const safeName = String(name || 'Sheet1')
    .replaceAll(/[\\/?*[\]:]/g, '')
    .slice(0, 31)
    .trim();

  return safeName || 'Sheet1';
}

export function buildExcelXml<T extends Record<string, any>>({
  fields,
  formatCellValue,
  getFieldHeader,
  getFieldWidth,
  records,
  worksheetName,
}: BuildExcelXmlOptions<T>) {
  const columnXml = fields
    .map((field) => {
      const width = getSpreadsheetMlColumnWidth(getFieldWidth?.(field));

      return width ? `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>` : '';
    })
    .join('');
  const headerXml = fields
    .map(
      (field) =>
        `<Cell><Data ss:Type="String">${escapeExcelXmlValue(
          getFieldHeader(field),
        )}</Data></Cell>`,
    )
    .join('');
  const rowXml = records
    .map((record) => {
      const cells = fields
        .map(
          (field) =>
            `<Cell><Data ss:Type="String">${escapeExcelXmlValue(
              formatCellValue(field, record),
            )}</Data></Cell>`,
        )
        .join('');

      return `<Row>${cells}</Row>`;
    })
    .join('');
  const sheetName = getSafeWorksheetName(worksheetName);

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${escapeExcelXmlValue(sheetName)}">
  <Table>
   ${columnXml}
   <Row>${headerXml}</Row>
   ${rowXml}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function downloadExcelXml(xml: string, fileName: string) {
  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
