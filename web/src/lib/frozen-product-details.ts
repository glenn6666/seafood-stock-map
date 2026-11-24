import details from './frozen-product-details.json';
import {displayProductName} from './product-display';

type Details = {spec: string; description: string};
const confirmed: Record<string, Details> = details;

/** Photo-confirmed display copy. Inventory specifications remain authoritative. */
export function frozenProductDetails(item: {name: string; spec?: string}): Details {
  const detail = confirmed[displayProductName(item.name)];
  const inventorySpec = item.spec?.trim() || '';
  const spec = inventorySpec === '附禮盒' && detail?.spec
    ? detail.spec.includes(inventorySpec) ? detail.spec : `${detail.spec}・${inventorySpec}`
    : inventorySpec || detail?.spec || '';
  return {spec, description: detail?.description || ''};
}
