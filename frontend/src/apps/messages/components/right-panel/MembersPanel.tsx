import type { ProfilePreview, WorkspaceMember } from "../../types";

type MembersPanelProps = {
  members: WorkspaceMember[];
  avatarTones: string[];
  onOpenProfile: (profile: ProfilePreview) => void;
};

export default function MembersPanel({ members, avatarTones, onOpenProfile }: MembersPanelProps) {
  return (
    <div className="space-y-2 text-xs">
      {members.map((member) => (
        <button
          key={`panel-${member.id}`}
          onClick={() =>
            onOpenProfile({
              id: member.id,
              name: member.name,
              role: member.role,
              status: member.status,
              lastSeen: member.lastSeen,
            })
          }
          className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left transition hover:bg-white/10"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                avatarTones[Math.abs(member.id.charCodeAt(0)) % avatarTones.length]
              }`}
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-100">{member.name}</p>
              <p className="truncate text-[11px] text-slate-500">{member.role}</p>
            </div>
          </div>
          <span
            className={`h-2 w-2 rounded-full ${
              member.status === "online"
                ? "bg-emerald-400"
                : member.status === "away"
                  ? "bg-amber-400"
                  : "bg-slate-500"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
