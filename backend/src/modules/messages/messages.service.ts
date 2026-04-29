import { randomUUID } from 'crypto';
import {
  createUser,
  listUsers,
  type PublicUser,
} from '../users/users.service';
import {
  readStorage,
  updateStorage,
  type StoredConversationReadState,
  type StoredDirectConversation,
  type StoredGroupConversation,
  type StoredUser,
  type StoredWorkspaceChannel,
  type StoredWorkspaceMessage,
} from '../storage/storage.service';

export type ConversationType = 'channel' | 'direct' | 'group';

export type WorkspaceChannel = {
  channel_id: string;
  workspace_id: string;
  name: string;
  description: string;
  unread: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceDirectConversation = {
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

export type WorkspaceGroupConversation = {
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

export type WorkspaceMessage = {
  message_id: string;
  workspace_id: string;
  conversation_type: ConversationType;
  conversation_id: string;
  author_user_id: string;
  author_username: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMessagingState = {
  workspace_id: string;
  channels: WorkspaceChannel[];
  direct_conversations: WorkspaceDirectConversation[];
  group_conversations: WorkspaceGroupConversation[];
  messages_by_conversation: Record<string, WorkspaceMessage[]>;
  users: PublicUser[];
};

function normalizeChannelName(input: string): string {
  return input.trim().toLowerCase().replace(/^#/, '');
}

function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

function conversationKey(type: ConversationType, id: string): string {
  return `${type}:${id}`;
}

function sortUserIds(userIds: string[]): string[] {
  return [...new Set(userIds)].sort((left, right) => left.localeCompare(right));
}

function toPublicMessage(item: StoredWorkspaceMessage, author: StoredUser | undefined): WorkspaceMessage {
  return {
    ...item,
    author_username: author?.username ?? 'unknown',
  };
}

function resolveWorkspaceActor(workspaceUsers: StoredUser[], actorUsername: string): StoredUser | undefined {
  const normalizedActor = normalizeUsername(actorUsername);
  if (!normalizedActor) {
    return workspaceUsers[0];
  }

  return workspaceUsers.find((user) => normalizeUsername(user.username) === normalizedActor)
    ?? workspaceUsers[0];
}

function ensureReadState(
  readState: StoredConversationReadState[],
  participantUserIds: string[],
): StoredConversationReadState[] {
  const stateByUser = new Map(readState.map((entry) => [entry.user_id, entry]));
  return participantUserIds.map((userId) => stateByUser.get(userId) ?? { user_id: userId, last_read_at: null });
}

function setLastReadAt(
  readState: StoredConversationReadState[],
  participantUserIds: string[],
  userId: string,
  lastReadAt: string,
): StoredConversationReadState[] {
  return ensureReadState(readState, participantUserIds).map((entry) => (
    entry.user_id === userId
      ? { ...entry, last_read_at: lastReadAt }
      : entry
  ));
}

function getUnreadCount(
  messages: StoredWorkspaceMessage[],
  actorUserId: string | undefined,
  readState: StoredConversationReadState[],
): number {
  if (!actorUserId) {
    return 0;
  }

  const lastReadAt = readState.find((entry) => entry.user_id === actorUserId)?.last_read_at;
  const lastReadTime = lastReadAt ? Date.parse(lastReadAt) : Number.NEGATIVE_INFINITY;

  return messages.filter((message) => (
    message.author_user_id !== actorUserId
    && Date.parse(message.created_at) > lastReadTime
  )).length;
}

function getWorkspaceConversationMessages(
  messages: StoredWorkspaceMessage[],
  workspaceId: string,
  type: ConversationType,
  id: string,
): StoredWorkspaceMessage[] {
  return messages
    .filter((message) => (
      message.workspace_id === workspaceId
      && message.conversation_type === type
      && message.conversation_id === id
    ))
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
}

function toPublicChannel(
  item: StoredWorkspaceChannel,
  actorUserId: string | undefined,
  conversationMessages: StoredWorkspaceMessage[],
  workspaceUserIds: string[],
): WorkspaceChannel {
  const readState = ensureReadState(item.read_state, workspaceUserIds);
  return {
    channel_id: item.channel_id,
    workspace_id: item.workspace_id,
    name: item.name,
    description: item.description,
    unread: getUnreadCount(conversationMessages, actorUserId, readState),
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function toPublicDirectConversation(
  item: StoredDirectConversation,
  workspaceUsers: StoredUser[],
  actor: StoredUser | undefined,
  conversationMessages: StoredWorkspaceMessage[],
): WorkspaceDirectConversation | null {
  const participants = item.participant_user_ids
    .map((userId) => workspaceUsers.find((user) => user.user_id === userId))
    .filter((user): user is StoredUser => Boolean(user));

  if (participants.length !== 2) {
    return null;
  }

  const actorUser = actor && participants.some((user) => user.user_id === actor.user_id)
    ? actor
    : participants[0];
  const otherUser = participants.find((user) => user.user_id !== actorUser.user_id) ?? participants[0];
  const readState = ensureReadState(item.read_state, item.participant_user_ids);

  return {
    direct_id: item.direct_id,
    workspace_id: item.workspace_id,
    participant_user_ids: [participants[0].user_id, participants[1].user_id],
    participant_usernames: [participants[0].username, participants[1].username],
    other_user_id: otherUser.user_id,
    other_username: otherUser.username,
    unread: getUnreadCount(conversationMessages, actorUser.user_id, readState),
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function toPublicGroupConversation(
  item: StoredGroupConversation,
  workspaceUsers: StoredUser[],
  actorUserId: string | undefined,
  conversationMessages: StoredWorkspaceMessage[],
): WorkspaceGroupConversation {
  const memberUsernames = item.member_user_ids.map((userId) => {
    const member = workspaceUsers.find((user) => user.user_id === userId);
    return member?.username ?? 'unknown';
  });
  const readState = ensureReadState(item.read_state, item.member_user_ids);

  return {
    group_id: item.group_id,
    workspace_id: item.workspace_id,
    name: item.name,
    description: item.description,
    member_user_ids: item.member_user_ids,
    member_usernames: memberUsernames,
    unread: getUnreadCount(conversationMessages, actorUserId, readState),
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function assertActor(actor: StoredUser | undefined): StoredUser {
  if (!actor) {
    throw new Error('actor user not found');
  }

  return actor;
}

export async function getWorkspaceMessagingState(
  workspaceId: string,
  actorUsername = '',
): Promise<WorkspaceMessagingState> {
  const storage = await readStorage();
  const workspaceUsers = storage.users.filter((user) => user.workspace_id === workspaceId);
  const actor = resolveWorkspaceActor(workspaceUsers, actorUsername);
  const workspaceUserIds = workspaceUsers.map((user) => user.user_id);

  const channels = storage.messages.channels
    .filter((channel) => channel.workspace_id === workspaceId)
    .map((channel) => toPublicChannel(
      channel,
      actor?.user_id,
      getWorkspaceConversationMessages(storage.messages.items, workspaceId, 'channel', channel.channel_id),
      workspaceUserIds,
    ));

  const directs = storage.messages.directs
    .filter((direct) => direct.workspace_id === workspaceId)
    .filter((direct) => !actor || direct.participant_user_ids.includes(actor.user_id))
    .map((direct) => toPublicDirectConversation(
      direct,
      workspaceUsers,
      actor,
      getWorkspaceConversationMessages(storage.messages.items, workspaceId, 'direct', direct.direct_id),
    ))
    .filter((direct): direct is WorkspaceDirectConversation => Boolean(direct));

  const groups = storage.messages.groups
    .filter((group) => group.workspace_id === workspaceId)
    .filter((group) => !actor || group.member_user_ids.includes(actor.user_id))
    .map((group) => toPublicGroupConversation(
      group,
      workspaceUsers,
      actor?.user_id,
      getWorkspaceConversationMessages(storage.messages.items, workspaceId, 'group', group.group_id),
    ));

  const visibleConversationIds = new Set<string>([
    ...channels.map((channel) => conversationKey('channel', channel.channel_id)),
    ...directs.map((direct) => conversationKey('direct', direct.direct_id)),
    ...groups.map((group) => conversationKey('group', group.group_id)),
  ]);

  const messages = storage.messages.items.filter((item) => (
    item.workspace_id === workspaceId
    && visibleConversationIds.has(conversationKey(item.conversation_type, item.conversation_id))
  ));
  const messagesByConversation: Record<string, WorkspaceMessage[]> = {};

  visibleConversationIds.forEach((key) => {
    messagesByConversation[key] = [];
  });

  messages
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
    .forEach((message) => {
      const author = workspaceUsers.find((user) => user.user_id === message.author_user_id);
      const key = conversationKey(message.conversation_type, message.conversation_id);
      if (!messagesByConversation[key]) {
        messagesByConversation[key] = [];
      }
      messagesByConversation[key].push(toPublicMessage(message, author));
    });

  return {
    workspace_id: workspaceId,
    channels,
    direct_conversations: directs,
    group_conversations: groups,
    messages_by_conversation: messagesByConversation,
    users: await listUsers(workspaceId),
  };
}

export async function createWorkspaceChannel(
  workspaceId: string,
  name: string,
  description: string,
): Promise<WorkspaceChannel> {
  const normalizedName = normalizeChannelName(name);
  if (!normalizedName) {
    throw new Error('channel name is required');
  }

  let created: StoredWorkspaceChannel | null = null;
  let workspaceUsers: StoredUser[] = [];

  await updateStorage((current) => {
    workspaceUsers = current.users.filter((user) => user.workspace_id === workspaceId);
    const exists = current.messages.channels.some(
      (channel) => channel.workspace_id === workspaceId && normalizeChannelName(channel.name) === normalizedName,
    );

    if (exists) {
      throw new Error('channel already exists in workspace');
    }

    const now = new Date().toISOString();
    created = {
      channel_id: randomUUID(),
      workspace_id: workspaceId,
      name: normalizedName,
      description: description.trim(),
      read_state: workspaceUsers.map((user) => ({ user_id: user.user_id, last_read_at: null })),
      created_at: now,
      updated_at: now,
    };

    return {
      ...current,
      messages: {
        ...current.messages,
        channels: [created, ...current.messages.channels],
      },
    };
  });

  if (!created) {
    throw new Error('unable to create channel');
  }

  return toPublicChannel(created, undefined, [], workspaceUsers.map((user) => user.user_id));
}

export async function updateWorkspaceChannel(
  workspaceId: string,
  channelId: string,
  name: string,
  description: string,
): Promise<WorkspaceChannel> {
  const normalizedName = normalizeChannelName(name);
  if (!normalizedName) {
    throw new Error('channel name is required');
  }

  let updated: StoredWorkspaceChannel | null = null;
  let workspaceUsers: StoredUser[] = [];

  await updateStorage((current) => {
    workspaceUsers = current.users.filter((user) => user.workspace_id === workspaceId);
    const duplicate = current.messages.channels.some((channel) => (
      channel.workspace_id === workspaceId
      && channel.channel_id !== channelId
      && normalizeChannelName(channel.name) === normalizedName
    ));

    if (duplicate) {
      throw new Error('channel already exists in workspace');
    }

    const nextChannels = current.messages.channels.map((channel) => {
      if (channel.workspace_id !== workspaceId || channel.channel_id !== channelId) {
        return channel;
      }

      updated = {
        ...channel,
        name: normalizedName,
        description: description.trim(),
        updated_at: new Date().toISOString(),
      };
      return updated;
    });

    if (!updated) {
      throw new Error('channel not found in workspace');
    }

    return {
      ...current,
      messages: {
        ...current.messages,
        channels: nextChannels,
      },
    };
  });

  if (!updated) {
    throw new Error('channel not found in workspace');
  }

  return toPublicChannel(
    updated,
    undefined,
    [],
    workspaceUsers.map((user) => user.user_id),
  );
}

export async function deleteWorkspaceChannel(workspaceId: string, channelId: string): Promise<void> {
  await updateStorage((current) => {
    const exists = current.messages.channels.some(
      (channel) => channel.workspace_id === workspaceId && channel.channel_id === channelId,
    );

    if (!exists) {
      throw new Error('channel not found in workspace');
    }

    return {
      ...current,
      messages: {
        ...current.messages,
        channels: current.messages.channels.filter(
          (channel) => !(channel.workspace_id === workspaceId && channel.channel_id === channelId),
        ),
        items: current.messages.items.filter(
          (message) => !(message.workspace_id === workspaceId && message.conversation_type === 'channel' && message.conversation_id === channelId),
        ),
      },
    };
  });
}

export async function createWorkspaceDirectConversation(
  workspaceId: string,
  participantUserId: string,
  actorUsername: string,
): Promise<WorkspaceDirectConversation> {
  let created: StoredDirectConversation | null = null;
  let workspaceUsers: StoredUser[] = [];
  let actor: StoredUser | undefined;

  await updateStorage((current) => {
    workspaceUsers = current.users.filter((user) => user.workspace_id === workspaceId);
    actor = resolveWorkspaceActor(workspaceUsers, actorUsername);
    const safeActor = assertActor(actor);

    const participant = workspaceUsers.find((user) => user.user_id === participantUserId);
    if (!participant) {
      throw new Error('participant user not found');
    }

    if (participant.user_id === safeActor.user_id) {
      throw new Error('cannot start a direct conversation with yourself');
    }

    const pair = sortUserIds([safeActor.user_id, participant.user_id]);
    const exists = current.messages.directs.find((direct) => {
      if (direct.workspace_id !== workspaceId) {
        return false;
      }

      const existingPair = sortUserIds(direct.participant_user_ids);
      return existingPair[0] === pair[0] && existingPair[1] === pair[1];
    });

    if (exists) {
      created = exists;
      return current;
    }

    const now = new Date().toISOString();
    created = {
      direct_id: randomUUID(),
      workspace_id: workspaceId,
      participant_user_ids: [safeActor.user_id, participant.user_id],
      read_state: [
        { user_id: safeActor.user_id, last_read_at: now },
        { user_id: participant.user_id, last_read_at: null },
      ],
      created_at: now,
      updated_at: now,
    };

    return {
      ...current,
      messages: {
        ...current.messages,
        directs: [created, ...current.messages.directs],
      },
    };
  });

  if (!created) {
    throw new Error('unable to create direct conversation');
  }

  const publicConversation = toPublicDirectConversation(created, workspaceUsers, actor, []);
  if (!publicConversation) {
    throw new Error('unable to load direct conversation');
  }

  return publicConversation;
}

export async function deleteWorkspaceDirectConversation(
  workspaceId: string,
  directId: string,
  actorUsername: string,
): Promise<void> {
  await updateStorage((current) => {
    const workspaceUsers = current.users.filter((user) => user.workspace_id === workspaceId);
    const actor = assertActor(resolveWorkspaceActor(workspaceUsers, actorUsername));
    const direct = current.messages.directs.find(
      (item) => item.workspace_id === workspaceId && item.direct_id === directId,
    );

    if (!direct) {
      throw new Error('direct conversation not found in workspace');
    }

    if (!direct.participant_user_ids.includes(actor.user_id)) {
      throw new Error('you are not a participant in this direct conversation');
    }

    return {
      ...current,
      messages: {
        ...current.messages,
        directs: current.messages.directs.filter(
          (item) => !(item.workspace_id === workspaceId && item.direct_id === directId),
        ),
        items: current.messages.items.filter(
          (message) => !(message.workspace_id === workspaceId && message.conversation_type === 'direct' && message.conversation_id === directId),
        ),
      },
    };
  });
}

export async function createWorkspaceGroupConversation(
  workspaceId: string,
  name: string,
  description: string,
  memberUserIds: string[],
  actorUsername: string,
): Promise<WorkspaceGroupConversation> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('group name is required');
  }

  let created: StoredGroupConversation | null = null;
  let workspaceUsers: StoredUser[] = [];

  await updateStorage((current) => {
    workspaceUsers = current.users.filter((user) => user.workspace_id === workspaceId);
    const actor = assertActor(resolveWorkspaceActor(workspaceUsers, actorUsername));

    const nextMemberIds = sortUserIds([...memberUserIds, actor.user_id]);
    const resolvedMembers = nextMemberIds.map((userId) => workspaceUsers.find((user) => user.user_id === userId));
    if (resolvedMembers.some((user) => !user)) {
      throw new Error('one or more group members were not found in the workspace');
    }

    if (nextMemberIds.length < 2) {
      throw new Error('group must include at least two workspace users');
    }

    const now = new Date().toISOString();
    created = {
      group_id: randomUUID(),
      workspace_id: workspaceId,
      name: trimmedName,
      description: description.trim(),
      member_user_ids: nextMemberIds,
      created_by_user_id: actor.user_id,
      read_state: nextMemberIds.map((userId) => ({
        user_id: userId,
        last_read_at: userId === actor.user_id ? now : null,
      })),
      created_at: now,
      updated_at: now,
    };

    return {
      ...current,
      messages: {
        ...current.messages,
        groups: [created, ...current.messages.groups],
      },
    };
  });

  if (!created) {
    throw new Error('unable to create group conversation');
  }

  return toPublicGroupConversation(created, workspaceUsers, undefined, []);
}

export async function updateWorkspaceGroupConversation(
  workspaceId: string,
  groupId: string,
  name: string,
  description: string,
  actorUsername: string,
): Promise<WorkspaceGroupConversation> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('group name is required');
  }

  let updated: StoredGroupConversation | null = null;
  let workspaceUsers: StoredUser[] = [];
  let actor: StoredUser | undefined;

  await updateStorage((current) => {
    workspaceUsers = current.users.filter((user) => user.workspace_id === workspaceId);
    const safeActor = assertActor(resolveWorkspaceActor(workspaceUsers, actorUsername));
    actor = safeActor;

    const nextGroups = current.messages.groups.map((group) => {
      if (group.workspace_id !== workspaceId || group.group_id !== groupId) {
        return group;
      }

      if (!group.member_user_ids.includes(safeActor.user_id)) {
        throw new Error('you are not a member of this group');
      }

      updated = {
        ...group,
        name: trimmedName,
        description: description.trim(),
        updated_at: new Date().toISOString(),
      };
      return updated;
    });

    if (!updated) {
      throw new Error('group conversation not found in workspace');
    }

    return {
      ...current,
      messages: {
        ...current.messages,
        groups: nextGroups,
      },
    };
  });

  if (!updated) {
    throw new Error('group conversation not found in workspace');
  }

  return toPublicGroupConversation(updated, workspaceUsers, actor?.user_id, []);
}

export async function deleteWorkspaceGroupConversation(
  workspaceId: string,
  groupId: string,
  actorUsername: string,
): Promise<void> {
  await updateStorage((current) => {
    const workspaceUsers = current.users.filter((user) => user.workspace_id === workspaceId);
    const actor = assertActor(resolveWorkspaceActor(workspaceUsers, actorUsername));
    const group = current.messages.groups.find(
      (item) => item.workspace_id === workspaceId && item.group_id === groupId,
    );

    if (!group) {
      throw new Error('group conversation not found in workspace');
    }

    if (!group.member_user_ids.includes(actor.user_id)) {
      throw new Error('you are not a member of this group');
    }

    return {
      ...current,
      messages: {
        ...current.messages,
        groups: current.messages.groups.filter(
          (item) => !(item.workspace_id === workspaceId && item.group_id === groupId),
        ),
        items: current.messages.items.filter(
          (message) => !(message.workspace_id === workspaceId && message.conversation_type === 'group' && message.conversation_id === groupId),
        ),
      },
    };
  });
}

export async function markWorkspaceConversationRead(
  workspaceId: string,
  conversationType: ConversationType,
  conversationId: string,
  actorUsername: string,
): Promise<void> {
  await updateStorage((current) => {
    const workspaceUsers = current.users.filter((user) => user.workspace_id === workspaceId);
    const actor = assertActor(resolveWorkspaceActor(workspaceUsers, actorUsername));
    const now = new Date().toISOString();

    if (conversationType === 'channel') {
      let found = false;
      const nextChannels = current.messages.channels.map((channel) => {
        if (channel.workspace_id !== workspaceId || channel.channel_id !== conversationId) {
          return channel;
        }

        found = true;
        return {
          ...channel,
          read_state: setLastReadAt(channel.read_state, workspaceUsers.map((user) => user.user_id), actor.user_id, now),
        };
      });

      if (!found) {
        throw new Error('channel not found in workspace');
      }

      return {
        ...current,
        messages: {
          ...current.messages,
          channels: nextChannels,
        },
      };
    }

    if (conversationType === 'direct') {
      let found = false;
      const nextDirects = current.messages.directs.map((direct) => {
        if (direct.workspace_id !== workspaceId || direct.direct_id !== conversationId) {
          return direct;
        }

        if (!direct.participant_user_ids.includes(actor.user_id)) {
          throw new Error('you are not a participant in this direct conversation');
        }

        found = true;
        return {
          ...direct,
          read_state: setLastReadAt(direct.read_state, direct.participant_user_ids, actor.user_id, now),
        };
      });

      if (!found) {
        throw new Error('direct conversation not found in workspace');
      }

      return {
        ...current,
        messages: {
          ...current.messages,
          directs: nextDirects,
        },
      };
    }

    let found = false;
    const nextGroups = current.messages.groups.map((group) => {
      if (group.workspace_id !== workspaceId || group.group_id !== conversationId) {
        return group;
      }

      if (!group.member_user_ids.includes(actor.user_id)) {
        throw new Error('you are not a member of this group');
      }

      found = true;
      return {
        ...group,
        read_state: setLastReadAt(group.read_state, group.member_user_ids, actor.user_id, now),
      };
    });

    if (!found) {
      throw new Error('group conversation not found in workspace');
    }

    return {
      ...current,
      messages: {
        ...current.messages,
        groups: nextGroups,
      },
    };
  });
}

export async function createWorkspaceConversationMessage(
  workspaceId: string,
  conversationType: ConversationType,
  conversationId: string,
  content: string,
  actorUsername: string,
): Promise<WorkspaceMessage> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('message content is required');
  }

  let created: StoredWorkspaceMessage | null = null;
  let author: StoredUser | undefined;

  await updateStorage((current) => {
    const workspaceUsers = current.users.filter((user) => user.workspace_id === workspaceId);
    const safeAuthor = assertActor(resolveWorkspaceActor(workspaceUsers, actorUsername));
    author = safeAuthor;
    const now = new Date().toISOString();

    const nextMessages = [...current.messages.items];
    created = {
      message_id: randomUUID(),
      workspace_id: workspaceId,
      conversation_type: conversationType,
      conversation_id: conversationId,
      author_user_id: safeAuthor.user_id,
      content: trimmed,
      created_at: now,
      updated_at: now,
    };
    nextMessages.push(created);

    if (conversationType === 'channel') {
      let found = false;
      const nextChannels = current.messages.channels.map((channel) => {
        if (channel.workspace_id !== workspaceId || channel.channel_id !== conversationId) {
          return channel;
        }

        found = true;
        return {
          ...channel,
          updated_at: now,
          read_state: setLastReadAt(channel.read_state, workspaceUsers.map((user) => user.user_id), safeAuthor.user_id, now),
        };
      });

      if (!found) {
        throw new Error('channel not found in workspace');
      }

      return {
        ...current,
        messages: {
          ...current.messages,
          channels: nextChannels,
          items: nextMessages,
        },
      };
    }

    if (conversationType === 'direct') {
      let found = false;
      const nextDirects = current.messages.directs.map((direct) => {
        if (direct.workspace_id !== workspaceId || direct.direct_id !== conversationId) {
          return direct;
        }

        if (!direct.participant_user_ids.includes(safeAuthor.user_id)) {
          throw new Error('you are not a participant in this direct conversation');
        }

        found = true;
        return {
          ...direct,
          updated_at: now,
          read_state: setLastReadAt(direct.read_state, direct.participant_user_ids, safeAuthor.user_id, now),
        };
      });

      if (!found) {
        throw new Error('direct conversation not found in workspace');
      }

      return {
        ...current,
        messages: {
          ...current.messages,
          directs: nextDirects,
          items: nextMessages,
        },
      };
    }

    let found = false;
    const nextGroups = current.messages.groups.map((group) => {
      if (group.workspace_id !== workspaceId || group.group_id !== conversationId) {
        return group;
      }

      if (!group.member_user_ids.includes(safeAuthor.user_id)) {
        throw new Error('you are not a member of this group');
      }

      found = true;
      return {
        ...group,
        updated_at: now,
        read_state: setLastReadAt(group.read_state, group.member_user_ids, safeAuthor.user_id, now),
      };
    });

    if (!found) {
      throw new Error('group conversation not found in workspace');
    }

    return {
      ...current,
      messages: {
        ...current.messages,
        groups: nextGroups,
        items: nextMessages,
      },
    };
  });

  if (!created) {
    throw new Error('unable to create message');
  }

  return toPublicMessage(created, author);
}

export async function createWorkspaceMessage(
  workspaceId: string,
  channelId: string,
  content: string,
  actorUsername: string,
): Promise<WorkspaceMessage> {
  return createWorkspaceConversationMessage(workspaceId, 'channel', channelId, content, actorUsername);
}

export async function createWorkspaceUser(
  workspaceId: string,
  username: string,
  password: string,
): Promise<PublicUser> {
  return createUser(username, password, workspaceId);
}
