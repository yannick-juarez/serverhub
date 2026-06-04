import { FaClock } from "react-icons/fa";
import type { AppManifest } from "../types";

export const app: AppManifest = {
  id: "tasks",
  to: "/tasks",
  routes: ["/tasks", "/cron"],
  icon: <FaClock className="h-4 w-4" />,
  label: "Tasks",
  title: "TASKS",
  menus: [],
  showInFooter: false,
  showInSideDock: true,
  color: {
    border: "border-orange-500/70",
    background: "bg-orange-500/40",
    hover: { border: "hover:border-orange-400/30", background: "hover:bg-orange-400/30" },
    idle: { border: "border-orange-500/20", background: "bg-orange-500/10" },
  },
  requiresAuth: true,
  order: 45,
};
