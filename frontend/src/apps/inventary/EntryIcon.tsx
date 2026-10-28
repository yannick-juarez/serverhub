import type { InventoryEntry } from '../../api/inventary';
import { containerTypes } from './containerTypes';
import { itemTypes } from './itemTypes';

export default function EntryIcon({ entry, className = '' }: {
  entry: Pick<InventoryEntry, 'kind' | 'containerType' | 'itemType'>; className?: string;
}) {
  const Icon = entry.kind === 'container' ? containerTypes[entry.containerType ?? 'folder'].icon
    : itemTypes[entry.itemType ?? (entry.kind === 'document' ? 'document' : 'object')].icon;
  return <Icon aria-hidden="true" className={className} />;
}
