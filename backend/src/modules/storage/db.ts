/**
 * SQLite layer for ServerHub storage.
 *
 * Responsible for:
 *  - Opening / initialising the database file
 *  - Applying the schema (idempotent CREATE TABLE IF NOT EXISTS)
 *  - readStorageSync  — builds the StorageData object from DB queries
 *  - writeStorageSync — replaces all data inside a single transaction
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type {
  StorageData,
  StoredDbConnection,
  StoredSshConnection,
  RequestFolderRecord,
  SqlRequestRecord,
  PlatformPreferences,
  StoredUser,
  StoredWorkspaceChannel,
  StoredDirectConversation,
  StoredGroupConversation,
  StoredWorkspaceMessage,
  StoredCalendar,
  StoredCalendarEvent,
  StoredConversationReadState,
} from './storage.service';

export const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
export const DB_FILE = path.join(STORAGE_DIR, 'app.db');

let _db: Database.Database | null = null;

// ── Public DB handle ─────────────────────────────────────────────────────────

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  _db = new Database(DB_FILE);
  _db.pragma('journal_mode = WAL');  // concurrent reads + crash-safe writes
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');
  applySchema(_db);

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ── Schema ───────────────────────────────────────────────────────────────────

function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS db_connections (
      db_id            TEXT PRIMARY KEY NOT NULL,
      name             TEXT NOT NULL,
      engine           TEXT NOT NULL,
      host             TEXT NOT NULL,
      port             INTEGER NOT NULL,
      username         TEXT NOT NULL,
      password         TEXT NOT NULL DEFAULT '',
      default_database TEXT NOT NULL DEFAULT '',
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ssh_connections (
      ssh_id     TEXT PRIMARY KEY NOT NULL,
      name       TEXT NOT NULL,
      host       TEXT NOT NULL,
      port       INTEGER NOT NULL,
      username   TEXT NOT NULL,
      auth_type  TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS request_folders (
      request_folder_id  TEXT PRIMARY KEY NOT NULL,
      db_id              TEXT NOT NULL,
      folder_name        TEXT NOT NULL,
      folder_description TEXT,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sql_requests (
      request_id          TEXT PRIMARY KEY NOT NULL,
      db_id               TEXT NOT NULL,
      request_folder_id   TEXT,
      request_name        TEXT NOT NULL,
      request_description TEXT,
      sql_text            TEXT NOT NULL,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id       TEXT PRIMARY KEY NOT NULL,
      workspace_id  TEXT NOT NULL DEFAULT 'demo',
      username      TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_active     INTEGER NOT NULL DEFAULT 1,
      is_admin      INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

    CREATE TABLE IF NOT EXISTS channels (
      channel_id   TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS channel_read_state (
      channel_id   TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      last_read_at TEXT,
      PRIMARY KEY (channel_id, user_id),
      FOREIGN KEY (channel_id) REFERENCES channels (channel_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS direct_conversations (
      direct_id    TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      user_id_1    TEXT NOT NULL,
      user_id_2    TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS direct_read_state (
      direct_id    TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      last_read_at TEXT,
      PRIMARY KEY (direct_id, user_id),
      FOREIGN KEY (direct_id) REFERENCES direct_conversations (direct_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_conversations (
      group_id           TEXT PRIMARY KEY NOT NULL,
      workspace_id       TEXT NOT NULL,
      name               TEXT NOT NULL,
      description        TEXT NOT NULL DEFAULT '',
      created_by_user_id TEXT NOT NULL,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL,
      user_id  TEXT NOT NULL,
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES group_conversations (group_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_read_state (
      group_id     TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      last_read_at TEXT,
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES group_conversations (group_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      message_id        TEXT PRIMARY KEY NOT NULL,
      workspace_id      TEXT NOT NULL,
      conversation_type TEXT NOT NULL,
      conversation_id   TEXT NOT NULL,
      author_user_id    TEXT NOT NULL,
      content           TEXT NOT NULL,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv
      ON messages (workspace_id, conversation_type, conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS calendars (
      calendar_id TEXT PRIMARY KEY NOT NULL,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL,
      description TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      event_id    TEXT PRIMARY KEY NOT NULL,
      calendar_id TEXT NOT NULL,
      title       TEXT NOT NULL,
      description TEXT,
      location    TEXT,
      all_day     INTEGER NOT NULL DEFAULT 0,
      start_at    TEXT NOT NULL,
      end_at      TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      FOREIGN KEY (calendar_id) REFERENCES calendars (calendar_id) ON DELETE CASCADE
    );
  `);

  // Backward-compatible migration for existing databases created before is_admin.
  const hasIsAdmin = db
    .prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'is_admin' LIMIT 1")
    .get() as { 1: number } | undefined;
  if (!hasIsAdmin) {
    db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  }
}

// ── Read ─────────────────────────────────────────────────────────────────────

export function readStorageSync(db: Database.Database): StorageData {
  // connections
  const dbConns = db.prepare('SELECT * FROM db_connections').all() as StoredDbConnection[];
  const sshConns = db.prepare('SELECT * FROM ssh_connections').all() as StoredSshConnection[];

  // requests
  const folders = db.prepare('SELECT * FROM request_folders').all() as RequestFolderRecord[];
  const sqlRequests = db.prepare('SELECT * FROM sql_requests').all() as SqlRequestRecord[];

  // preferences (key/value rows, values are JSON-encoded)
  const prefRows = db.prepare('SELECT key, value FROM preferences').all() as { key: string; value: string }[];
  const preferences: PlatformPreferences = {};
  for (const row of prefRows) {
    try { preferences[row.key] = JSON.parse(row.value) as PlatformPreferences[string]; }
    catch { preferences[row.key] = row.value; }
  }

  // users (boolean flags stored as 0/1)
  type UserRow = Omit<StoredUser, 'is_active' | 'is_admin'> & { is_active: number; is_admin: number };
  const users: StoredUser[] = (db.prepare('SELECT * FROM users').all() as UserRow[])
    .map(r => ({ ...r, is_active: Boolean(r.is_active), is_admin: Boolean(r.is_admin) }));

  // channels + read_state
  type ChannelRow = Omit<StoredWorkspaceChannel, 'read_state'>;
  type ReadStateRow = { channel_id: string } & StoredConversationReadState;

  const channelRows = db.prepare('SELECT * FROM channels').all() as ChannelRow[];
  const channelReadRows = db.prepare('SELECT * FROM channel_read_state').all() as ReadStateRow[];

  const readStateByChannel = new Map<string, StoredConversationReadState[]>();
  for (const r of channelReadRows) {
    const list = readStateByChannel.get(r.channel_id) ?? [];
    list.push({ user_id: r.user_id, last_read_at: r.last_read_at });
    readStateByChannel.set(r.channel_id, list);
  }
  const channels: StoredWorkspaceChannel[] = channelRows.map(r => ({
    ...r,
    read_state: readStateByChannel.get(r.channel_id) ?? [],
  }));

  // direct_conversations + read_state
  type DirectRow = { direct_id: string; workspace_id: string; user_id_1: string; user_id_2: string; created_at: string; updated_at: string };
  type DirectReadRow = { direct_id: string } & StoredConversationReadState;

  const directRows = db.prepare('SELECT * FROM direct_conversations').all() as DirectRow[];
  const directReadRows = db.prepare('SELECT * FROM direct_read_state').all() as DirectReadRow[];

  const readStateByDirect = new Map<string, StoredConversationReadState[]>();
  for (const r of directReadRows) {
    const list = readStateByDirect.get(r.direct_id) ?? [];
    list.push({ user_id: r.user_id, last_read_at: r.last_read_at });
    readStateByDirect.set(r.direct_id, list);
  }
  const directs: StoredDirectConversation[] = directRows.map(r => ({
    direct_id: r.direct_id,
    workspace_id: r.workspace_id,
    participant_user_ids: [r.user_id_1, r.user_id_2] as [string, string],
    read_state: readStateByDirect.get(r.direct_id) ?? [],
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  // group_conversations + members + read_state
  type GroupRow = Omit<StoredGroupConversation, 'member_user_ids' | 'read_state'>;
  type GroupMemberRow = { group_id: string; user_id: string };
  type GroupReadRow = { group_id: string } & StoredConversationReadState;

  const groupRows = db.prepare('SELECT * FROM group_conversations').all() as GroupRow[];
  const groupMemberRows = db.prepare('SELECT * FROM group_members').all() as GroupMemberRow[];
  const groupReadRows = db.prepare('SELECT * FROM group_read_state').all() as GroupReadRow[];

  const membersByGroup = new Map<string, string[]>();
  for (const r of groupMemberRows) {
    const list = membersByGroup.get(r.group_id) ?? [];
    list.push(r.user_id);
    membersByGroup.set(r.group_id, list);
  }
  const readStateByGroup = new Map<string, StoredConversationReadState[]>();
  for (const r of groupReadRows) {
    const list = readStateByGroup.get(r.group_id) ?? [];
    list.push({ user_id: r.user_id, last_read_at: r.last_read_at });
    readStateByGroup.set(r.group_id, list);
  }
  const groups: StoredGroupConversation[] = groupRows.map(r => ({
    ...r,
    member_user_ids: membersByGroup.get(r.group_id) ?? [],
    read_state: readStateByGroup.get(r.group_id) ?? [],
  }));

  // messages
  const messageItems = db.prepare('SELECT * FROM messages ORDER BY created_at').all() as StoredWorkspaceMessage[];

  // calendars
  const calendars = db.prepare('SELECT * FROM calendars').all() as StoredCalendar[];

  // calendar_events (all_day stored as 0/1)
  type EventRow = Omit<StoredCalendarEvent, 'all_day'> & { all_day: number };
  const events: StoredCalendarEvent[] = (db.prepare('SELECT * FROM calendar_events').all() as EventRow[])
    .map(r => ({ ...r, all_day: Boolean(r.all_day) }));

  return {
    connections: { db: dbConns, ssh: sshConns },
    requests: { folders, items: sqlRequests },
    preferences,
    users,
    messages: { channels, directs, groups, items: messageItems },
    calendar: { calendars, events },
  };
}

// ── Write ────────────────────────────────────────────────────────────────────
// Full replace inside a single transaction — atomic and crash-safe.

export function writeStorageSync(db: Database.Database, data: StorageData): void {
  const tx = db.transaction(() => {
    // Delete leaf tables first (FK constraints), then parents
    db.prepare('DELETE FROM channel_read_state').run();
    db.prepare('DELETE FROM direct_read_state').run();
    db.prepare('DELETE FROM group_members').run();
    db.prepare('DELETE FROM group_read_state').run();
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM channels').run();
    db.prepare('DELETE FROM direct_conversations').run();
    db.prepare('DELETE FROM group_conversations').run();
    db.prepare('DELETE FROM calendar_events').run();
    db.prepare('DELETE FROM calendars').run();
    db.prepare('DELETE FROM sql_requests').run();
    db.prepare('DELETE FROM request_folders').run();
    db.prepare('DELETE FROM db_connections').run();
    db.prepare('DELETE FROM ssh_connections').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM preferences').run();

    // db_connections
    const insDbConn = db.prepare(`
      INSERT INTO db_connections
        (db_id, name, engine, host, port, username, password, default_database, created_at, updated_at)
      VALUES
        (@db_id, @name, @engine, @host, @port, @username, @password, @default_database, @created_at, @updated_at)
    `);
    for (const c of data.connections.db) insDbConn.run(c);

    // ssh_connections
    const insSsh = db.prepare(`
      INSERT INTO ssh_connections
        (ssh_id, name, host, port, username, auth_type, created_at, updated_at)
      VALUES
        (@ssh_id, @name, @host, @port, @username, @auth_type, @created_at, @updated_at)
    `);
    for (const c of data.connections.ssh) insSsh.run(c);

    // request_folders
    const insFolder = db.prepare(`
      INSERT INTO request_folders
        (request_folder_id, db_id, folder_name, folder_description, created_at, updated_at)
      VALUES
        (@request_folder_id, @db_id, @folder_name, @folder_description, @created_at, @updated_at)
    `);
    for (const f of data.requests.folders) insFolder.run(f);

    // sql_requests
    const insReq = db.prepare(`
      INSERT INTO sql_requests
        (request_id, db_id, request_folder_id, request_name, request_description, sql_text, created_at, updated_at)
      VALUES
        (@request_id, @db_id, @request_folder_id, @request_name, @request_description, @sql_text, @created_at, @updated_at)
    `);
    for (const r of data.requests.items) insReq.run(r);

    // preferences
    const insPref = db.prepare('INSERT INTO preferences (key, value) VALUES (@key, @value)');
    for (const [key, value] of Object.entries(data.preferences)) {
      insPref.run({ key, value: JSON.stringify(value) });
    }

    // users
    const insUser = db.prepare(`
      INSERT INTO users
        (user_id, workspace_id, username, password_hash, is_active, is_admin, created_at, updated_at)
      VALUES
        (@user_id, @workspace_id, @username, @password_hash, @is_active, @is_admin, @created_at, @updated_at)
    `);
    for (const u of data.users) {
      insUser.run({ ...u, is_active: u.is_active ? 1 : 0, is_admin: u.is_admin ? 1 : 0 });
    }

    // channels + read_state
    const insChan = db.prepare(`
      INSERT INTO channels (channel_id, workspace_id, name, description, created_at, updated_at)
      VALUES (@channel_id, @workspace_id, @name, @description, @created_at, @updated_at)
    `);
    const insChanRS = db.prepare(`
      INSERT INTO channel_read_state (channel_id, user_id, last_read_at)
      VALUES (@channel_id, @user_id, @last_read_at)
    `);
    for (const ch of data.messages.channels) {
      insChan.run(ch);
      for (const rs of ch.read_state) {
        insChanRS.run({ channel_id: ch.channel_id, ...rs });
      }
    }

    // direct_conversations + read_state
    const insDirect = db.prepare(`
      INSERT INTO direct_conversations (direct_id, workspace_id, user_id_1, user_id_2, created_at, updated_at)
      VALUES (@direct_id, @workspace_id, @user_id_1, @user_id_2, @created_at, @updated_at)
    `);
    const insDirectRS = db.prepare(`
      INSERT INTO direct_read_state (direct_id, user_id, last_read_at)
      VALUES (@direct_id, @user_id, @last_read_at)
    `);
    for (const d of data.messages.directs) {
      insDirect.run({
        direct_id: d.direct_id,
        workspace_id: d.workspace_id,
        user_id_1: d.participant_user_ids[0],
        user_id_2: d.participant_user_ids[1],
        created_at: d.created_at,
        updated_at: d.updated_at,
      });
      for (const rs of d.read_state) {
        insDirectRS.run({ direct_id: d.direct_id, ...rs });
      }
    }

    // group_conversations + members + read_state
    const insGroup = db.prepare(`
      INSERT INTO group_conversations
        (group_id, workspace_id, name, description, created_by_user_id, created_at, updated_at)
      VALUES
        (@group_id, @workspace_id, @name, @description, @created_by_user_id, @created_at, @updated_at)
    `);
    const insGroupMember = db.prepare(`
      INSERT INTO group_members (group_id, user_id) VALUES (@group_id, @user_id)
    `);
    const insGroupRS = db.prepare(`
      INSERT INTO group_read_state (group_id, user_id, last_read_at)
      VALUES (@group_id, @user_id, @last_read_at)
    `);
    for (const g of data.messages.groups) {
      insGroup.run(g);
      for (const uid of g.member_user_ids) {
        insGroupMember.run({ group_id: g.group_id, user_id: uid });
      }
      for (const rs of g.read_state) {
        insGroupRS.run({ group_id: g.group_id, ...rs });
      }
    }

    // messages
    const insMsg = db.prepare(`
      INSERT INTO messages
        (message_id, workspace_id, conversation_type, conversation_id, author_user_id, content, created_at, updated_at)
      VALUES
        (@message_id, @workspace_id, @conversation_type, @conversation_id, @author_user_id, @content, @created_at, @updated_at)
    `);
    for (const m of data.messages.items) insMsg.run(m);

    // calendars
    const insCal = db.prepare(`
      INSERT INTO calendars (calendar_id, name, color, description, created_at, updated_at)
      VALUES (@calendar_id, @name, @color, @description, @created_at, @updated_at)
    `);
    for (const c of data.calendar.calendars) insCal.run(c);

    // calendar_events (all_day → 0/1)
    const insEvent = db.prepare(`
      INSERT INTO calendar_events
        (event_id, calendar_id, title, description, location, all_day, start_at, end_at, created_at, updated_at)
      VALUES
        (@event_id, @calendar_id, @title, @description, @location, @all_day, @start_at, @end_at, @created_at, @updated_at)
    `);
    for (const e of data.calendar.events) insEvent.run({ ...e, all_day: e.all_day ? 1 : 0 });
  });

  tx();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the DB has no users yet (first run). */
export function isDbEmpty(db: Database.Database): boolean {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  return row.c === 0;
}
