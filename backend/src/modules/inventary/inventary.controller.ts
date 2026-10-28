import type { Request, Response } from 'express';
import * as inventory from './inventary.service';
import type { ContextInput, EntryInput } from './inventary.service';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new inventory.InventoryError('A JSON object is required.');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new inventory.InventoryError(`${field}: ${required ? 'nonempty ' : ''}text of at most ${max} characters is required.`);
  }
  return value.trim();
}

function amount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) {
    throw new inventory.InventoryError(`${field}: a number between 0 and 1,000,000,000,000 is required.`);
  }
  return value;
}

function contextInput(body: unknown): ContextInput {
  const value = object(body);
  const { usage, visibility } = value;
  if (usage !== 'personal' && usage !== 'business' && usage !== 'archives' && usage !== 'library') {
    throw new inventory.InventoryError('Invalid context usage.');
  }
  if (visibility !== 'private' && visibility !== 'shared') throw new inventory.InventoryError('Invalid visibility.');
  return { name: text(value.name, 'Name', 200, true), usage, visibility };
}

function entryInput(body: unknown): EntryInput {
  const value = object(body);
  const { kind } = value;
  if (kind !== 'container' && kind !== 'item' && kind !== 'document') throw new inventory.InventoryError('Invalid entry type.');
  const containerType = kind === 'container' ? value.containerType ?? 'folder' : value.containerType ?? null;
  if (containerType !== null && containerType !== 'folder' && containerType !== 'box' && containerType !== 'home'
    && containerType !== 'building' && containerType !== 'room' && containerType !== 'shelf') {
    throw new inventory.InventoryError('Invalid container type.');
  }
  if (kind !== 'container' && containerType !== null) {
    throw new inventory.InventoryError('Container types are only available for containers.');
  }
  const parentId = value.parentId === null ? null : text(value.parentId, 'Parent', 100, true);
  const quantity = amount(value.quantity, 'Quantity');
  const minQuantity = amount(value.minQuantity, 'Low-stock threshold');
  const sku = text(value.sku, 'SKU', 100);
  const barcode = text(value.barcode, 'Barcode', 200);
  if (kind === 'container' && (quantity !== 0 || minQuantity !== 0 || sku || barcode)) {
    throw new inventory.InventoryError('Stock fields are only available for items and documents.');
  }
  return {
    parentId, kind, containerType, name: text(value.name, 'Name', 200, true),
    label: text(value.label, 'Category', 100), description: text(value.description, 'Description', 5000),
    quantity, minQuantity, unit: text(value.unit, 'Unit', 40, true), sku, barcode,
  };
}

function username(req: Request): string {
  if (!req.user) throw new inventory.InventoryError('Authentication required.', 401);
  return req.user.username;
}

export async function listContexts(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: inventory.listContexts(username(req)) });
}
export async function createContext(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: inventory.createContext(username(req), contextInput(req.body)) });
}
export async function updateContext(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: inventory.updateContext(username(req), req.params.contextId, contextInput(req.body)) });
}
export async function deleteContext(req: Request, res: Response): Promise<void> {
  inventory.deleteContext(username(req), req.params.contextId);
  res.json({ success: true, message: 'Context deleted.' });
}
export async function listEntries(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: inventory.listEntries(username(req), req.params.contextId) });
}
export async function createEntry(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: inventory.createEntry(username(req), req.params.contextId, entryInput(req.body)) });
}
export async function updateEntry(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: inventory.updateEntry(username(req), req.params.contextId, req.params.entryId, entryInput(req.body)) });
}
export async function deleteEntry(req: Request, res: Response): Promise<void> {
  inventory.deleteEntry(username(req), req.params.contextId, req.params.entryId);
  res.json({ success: true, message: 'Entry deleted.' });
}
export async function adjustStock(req: Request, res: Response): Promise<void> {
  const { delta } = object(req.body);
  if (typeof delta !== 'number' || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1e12) {
    throw new inventory.InventoryError('Invalid stock adjustment.');
  }
  res.json({ success: true, data: inventory.adjustStock(username(req), req.params.contextId, req.params.entryId, delta) });
}
