import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../../config/env';

export type StoredDbConnection = {
  db_id: string;
  name: string;
  engine: 'mysql' | 'postgresql';
  host: string;
  port: number;
  username: string;
  password: string;
  default_database: string;
  created_at: string;
  updated_at: string;
};

export type StoredSshConnection = {
  ssh_id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key';
  created_at: string;
  updated_at: string;
};

export type RequestFolderRecord = {
  request_folder_id: string;
  db_id: string;
  folder_name: string;
  folder_description: string | null;
  created_at: string;
  updated_at: string;
};

export type SqlRequestRecord = {
  request_id: string;
  db_id: string;
  request_folder_id: string | null;
  request_name: string;
  request_description: string | null;
  sql_text: string;
  created_at: string;
  updated_at: string;
};

export type PlatformPreferences = {
  [key: string]: string | number | boolean | null | PlatformPreferences | Array<string | number | boolean | null>;
};

export type StoredUser = {
  user_id: string;
  workspace_id: string;
  username: string;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoredWorkspaceChannel = {
  channel_id: string;
  workspace_id: string;
  name: string;
  description: string;
  read_state: StoredConversationReadState[];
  created_at: string;
  updated_at: string;
};

export type StoredConversationReadState = {
  user_id: string;
  last_read_at: string | null;
};

export type StoredDirectConversation = {
  direct_id: string;
  workspace_id: string;
  participant_user_ids: [string, string];
  read_state: StoredConversationReadState[];
  created_at: string;
  updated_at: string;
};

export type StoredGroupConversation = {
  group_id: string;
  workspace_id: string;
  name: string;
  description: string;
  member_user_ids: string[];
  created_by_user_id: string;
  read_state: StoredConversationReadState[];
  created_at: string;
  updated_at: string;
};

export type StoredWorkspaceMessage = {
  message_id: string;
  workspace_id: string;
  conversation_type: 'channel' | 'direct' | 'group';
  conversation_id: string;
  author_user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type StoredCalendar = {
  calendar_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type StoredCalendarEvent = {
  event_id: string;
  calendar_id: string;
  title: string;
  description: string | null;
  location: string | null;
  all_day: boolean;
  start_at: string;
  end_at: string;
  created_at: string;
  updated_at: string;
};

export type StorageData = {
  connections: {
    db: StoredDbConnection[];
    ssh: StoredSshConnection[];
  };
  requests: {
    folders: RequestFolderRecord[];
    items: SqlRequestRecord[];
  };
  preferences: PlatformPreferences;
  users: StoredUser[];
  messages: {
    channels: StoredWorkspaceChannel[];
    directs: StoredDirectConversation[];
    groups: StoredGroupConversation[];
    items: StoredWorkspaceMessage[];
  };
  calendar: {
    calendars: StoredCalendar[];
    events: StoredCalendarEvent[];
  };
};

const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const STORAGE_FILE = path.join(STORAGE_DIR, 'app-storage.json');

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStorage(): StorageData {
  const now = nowIso();
  const defaultWorkspaceId = 'demo';
  const adminPasswordHash = config.admin.password.startsWith('$2')
    ? config.admin.password
    : bcrypt.hashSync(config.admin.password, 10);
  const adminUserId = randomUUID();
  const sofiaUserId = randomUUID();
  const ryanUserId = randomUUID();
  const generalChannelId = randomUUID();
  const incidentsChannelId = randomUUID();
  const directConversationId = randomUUID();
  const opsGroupId = randomUUID();

  return {
    connections: {
      db: [
        {
          db_id: randomUUID(),
          name: 'MySQL Local',
          engine: 'mysql',
          host: config.mysql.host,
          port: config.mysql.port,
          username: config.mysql.user,
          password: config.mysql.password,
          default_database: 'mysql',
          created_at: now,
          updated_at: now,
        },
        {
          db_id: randomUUID(),
          name: 'PostgreSQL Local',
          engine: 'postgresql',
          host: config.pg.host,
          port: config.pg.port,
          username: config.pg.user,
          password: config.pg.password,
          default_database: 'postgres',
          created_at: now,
          updated_at: now,
        },
      ],
      ssh: [],
    },
    requests: {
      folders: [],
      items: [],
    },
    preferences: {
      theme: 'dark',
      locale: 'fr',
      filesRoot: config.filesRoot,
      databasePage: {
        leftPanelTab: 'tables',
      },
    },
    users: [
      {
        user_id: adminUserId,
        workspace_id: defaultWorkspaceId,
        username: config.admin.username.trim().toLowerCase(),
        password_hash: adminPasswordHash,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        user_id: sofiaUserId,
        workspace_id: defaultWorkspaceId,
        username: 'sofia.patel',
        password_hash: bcrypt.hashSync('serverhub', 10),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        user_id: ryanUserId,
        workspace_id: defaultWorkspaceId,
        username: 'ryan.chen',
        password_hash: bcrypt.hashSync('serverhub', 10),
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    messages: {
      channels: [
        {
          channel_id: generalChannelId,
          workspace_id: defaultWorkspaceId,
          name: 'general',
          description: 'General team communication',
          read_state: [
            { user_id: adminUserId, last_read_at: now },
            { user_id: sofiaUserId, last_read_at: null },
            { user_id: ryanUserId, last_read_at: null },
          ],
          created_at: now,
          updated_at: now,
        },
        {
          channel_id: incidentsChannelId,
          workspace_id: defaultWorkspaceId,
          name: 'incidents',
          description: 'Live incident coordination channel',
          read_state: [
            { user_id: adminUserId, last_read_at: now },
            { user_id: sofiaUserId, last_read_at: null },
            { user_id: ryanUserId, last_read_at: null },
          ],
          created_at: now,
          updated_at: now,
        },
      ],
      directs: [
        {
          direct_id: directConversationId,
          workspace_id: defaultWorkspaceId,
          participant_user_ids: [adminUserId, sofiaUserId],
          read_state: [
            { user_id: adminUserId, last_read_at: null },
            { user_id: sofiaUserId, last_read_at: now },
          ],
          created_at: now,
          updated_at: now,
        },
      ],
      groups: [
        {
          group_id: opsGroupId,
          workspace_id: defaultWorkspaceId,
          name: 'Ops War Room',
          description: 'Shared coordination for infrastructure events',
          member_user_ids: [adminUserId, sofiaUserId, ryanUserId],
          created_by_user_id: adminUserId,
          read_state: [
            { user_id: adminUserId, last_read_at: null },
            { user_id: sofiaUserId, last_read_at: null },
            { user_id: ryanUserId, last_read_at: now },
          ],
          created_at: now,
          updated_at: now,
        },
      ],
      items: [
        {
          message_id: randomUUID(),
          workspace_id: defaultWorkspaceId,
          conversation_type: 'channel',
          conversation_id: generalChannelId,
          author_user_id: adminUserId,
          content: 'Welcome to the workspace messaging backend seed.',
          created_at: now,
          updated_at: now,
        },

        {
          message_id: randomUUID(),
          workspace_id: defaultWorkspaceId,
          conversation_type: 'channel',
          conversation_id: incidentsChannelId,
          author_user_id: adminUserId,
          content: 'Incident room initialized. Use this channel for active events.',
          created_at: now,
          updated_at: now,
        },
        {
          message_id: randomUUID(),
          workspace_id: defaultWorkspaceId,
          conversation_type: 'direct',
          conversation_id: directConversationId,
          author_user_id: sofiaUserId,
          content: 'Can you review the dashboard alert tuning when you have a minute?',
          created_at: now,
          updated_at: now,
        },
        {
          message_id: randomUUID(),
          workspace_id: defaultWorkspaceId,
          conversation_type: 'group',
          conversation_id: opsGroupId,
          author_user_id: ryanUserId,
          content: 'War room is ready. I pinned the latest infra notes.',
          created_at: now,
          updated_at: now,
        },
      ],
    },
    calendar: {
      calendars: [
        {
          calendar_id: randomUUID(),
          name: 'Personnel',
          color: '#3b82f6',
          description: null,
          created_at: now,
          updated_at: now,
        },
        {
          calendar_id: randomUUID(),
          name: 'Travail',
          color: '#22c55e',
          description: null,
          created_at: now,
          updated_at: now,
        },
      ],
      events: [],
    },
  };
}

async function ensureStorageFile(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  try {
    await fs.access(STORAGE_FILE);
  } catch {
    const seed = defaultStorage();
    await fs.writeFile(STORAGE_FILE, JSON.stringify(seed, null, 2), 'utf-8');
  }
}

export async function readStorage(): Promise<StorageData> {
  await ensureStorageFile();
  const raw = await fs.readFile(STORAGE_FILE, 'utf-8');

  try {
    const parsed = JSON.parse(raw) as Partial<StorageData>;

    if (!parsed.connections || !parsed.requests || !parsed.preferences) {
      throw new Error('invalid storage shape');
    }

    const now = nowIso();

    const normalizedUsers = Array.isArray(parsed.users)
      ? parsed.users.map((user) => ({
        ...user,
        workspace_id: user.workspace_id || 'demo',
      }))
      : [];

    const rawMessages = parsed.messages && typeof parsed.messages === 'object'
      ? parsed.messages as Partial<StorageData['messages']> & { items?: Array<StoredWorkspaceMessage | ({ channel_id?: string } & Record<string, unknown>)> }
      : null;

    const normalizeReadState = (value: unknown): StoredConversationReadState[] => {
      if (!Array.isArray(value)) {
        return [];
      }

      return value.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') {
          return [];
        }

        const readState = entry as Partial<StoredConversationReadState>;
        if (!readState.user_id) {
          return [];
        }

        return [{
          user_id: readState.user_id,
          last_read_at: readState.last_read_at ?? null,
        }];
      });
    };

    const normalizedMessages = rawMessages
      ? {
        channels: Array.isArray(rawMessages.channels)
          ? rawMessages.channels.map((channel) => ({
            ...channel,
            read_state: normalizeReadState((channel as Partial<StoredWorkspaceChannel>).read_state),
          }))
          : [],
        directs: Array.isArray(rawMessages.directs)
          ? rawMessages.directs.map((direct) => ({
            ...direct,
            read_state: normalizeReadState((direct as Partial<StoredDirectConversation>).read_state),
          }))
          : [],
        groups: Array.isArray(rawMessages.groups)
          ? rawMessages.groups.map((group) => ({
            ...group,
            read_state: normalizeReadState((group as Partial<StoredGroupConversation>).read_state),
          }))
          : [],
        items: Array.isArray(rawMessages.items)
          ? rawMessages.items.flatMap((item) => {
            if (!item || typeof item !== 'object') {
              return [];
            }

            const nextItem = item as Partial<StoredWorkspaceMessage> & { channel_id?: string };
            const conversationType = nextItem.conversation_type;
            const conversationId = nextItem.conversation_id ?? nextItem.channel_id;

            if (!conversationType && !nextItem.channel_id) {
              return [];
            }

            if (!conversationId || !nextItem.author_user_id || !nextItem.content || !nextItem.message_id || !nextItem.workspace_id || !nextItem.created_at || !nextItem.updated_at) {
              return [];
            }

            return [{
              message_id: nextItem.message_id,
              workspace_id: nextItem.workspace_id,
              conversation_type: conversationType ?? 'channel',
              conversation_id: conversationId,
              author_user_id: nextItem.author_user_id,
              content: nextItem.content,
              created_at: nextItem.created_at,
              updated_at: nextItem.updated_at,
            }];
          })
          : [],
      }
      : {
        channels: [],
        directs: [],
        groups: [],
        items: [],
      };
    const next: StorageData = {
      connections: parsed.connections,
      requests: parsed.requests,
      preferences: {
        filesRoot: config.filesRoot,
        ...(parsed.preferences as PlatformPreferences),
      },
      users: normalizedUsers,
      messages: normalizedMessages,
      calendar: parsed.calendar && Array.isArray(parsed.calendar.calendars) && Array.isArray(parsed.calendar.events)
        ? parsed.calendar
        : { calendars: [], events: [] },
    };

    if (
      !Array.isArray(parsed.users)
      || !(parsed.preferences as PlatformPreferences).filesRoot
      || !parsed.messages
      || !Array.isArray((parsed.messages as Partial<StorageData['messages']>).directs)
      || !Array.isArray((parsed.messages as Partial<StorageData['messages']>).groups)
      || normalizedMessages.channels.some((channel) => !Array.isArray(channel.read_state))
      || normalizedMessages.directs.some((direct) => !Array.isArray(direct.read_state))
      || normalizedMessages.groups.some((group) => !Array.isArray(group.read_state))
      || (Array.isArray(rawMessages?.items) && rawMessages?.items.some((item) => item && typeof item === 'object' && 'channel_id' in item && !('conversation_id' in item)))
      || !parsed.calendar
      || !Array.isArray((parsed.calendar as Partial<StorageData['calendar']>).calendars)
    ) {
      await writeStorage(next);
    }

    return next;
  } catch {
    const seed = defaultStorage();
    await writeStorage(seed);
    return seed;
  }
}

export async function writeStorage(next: StorageData): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.writeFile(STORAGE_FILE, JSON.stringify(next, null, 2), 'utf-8');
}

export async function updateStorage(
  updater: (current: StorageData) => StorageData | Promise<StorageData>,
): Promise<StorageData> {
  const current = await readStorage();
  const next = await updater(current);
  await writeStorage(next);
  return next;
}
