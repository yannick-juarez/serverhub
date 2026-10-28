import { apiRequest } from './http';

export type ContextUsage = 'personal' | 'business' | 'archives' | 'library';
export type EntryKind = 'container' | 'item' | 'document';
export type ContainerType = 'folder' | 'box' | 'home' | 'building' | 'room' | 'shelf';
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

const base = '/inventary/contexts';
const contextPath = (id: string): string => `${base}/${encodeURIComponent(id)}`;
const entryPath = (contextId: string, id: string): string => `${contextPath(contextId)}/entries/${encodeURIComponent(id)}`;

export const fetchContexts = (): Promise<InventoryContext[]> => apiRequest(base);
export const createContext = (body: ContextInput): Promise<InventoryContext> => apiRequest(base, { method: 'POST', body });
export const updateContext = (id: string, body: ContextInput): Promise<InventoryContext> => apiRequest(contextPath(id), { method: 'PUT', body });
export const deleteContext = (id: string): Promise<void> => apiRequest(contextPath(id), { method: 'DELETE' });
export const fetchEntries = (id: string): Promise<InventoryEntry[]> => apiRequest(`${contextPath(id)}/entries`);
export const createEntry = (contextId: string, body: EntryInput): Promise<InventoryEntry> => apiRequest(`${contextPath(contextId)}/entries`, { method: 'POST', body });
export const updateEntry = (contextId: string, id: string, body: EntryInput): Promise<InventoryEntry> => apiRequest(entryPath(contextId, id), { method: 'PUT', body });
export const deleteEntry = (contextId: string, id: string): Promise<void> => apiRequest(entryPath(contextId, id), { method: 'DELETE' });
export const adjustStock = (contextId: string, id: string, delta: number): Promise<InventoryEntry> => apiRequest(`${entryPath(contextId, id)}/stock`, { method: 'POST', body: { delta } });
