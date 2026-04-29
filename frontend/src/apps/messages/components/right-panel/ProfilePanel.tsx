import { HiOutlineClock, HiOutlineUserGroup, HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import type { ProfilePreview } from "../../types";

type ProfilePanelProps = {
  selectedProfile: ProfilePreview | null;
  avatarTones: string[];
  onStartDirectMessage?: () => void;
};

export default function ProfilePanel({ selectedProfile, avatarTones, onStartDirectMessage }: ProfilePanelProps) {
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm ${
              avatarTones[Math.abs((selectedProfile?.id ?? "profile").charCodeAt(0)) % avatarTones.length]
            }`}
          >
            {selectedProfile?.name.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">{selectedProfile?.name ?? "Unknown"}</p>
            <p className="text-[11px] text-slate-400">{selectedProfile?.role ?? "Member"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-slate-400">Status</p>
        <p className="mt-1 inline-flex items-center gap-2 text-slate-100">
          <span
            className={`h-2 w-2 rounded-full ${
              selectedProfile?.status === "online"
                ? "bg-emerald-400"
                : selectedProfile?.status === "away"
                  ? "bg-amber-400"
                  : "bg-slate-500"
            }`}
          />
          {selectedProfile?.status ?? "offline"}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">Last seen {selectedProfile?.lastSeen ?? "recently"}</p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-slate-400">Quick actions</p>
        <div className="mt-2 flex flex-col gap-1.5">
          <button
            onClick={onStartDirectMessage}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 hover:bg-white/10"
          >
            <HiOutlineChatBubbleLeftRight className="h-3.5 w-3.5" />
            Start direct message
          </button>
          <button className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 hover:bg-white/10">
            <HiOutlineUserGroup className="h-3.5 w-3.5" />
            Add to group
          </button>
          <button className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-left text-slate-100 hover:bg-white/10">
            <HiOutlineClock className="h-3.5 w-3.5" />
            View activity
          </button>
        </div>
      </div>
    </div>
  );
}
