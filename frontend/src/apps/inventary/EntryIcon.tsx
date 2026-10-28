import { HiOutlineArchiveBox, HiOutlineDocumentText } from 'react-icons/hi2';
import type { InventoryEntry } from '../../api/inventary';
import { containerTypes } from './containerTypes';

export default function EntryIcon({ entry, className = '' }: {
  entry: Pick<InventoryEntry, 'kind' | 'containerType'>; className?: string;
}) {
  const Icon = entry.kind === 'container' ? containerTypes[entry.containerType ?? 'folder'].icon
    : entry.kind === 'document' ? HiOutlineDocumentText : HiOutlineArchiveBox;
  return <Icon aria-hidden="true" className={className} />;
}
