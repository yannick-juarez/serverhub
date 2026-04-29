import { FaUserGroup } from "react-icons/fa6";
import {
  HiOutlineInformationCircle,
  HiOutlineHashtag,
  HiOutlinePencilSquare,
  HiOutlineXMark,
} from "react-icons/hi2";
import type { ChatMode, ProfilePreview, RightPanelTab, WorkspaceMember } from "../types";
import ConversationDetailsPanel from "./right-panel/ConversationDetailsPanel";
import ChannelEditPanel from "./right-panel/ChannelEditPanel";
import MembersPanel from "./right-panel/MembersPanel";
import ProfilePanel from "./right-panel/ProfilePanel";

type RightPanelProps = {
  show: boolean;
  tab: RightPanelTab;
  onClose: () => void;
  activeMode: ChatMode;
  activeTitle: string;
  participantCount: number;
  activeUnread: number;
  members: WorkspaceMember[];
  selectedProfile: ProfilePreview | null;
  avatarTones: string[];
  onOpenProfile: (profile: ProfilePreview) => void;
  onStartDirectMessage: () => void;
  channelName: string;
  channelDescription: string;
  onChannelNameChange: (value: string) => void;
  onChannelDescriptionChange: (value: string) => void;
  onSaveChannel: () => void;
  onCancelChannelEdit: () => void;
};

export default function RightPanel({
  show,
  tab,
  onClose,
  activeMode,
  activeTitle,
  participantCount,
  activeUnread,
  members,
  selectedProfile,
  avatarTones,
  onOpenProfile,
  onStartDirectMessage,
  channelName,
  channelDescription,
  onChannelNameChange,
  onChannelDescriptionChange,
  onSaveChannel,
  onCancelChannelEdit,
}: RightPanelProps) {
  if (!show) return null;

  return (
    <aside className="hidden w-[280px] shrink-0 border-l border-white/10 bg-black/20 p-3 lg:block">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {tab === "members" ? (
            <FaUserGroup className="h-4 w-4 text-slate-300" />
          ) : tab === "channel-edit" ? (
            <HiOutlineHashtag className="h-4 w-4 text-slate-300" />
          ) : tab === "profile" ? (
            <HiOutlinePencilSquare className="h-4 w-4 text-slate-300" />
          ) : (
            <HiOutlineInformationCircle className="h-4 w-4 text-slate-300" />
          )}
          <h3 className="text-sm font-semibold text-slate-100">
            {tab === "members"
              ? "Members"
              : tab === "profile"
                ? "Profile"
                : tab === "channel-edit"
                  ? "Edit Channel"
                  : "Conversation Details"}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          title="Close details"
        >
          <HiOutlineXMark className="h-4 w-4" />
        </button>
      </div>

      {tab === "conversation" ? (
        <ConversationDetailsPanel
          activeMode={activeMode}
          activeTitle={activeTitle}
          participantCount={participantCount}
          activeUnread={activeUnread}
        />
      ) : null}

      {tab === "members" ? (
        <MembersPanel members={members} avatarTones={avatarTones} onOpenProfile={onOpenProfile} />
      ) : null}

      {tab === "profile" ? (
        <ProfilePanel
          selectedProfile={selectedProfile}
          avatarTones={avatarTones}
          onStartDirectMessage={onStartDirectMessage}
        />
      ) : null}

      {tab === "channel-edit" ? (
        <ChannelEditPanel
          channelName={channelName}
          channelDescription={channelDescription}
          onNameChange={onChannelNameChange}
          onDescriptionChange={onChannelDescriptionChange}
          onSave={onSaveChannel}
          onCancel={onCancelChannelEdit}
        />
      ) : null}
    </aside>
  );
}
