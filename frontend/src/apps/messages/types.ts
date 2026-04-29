export interface Channel {
  id: string;
  name: string;
  description: string;
  unread?: number;
}

export interface Proposal {
  title: string;
  items: string[];
  state?: "incoming" | "waiting";
  waitingFor?: string;
}

export interface ChatMessage {
  id: string;
  author: string;
  authorUsername?: string;
  authorUserId?: string;
  role: string;
  time: string;
  content: string;
  ownership: "mine" | "their";
  system?: boolean;
  proposal?: Proposal;
}

export interface DirectMessage {
  id: string;
  name: string;
  username?: string;
  userId: string;
  status: "online" | "away" | "offline";
  unread?: number;
}

export interface GroupConversation {
  id: string;
  name: string;
  description?: string;
  members: number;
  memberIds: string[];
  unread?: number;
}

export interface WorkspaceMember {
  id: string;
  username: string;
  name: string;
  role: string;
  status: "online" | "away" | "offline";
  lastSeen: string;
}

export interface WorkspaceSample {
  id: string;
  name: string;
  description?: string;
  channels: Channel[];
  directMessages: DirectMessage[];
  channelMessages: Record<string, ChatMessage[] | undefined>;
}

export type ChatMode = "channel" | "direct" | "group";

export type ContextTarget =
  | { kind: "channel"; id: string }
  | { kind: "direct"; id: string }
  | { kind: "group"; id: string };

export type ContextMenuState = {
  x: number;
  y: number;
  target: ContextTarget;
} | null;

export type RightPanelTab = "conversation" | "members" | "profile" | "channel-edit";

export type ProfilePreview = {
  id: string;
  name: string;
  role: string;
  status: "online" | "away" | "offline";
  lastSeen: string;
};
