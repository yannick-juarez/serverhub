import { apiRequest } from "./http";

export type WorkspaceApiUser = {
  user_id: string;
  workspace_id: string;
  username: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkspaceApiChannel = {
  channel_id: string;
  workspace_id: string;
  name: string;
  description: string;
  unread: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceApiDirectConversation = {
  direct_id: string;
  workspace_id: string;
  participant_user_ids: [string, string];
  participant_usernames: [string, string];
  other_user_id: string;
  other_username: string;
  unread: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceApiGroupConversation = {
  group_id: string;
  workspace_id: string;
  name: string;
  description: string;
  member_user_ids: string[];
  member_usernames: string[];
  unread: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceApiMessage = {
  message_id: string;
  workspace_id: string;
  conversation_type: "channel" | "direct" | "group";
  conversation_id: string;
  author_user_id: string;
  author_username: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMessagingState = {
  workspace_id: string;
  channels: WorkspaceApiChannel[];
  direct_conversations: WorkspaceApiDirectConversation[];
  group_conversations: WorkspaceApiGroupConversation[];
  messages_by_conversation: Record<string, WorkspaceApiMessage[]>;
  users: WorkspaceApiUser[];
};

export async function fetchWorkspaceMessagingState(workspaceId: string): Promise<WorkspaceMessagingState> {
  return apiRequest<WorkspaceMessagingState>(`/messages/workspaces/${encodeURIComponent(workspaceId)}/state`);
}

export async function createWorkspaceChannel(
  workspaceId: string,
  payload: { name: string; description: string },
): Promise<WorkspaceApiChannel> {
  return apiRequest<WorkspaceApiChannel>(`/messages/workspaces/${encodeURIComponent(workspaceId)}/channels`, {
    method: "POST",
    body: payload,
  });
}

export async function updateWorkspaceChannel(
  workspaceId: string,
  channelId: string,
  payload: { name: string; description: string },
): Promise<WorkspaceApiChannel> {
  return apiRequest<WorkspaceApiChannel>(
    `/messages/workspaces/${encodeURIComponent(workspaceId)}/channels/${encodeURIComponent(channelId)}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function deleteWorkspaceChannel(workspaceId: string, channelId: string): Promise<void> {
  await apiRequest<void>(`/messages/workspaces/${encodeURIComponent(workspaceId)}/channels/${encodeURIComponent(channelId)}`, {
    method: "DELETE",
  });
}

export async function createWorkspaceMessage(
  workspaceId: string,
  channelId: string,
  payload: { content: string },
): Promise<WorkspaceApiMessage> {
  return apiRequest<WorkspaceApiMessage>(
    `/messages/workspaces/${encodeURIComponent(workspaceId)}/channels/${encodeURIComponent(channelId)}/messages`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function createWorkspaceDirectConversation(
  workspaceId: string,
  payload: { participant_user_id: string },
): Promise<WorkspaceApiDirectConversation> {
  return apiRequest<WorkspaceApiDirectConversation>(
    `/messages/workspaces/${encodeURIComponent(workspaceId)}/direct-conversations`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function deleteWorkspaceDirectConversation(workspaceId: string, directId: string): Promise<void> {
  await apiRequest<void>(
    `/messages/workspaces/${encodeURIComponent(workspaceId)}/direct-conversations/${encodeURIComponent(directId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function createWorkspaceGroupConversation(
  workspaceId: string,
  payload: { name: string; description: string; member_user_ids: string[] },
): Promise<WorkspaceApiGroupConversation> {
  return apiRequest<WorkspaceApiGroupConversation>(`/messages/workspaces/${encodeURIComponent(workspaceId)}/groups`, {
    method: "POST",
    body: payload,
  });
}

export async function updateWorkspaceGroupConversation(
  workspaceId: string,
  groupId: string,
  payload: { name: string; description: string },
): Promise<WorkspaceApiGroupConversation> {
  return apiRequest<WorkspaceApiGroupConversation>(
    `/messages/workspaces/${encodeURIComponent(workspaceId)}/groups/${encodeURIComponent(groupId)}`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function deleteWorkspaceGroupConversation(workspaceId: string, groupId: string): Promise<void> {
  await apiRequest<void>(`/messages/workspaces/${encodeURIComponent(workspaceId)}/groups/${encodeURIComponent(groupId)}`, {
    method: "DELETE",
  });
}

export async function createWorkspaceConversationMessage(
  workspaceId: string,
  conversationType: "channel" | "direct" | "group",
  conversationId: string,
  payload: { content: string },
): Promise<WorkspaceApiMessage> {
  return apiRequest<WorkspaceApiMessage>(
    `/messages/workspaces/${encodeURIComponent(workspaceId)}/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function markWorkspaceConversationRead(
  workspaceId: string,
  conversationType: "channel" | "direct" | "group",
  conversationId: string,
): Promise<void> {
  await apiRequest<void>(
    `/messages/workspaces/${encodeURIComponent(workspaceId)}/conversations/${encodeURIComponent(conversationType)}/${encodeURIComponent(conversationId)}/read`,
    {
      method: "POST",
    },
  );
}
