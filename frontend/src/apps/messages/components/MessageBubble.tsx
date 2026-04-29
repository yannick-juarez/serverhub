import { useState } from "react";
import { HiOutlineFaceSmile } from "react-icons/hi2";
import { REACTION_OPTIONS } from "../constants";
import type { ChatMessage, Proposal } from "../types";

const MessageProposal = ({ proposal }: { proposal: Proposal }) => (
  <div className="mt-1 w-fit max-w-[85%] rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
    <p className="text-sm font-semibold text-white">{proposal.title}</p>
    <ul className="mt-2 space-y-2 text-xs text-white/90">
      {proposal.items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/50" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
    {proposal.state === "incoming" ? (
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-lg border border-emerald-200/50 bg-emerald-200/20 px-2.5 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-200/30">
          Accept
        </button>
        <button className="rounded-lg border border-rose-200/40 bg-rose-200/15 px-2.5 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-200/25">
          Decline
        </button>
        <button className="rounded-lg border border-sky-200/40 bg-sky-200/15 px-2.5 py-1 text-xs font-semibold text-sky-100 hover:bg-sky-200/25">
          Ask
        </button>
      </div>
    ) : (
      <div className="mt-3 inline-flex animate-pulse rounded-full border border-amber-700/30 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
        Waiting for approval
      </div>
    )}
  </div>
);

const MessageReactions = ({
  messageId,
  reactions,
  reactionPickerFor,
  onTogglePicker,
  onReact,
  canReact = true,
  showReactButton = false,
}: {
  messageId: string;
  reactions: Record<string, number>;
  reactionPickerFor: string | null;
  onTogglePicker: (id: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  canReact?: boolean;
  showReactButton?: boolean;
}) => {
  const items = Object.entries(reactions);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {items.map(([emoji, count]) => (
        <span
          key={`${messageId}-${emoji}`}
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[11px] text-slate-100 transition hover:bg-white/15"
        >
          <span>{emoji}</span>
          <span className="text-white/70">{count}</span>
        </span>
      ))}
      {canReact && (showReactButton || reactionPickerFor === messageId) ? (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePicker(messageId);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[11px] text-slate-200 transition hover:bg-white/15"
          >
            <HiOutlineFaceSmile className="h-3.5 w-3.5" />
            React
          </button>
          {reactionPickerFor === messageId ? (
            <div className="absolute left-0 top-7 z-20 flex w-max max-w-[280px] flex-nowrap gap-1 overflow-x-auto rounded-lg border border-white/15 bg-zinc-950/95 p-1.5 shadow-xl">
              {REACTION_OPTIONS.map((emoji) => (
                <button
                  key={`${messageId}-picker-${emoji}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReact(messageId, emoji);
                  }}
                  className="rounded-md border border-white/10 px-1.5 py-1 text-sm transition hover:bg-white/10"
                  title={`Add ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const MessageBubbleMine = ({
  message,
}: {
  message: ChatMessage;
}) => (
  <div className="flex w-full flex-col items-end justify-center gap-1">
    <time className="text-xs text-white/55">{message.time}</time>
    <div className="w-fit max-w-[85%] rounded-xl rounded-tr border-white/80 bg-white/90 px-3 py-1 text-black">
      <p className="text-sm leading-6 text-black">{message.content}</p>
    </div>
    {message.proposal ? <MessageProposal proposal={message.proposal} /> : null}
  </div>
);

function MessageBubbleTheirs({
  message,
  tone,
  reactions,
  reactionPickerFor,
  onTogglePicker,
  onReact,
  onAvatarClick,
  isGrouped = false,
}: {
  message: ChatMessage;
  tone: string;
  reactions: Record<string, number>;
  reactionPickerFor: string | null;
  onTogglePicker: (id: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onAvatarClick?: (author: string, role: string) => void;
  isGrouped?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`flex w-fit max-w-[85%] flex-row gap-2 rounded-tl-md border-white/15 bg-black/35 ${isGrouped ? "my-0.5 ml-10" : "my-5"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isGrouped && (
        <button
          onClick={() => onAvatarClick?.(message.author, message.role)}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${tone}`}
          title={`View ${message.author}`}
        >
          {message.author.charAt(0).toUpperCase()}
        </button>
      )}
      <div className="flex flex-col items-start gap-1">
        {!isGrouped && (
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-slate-100">{message.author}</p>
            <p className="text-[11px] text-slate-300/90">{message.role}</p>
            <time className="text-xs text-slate-400">{message.time}</time>
          </div>
        )}
        <p
          className={`rounded-lg border px-3 py-1 text-sm leading-6 text-slate-100 ${
            message.system ? "border-amber-500/20 bg-amber-500/5 italic text-amber-200/80" : "border-white/10"
          }`}
        >
          {message.content}
        </p>
        {message.proposal ? <MessageProposal proposal={message.proposal} /> : null}
        <MessageReactions
          messageId={message.id}
          reactions={reactions}
          reactionPickerFor={reactionPickerFor}
          onTogglePicker={onTogglePicker}
          onReact={onReact}
          showReactButton={isHovered}
        />
      </div>
    </div>
  );
}

export default function MessageBubble({
  message,
  tone,
  reactions,
  reactionPickerFor,
  onTogglePicker,
  onReact,
  onAvatarClick,
  isGrouped = false,
}: {
  message: ChatMessage;
  tone: string;
  reactions: Record<string, number>;
  reactionPickerFor: string | null;
  onTogglePicker: (id: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onAvatarClick?: (author: string, role: string) => void;
  isGrouped?: boolean;
}) {
  if (message.ownership === "mine") {
    return (
      <article className="w-full">
        <MessageBubbleMine
          message={message}
        />
      </article>
    );
  }

  return (
    <article className="w-full">
      <MessageBubbleTheirs
        message={message}
        tone={tone}
        reactions={reactions}
        reactionPickerFor={reactionPickerFor}
        onTogglePicker={onTogglePicker}
        onReact={onReact}
        onAvatarClick={onAvatarClick}
        isGrouped={isGrouped}
      />
    </article>
  );
}
