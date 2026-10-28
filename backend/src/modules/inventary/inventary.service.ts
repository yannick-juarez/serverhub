import { randomUUID } from 'crypto';
import { getDb } from '../storage/db';

export type ContextUsage = 'personal' | 'business' | 'archives' | 'library';
export type EntryKind = 'container' | 'item' | 'document';
export type ContainerType = 'folder' | 'box' | 'home' | 'building' | 'room' | 'shelf';
export type ItemType = 'object' | 'product' | 'document' | 'clothing' | 'book' | 'equipment';
export interface InventoryContext {
  id: string;
  name: string;
  usage: ContextUsage;
  visibility: 'private' | 'shared';
  owner: string;
  createdAt: string;
}
export interface InventoryEntry {
  id: string;
  contextId: string;
  parentId: string | null;
  kind: EntryKind;
  containerType: ContainerType | null;
  itemType: ItemType | null;
  name: string;
  label: string;
  description: string;
  quantity: number;
  unit: string;
  minQuantity: number;
  sku: string;
  barcode: string;
  createdAt: string;
  updatedAt: string;
}
export type ContextInput = Pick<InventoryContext, 'name' | 'usage' | 'visibility'>;
export type EntryInput = Omit<InventoryEntry, 'id' | 'contextId' | 'createdAt' | 'updatedAt'>;

export class InventoryError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
  }
}

let initializedDb: ReturnType<typeof getDb> | undefined;

function db(): ReturnType<typeof getDb> {
  const connection = getDb();
  if (initializedDb !== connection) {
    connection.exec(`
      CREATE TABLE IF NOT EXISTS inventory_contexts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        usage TEXT NOT NULL,
        visibility TEXT NOT NULL CHECK (visibility IN ('private', 'shared')),
        owner TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inventory_entries (
        id TEXT PRIMARY KEY,
        contextId TEXT NOT NULL REFERENCES inventory_contexts(id) ON DELETE CASCADE,
        parentId TEXT REFERENCES inventory_entries(id) ON DELETE RESTRICT,
        kind TEXT NOT NULL CHECK (kind IN ('container', 'item', 'document')),
        name TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL CHECK (quantity >= 0),
        unit TEXT NOT NULL,
        minQuantity REAL NOT NULL CHECK (minQuantity >= 0),
        sku TEXT NOT NULL,
        barcode TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_entries_context_parent
        ON inventory_entries(contextId, parentId);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_entries_sku
        ON inventory_entries(contextId, sku) WHERE sku <> '';
    `);
    const columns = connection.prepare('PRAGMA table_info(inventory_entries)').all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === 'containerType')) {
      connection.transaction(() => {
        connection.exec(`ALTER TABLE inventory_entries ADD COLUMN containerType TEXT
          CHECK (containerType IS NULL OR containerType IN ('folder', 'box', 'home', 'building', 'room', 'shelf'))`);
        connection.exec("UPDATE inventory_entries SET containerType = 'folder' WHERE kind = 'container'");
      })();
    }
    if (!columns.some((column) => column.name === 'itemType')) {
      connection.transaction(() => {
        connection.exec(`ALTER TABLE inventory_entries ADD COLUMN itemType TEXT
          CHECK (itemType IS NULL OR itemType IN ('object', 'product', 'document', 'clothing', 'book', 'equipment'))`);
        connection.exec("UPDATE inventory_entries SET itemType = CASE kind WHEN 'item' THEN 'object' WHEN 'document' THEN 'document' ELSE NULL END");
      })();
    }
    initializedDb = connection;
  }
  return connection;
}

function identity(username: string): string {
  return username.trim().toLowerCase();
}

export function listContexts(username: string): InventoryContext[] {
  return db().prepare("SELECT * FROM inventory_contexts WHERE owner = ? OR visibility = 'shared' ORDER BY name COLLATE NOCASE")
    .all(identity(username)) as InventoryContext[];
}

export function getContext(username: string, id: string): InventoryContext {
  const context = db().prepare("SELECT * FROM inventory_contexts WHERE id = ? AND (owner = ? OR visibility = 'shared')")
    .get(id, identity(username)) as InventoryContext | undefined;
  if (!context) throw new InventoryError('Context not found.', 404);
  return context;
}

export function createContext(username: string, input: ContextInput): InventoryContext {
  const context: InventoryContext = {
    ...input, id: randomUUID(), owner: identity(username), createdAt: new Date().toISOString(),
  };
  db().prepare('INSERT INTO inventory_contexts (id, name, usage, visibility, owner, createdAt) VALUES (@id, @name, @usage, @visibility, @owner, @createdAt)')
    .run(context);
  return context;
}

function ownedContext(username: string, id: string): InventoryContext {
  const context = getContext(username, id);
  if (context.owner !== identity(username)) {
    throw new InventoryError('Only the owner can edit or delete this context.', 403);
  }
  return context;
}

