/** 仅对服务端生成的报表菜单补充结构父菜单权限。 */
export function isGeneratedReportMenuPath(path: string) {
  return /^\/clob\/V1\/ReportView\/[0-9a-f]{32}$/.test(path);
}
