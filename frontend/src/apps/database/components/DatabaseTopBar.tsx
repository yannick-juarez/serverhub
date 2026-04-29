import { BiColumns } from "react-icons/bi";
import { FaCode, FaDatabase, FaFolder, FaListUl, FaPlusCircle, FaSearch } from "react-icons/fa";
import type { LeftPanelTab, SelectedTable, ViewPanelContent } from "./types";
import IconButton from "../../../ui/IconButton";

type DatabaseTopBarProps = {
  leftPanelTab: LeftPanelTab;
  hasSelectedDatabase: boolean;
  selectedTable: SelectedTable | null;
  showSqlPanel: boolean;
  showViewPanel: boolean;
  viewPanelContent: ViewPanelContent;
  onLeftPanelTabChange: (tab: LeftPanelTab) => void;
  onToggleSqlPanel: () => void;
  onToggleViewPanel: (content: Exclude<ViewPanelContent, null>) => void;
};

const DatabaseTopBar = ({
  leftPanelTab,
  hasSelectedDatabase,
  selectedTable,
  showSqlPanel,
  showViewPanel,
  viewPanelContent,
  onLeftPanelTabChange,
  onToggleSqlPanel,
  onToggleViewPanel,
}: DatabaseTopBarProps) => {
  return (
    <div className="flex flex-col gap-4 border-b border-white/10 bg-black/20 px-6 py-2 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <IconButton
          icon={<FaDatabase />}
          active={leftPanelTab === "sources"}
          onClick={() => onLeftPanelTabChange("sources")}
          activeClassName="border-emerald-300/60 bg-emerald-300/30 text-emerald-100"
          inactiveClassName="border-white/10 bg-emerald-300/10 text-slate-200 hover:bg-white/10"
          className="text-[10px] uppercase"
          aria-label="Sources"
          title="Source browser"
        />
        {hasSelectedDatabase ? (
          <IconButton
            icon={<FaListUl />}
            active={leftPanelTab === "tables"}
            onClick={() => onLeftPanelTabChange("tables")}
            activeClassName="border-violet-300/60 bg-violet-300/30 text-violet-100"
            inactiveClassName="border-white/10 bg-violet-300/10 text-slate-200 hover:bg-white/10"
            className="text-[10px] uppercase"
            aria-label="Toggle schema panel"
            title="Toggle schema panel"
          />
        ) : null}
        <IconButton
          icon={<FaFolder />}
          active={leftPanelTab === "requests"}
          onClick={() => onLeftPanelTabChange("requests")}
          activeClassName="border-amber-300/60 bg-amber-300/30 text-amber-100"
          inactiveClassName="border-white/10 bg-amber-300/10 text-slate-200 hover:bg-white/10"
          className="text-[10px] uppercase"
          aria-label="Toggle Requests panel"
          title="Toggle Requests panel"
        />
      </div>
      <div className="flex items-center gap-2">
        {selectedTable && (
          <>
            <div className="h-6 w-px bg-white/10" />
            <IconButton
              icon={<FaCode />}
              active={showSqlPanel}
              onClick={onToggleSqlPanel}
              activeClassName="border-white/10 bg-white/10 text-white"
              inactiveClassName="border-white/10 bg-white/10 text-slate-200 hover:bg-white/10"
              className="text-[10px] uppercase"
              aria-label="Toggle SQL editor"
              title="Toggle SQL editor"
            />
            <IconButton
              icon={<BiColumns />}
              active={showViewPanel && viewPanelContent === "structure"}
              onClick={() => onToggleViewPanel("structure")}
              activeClassName="border-blue-300/60 bg-blue-300/30 text-blue-100"
              inactiveClassName="border-white/10 bg-blue-300/10 text-slate-200 hover:bg-white/10"
              className="text-[10px] uppercase"
              aria-label="Structure"
              title="Table structure"
            />
            <IconButton
              icon={<FaPlusCircle />}
              active={showViewPanel && viewPanelContent === "insert"}
              onClick={() => onToggleViewPanel("insert")}
              activeClassName="border-green-300/60 bg-green-300/30 text-green-100"
              inactiveClassName="border-white/10 bg-green-300/10 text-slate-200 hover:bg-white/10"
              className="text-[10px] uppercase"
              aria-label="Insert"
              title="Insert row"
            />
            <IconButton
              icon={<FaSearch />}
              active={showViewPanel && viewPanelContent === "search"}
              onClick={() => onToggleViewPanel("search")}
              activeClassName="border-amber-300/60 bg-amber-300/30 text-amber-100"
              inactiveClassName="border-white/10 bg-amber-300/10 text-slate-200 hover:bg-white/10"
              className="text-[10px] uppercase"
              aria-label="Search"
              title="Search & filter"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default DatabaseTopBar;
