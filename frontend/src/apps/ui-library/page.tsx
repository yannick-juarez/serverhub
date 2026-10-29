import { useState, type ReactNode } from "react";
import { HiOutlineArrowPath, HiOutlineCheck, HiOutlineInboxStack, HiOutlinePlus, HiOutlineRocketLaunch, HiOutlineSquares2X2, HiOutlineTrash } from "react-icons/hi2";
import Input from "../../components/Input";
import { ToastContainer } from "../../components/ToastContainer";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import { useToast } from "../../hooks/useToast";
import Alert from "../../ui/Alert";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Checkbox from "../../ui/Checkbox";
import CollapsibleSection from "../../ui/CollapsibleSection";
import ConfirmDialog from "../../ui/ConfirmDialog";
import EmptyState from "../../ui/EmptyState";
import IconButton from "../../ui/IconButton";
import InlineConfirm from "../../ui/InlineConfirm";
import PanelWindow from "../../ui/PanelWindow";
import SegmentedControl from "../../ui/SegmentedControl";
import Skeleton from "../../ui/Skeleton";
import Toggle from "../../ui/Toggle";
import { Subtitle, Title } from "../../ui/Typography";

const sections = [
  { id: "typography", label: "Typography" },
  { id: "buttons", label: "Buttons" },
  { id: "fields", label: "Form fields" },
  { id: "controls", label: "Toggles & choices" },
  { id: "dialogs", label: "Confirms" },
  { id: "alerts", label: "Alerts & toasts" },
  { id: "states", label: "Empty & loading" },
  { id: "feedback", label: "Badges & colors" },
  { id: "surfaces", label: "Panels" },
];

type ViewMode = "list" | "grid" | "timeline";
type ConfirmKind = "publish" | "delete" | null;

const wait = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));

type ShowcaseProps = {
  id: string;
  title: string;
  description: string;
  code: string;
  children: ReactNode;
};

function Showcase({ id, title, description, code, children }: ShowcaseProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 rounded-xl border border-white/10 bg-black/40">
      <header className="border-b border-white/10 p-5">
        <h2 id={`${id}-title`} className="text-lg font-semibold text-white">{title}</h2>
        <Subtitle className="mt-1">{description}</Subtitle>
      </header>
      <div className="space-y-6 p-5">{children}</div>
      <details className="border-t border-white/10">
        <summary className="cursor-pointer rounded-b-xl px-5 py-3 text-xs font-medium text-slate-300 focus-visible:outline focus-visible:outline-emerald-300">
          Usage / TSX
        </summary>
        <pre className="overflow-x-auto border-t border-white/10 bg-black/30 p-5 text-xs leading-relaxed text-emerald-200">
          <code>{code}</code>
        </pre>
      </details>
    </section>
  );
}

