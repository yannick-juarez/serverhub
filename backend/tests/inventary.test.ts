import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { InventoryContext, InventoryEntry, EntryInput } from '../src/modules/inventary/inventary.service';

const originalCwd = process.cwd();
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'serverhub-inventary-test-'));
process.chdir(temporaryDirectory);

let server: Server;
let origin: string;
let secret: string;
let closeDb: () => void;
const errors: unknown[] = [];

before(async () => {
  const { inventaryRouter } = await import('../src/modules/inventary/inventary.routes');
  const { config } = await import('../src/config/env');
  const storage = await import('../src/modules/storage/db');
  closeDb = storage.closeDb;
  secret = config.jwt.secret;
  const app = express();
  app.use(express.json());
  app.use('/api/inventary', inventaryRouter);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    const status = error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (status === 500) errors.push(error);
    res.status(status).json({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' });
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/inventary`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  closeDb?.();
  process.chdir(originalCwd);
  rmSync(temporaryDirectory, { recursive: true, force: true });
  assert.deepEqual(errors, [], 'No unexpected internal server errors');
});

async function request<T>(username: string | null, route: string, method = 'GET', body?: unknown, expected = 200, expectedError?: string): Promise<T> {
  const response = await fetch(`${origin}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(username ? { Authorization: `Bearer ${jwt.sign({ username, is_admin: false }, secret)}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const envelope = await response.json() as { success: boolean; data: T; error?: string; message?: string };
  assert.equal(response.status, expected, JSON.stringify(envelope));
  assert.equal(envelope.success, expected < 400);
  if (expected >= 400) assert.equal(typeof envelope.error, 'string');
  if (expectedError) assert.equal(envelope.error, expectedError);
  return envelope.data;
}

async function context(visibility = 'private', name = 'Maison'): Promise<InventoryContext> {
  return request('Alice', '/contexts', 'POST', { name, usage: 'personal', visibility }, 201);
}
const entriesPath = (id: string): string => `/contexts/${id}/entries`;
function input(name: string, overrides: Partial<EntryInput> = {}): EntryInput {
  return {
    name, kind: 'container', parentId: null, label: '', description: '',
    containerType: overrides.kind && overrides.kind !== 'container' ? null : 'folder',
    itemType: overrides.kind === 'document' ? 'document' : overrides.kind === 'item' ? 'object' : null,
    quantity: 0, unit: 'unité', minQuantity: 0, sku: '', barcode: '', ...overrides,
  };
}
async function entry(contextId: string, data: EntryInput, user = 'Alice'): Promise<InventoryEntry> {
  return request(user, entriesPath(contextId), 'POST', data, 201);
}

test('requires authentication on every route', async () => {
  for (const [route, method] of [
    ['/contexts', 'GET'], ['/contexts', 'POST'], ['/contexts/unknown', 'PUT'], ['/contexts/unknown', 'DELETE'],
    ['/contexts/unknown/entries', 'GET'], ['/contexts/unknown/entries', 'POST'],
    ['/contexts/unknown/entries/unknown', 'PUT'], ['/contexts/unknown/entries/unknown', 'DELETE'],
    ['/contexts/unknown/entries/unknown/stock', 'POST'],
  ]) await request(null, route, method, undefined, 401);
});

test('isolates private contexts and permits shared content edits but not context administration', async () => {
  const privateContext = await context();
  const shared = await context('shared', 'Boutique');
  const visible = await request<InventoryContext[]>('Bob', '/contexts');
  assert.ok(!visible.some((item) => item.id === privateContext.id));
  assert.ok(visible.some((item) => item.id === shared.id));
  await request('Bob', entriesPath(privateContext.id), 'GET', undefined, 404);
  await request('Bob', entriesPath(privateContext.id), 'POST', input('Forbidden'), 404);
  const record = await entry(privateContext.id, input('Private box'));
  await request('Bob', `${entriesPath(privateContext.id)}/${record.id}`, 'PUT', input('Forbidden'), 404);
  await request('Bob', `${entriesPath(privateContext.id)}/${record.id}`, 'DELETE', undefined, 404);
  await request('Bob', `${entriesPath(privateContext.id)}/${record.id}/stock`, 'POST', { delta: 1 }, 404);
  const sharedRecord = await entry(shared.id, input('Shared box'), 'Bob');
  await request('Bob', `${entriesPath(shared.id)}/${sharedRecord.id}`, 'PUT', input('Edited box'));
  await request('Bob', `${entriesPath(shared.id)}/${sharedRecord.id}`, 'DELETE');
  await request('Bob', `/contexts/${shared.id}`, 'PUT', { name: 'Hijack', usage: 'business', visibility: 'private' }, 403);
  await request('Bob', `/contexts/${shared.id}`, 'DELETE', undefined, 403);
  await request('Alice', `/contexts/${shared.id}`, 'PUT', { name: 'Private now', usage: 'business', visibility: 'private' });
  await request('Bob', entriesPath(shared.id), 'GET', undefined, 404);
  assert.equal((await request<InventoryContext[]>('alice', '/contexts')).find((item) => item.id === shared.id)?.name, 'Private now');
});

test('supports deep hierarchies, subtree moves and rejects invalid placement', async () => {
  const home = await context();
  let parentId: string | null = null;
  let top: InventoryEntry | undefined;
  let last: InventoryEntry | undefined;
  for (const name of ['Ville', 'Campus', 'Bâtiment', 'Étage', 'Section', 'Rayon', 'Étagère', 'Carton', 'Dossier']) {
    last = await entry(home.id, input(name, { parentId }));
    top ??= last;
    parentId = last.id;
  }
  assert.ok(top && last);
  const document = await entry(home.id, input('Document', { parentId, kind: 'document', quantity: 1 }));
  await request('Alice', `${entriesPath(home.id)}/${top.id}`, 'PUT', input('Loop', { parentId: last.id }), 400);
  await request('Alice', `${entriesPath(home.id)}/${top.id}`, 'PUT', input('Self', { parentId: top.id }), 400);
  await request('Alice', `${entriesPath(home.id)}/${top.id}`, 'PUT', input('Not a folder', { kind: 'item', quantity: 1 }), 409);
  await request('Alice', `${entriesPath(home.id)}/${top.id}`, 'DELETE', undefined, 409);
  await request('Alice', entriesPath(home.id), 'POST', input('Invalid child', { parentId: document.id }), 400);
  const other = await context();
  const otherBox = await entry(other.id, input('Other'));
  await request('Alice', entriesPath(home.id), 'POST', input('Wrong context', { parentId: otherBox.id }), 404);
  await request('Alice', `${entriesPath(other.id)}/${document.id}`, 'DELETE', undefined, 404);
  const destination = await entry(home.id, input('Destination'));
  await request('Alice', `${entriesPath(home.id)}/${top.id}`, 'PUT', input('Moved hierarchy', { parentId: destination.id }));
  const records = await request<InventoryEntry[]>('Alice', entriesPath(home.id));
  assert.equal(records.find((item) => item.id === document.id)?.parentId, last.id);
  assert.equal(records.find((item) => item.id === top.id)?.parentId, destination.id);
  await request('Alice', `/contexts/${home.id}`, 'DELETE');
  await request('Alice', entriesPath(home.id), 'GET', undefined, 404);
});

test('preserves barcode zeroes, enforces SKU uniqueness and atomic nonnegative stock', async () => {
  const shop = await context('shared', 'Stock');
  const product = await entry(shop.id, input('Pull', { kind: 'item', quantity: 5, minQuantity: 2, sku: 'PULL-1', barcode: '000123456' }));
  assert.equal(product.barcode, '000123456');
  await request('Alice', entriesPath(shop.id), 'POST', input('Duplicate', { kind: 'item', sku: 'PULL-1' }), 409);
  const elsewhere = await context();
  await entry(elsewhere.id, input('Same SKU elsewhere', { kind: 'item', sku: 'PULL-1' }));
  const stockPath = `${entriesPath(shop.id)}/${product.id}/stock`;
  await Promise.all(Array.from({ length: 8 }, () => request('Bob', stockPath, 'POST', { delta: 1 })));
  const decreased = await request<InventoryEntry>('Alice', stockPath, 'POST', { delta: -12.5 });
  assert.equal(decreased.quantity, 0.5);
  await request('Alice', stockPath, 'POST', { delta: -1 }, 400, 'Quantity must remain between 0 and 1,000,000,000,000.');
  await request('Alice', stockPath, 'POST', { delta: 1e12 }, 400);
  const zero = await request<InventoryEntry>('Alice', stockPath, 'POST', { delta: -0.5 });
  assert.equal(zero.quantity, 0);
  await request('Alice', stockPath, 'POST', { delta: 0 }, 400);
  const box = await entry(shop.id, input('Box'));
  await request('Alice', `${entriesPath(shop.id)}/${box.id}/stock`, 'POST', { delta: 1 }, 400);
  const second = await entry(shop.id, input('Second product', { kind: 'item', sku: 'PULL-2' }));
  await request('Alice', `${entriesPath(shop.id)}/${second.id}`, 'PUT', input('Duplicate on update', { kind: 'item', sku: 'PULL-1' }), 409);
  await request('Bob', `${entriesPath(shop.id)}/${second.id}`, 'DELETE');
});

test('validates context and entry bodies without internal errors', async () => {
  await request('Alice', '/contexts', 'POST', { name: ' ', usage: 'personal', visibility: 'private' }, 400);
  await request('Alice', '/contexts', 'POST', { name: 'Invalid', usage: 'unknown', visibility: 'private' }, 400);
  await request('Alice', '/contexts', 'POST', { name: 'Invalid', usage: 'personal', visibility: 'unknown' }, 400);
  const home = await context();
  for (const overrides of [
    { name: '' }, { name: 'x'.repeat(201) }, { quantity: -1 }, { quantity: '5' }, { quantity: null },
    { quantity: 1e13 }, { minQuantity: -1 }, { unit: '' }, { kind: 'other' }, { parentId: 123 },
    { description: 'x'.repeat(5001) }, { barcode: 123 }, { sku: 'CONTAINER-SKU' }, { quantity: 1 },
  ]) await request('Alice', entriesPath(home.id), 'POST', { ...input('Invalid'), ...overrides }, 400);
  await request('Alice', entriesPath(home.id), 'POST', [], 400);
  await request('Alice', `${entriesPath(home.id)}/missing`, 'DELETE', undefined, 404, 'Entry not found.');
});

test('persists contexts, hierarchy and stock when reopening the database', async () => {
  const home = await context();
  const box = await entry(home.id, input('Persistent box'));
  const book = await entry(home.id, input('Persistent book', { parentId: box.id, kind: 'item', quantity: 3 }));
  closeDb();
  const contexts = await request<InventoryContext[]>('Alice', '/contexts');
  assert.ok(contexts.some((item) => item.id === home.id));
  const records = await request<InventoryEntry[]>('Alice', entriesPath(home.id));
  assert.equal(records.find((item) => item.id === book.id)?.quantity, 3);
  assert.equal(records.find((item) => item.id === book.id)?.parentId, box.id);
  await request('Alice', `${entriesPath(home.id)}/${book.id}`, 'DELETE');
  await request('Alice', `${entriesPath(home.id)}/${box.id}`, 'DELETE');
});

test('persists all container types and validates create/update without changing hierarchy', async () => {
  const home = await context();
  for (const containerType of ['folder', 'box', 'home', 'building', 'room', 'shelf'] as const) {
    const container = await entry(home.id, input(containerType, { containerType }));
    assert.equal(container.containerType, containerType);
  }
  const box = await entry(home.id, input('Typed container', { containerType: 'box' }));
  const child = await entry(home.id, input('Child', { parentId: box.id, kind: 'item', quantity: 3 }));
  const updated = await request<InventoryEntry>('Alice', `${entriesPath(home.id)}/${box.id}`, 'PUT', input('Changed type', { containerType: 'home' }));
  assert.equal(updated.containerType, 'home');
  closeDb();
  const records = await request<InventoryEntry[]>('Alice', entriesPath(home.id));
  assert.equal(records.find((record) => record.id === box.id)?.containerType, 'home');
  assert.equal(records.find((record) => record.id === child.id)?.parentId, box.id);
  assert.equal(records.find((record) => record.id === child.id)?.containerType, null);
  for (const containerType of ['unknown', 123, {}, '']) {
    await request('Alice', entriesPath(home.id), 'POST', { ...input('Invalid'), containerType }, 400, 'Invalid container type.');
    await request('Alice', `${entriesPath(home.id)}/${box.id}`, 'PUT', { ...input('Invalid'), containerType }, 400, 'Invalid container type.');
  }
  await request('Alice', entriesPath(home.id), 'POST', input('Not a container', { kind: 'item', containerType: 'box' }), 400);
  const legacyInput: Partial<EntryInput> = input('Legacy client');
  delete legacyInput.containerType;
  const legacy = await request<InventoryEntry>('Alice', entriesPath(home.id), 'POST', legacyInput, 201);
  assert.equal(legacy.containerType, 'folder');
});

test('migrates existing entries to folder types without losing data and can reopen repeatedly', async () => {
  const home = await context();
  const box = await entry(home.id, input('Existing container'));
  const product = await entry(home.id, input('Existing item', { kind: 'item', parentId: box.id, quantity: 7, sku: 'LEGACY-1' }));
  const { getDb } = await import('../src/modules/storage/db');
  getDb().exec('ALTER TABLE inventory_entries DROP COLUMN containerType');
  closeDb();
  const records = await request<InventoryEntry[]>('Alice', entriesPath(home.id));
  assert.equal(records.find((record) => record.id === box.id)?.containerType, 'folder');
  const migrated = records.find((record) => record.id === product.id);
  assert.equal(migrated?.containerType, null);
  assert.equal(migrated?.parentId, box.id);
  assert.equal(migrated?.quantity, 7);
  assert.equal(migrated?.sku, 'LEGACY-1');
  closeDb();
  assert.deepEqual(await request<InventoryEntry[]>('Alice', entriesPath(home.id)), records);
});

test('persists item types, preserves stock on edits and rejects mismatched types', async () => {
  const shop = await context();
  for (const itemType of ['object', 'product', 'document', 'clothing', 'book', 'equipment'] as const) {
    const record = await entry(shop.id, input(itemType, {
      kind: itemType === 'document' ? 'document' : 'item', itemType, quantity: 3,
    }));
    assert.equal(record.itemType, itemType);
    assert.equal(record.containerType, null);
  }
  const clothing = await entry(shop.id, input('Typed item', {
    kind: 'item', itemType: 'clothing', quantity: 7, minQuantity: 2, sku: 'TYPE-1', barcode: '000123',
  }));
  const changed = await request<InventoryEntry>('Alice', `${entriesPath(shop.id)}/${clothing.id}`, 'PUT', {
    ...clothing, itemType: 'equipment',
  });
  assert.equal(changed.itemType, 'equipment');
  assert.equal(changed.quantity, 7);
  assert.equal(changed.minQuantity, 2);
  assert.equal(changed.sku, 'TYPE-1');
  assert.equal(changed.barcode, '000123');
  const stock = await request<InventoryEntry>('Alice', `${entriesPath(shop.id)}/${clothing.id}/stock`, 'POST', { delta: 1 });
  assert.equal(stock.itemType, 'equipment');
  closeDb();
  const records = await request<InventoryEntry[]>('Alice', entriesPath(shop.id));
  assert.equal(records.find((record) => record.id === clothing.id)?.itemType, 'equipment');
  assert.equal(records.find((record) => record.id === clothing.id)?.quantity, 8);
  for (const itemType of ['unknown', 123, {}, '']) {
    await request('Alice', entriesPath(shop.id), 'POST', { ...input('Invalid', { kind: 'item' }), itemType }, 400, 'Invalid item type.');
    await request('Alice', `${entriesPath(shop.id)}/${clothing.id}`, 'PUT', { ...changed, itemType }, 400, 'Invalid item type.');
  }
  await request('Alice', entriesPath(shop.id), 'POST', input('Container mismatch', { itemType: 'clothing' }), 400);
  await request('Alice', entriesPath(shop.id), 'POST', input('Document mismatch', { kind: 'document', itemType: 'clothing' }), 400);
  await request('Alice', entriesPath(shop.id), 'POST', input('Item mismatch', { kind: 'item', itemType: 'document' }), 400);
  const legacy: Partial<EntryInput> = input('Legacy object', { kind: 'item' });
  delete legacy.itemType;
  assert.equal((await request<InventoryEntry>('Alice', entriesPath(shop.id), 'POST', legacy, 201)).itemType, 'object');
  const legacyDocument: Partial<EntryInput> = input('Legacy document', { kind: 'document' });
  delete legacyDocument.itemType;
  assert.equal((await request<InventoryEntry>('Alice', entriesPath(shop.id), 'POST', legacyDocument, 201)).itemType, 'document');
});

test('migrates existing objects and documents without changing data or container types', async () => {
  const home = await context();
  const box = await entry(home.id, input('Box', { containerType: 'box' }));
  const object = await entry(home.id, input('Existing object', { kind: 'item', parentId: box.id, quantity: 5, sku: 'MIGRATION-ITEM' }));
  const document = await entry(home.id, input('Existing document', { kind: 'document', parentId: box.id }));
  const { getDb } = await import('../src/modules/storage/db');
  getDb().exec('ALTER TABLE inventory_entries DROP COLUMN itemType');
  closeDb();
  const records = await request<InventoryEntry[]>('Alice', entriesPath(home.id));
  assert.equal(records.find((record) => record.id === box.id)?.itemType, null);
  assert.equal(records.find((record) => record.id === box.id)?.containerType, 'box');
  assert.deepEqual(records.find((record) => record.id === object.id), object);
  assert.deepEqual(records.find((record) => record.id === document.id), document);
  closeDb();
  assert.deepEqual(await request<InventoryEntry[]>('Alice', entriesPath(home.id)), records);
});
