import { HiOutlineArchiveBox, HiOutlineBuildingOffice2, HiOutlineFolder, HiOutlineHome, HiOutlineRectangleGroup, HiOutlineSquares2X2 } from 'react-icons/hi2';
import type { ContainerType } from '../../api/inventary';

export const containerTypes = {
  folder: { label: 'Folder', icon: HiOutlineFolder },
  box: { label: 'Box', icon: HiOutlineArchiveBox },
  home: { label: 'Home', icon: HiOutlineHome },
  building: { label: 'Building', icon: HiOutlineBuildingOffice2 },
  room: { label: 'Room', icon: HiOutlineSquares2X2 },
  shelf: { label: 'Shelf', icon: HiOutlineRectangleGroup },
} satisfies Record<ContainerType, { label: string; icon: typeof HiOutlineFolder }>;