export function updateContext(username: string, id: string, input: ContextInput): InventoryContext {
  ownedContext(username, id);
  db().prepare('UPDATE inventory_contexts SET name = @name, usage = @usage, visibility = @visibility WHERE id = @id')
    .run({ ...input, id });
  return getContext(username, id);
}

export function deleteContext(username: string, id: string): void {
  db().transaction(() => {
    ownedContext(username, id);
    // Break parent references before the context cascade removes the entire tree.
    db().prepare('UPDATE inventory_entries SET parentId = NULL WHERE contextId = ?').run(id);
    db().prepare('DELETE FROM inventory_contexts WHERE id = ?').run(id);
  })();
}

export function listEntries(username: string, contextId: string): InventoryEntry[] {
  getContext(username, contextId);
  return db().prepare('SELECT * FROM inventory_entries WHERE contextId = ? ORDER BY name COLLATE NOCASE')
    .all(contextId) as InventoryEntry[];
}

function getEntry(contextId: string, id: string): InventoryEntry {
  const entry = db().prepare('SELECT * FROM inventory_entries WHERE contextId = ? AND id = ?')
    .get(contextId, id) as InventoryEntry | undefined;
  if (!entry) throw new InventoryError('Entry not found.', 404);
  return entry;
}

function validatePlacement(contextId: string, input: EntryInput, id?: string): void {
  if (input.parentId) {
    let parent: InventoryEntry | undefined = getEntry(contextId, input.parentId);
    if (parent.kind !== 'container') throw new InventoryError('The parent must be a container.');
    while (parent) {
      if (parent.id === id) throw new InventoryError('A container cannot be moved into itself or one of its descendants.');
      parent = parent.parentId ? getEntry(contextId, parent.parentId) : undefined;
    }
  }
  if (id && input.kind !== 'container' && db().prepare('SELECT id FROM inventory_entries WHERE parentId = ? LIMIT 1').get(id)) {
    throw new InventoryError('This container has entries. Move them before changing its type.', 409);
  }
  if (input.sku && db().prepare('SELECT id FROM inventory_entries WHERE contextId = ? AND sku = ? AND id <> ?')
    .get(contextId, input.sku, id ?? '')) {
    throw new InventoryError('This SKU already exists in this context.', 409);
  }
}

export function createEntry(username: string, contextId: string, input: EntryInput): InventoryEntry {
  return db().transaction(() => {
    getContext(username, contextId);
    validatePlacement(contextId, input);
    const now = new Date().toISOString();
    const entry: InventoryEntry = { ...input, id: randomUUID(), contextId, createdAt: now, updatedAt: now };
    db().prepare(`INSERT INTO inventory_entries
      (id, contextId, parentId, kind, containerType, itemType, name, label, description, quantity, unit, minQuantity, sku, barcode, createdAt, updatedAt)
      VALUES (@id, @contextId, @parentId, @kind, @containerType, @itemType, @name, @label, @description, @quantity, @unit, @minQuantity, @sku, @barcode, @createdAt, @updatedAt)`)
      .run(entry);
    return entry;
  })();
}

export function updateEntry(username: string, contextId: string, id: string, input: EntryInput): InventoryEntry {
  return db().transaction(() => {
    getContext(username, contextId);
    getEntry(contextId, id);
    validatePlacement(contextId, input, id);
    db().prepare(`UPDATE inventory_entries SET parentId = @parentId, kind = @kind, containerType = @containerType, itemType = @itemType, name = @name,
      label = @label, description = @description, quantity = @quantity, unit = @unit,
      minQuantity = @minQuantity, sku = @sku, barcode = @barcode, updatedAt = @updatedAt WHERE id = @id`)
      .run({ ...input, id, updatedAt: new Date().toISOString() });
    return getEntry(contextId, id);
  })();
}

export function adjustStock(username: string, contextId: string, id: string, delta: number): InventoryEntry {
  return db().transaction(() => {
    getContext(username, contextId);
    const entry = getEntry(contextId, id);
    if (entry.kind === 'container') throw new InventoryError('Containers do not have stock.');
    const next = entry.quantity + delta;
    if (!Number.isFinite(next) || next < 0 || next > 1e12) {
      throw new InventoryError('Quantity must remain between 0 and 1,000,000,000,000.');
    }
    db().prepare('UPDATE inventory_entries SET quantity = ?, updatedAt = ? WHERE id = ?')
      .run(next, new Date().toISOString(), id);
    return getEntry(contextId, id);
  })();
}

export function deleteEntry(username: string, contextId: string, id: string): void {
  db().transaction(() => {
    getContext(username, contextId);
    getEntry(contextId, id);
    if (db().prepare('SELECT id FROM inventory_entries WHERE parentId = ? LIMIT 1').get(id)) {
      throw new InventoryError('This container is not empty. Move or delete its contents before deleting it.', 409);
    }
    db().prepare('DELETE FROM inventory_entries WHERE id = ?').run(id);
  })();
}
