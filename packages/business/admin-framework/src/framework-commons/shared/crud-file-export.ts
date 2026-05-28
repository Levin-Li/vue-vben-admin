import type { CrudFieldConfig } from './types';

export interface BuildExcelXmlOptions<T extends Record<string, any>> {
  fields: CrudFieldConfig[];
  formatCellValue: (field: CrudFieldConfig, record: T) => any;
  getFieldHeader: (field: CrudFieldConfig) => any;
  records: T[];
  worksheetName?: string;
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
  records,
  worksheetName,
}: BuildExcelXmlOptions<T>) {
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
