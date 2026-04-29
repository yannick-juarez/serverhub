type ChannelEditPanelProps = {
  channelName: string;
  channelDescription: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export default function ChannelEditPanel({
  channelName,
  channelDescription,
  onNameChange,
  onDescriptionChange,
  onSave,
  onCancel,
}: ChannelEditPanelProps) {
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="mb-1 text-slate-400">Channel title</p>
        <input
          value={channelName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="channel-name"
          className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="mb-1 text-slate-400">Description</p>
        <textarea
          rows={4}
          value={channelDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe this channel"
          className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-slate-200 hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="rounded-md border border-black bg-white/90 px-3 py-1 font-semibold text-black hover:bg-white"
        >
          Save channel
        </button>
      </div>
    </div>
  );
}
