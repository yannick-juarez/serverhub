/**
 * Storage service — public API for all modules.
 *
 * All persistent data is kept in a SQLite database (storage/app.db).
 * The JSON file (storage/app-storage.json) from previous versions is
 * automatically imported on first run and renamed to *.migrated.
 *
 * Exported API is unchanged so every consumer module continues to work
 * without modification.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../../config/env';
import {
  getDb,
  isDbEmpty,
  readStorageSync,
  writeStorageSync,
  STORAGE_DIR,
} from './db';

// ── Types (re-exported for all consumer modules) ─────────────────────────────

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
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type StoredConversationReadState = {
  user_id: string;
  last_read_at: string | null;
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

// ── Seed data (first run) ─────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function defaultStorage(): StorageData {
  const now = nowIso();
  const workspaceId = 'demo';
  const adminPasswordHash = config.admin.password.startsWith('$2')
    ? config.admin.password
    : bcrypt.hashSync(config.admin.password, 10);
  const adminUserId = randomUUID();
  const generalChannelId = randomUUID();
  const incidentsChannelId = randomUUID();

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
    requests: { folders: [], items: [] },
    preferences: {
      theme: 'dark',
      locale: 'fr',
      filesRoot: config.filesRoot,
      databasePage: { leftPanelTab: 'tables' },
    },
    users: [
      {
        user_id: adminUserId,
        workspace_id: workspaceId,
        username: config.admin.username.trim().toLowerCase(),
        password_hash: adminPasswordHash,
        is_active: true,
        is_admin: true,
        created_at: now,
        updated_at: now,
      },
    ],
    messages: {
      channels: [
        {
          channel_id: generalChannelId,
          workspace_id: workspaceId,
          name: 'general',
          description: 'General team communication',
          read_state: [
            { user_id: adminUserId, last_read_at: now },
          ],
          created_at: now,
          updated_at: now,
        },
        {
          channel_id: incidentsChannelId,
          workspace_id: workspaceId,
          name: 'incidents',
          description: 'Live incident coordination channel',
          read_state: [
            { user_id: adminUserId, last_read_at: now },
          ],
          created_at: now,
          updated_at: now,
        },
      ],
      directs: [],
      groups: [],
      items: [
        {
          message_id: randomUUID(),
          workspace_id: workspaceId,
          conversation_type: 'channel',
          conversation_id: generalChannelId,
          author_user_id: adminUserId,
          content: 'Welcome to the workspace messaging backend seed.',
          created_at: now,
          updated_at: now,
        },
        {
          message_id: randomUUID(),
          workspace_id: workspaceId,
          conversation_type: 'channel',
          conversation_id: incidentsChannelId,
          author_user_id: adminUserId,
          content: 'Incident room initialized. Use this channel for active events.',
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

// ── JSON migration (v1 → SQLite) ─────────────────────────────────────────────

const JSON_FILE = path.join(STORAGE_DIR, 'app-storage.json');

function tryMigrateJson(): StorageData | null {
  if (!fs.existsSync(JSON_FILE)) return null;

  try {
    const raw = fs.readFileSync(JSON_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Minimal validity check
    if (!parsed.connections || !parsed.preferences) return null;

    const data = parsed as unknown as Partial<StorageData>;

    // Normalise read_state entries
    const normalizeRS = (arr: unknown): StoredConversationReadState[] => {
      if (!Array.isArray(arr)) return [];
      return arr.flatMap((e) => {
        if (!e || typeof e !== 'object') return [];
        const entry = e as Partial<StoredConversationReadState>;
        if (!entry.user_id) return [];
        return [{ user_id: entry.user_id, last_read_at: entry.last_read_at ?? null }];
      });
    };

    const raw_messages = data.messages;
    const messages: StorageData['messages'] = {
      channels: (raw_messages?.channels ?? []).map((ch) => ({
        ...ch,
        read_state: normalizeRS(ch.read_state),
      })),
      directs: (raw_messages?.directs ?? []).map((d) => ({
        ...d,
        read_state: normalizeRS(d.read_state),
      })),
      groups: (raw_messages?.groups ?? []).map((g) => ({
        ...g,
        read_state: normalizeRS(g.read_state),
      })),
      items: (raw_messages?.items ?? []).flatMap((item) => {
        const m = item as Partial<StoredWorkspaceMessage> & { channel_id?: string };
        const conversationId = m.conversation_id ?? m.channel_id;
        if (!m.message_id || !m.workspace_id || !m.author_user_id || !m.content || !conversationId) return [];
        return [{
          message_id: m.message_id,
          workspace_id: m.workspace_id,
          conversation_type: m.conversation_type ?? 'channel',
          conversation_id: conversationId,
          author_user_id: m.author_user_id,
          content: m.content,
          created_at: m.created_at ?? nowIso(),
          updated_at: m.updated_at ?? nowIso(),
        }];
      }),
    };

    const normalized: StorageData = {
      connections: data.connections ?? { db: [], ssh: [] },
      requests: data.requests ?? { folders: [], items: [] },
      preferences: {
        filesRoot: config.filesRoot,
        ...(data.preferences as PlatformPreferences),
      },
      users: (data.users ?? []).map((u) => ({
        ...u,
        workspace_id: u.workspace_id || 'demo',
        is_admin:
          typeof u.is_admin === 'boolean'
            ? u.is_admin
            : (u.username ?? '').toString().trim().toLowerCase() === config.admin.username.trim().toLowerCase(),
      })),
      messages,
      calendar: data.calendar ?? { calendars: [], events: [] },
    };

    // Archive the JSON file so it's never imported again
    fs.renameSync(JSON_FILE, JSON_FILE + '.migrated');
    console.log('[storage] Migrated app-storage.json → SQLite (storage/app.db)');

    return normalized;
  } catch (err) {
    console.warn('[storage] JSON migration failed, using fresh seed:', err);
    return null;
  }
}

// ── Ensure DB is seeded ───────────────────────────────────────────────────────

function ensureSeed(): void {
  const db = getDb();
  if (!isDbEmpty(db)) return;

  const migrated = tryMigrateJson();
  writeStorageSync(db, migrated ?? defaultStorage());
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function readStorage(): Promise<StorageData> {
  ensureSeed();
  return readStorageSync(getDb());
}

export async function writeStorage(next: StorageData): Promise<void> {
  writeStorageSync(getDb(), next);
}

export async function updateStorage(
  updater: (current: StorageData) => StorageData | Promise<StorageData>,
): Promise<StorageData> {
  const current = await readStorage();
  const next = await updater(current);
  await writeStorage(next);
  return next;
}
