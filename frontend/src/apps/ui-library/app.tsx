import { HiOutlineSwatch } from "react-icons/hi2";
import type { AppManifest } from "../types";

export const app: AppManifest = {
  id: "ui-library",
  to: "/ui-library",
  icon: <HiOutlineSwatch className="h-4 w-4" />,
  label: "UI Library",
  title: "UI LIBRARY",
  menus: [],
  showInFooter: false,
  showInSideDock: true,
  color: {
    border: "border-violet-500/70",
    background: "bg-violet-500/40",
    hover: { border: "hover:border-violet-400/30", background: "hover:bg-violet-400/30" },
    idle: { border: "border-violet-500/20", background: "bg-violet-500/10" },
  },
  requiresAuth: true,
  order: 110,
};
