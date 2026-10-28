import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cookies from 'js-cookie';
import {
  HiOutlineArchiveBox, HiOutlineArrowPath, HiOutlineChevronRight,
  HiOutlineFolder, HiOutlineMagnifyingGlass, HiOutlineMinus,
  HiOutlinePencilSquare, HiOutlinePlus, HiOutlineTrash, HiOutlineXMark,
} from 'react-icons/hi2';
import * as api from '../../api/inventary';
import type { ContextInput, EntryInput, EntryKind, InventoryContext, InventoryEntry } from '../../api/inventary';
import Input from '../../components/Input';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';
import { ContextEditor, EntryEditor, Modal } from './editors';
import { kindLabels, selectClass, usageLabels } from './labels';
import { useAppHeader } from '../../components/Header/appHeader';
import EntryIcon from './EntryIcon';
import { containerTypes } from './containerTypes';
import { itemTypes } from './itemTypes';

type Editor = { type: 'context'; context?: InventoryContext }
  | { type: 'entry'; entry?: InventoryEntry; kind: EntryKind };
type Removal = { type: 'context'; context: InventoryContext } | { type: 'entry'; entry: InventoryEntry };

function ContainerTree({ entries, parentId, currentId, onNavigate }: {
  entries: InventoryEntry[]; parentId: string | null; currentId: string | null; onNavigate: (id: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {entries.filter((entry) => entry.kind === 'container' && entry.parentId === parentId).map((entry) => {
        const hasChildren = entries.some((child) => child.kind === 'container' && child.parentId === entry.id);
        const content = (
          <button onClick={() => onNavigate(entry.id)} aria-current={currentId === entry.id ? 'location' : undefined}
            className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition hover:bg-white/10 ${currentId === entry.id ? 'bg-emerald-500/10 text-emerald-200' : 'text-slate-300'}`}>
            <EntryIcon entry={entry} className="h-4 w-4 shrink-0 text-emerald-300" />
            <span className="truncate">{entry.name}</span>
          </button>
        );
        return (
          <li key={entry.id}>
            {hasChildren ? (
              <details open>
                <summary className="cursor-pointer text-xs text-slate-500">
                  <span className="inline-flex w-[calc(100%-1rem)] align-middle">{content}</span>
                </summary>
                <div className="ml-3 border-l border-white/10 pl-2">
                  <ContainerTree entries={entries} parentId={entry.id} currentId={currentId} onNavigate={onNavigate} />
                </div>
              </details>
            ) : content}
          </li>
        );
      })}
    </ul>
  );
}

const isLow = (entry: InventoryEntry): boolean => entry.kind !== 'container' && entry.quantity <= entry.minQuantity;
const number = (value: number): string => value.toLocaleString('en-US', { maximumFractionDigits: 6 });

export default function InventaryPage() {
  useDocumentTitle('INVENTARY - SERVERHUB');
  const [contexts, setContexts] = useState<InventoryContext[]>([]);
  const [contextId, setContextId] = useState<string | null>(null);
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [parentId, setParentId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);
  const requestId = useRef(0);
  const current = contexts.find((context) => context.id === contextId);
  const selected = entries.find((entry) => entry.id === selectedId);
  const owned = current?.owner === (Cookies.get('user') ?? '').trim().toLowerCase();
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  const reload = useCallback(async (preferredId: string | null) => {
    const request = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const nextContexts = await api.fetchContexts();
      const nextId = nextContexts.some((context) => context.id === preferredId) ? preferredId : nextContexts[0]?.id ?? null;
      const nextEntries = nextId ? await api.fetchEntries(nextId) : [];
      if (request !== requestId.current) return;
      setContexts(nextContexts);
      setContextId(nextId);
      setEntries(nextEntries);
      setParentId((previous) => nextEntries.some((entry) => entry.id === previous && entry.kind === 'container') ? previous : null);
      setSelectedId(null);
    } catch (reason) {
      if (request === requestId.current) setError(reason instanceof Error ? reason.message : 'Unable to load Inventary.');
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(null);
    return () => { requestId.current += 1; };
  }, [reload]);

  function ancestors(id: string | null): InventoryEntry[] {
    const chain: InventoryEntry[] = [];
    const seen = new Set<string>();
    let next = id ? entryMap.get(id) : undefined;
    while (next && !seen.has(next.id)) {
      seen.add(next.id);
      chain.unshift(next);
      next = next.parentId ? entryMap.get(next.parentId) : undefined;
    }
    return chain;
  }
  function path(id: string | null): string {
    return [current?.name, ...ancestors(id).map((entry) => entry.name)].filter(Boolean).join(' / ');
  }
  function navigate(id: string | null) {
    setParentId(id);
    setSelectedId(null);
    setQuery('');
    setLowOnly(false);
    setKind('');
  }
  function openEditor(next: Editor) {
    setError('');
    setEditor(next);
  }
  function openRemoval(next: Removal) {
    setError('');
    setRemoval(next);
  }
  async function mutate(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setEditor(null);
      setRemoval(null);
      setNotice(message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The change could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  function saveContext(input: ContextInput) {
    void mutate(async () => {
      if (editor?.type !== 'context') return;
      if (editor.context) {
        const updated = await api.updateContext(editor.context.id, input);
        setContexts((previous) => previous.map((context) => context.id === updated.id ? updated : context));
      } else {
        const created = await api.createContext(input);
        requestId.current += 1;
        setContexts((previous) => [...previous, created]);
        setContextId(created.id);
        setEntries([]);
        navigate(null);
      }
    }, 'Context saved.');
  }
  function saveEntry(input: EntryInput) {
    if (!current || editor?.type !== 'entry') return;
    void mutate(async () => {
      const saved = editor.entry
        ? await api.updateEntry(current.id, editor.entry.id, input)
        : await api.createEntry(current.id, input);
      setEntries((previous) => [...previous.filter((entry) => entry.id !== saved.id), saved]);
      if (saved.id === parentId && saved.kind !== 'container') navigate(saved.parentId);
      setSelectedId(saved.id);
    }, 'Entry saved.');
  }
  function stock(entry: InventoryEntry, delta: number) {
    void mutate(async () => {
      const updated = await api.adjustStock(entry.contextId, entry.id, delta);
      setEntries((previous) => previous.map((item) => item.id === updated.id ? updated : item));
    }, 'Stock updated.');
  }
  function remove() {
    if (!removal) return;
    void mutate(async () => {
      if (removal.type === 'context') {
        await api.deleteContext(removal.context.id);
        setContexts((previous) => previous.filter((context) => context.id !== removal.context.id));
        setContextId(null);
        setEntries([]);
        navigate(null);
      } else {
        await api.deleteEntry(removal.entry.contextId, removal.entry.id);
        setEntries((previous) => previous.filter((entry) => entry.id !== removal.entry.id));
        if (parentId === removal.entry.id) navigate(removal.entry.parentId);
        setSelectedId(null);
      }
    }, 'Deleted successfully.');
  }

  const searching = Boolean(query.trim() || lowOnly);
  const normalizedQuery = query.trim().toLocaleLowerCase('en');
  const visible = entries.filter((entry) =>
    (searching || entry.parentId === parentId)
    && (!kind || entry.kind === kind || (kind.startsWith('item:') && entry.itemType === kind.slice(5)))
    && (!lowOnly || isLow(entry))
    && (!normalizedQuery || [entry.name, entry.label, entry.description, entry.sku, entry.barcode, path(entry.parentId)]
      .some((value) => value.toLocaleLowerCase('en').includes(normalizedQuery))))
    .sort((a, b) => Number(b.kind === 'container') - Number(a.kind === 'container') || a.name.localeCompare(b.name, 'en', { numeric: true }));
  const lowCount = entries.filter(isLow).length;
  const disabled = loading || busy;
  const headerDisabled = disabled || Boolean(editor || removal);
  const currentContainer = parentId ? entryMap.get(parentId) : undefined;

  useAppHeader({
    menus: [
      { label: 'File', items: [
        { name: 'New context', shortcut: 'Ctrl+N', disabled: headerDisabled, action: () => openEditor({ type: 'context' }) },
        { name: 'New container', shortcut: 'Ctrl+Shift+N', disabled: headerDisabled || !current, action: () => openEditor({ type: 'entry', kind: 'container' }) },
        { name: 'New item / document', shortcut: 'N', disabled: headerDisabled || !current, action: () => openEditor({ type: 'entry', kind: 'item' }) },
      ] },
      { label: 'Edit', items: [
        { name: 'Edit container', disabled: headerDisabled || !currentContainer,
          action: () => { if (currentContainer) openEditor({ type: 'entry', entry: currentContainer, kind: currentContainer.kind }); } },
        { name: 'Edit selected item', disabled: headerDisabled || !selected,
          action: () => { if (selected) openEditor({ type: 'entry', entry: selected, kind: selected.kind }); } },
        { name: 'Context settings', disabled: headerDisabled || !current || !owned,
          action: () => { if (current && owned) openEditor({ type: 'context', context: current }); } },
        { name: 'Delete context', disabled: headerDisabled || !current || !owned,
          action: () => { if (current && owned) openRemoval({ type: 'context', context: current }); } },
      ] },
    ],
    status: {
      tone: error ? 'error' : busy || loading ? 'pending' : editor || removal ? 'idle' : notice ? 'success' : 'idle',
      text: error || (busy ? 'Saving...' : loading ? 'Loading...' : editor ? 'Editing...' : removal ? 'Awaiting confirmation' : notice),
    },
    selection: {
      label: 'Context', value: contextId, placeholder: 'No context', disabled: headerDisabled,
      options: contexts.map((context) => ({
        value: context.id, label: context.name,
        detail: `${usageLabels[context.usage]} · ${context.visibility === 'private' ? 'Private' : 'Shared'}`,
      })),
      onChange: (id) => {
        if (id === contextId) return;
        navigate(null);
        setNotice('');
        void reload(id);
      },
    },
  });

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden">
        <div className="absolute -left-20 -top-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>
      <main className="relative mx-auto max-w-[1600px] px-5 py-3 lg:px-8 lg:py-4">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          {current ? (
            <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
              <button disabled={disabled} className="break-words text-emerald-200 hover:underline disabled:opacity-50" onClick={() => navigate(null)}>{current.name}</button>
              {ancestors(parentId).map((entry) => <span key={entry.id} className="inline-flex min-w-0 items-center gap-2">
                <HiOutlineChevronRight className="h-3 w-3 shrink-0 text-slate-600" />
                <button disabled={disabled} className="inline-flex min-w-0 items-center gap-1.5 text-slate-300 hover:text-white disabled:opacity-50"
                  aria-current={entry.id === parentId ? 'location' : undefined} onClick={() => navigate(entry.id)}>
                  <EntryIcon entry={entry} className="h-4 w-4 shrink-0 text-emerald-300" /><span className="break-words">{entry.name}</span>
                </button>
              </span>)}
            </nav>
          ) : <span className="text-xs text-slate-400">No context selected</span>}
          <div className="flex flex-wrap items-center gap-2">
            {current && <>
              {currentContainer && <Button variant="secondary" disabled={disabled} onClick={() => openEditor({ type: 'entry', entry: currentContainer, kind: currentContainer.kind })}>Edit container</Button>}
              <Button variant="secondary" disabled={disabled} onClick={() => openEditor({ type: 'entry', kind: 'container' })}><HiOutlineFolder className="h-4 w-4" /> Container</Button>
              <Button disabled={disabled} onClick={() => openEditor({ type: 'entry', kind: 'item' })}><HiOutlinePlus className="h-4 w-4" /> Add entry</Button>
            </>}
            <Button variant="secondary" disabled={disabled} onClick={() => void reload(contextId)} aria-label="Refresh">
              <HiOutlineArrowPath className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </header>

        {error && !editor && !removal && (
          <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}<Button variant="secondary" disabled={disabled} onClick={() => void reload(contextId)}>Retry</Button>
          </div>
        )}
        {loading && <p role="status" className="mb-4 text-sm text-slate-400">Loading inventory...</p>}

        <div className="grid items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]" aria-busy={loading}>
          <aside className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Containers</h2>
            </div>
            {!current && !loading && <p className="p-4 text-xs text-slate-500">Choose or create a context in the header.</p>}
            {current && !loading && (
              <nav aria-label="Container tree" className="border-t border-white/10 p-3">
                <button className="mb-2 flex items-center gap-2 px-2 py-2 text-xs font-semibold text-white" onClick={() => navigate(null)}>
                  <HiOutlineArchiveBox className="h-4 w-4 text-emerald-300" /> Context root
                </button>
                <div className="max-h-[55vh] overflow-auto">
                  <ContainerTree entries={entries} parentId={null} currentId={parentId} onNavigate={navigate} />
                </div>
              </nav>
            )}
          </aside>

          <section className="min-w-0">
            {!current ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-20 text-center">
                <HiOutlineArchiveBox className="mx-auto mb-4 h-12 w-12 text-emerald-300/60" />
                <h2 className="text-lg font-semibold">No context selected</h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
                  Select or create a context to manage containers, objects and documents
                  in a structured hierarchy.
                </p>
                <Button className="mt-6" disabled={disabled} onClick={() => openEditor({ type: 'context' })}>Create a context</Button>
              </div>
            ) : (
              <div className={loading ? 'pointer-events-none opacity-50' : ''}>
                <div className="rounded-xl border border-white/10 bg-white/[0.02]">
                  <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4">
                    <label className="relative min-w-[180px] flex-1">
                      <span className="sr-only">Search this context</span>
                      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, SKU, barcode, notes, location..." />
                      <HiOutlineMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute right-3 top-2 h-4 w-4 text-slate-500" />
                    </label>
                    <select aria-label="Filter by type" className={`${selectClass} !w-auto`} value={kind} onChange={(event) => setKind(event.target.value)}>
                      <option value="">All types</option>
                      {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      <optgroup label="Item types">
                        {Object.entries(itemTypes).filter(([value]) => value !== 'document')
                          .map(([value, definition]) => <option key={value} value={`item:${value}`}>{definition.label}</option>)}
                      </optgroup>
                    </select>
                    <Button variant="secondary" aria-pressed={lowOnly} onClick={() => setLowOnly(!lowOnly)}
                      className={lowOnly ? 'border-amber-300/40 text-amber-200' : ''}>Low stock ({lowCount})</Button>
                  </div>
                  {searching && <p className="px-4 pt-3 text-xs text-slate-400">Searching the entire context · {visible.length} result(s)</p>}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-500">
                        <tr><th className="p-4 font-medium">Entry</th><th className="p-4 font-medium">References</th><th className="p-4 font-medium">Stock</th><th className="p-4 font-medium"><span className="sr-only">Actions</span></th></tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {visible.map((entry) => <tr key={entry.id} className={selectedId === entry.id ? 'bg-emerald-500/[0.07]' : 'hover:bg-white/[0.03]'}>
                          <td className="min-w-[220px] p-4">
                            <button onClick={() => entry.kind === 'container' ? navigate(entry.id) : setSelectedId(entry.id)} className="flex items-center gap-3 text-left">
                              <span className="rounded-lg border border-white/10 bg-white/5 p-2"><EntryIcon entry={entry} className={`h-5 w-5 ${entry.kind === 'container' ? 'text-emerald-300' : 'text-slate-300'}`} /></span>
                              <span><span className="block break-words text-sm font-medium text-slate-100">{entry.name}</span>
                                <span className="mt-1 block text-[11px] text-slate-500">{entry.label || (entry.kind === 'container' ? containerTypes[entry.containerType ?? 'folder'].label : itemTypes[entry.itemType ?? (entry.kind === 'document' ? 'document' : 'object')].label)}{searching ? ` · ${path(entry.parentId)}` : ''}</span></span>
                            </button>
                          </td>
                          <td className="p-4 font-mono text-[11px] text-slate-400">
                            <span className="block">{entry.sku || '—'}</span>
                            {entry.barcode && <span className="mt-1 block">{entry.barcode}</span>}
                          </td>
                          <td className="whitespace-nowrap p-4">
                            {entry.kind === 'container' ? <span className="text-slate-500">{entries.filter((child) => child.parentId === entry.id).length} entries</span>
                              : <div className="flex flex-wrap items-center gap-2"><span>{number(entry.quantity)} {entry.unit}</span>{isLow(entry) && <Badge tone={entry.quantity === 0 ? 'danger' : 'warning'}>{entry.quantity === 0 ? 'Out of stock' : 'Low stock'}</Badge>}</div>}
                          </td>
                          <td className="p-4">
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" disabled={disabled} aria-label={`Edit ${entry.name}`} onClick={() => openEditor({ type: 'entry', entry, kind: entry.kind })}><HiOutlinePencilSquare className="h-4 w-4" /></Button>
                              <Button variant="destructive" disabled={disabled} aria-label={`Delete ${entry.name}`} onClick={() => openRemoval({ type: 'entry', entry })}><HiOutlineTrash className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>
                  {!visible.length && <div className="px-6 py-14 text-center">
                    {currentContainer ? <EntryIcon entry={currentContainer} className="mx-auto mb-3 h-9 w-9 text-slate-600" />
                      : <HiOutlineFolder className="mx-auto mb-3 h-9 w-9 text-slate-600" />}
                    <p className="text-sm text-slate-300">{searching || kind ? 'No entries match these filters.' : 'This container is empty.'}</p>
                    <p className="mt-2 text-xs text-slate-500">{searching || kind ? 'Try another name, SKU or barcode.' : 'Add a container to create a level, or an item / document to catalog it.'}</p>
                  </div>}
                </div>
                {selected && selected.kind !== 'container' && <section aria-label={`Record: ${selected.name}`} className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-500/[0.03] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <EntryIcon entry={selected} className="h-6 w-6 shrink-0 text-emerald-300" />
                      <div className="min-w-0"><h3 className="break-words text-lg font-semibold">{selected.name}</h3><p className="mt-1 text-xs text-slate-400">{path(selected.parentId)}</p></div>
                    </div>
                    <Button variant="secondary" aria-label="Close record" onClick={() => setSelectedId(null)}><HiOutlineXMark className="h-4 w-4" /></Button>
                  </div>
                  {selected.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-300">{selected.description}</p>}
                  <dl className="my-5 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                    <div><dt className="text-slate-500">Item type / category</dt><dd className="mt-1 break-words">{itemTypes[selected.itemType ?? (selected.kind === 'document' ? 'document' : 'object')].label}{selected.label ? ` · ${selected.label}` : ''}</dd></div>
                    <div><dt className="text-slate-500">SKU</dt><dd className="mt-1 break-all font-mono">{selected.sku || 'Not specified'}</dd></div>
                    <div><dt className="text-slate-500">Barcode</dt><dd className="mt-1 break-all font-mono">{selected.barcode || 'Not specified'}</dd></div>
                    <div><dt className="text-slate-500">Low-stock threshold</dt><dd className="mt-1">{number(selected.minQuantity)} {selected.unit}</dd></div>
                  </dl>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
                    <div className="flex items-center gap-3">
                      <Button variant="secondary" disabled={disabled || selected.quantity < 1} aria-label="Remove one unit" onClick={() => stock(selected, -1)}><HiOutlineMinus className="h-4 w-4" /></Button>
                      <span className="text-sm font-semibold" aria-live="polite">{number(selected.quantity)} {selected.unit}</span>
                      <Button variant="secondary" disabled={disabled || selected.quantity + 1 > 1e12} aria-label="Add one unit" onClick={() => stock(selected, 1)}><HiOutlinePlus className="h-4 w-4" /></Button>
                    </div>
                    <Button variant="secondary" disabled={disabled} onClick={() => openEditor({ type: 'entry', entry: selected, kind: selected.kind })}>Edit / move</Button>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-500">Updated {new Date(selected.updatedAt).toLocaleString('en-US')} · For precise adjustments, use “Edit / move”.</p>
                </section>}
              </div>
            )}
          </section>
        </div>
      </main>
      {editor?.type === 'context' && <ContextEditor context={editor.context} busy={busy} error={error} onClose={() => { setEditor(null); setError(''); }} onSave={saveContext} />}
      {editor?.type === 'entry' && <EntryEditor entry={editor.entry} parentId={parentId} initialKind={editor.kind}
        entries={entries} path={path} busy={busy} error={error} onClose={() => { setEditor(null); setError(''); }} onSave={saveEntry} />}
      {removal && <Modal title={removal.type === 'context' ? 'Delete this context?' : 'Delete this entry?'} busy={busy} error={error} onClose={() => { setRemoval(null); setError(''); }}>
        <p className="break-words text-sm text-slate-300">
          {removal.type === 'context'
            ? `“${removal.context.name}” and all its contents will be permanently deleted, including containers and records.`
            : `“${removal.entry.name}” will be permanently deleted. A container must be empty before it can be deleted.`}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => { setRemoval(null); setError(''); }}>Cancel</Button>
          <Button variant="destructive" loading={busy} onClick={remove}>Delete permanently</Button>
        </div>
      </Modal>}
    </div>
  );
}