export default function UiLibraryPage() {
  useDocumentTitle("UI LIBRARY - SERVERHUB");
  const [message, setMessage] = useState("Try a button. All examples are local and do not change your data.");
  const [name, setName] = useState("");
  const [compact, setCompact] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const { toasts, showToast, removeToast } = useToast();

  const closeConfirm = () => {
    if (!confirmLoading) {
      setConfirmKind(null);
    }
  };

  const confirmAction = async () => {
    const isDelete = confirmKind === "delete";
    setConfirmLoading(true);
    await wait(700);
    setConfirmLoading(false);
    setConfirmKind(null);
    showToast({
      title: isDelete ? "Delete preview complete" : "Changes published",
      subtitle: isDelete ? "No workspace was deleted. This is only a demo." : "Your preview changes are now live.",
      type: isDelete ? "warning" : "success",
      duration: 3500,
    });
  };

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-96 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute right-0 top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>
      <main className="relative mx-auto w-full max-w-7xl p-5 lg:p-8">
        <header className="mb-6 border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Title>UI Library</Title>
            <Badge tone="success">Reusable components</Badge>
          </div>
          <Subtitle className="mt-2 max-w-2xl">
            A shared visual language for our apps. Explore typography, actions and surfaces inspired by Applications, Tasks and Database.
          </Subtitle>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
          <nav aria-label="UI library sections" className="flex flex-wrap gap-2 lg:sticky lg:top-6 lg:flex-col">
            {sections.map((section, index) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:border-violet-300/30 hover:bg-violet-500/10 hover:text-white focus-visible:outline focus-visible:outline-violet-300"
              >
                <span className="mr-2 font-mono text-slate-500">0{index + 1}</span>
                {section.label}
              </a>
            ))}
          </nav>

          <div className="min-w-0 space-y-6">
            <Showcase
              id="typography"
              title="Typography"
              description="Inter, clear hierarchy and muted supporting text. Use one h1 per page and the as prop for section headings."
              code={`import { Title, Subtitle } from "../../ui/Typography";\n\n<Title>Page title</Title>\n<Title as="h2">Section title</Title>\n<Subtitle>Supporting description for your page.</Subtitle>`}
            >
              <div>
                <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Title / 24-30px / semibold</p>
                <Title as="h3">Everything in its right place.</Title>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Subtitle / 14px / regular</p>
                <Subtitle>Give your content context with a short, readable description.</Subtitle>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-200">Body text for everyday content.</p>
                  <p className="mt-2 text-xs text-slate-400">Caption, metadata and helpful hints.</p>
                </div>
                <code className="self-center break-words rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-violet-200">
                  font-family: Inter, sans-serif
                </code>
              </div>
            </Showcase>

            <Showcase
              id="buttons"
              title="Buttons"
              description="Primary uses black text on white with green icons. Secondary is for alternatives, destructive for removal. Native button props and refs are supported; type defaults to button."
              code={`import Button from "../../ui/Button";\n\n<Button onClick={save}>Save changes</Button>\n<Button variant="secondary" onClick={cancel}>Cancel</Button>\n<Button variant="destructive" onClick={remove}>Delete</Button>\n<Button size="sm">Compact action</Button>\n<Button disabled>Unavailable</Button>\n<Button loading aria-label="Saving changes">Saving...</Button>`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => setMessage("Primary action: changes saved in this preview.")}>
                  <HiOutlineCheck aria-hidden="true" className="h-4 w-4" /> Save changes
                </Button>
                <Button variant="secondary" onClick={() => setMessage("Secondary action: preview cancelled.")}>Cancel</Button>
                <Button variant="destructive" onClick={() => setMessage("Destructive action preview. No data was deleted.")}>
                  <HiOutlineTrash aria-hidden="true" className="h-4 w-4" /> Delete
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={() => setMessage("Compact action: a preview item was added.")}>
                  <HiOutlinePlus aria-hidden="true" className="h-4 w-4" /> Add item
                </Button>
                <Button disabled>Disabled</Button>
                <Button variant="secondary" loading aria-label="Saving changes">Saving...</Button>
                <IconButton
                  icon={<HiOutlineSquares2X2 />}
                  aria-label="Compact layout"
                  title="Compact layout"
                  aria-pressed={compact}
                  active={compact}
                  onClick={() => setCompact((previous) => !previous)}
                  activeClassName="border-violet-300/60 bg-violet-300/30 text-violet-100"
                  inactiveClassName="border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  className="focus-visible:outline focus-visible:outline-violet-300"
                />
                <span className="text-xs text-slate-400">{compact ? "Compact layout selected" : "Default layout selected"}</span>
              </div>
              <p role="status" className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">{message}</p>
            </Showcase>

            <Showcase
              id="fields"
              title="Form fields"
              description="The existing shared Input component, with visible labels, helper text and native disabled states."
              code={`import Input from "../../components/Input";\n\n<label htmlFor="project-name">Project name</label>\n<Input\n  id="project-name"\n  value={name}\n  onChange={(event) => setName(event.target.value)}\n  aria-describedby="project-help"\n/>\n<p id="project-help">Choose a descriptive name.</p>`}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="ui-project-name" className="block text-xs font-medium text-slate-200">Project name</label>
                  <Input id="ui-project-name" placeholder="My workspace" value={name} onChange={(event) => setName(event.target.value)} aria-describedby="ui-project-help" />
                  <p id="ui-project-help" className="break-words text-xs text-slate-400">{name ? `Preview: ${name}` : "Choose a descriptive name."}</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="ui-readonly" className="block text-xs font-medium text-slate-200">Disabled field</label>
                  <Input id="ui-readonly" value="Managed by your administrator" disabled aria-describedby="ui-disabled-help" />
                  <p id="ui-disabled-help" className="text-xs text-slate-400">Not editable in this state.</p>
                </div>
              </div>
            </Showcase>

            <Showcase
              id="controls"
              title="Toggles & choices"
              description="Use toggles for immediate on/off settings, checkboxes for consent or multi-select, and segmented controls for a single choice among a few options."
              code={`import Toggle from "../../ui/Toggle";\nimport Checkbox from "../../ui/Checkbox";\nimport SegmentedControl from "../../ui/SegmentedControl";\n\n<Toggle\n  label="Email notifications"\n  description="Receive alerts when a task fails."\n  checked={enabled}\n  onChange={setEnabled}\n/>\n\n<Checkbox\n  label="I understand the impact"\n  checked={accepted}\n  onChange={(event) => setAccepted(event.target.checked)}\n/>\n\n<SegmentedControl\n  label="View"\n  value={view}\n  onChange={setView}\n  options={[\n    { value: "list", label: "List" },\n    { value: "grid", label: "Grid" },\n  ]}\n/>`}
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
                  <Toggle
                    label="Email notifications"
                    description="Receive an alert when a scheduled task fails."
                    checked={notifications}
                    onChange={setNotifications}
                  />
                  <div className="h-px bg-white/10" />
                  <Toggle
                    label="Automatic backups"
                    description="Create a daily backup at 02:00."
                    checked={autoBackup}
                    onChange={setAutoBackup}
                  />
                  <div className="h-px bg-white/10" />
                  <Toggle label="Maintenance mode" description="Managed by an administrator." checked={false} onChange={() => undefined} disabled />
                </div>
                <div className="space-y-5 rounded-lg border border-white/10 bg-white/5 p-4">
                  <Checkbox
                    label="I understand this action affects all users"
                    description="Required before applying workspace-wide changes."
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                  />
                  <SegmentedControl
                    label="Display mode"
                    value={viewMode}
                    onChange={setViewMode}
                    options={[
                      { value: "list", label: "List" },
                      { value: "grid", label: "Grid" },
                      { value: "timeline", label: "Timeline" },
                    ]}
                  />
                  <p className="text-xs text-slate-400">
                    Notifications {notifications ? "on" : "off"} · backups {autoBackup ? "on" : "off"} · {viewMode} view
                  </p>
                </div>
              </div>
            </Showcase>

            <Showcase
              id="dialogs"
              title="Confirms"
              description="Use inline confirms for quick, reversible decisions in rows or toolbars. Use a dialog when the action needs more context. Escape cancels both."
              code={`import InlineConfirm from "../../ui/InlineConfirm";\nimport ConfirmDialog from "../../ui/ConfirmDialog";\n\n<InlineConfirm\n  label="Delete"\n  confirmLabel="Delete file"\n  onConfirm={deleteFile}\n/>\n\n<Button variant="destructive" onClick={() => setOpen(true)}>Delete</Button>\n\n<ConfirmDialog\n  open={open}\n  tone="danger"\n  title="Delete workspace?"\n  description="This action cannot be undone."\n  confirmLabel="Delete workspace"\n  loading={deleting}\n  onCancel={() => setOpen(false)}\n  onConfirm={deleteWorkspace}\n/>`}
            >
              <div>
                <p className="mb-3 text-xs font-medium text-slate-200">Inline confirm</p>
                <div className="flex flex-wrap items-center gap-3">
                  <InlineConfirm
                    label={<><HiOutlineTrash aria-hidden="true" className="h-4 w-4" /> Delete file</>}
                    confirmLabel="Delete"
                    onConfirm={async () => {
                      await wait(600);
                      showToast({ title: "File delete preview", subtitle: "No file was deleted.", type: "warning", duration: 3000 });
                    }}
                  />
                  <InlineConfirm
                    label="Revoke access"
                    confirmLabel="Revoke"
                    size="sm"
                    onConfirm={() => {
                      showToast({ title: "Access revoke preview", subtitle: "No permissions were changed.", type: "info", duration: 3000 });
                    }}
                  />
                  <InlineConfirm
                    label={<><HiOutlineArrowPath aria-hidden="true" className="h-4 w-4" /> Reset settings</>}
                    confirmLabel="Reset"
                    variant="primary"
                    onConfirm={() => {
                      showToast({ title: "Settings reset preview", subtitle: "Your settings were not changed.", type: "success", duration: 3000 });
                    }}
                  />
                </div>
              </div>
              <div className="h-px bg-white/10" />
              <p className="-mb-3 text-xs font-medium text-slate-200">Dialog confirm</p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setConfirmKind("publish")}>
                  <HiOutlineRocketLaunch aria-hidden="true" className="h-4 w-4" /> Publish changes
                </Button>
                <Button variant="destructive" onClick={() => setConfirmKind("delete")}>
                  <HiOutlineTrash aria-hidden="true" className="h-4 w-4" /> Delete workspace
                </Button>
              </div>
              <Alert tone="info" title="Safe demo">Confirming only simulates the action and shows a toast. No data is changed.</Alert>
            </Showcase>

            <Showcase
              id="alerts"
              title="Alerts & toasts"
              description="Alerts stay in the page for contextual feedback. Toasts are temporary confirmations after an action."
              code={`import Alert from "../../ui/Alert";\nimport { useToast } from "../../hooks/useToast";\nimport { ToastContainer } from "../../components/ToastContainer";\n\n<Alert tone="warning" title="Disk almost full">\n  Free some space to keep backups running.\n</Alert>\n\nconst { toasts, showToast, removeToast } = useToast();\nshowToast({ title: "Saved", subtitle: "Changes saved", type: "success" });\n<ToastContainer toasts={toasts} onRemove={removeToast} />`}
            >
              <div className="grid gap-3">
                <Alert tone="info" title="Update available">ServerHub 2.4 includes performance improvements.</Alert>
                <Alert tone="success" title="Backup completed">The latest snapshot was created 2 minutes ago.</Alert>
                <Alert tone="warning" title="Disk almost full" action={<Button size="sm" variant="secondary" onClick={() => showToast({ title: "Storage review", subtitle: "This preview does not open storage settings.", type: "info", duration: 3000 })}>Review</Button>}>
                  Free some space to keep backups running.
                </Alert>
                <Alert tone="danger" title="Connection failed">The database could not be reached. Check credentials and try again.</Alert>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => showToast({ title: "Changes saved", subtitle: "Your settings are up to date.", type: "success", duration: 3500 })}>
                  <HiOutlineCheck aria-hidden="true" className="h-4 w-4" /> Success toast
                </Button>
                <Button size="sm" variant="secondary" onClick={() => showToast({ title: "Sync in progress", subtitle: "We will let you know when it is done.", type: "info", duration: 3500 })}>
                  Info toast
                </Button>
                <Button size="sm" variant="destructive" onClick={() => showToast({ title: "Upload failed", subtitle: "The file exceeds the allowed size.", type: "error", duration: 3500 })}>
                  Error toast
                </Button>
              </div>
            </Showcase>

            <Showcase
              id="states"
              title="Empty & loading"
              description="Explain empty screens with a clear next action, and use skeletons while content loads."
              code={`import EmptyState from "../../ui/EmptyState";\nimport Skeleton from "../../ui/Skeleton";\n\n<EmptyState\n  icon={<HiOutlineInboxStack />}\n  title="No tasks yet"\n  description="Create a task to automate recurring work."\n  action={<Button>Create task</Button>}\n/>\n\n<div aria-busy="true">\n  <Skeleton className="h-4 w-1/2" />\n</div>`}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <EmptyState
                  icon={<HiOutlineInboxStack className="h-5 w-5" />}
                  title="No scheduled tasks"
                  description="Create your first task to automate backups, cleanups or reports."
                  action={
                    <Button size="sm" onClick={() => showToast({ title: "Create task", subtitle: "This preview does not create a task.", type: "info", duration: 3000 })}>
                      <HiOutlinePlus aria-hidden="true" className="h-4 w-4" /> Create task
                    </Button>
                  }
                />
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-200">Loading preview</p>
                    <Button size="sm" variant="secondary" onClick={() => setShowSkeleton((previous) => !previous)}>
                      <HiOutlineArrowPath aria-hidden="true" className="h-4 w-4" /> {showSkeleton ? "Show content" : "Show loading"}
                    </Button>
                  </div>
                  {showSkeleton ? (
                    <div aria-busy="true" aria-label="Loading tasks" className="space-y-3">
                      {[0, 1, 2].map((item) => (
                        <div key={item} className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-3 w-2/3" />
                            <Skeleton className="h-2.5 w-1/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {["Nightly backup", "Clean temporary files", "Weekly usage report"].map((task) => (
                        <li key={task} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                          {task}
                          <Badge tone="success">Active</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Showcase>

            <Showcase
              id="feedback"
              title="Badges & colors"
              description="Neutral surfaces with semantic accents. Always pair status colors with a text label."
              code={`import Badge from "../../ui/Badge";\n\n<Badge>Draft</Badge>\n<Badge tone="success">Active</Badge>\n<Badge tone="warning">Pending</Badge>\n<Badge tone="danger">Failed</Badge>`}
            >
              <div className="flex flex-wrap gap-3">
                <Badge>Draft</Badge>
                <Badge tone="success">Active</Badge>
                <Badge tone="warning">Pending</Badge>
                <Badge tone="danger">Failed</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { name: "Neutral", token: "slate-400", color: "bg-slate-400" },
                  { name: "Success", token: "emerald-400", color: "bg-emerald-400" },
                  { name: "Warning", token: "amber-400", color: "bg-amber-400" },
                  { name: "Danger", token: "red-400", color: "bg-red-400" },
                ].map((swatch) => (
                  <div key={swatch.name} className="overflow-hidden rounded-lg border border-white/10">
                    <div aria-hidden="true" className={`h-12 ${swatch.color}`} />
                    <div className="p-3">
                      <p className="text-xs font-medium">{swatch.name}</p>
                      <code className="text-[10px] text-slate-400">{swatch.token}</code>
                    </div>
                  </div>
                ))}
              </div>
            </Showcase>

            <Showcase
              id="surfaces"
              title="Panels"
              description="Existing collapsible sections and panel windows, as used in the platform's apps."
              code={`import CollapsibleSection from "../../ui/CollapsibleSection";\nimport PanelWindow from "../../ui/PanelWindow";\n\n<CollapsibleSection title="Advanced settings" bodyClassName="p-4">\n  Panel content\n</CollapsibleSection>\n{open && (\n  <PanelWindow\n    title="Details"\n    onClose={() => setOpen(false)}\n    collapsible\n    className="rounded-lg border border-white/10 bg-white/5"\n    headerClassName="gap-2 px-4 py-3"\n    bodyClassName="p-4"\n  >\n    Panel content\n  </PanelWindow>\n)}`}
            >
              <CollapsibleSection title="Advanced settings" bodyClassName="border-t border-white/10 p-4">
                <Subtitle>Expand or collapse this section to keep secondary content out of the way.</Subtitle>
              </CollapsibleSection>
              {panelOpen ? (
                <PanelWindow
                  title="Preview panel"
                  onClose={() => setPanelOpen(false)}
                  collapsible
                  className="rounded-lg border border-white/10 bg-white/5"
                  headerClassName="gap-2 px-4 py-3"
                  bodyClassName="p-4"
                  headerRight={<Badge tone="success">Live preview</Badge>}
                >
                  <Subtitle>A reusable window with a title, optional actions, collapse control and close button.</Subtitle>
                </PanelWindow>
              ) : (
                <Button variant="secondary" onClick={() => setPanelOpen(true)}>Reopen preview panel</Button>
              )}
            </Showcase>
          </div>
        </div>
      </main>
      <ConfirmDialog
        open={confirmKind !== null}
        tone={confirmKind === "delete" ? "danger" : "default"}
        title={confirmKind === "delete" ? "Delete workspace?" : "Publish changes?"}
        description={
          confirmKind === "delete"
            ? "This will permanently remove the workspace and its settings. In this preview, nothing will be deleted."
            : "Your changes will become visible to everyone in this workspace."
        }
        confirmLabel={confirmKind === "delete" ? "Delete workspace" : "Publish"}
        loading={confirmLoading}
        onCancel={closeConfirm}
        onConfirm={() => void confirmAction()}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
