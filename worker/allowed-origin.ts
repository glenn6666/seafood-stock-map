/** Explicit origins only. Never allow wildcard or suffix matching. */
export function isAllowedOrigin(origin:string|null,configured:string):boolean{
 return !!origin&&configured.split(",").some(value=>value.trim()===origin);
}
