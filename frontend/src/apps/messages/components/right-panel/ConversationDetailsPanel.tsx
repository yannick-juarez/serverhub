import {
  HiOutlineArrowDownTray,
  HiOutlineBellSlash,
  HiOutlineBookmark,
} from "react-icons/hi2";
import type { ChatMode } from "../../types";

type ConversationDetailsPanelProps = {
  activeMode: ChatMode;
  activeTitle: string;
  participantCount: number;
  activeUnread: number;
};

export default function ConversationDetailsPanel({
  activeMode,
  activeTitle,
  participantCount,
  activeUnread,
}: ConversationDetailsPanelProps) {
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-slate-400">Type</p>
        <p className="mt-1 font-semibold capitalize text-slate-100">{activeMode}</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-slate-400">Title</p>
        <p className="mt-1 font-semibold text-slate-100">{activeTitle}</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-slate-400">Participants</p>
        <p className="mt-1 text-slate-100">{participantCount} members</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-slate-400">Unread</p>
        <p className="mt-1 text-slate-100">{activeUnread}</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-slate-400">Quick actions</p>
        <div className="mt-2 flex flex-col gap-1.5">
          <button className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 hover:bg-white/10">
            <HiOutlineBookmark className="h-3.5 w-3.5" />
            Pin conversation
          </button>
          <button className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 hover:bg-white/10">
            <HiOutlineBellSlash className="h-3.5 w-3.5" />
            Mute notifications
          </button>
          <button className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 hover:bg-white/10">
            <HiOutlineArrowDownTray className="h-3.5 w-3.5" />
            Export thread
          </button>
        </div>
      </div>
    </div>
  );
}
