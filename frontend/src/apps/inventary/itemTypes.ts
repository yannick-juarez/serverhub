import { HiOutlineArchiveBox, HiOutlineBookOpen, HiOutlineCube, HiOutlineDocumentText, HiOutlineWrenchScrewdriver } from 'react-icons/hi2';
import { TbHanger } from 'react-icons/tb';
import type { ItemType } from '../../api/inventary';

export const itemTypes = {
  object: { label: 'Object', icon: HiOutlineArchiveBox },
  product: { label: 'Product', icon: HiOutlineCube },
  document: { label: 'Document', icon: HiOutlineDocumentText },
  clothing: { label: 'Clothing', icon: TbHanger },
  book: { label: 'Book', icon: HiOutlineBookOpen },
  equipment: { label: 'Equipment', icon: HiOutlineWrenchScrewdriver },
} satisfies Record<ItemType, { label: string; icon: typeof HiOutlineArchiveBox }>;
