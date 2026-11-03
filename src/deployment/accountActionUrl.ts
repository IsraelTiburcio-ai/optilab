/** Auth email action links follow the active Pages root without changing HashRouter routes. */
export function accountActionUrl(baseUrl:string,origin:string) {
  return new URL(`${baseUrl}#/cuenta`,origin).href;
}
