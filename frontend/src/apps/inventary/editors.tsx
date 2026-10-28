import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import Input from '../../components/Input';
import Button from '../../ui/Button';
import type { ContextInput, EntryInput, InventoryContext, InventoryEntry } from '../../api/inventary';
import { kindLabels, selectClass, usageLabels } from './labels';

export function Modal({ title, children, onClose, busy, error }: {
  title: string; children: ReactNode; onClose: () => void; busy: boolean; error: string;
}) {
  return (
    <Dialog open onClose={() => { if (!busy) onClose(); }} className="fixed inset-0 z-[100]">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel className="w-full max-w-xl rounded-xl border border-white/15 bg-zinc-950 p-6 text-white shadow-2xl">
            <DialogTitle className="mb-5 text-lg font-semibold">{title}</DialogTitle>
            {error && <p role="alert" className="mb-4 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            {children}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-2 text-xs text-slate-300">{label}{children}</label>;
}

export function ContextEditor({ context, busy, error, onClose, onSave }: {
  context?: InventoryContext; busy: boolean; error: string; onClose: () => void;
  onSave: (input: ContextInput) => void;
}) {
  const [form, setForm] = useState<ContextInput>(context ?? { name: '', usage: 'personal', visibility: 'private' });
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ name: form.name.trim(), usage: form.usage, visibility: form.visibility });
  }
  return (
    <Modal title={context ? 'Context settings' : 'New context'} onClose={onClose} busy={busy} error={error}>
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          <Field label="Context name">
            <Input autoFocus required maxLength={200} value={form.name} placeholder="Home, city archives, shop..."
              onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Usage">
            <select className={selectClass} value={form.usage} onChange={(event) => {
              const usage = event.target.value;
              if (usage === 'personal' || usage === 'business' || usage === 'archives' || usage === 'library') setForm({ ...form, usage });
            }}>
              {Object.entries(usageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Access">
            <select className={selectClass} value={form.visibility} onChange={(event) => {
              const visibility = event.target.value;
              if (visibility === 'private' || visibility === 'shared') setForm({ ...form, visibility });
            }}>
              <option value="private">Private — only me</option>
              <option value="shared">Shared — platform users</option>
            </select>
          </Field>
          <p className="text-xs leading-relaxed text-slate-400">
            {form.visibility === 'shared'
              ? 'All signed-in users can view, create, edit and delete content. Only you can change the context settings, sharing or delete the context.'
              : 'This context and all its entries are visible only to you.'}
          </p>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!form.name.trim()}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

export function EntryEditor({ entry, parentId, initialKind, entries, path, busy, error, onClose, onSave }: {
  entry?: InventoryEntry; parentId: string | null; initialKind: EntryInput['kind'];
  entries: InventoryEntry[]; path: (id: string | null) => string;
  busy: boolean; error: string; onClose: () => void; onSave: (input: EntryInput) => void;
}) {
  const [form, setForm] = useState<EntryInput>(entry ?? {
    parentId, kind: initialKind, name: '', label: '', description: '', quantity: initialKind === 'container' ? 0 : 1,
    minQuantity: 0, unit: 'unit', sku: '', barcode: '',
  });
  const excluded = new Set<string>();
  if (entry) {
    excluded.add(entry.id);
    let size = 0;
    while (size !== excluded.size) {
      size = excluded.size;
      entries.forEach((item) => { if (item.parentId && excluded.has(item.parentId)) excluded.add(item.id); });
    }
  }
  const parents = entries.filter((item) => item.kind === 'container' && !excluded.has(item.id));
  const hasChildren = entry && entries.some((item) => item.parentId === entry.id);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      parentId: form.parentId, kind: form.kind, name: form.name.trim(), label: form.label.trim(),
      description: form.description.trim(), quantity: form.kind === 'container' ? 0 : form.quantity,
      minQuantity: form.kind === 'container' ? 0 : form.minQuantity, unit: form.unit.trim(),
      sku: form.kind === 'container' ? '' : form.sku.trim(), barcode: form.kind === 'container' ? '' : form.barcode.trim(),
    });
  }
  return (
    <Modal title={entry ? 'Edit / move entry' : 'New entry'} onClose={onClose} busy={busy} error={error}>
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select className={selectClass} value={form.kind} disabled={Boolean(hasChildren)} onChange={(event) => {
                const kind = event.target.value;
                if (kind === 'container' || kind === 'item' || kind === 'document') setForm({ ...form, kind });
              }}>
                {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Category (free text)">
              <Input maxLength={100} value={form.label} placeholder="City, attic, box, book..."
                onChange={(event) => setForm({ ...form, label: event.target.value })} />
            </Field>
          </div>
          <Field label="Name">
            <Input autoFocus required maxLength={200} value={form.name} placeholder="Winter box 2, blue sweater..."
              onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Store in">
            <select className={selectClass} value={form.parentId ?? ''} onChange={(event) => setForm({ ...form, parentId: event.target.value || null })}>
              <option value="">Context root</option>
              {parents.map((item) => <option key={item.id} value={item.id}>{path(item.id)}</option>)}
            </select>
          </Field>
          <Field label="Description / notes">
            <textarea className={`${selectClass} min-h-20`} maxLength={5000} value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          {form.kind !== 'container' && (
            <div className="space-y-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold text-emerald-200">Identification and stock</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="SKU (optional, unique per context)">
                  <Input maxLength={100} value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
                </Field>
                <Field label="Barcode (optional)">
                  <Input maxLength={200} value={form.barcode} placeholder="Type or use a USB scanner"
                    onChange={(event) => setForm({ ...form, barcode: event.target.value })} />
                </Field>
                <Field label="Quantity">
                  <Input required type="number" min={0} max={1e12} step="any" value={form.quantity}
                    onChange={(event) => setForm({ ...form, quantity: event.target.valueAsNumber })} />
                </Field>
                <Field label="Unit">
                  <Input required maxLength={40} value={form.unit} placeholder="unit, kg, box..."
                    onChange={(event) => setForm({ ...form, unit: event.target.value })} />
                </Field>
                <Field label="Low-stock threshold">
                  <Input required type="number" min={0} max={1e12} step="any" value={form.minQuantity}
                    onChange={(event) => setForm({ ...form, minQuantity: event.target.valueAsNumber })} />
                </Field>
              </div>
              <p className="text-xs text-slate-400">An alert appears when the quantity is at or below this threshold.</p>
            </div>
          )}
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!form.name.trim()}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
