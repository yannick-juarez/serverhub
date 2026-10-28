import { useState, type ReactNode } from "react";
import { HiOutlineCheck, HiOutlinePlus, HiOutlineSquares2X2, HiOutlineTrash } from "react-icons/hi2";
import Input from "../../components/Input";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import CollapsibleSection from "../../ui/CollapsibleSection";
import IconButton from "../../ui/IconButton";
import PanelWindow from "../../ui/PanelWindow";
import { Subtitle, Title } from "../../ui/Typography";

const sections = [
  { id: "typography", label: "Typography" },
  { id: "buttons", label: "Buttons" },
  { id: "fields", label: "Form fields" },
  { id: "feedback", label: "Badges & colors" },
  { id: "surfaces", label: "Panels" },
];

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

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-96 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute right-0 top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>
      <main className="relative mx-auto w-full max-w-7xl p-5 lg:p-8">
        <header className="mb-6 border-b border-white/10 pb-6">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-violet-300">ServerHub / Design system</p>
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
    </div>
  );
}
