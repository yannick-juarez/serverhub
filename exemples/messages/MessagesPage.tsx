import { useEffect, useMemo, useState } from "react";
import { FaMagnifyingGlass, FaRegBell, FaRegBookmark, FaUserGroup } from "react-icons/fa6";
import { HiOutlineHashtag, HiOutlineLockClosed, HiOutlinePaperAirplane, HiOutlinePhone, HiOutlinePlusSmall, HiOutlineSparkles, HiOutlineVideoCamera } from "react-icons/hi2";
import { BiMessageDetail } from "react-icons/bi";
import sampleData from "../data/messages-sample.json";

interface Channel {
	id: string;
	name: string;
	description: string;
	unread?: number;
}

interface Proposal {
    title: string;
    items: string[];
    state?: "incoming" | "waiting";
    waitingFor?: string;
}

interface ChatMessage {
	id: string;
	author: string;
	role: string;
	time: string;
	content: string;
	ownership: "mine" | "their";
	system?: boolean;
	proposal?: Proposal;
}

interface DirectMessage {
	id: string;
	name: string;
	status: "online" | "away";
	unread?: number;
}

interface WorkspaceSample {
	id: string;
	name: string;
	description?: string;
	channels: Channel[];
	directMessages: DirectMessage[];
	channelMessages: Record<string, ChatMessage[] | undefined>;
}

const DEFAULT_WORKSPACE_ID = "demo";
const SELECTED_WORKSPACE_STORAGE_KEY = "selectedWorkspaceId";

const { workspaces, avatarTones } = sampleData as unknown as {
	workspaces: WorkspaceSample[];
	avatarTones: string[];
};

const readSelectedWorkspaceId = () => {
	if (typeof window === "undefined") {
		return DEFAULT_WORKSPACE_ID;
	}

	try {
		const raw = window.localStorage.getItem(SELECTED_WORKSPACE_STORAGE_KEY);
		const normalized = raw?.trim();
		return normalized || DEFAULT_WORKSPACE_ID;
	} catch {
		return DEFAULT_WORKSPACE_ID;
	}
};

// Message bubble component
const MessageBubbleMine = ({ message }: { message: ChatMessage }) => {
    return (
        <div className="flex flex-col items-end justify-center w-full gap-1">
            <time className="text-xs text-white/55">{message.time}</time>
            <div className="w-fit max-w-[85%] rounded-xl rounded-tr border-white/80 bg-white/90 text-black px-3 py-1">
                <p className="text-sm leading-6 text-black">{message.content}</p>
            </div>
            {message.proposal ? (
                <MessageProposal proposal={message.proposal} />
            ) : null}
        </div>
    );
};

// For "theirs" messages, we randomize the avatar color tone for visual variety
const MessageBubbleTheirs = ({ message }: { message: ChatMessage }) => {
    const tone = avatarTones[Math.floor(Math.random() * avatarTones.length)];
    const avatarClass = `flex h-8 w-8 items-center justify-center rounded-full border ${tone}`;

    return (
        <div className="w-fit max-w-[85%] rounded-tl-md border-white/15 bg-black/35 my-5 flex flex-row gap-2">
            <div className={avatarClass}>
                {message.author.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col items-start justify-start gap-1">
                <div className="flex flex-row items-center justify-between gap-1">
                    <div className="flex flex-row items-center gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="leading-tight flex flex-row items-center justify-center gap-2">
                                <p className="text-xs font-semibold text-slate-100">{message.author}</p>
                                <p className="text-[11px] text-slate-300/90">{message.role}</p>
                            </div>
                        </div>
                        <time className="text-xs text-slate-400">{message.time}</time>
                    </div>
                </div>
                <p className="text-sm leading-6 text-slate-100 border border-white/10 px-3 py-1 rounded-lg">{message.content}</p>

                {message.proposal ? (
                    <MessageProposal proposal={message.proposal} />
                ) : null}
            </div>
        </div>
    );
};

const MessageProposal = ({ proposal }: { proposal: Proposal }) => {
    return (
        <div className={`w-fit max-w-[85%] rounded-lg border p-3 mt-1 border-white/10 bg-white/5 backdrop-blur-sm`}>
            <p className={`text-sm font-semibold text-white`}>{proposal.title}</p>
            <ul className={`mt-2 space-y-2 text-xs text-white/90`}>
                {proposal.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                        <span className={`mt-[5px] h-1.5 w-1.5 rounded-full bg-white/50`} />
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
                <div className="mt-3 inline-flex rounded-full border border-amber-700/30 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 animate-pulse">
                    Waiting for approval
                </div>
            )}
        </div>
    );
};


const MessageBubble = ({ message }: { message: ChatMessage }) => {

    const isMine = message.ownership === "mine";

    return (
        <article className="w-full">
            { isMine ? (
                <MessageBubbleMine message={message} />
            ) : (
                <MessageBubbleTheirs message={message} />
            )}
        </article>
    );
};

// Messages Page component
const MessagesPage = () => {
	const [query, setQuery] = useState("");
	const [selectedWorkspaceId] = useState(() => readSelectedWorkspaceId());
	const activeWorkspace = useMemo(
		() => workspaces.find((item) => item.id === selectedWorkspaceId) ?? workspaces.find((item) => item.id === DEFAULT_WORKSPACE_ID) ?? workspaces[0] ?? null,
		[selectedWorkspaceId]
	);

	const channels = activeWorkspace?.channels ?? [];
	const directMessages = activeWorkspace?.directMessages ?? [];
	const channelMessages = activeWorkspace?.channelMessages ?? {};

	const [activeChannelId, setActiveChannelId] = useState(channels[0]?.id ?? "");

	useEffect(() => {
		if (!channels.length) {
			setActiveChannelId("");
			return;
		}

		if (!channels.some((item) => item.id === activeChannelId)) {
			setActiveChannelId(channels[0].id);
		}
	}, [channels, activeChannelId]);

	const activeChannel = useMemo(
		() => channels.find((item) => item.id === activeChannelId) ?? channels[0] ?? null,
		[channels, activeChannelId]
	);

	const visibleChannels = useMemo(() => {
		const search = query.trim().toLowerCase();
		if (!search) {
			return channels;
		}
		return channels.filter((item) => item.name.toLowerCase().includes(search) || item.description.toLowerCase().includes(search));
	}, [query]);

	const activeMessages = activeChannel ? channelMessages[activeChannel.id] ?? [] : [];

	return (
		<div className="relative h-full w-full overflow-hidden text-white">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-20 -top-28 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="absolute right-0 top-12 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
                <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-lime-500/10 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_45%)]" />
            </div>

			<div className="relative z-10 flex h-full flex-col">
				<header className="border-b border-white/10 bg-black/30 px-6 py-2">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h1 className="text-2xl font-semibold">Messages</h1>
						</div>
						<div className="flex flex-wrap gap-2 text-xs text-slate-300">
							<span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
								<HiOutlineHashtag className="h-3.5 w-3.5" />
								{channels.length} channels
							</span>
							{activeWorkspace ? (
								<span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
									Workspace: {activeWorkspace.id}
								</span>
							) : null}
							<span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
								<FaUserGroup className="h-3.5 w-3.5" />
								23 active users
							</span>
							<span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
								<HiOutlineLockClosed className="h-3.5 w-3.5" />
								End-to-end encrypted
							</span>
						</div>
					</div>
				</header>

				<div className="flex h-full min-h-0 gap-0">
                    {/* Left Panel */}
					<aside className="w-full max-w-[320px] min-w-[260px] border-r border-white/10 px-3 py-3">
						<div className="mb-3 flex items-center justify-between">
							<h2 className="text-sm font-semibold text-slate-100">Channels</h2>
							<button className="rounded-lg border border-white/15 bg-white/10 p-1 text-slate-100 transition hover:bg-white/20">
								<HiOutlinePlusSmall className="h-4 w-4" />
							</button>
						</div>

						<div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus-within:ring-1 focus-within:ring-white/50">
							<FaMagnifyingGlass className="text-slate-400" />
							<input
								type="text"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search channels"
								className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
							/>
						</div>

						<div className="h-[calc(100%-86px)] overflow-y-auto pr-1">
							<div className="space-y-2">
								<div className="space-y-1.5">
								{visibleChannels.map((channel) => {
									const isActive = channel.id === activeChannel.id;
									return (
										<button
											key={channel.id}
											onClick={() => setActiveChannelId(channel.id)}
											className={`w-full rounded-lg border px-2 py-1 text-left transition ${
												isActive
													? "border-white/30 bg-white/10"
													: "border-white/10 bg-white/5 hover:border-white/10 hover:bg-white/10"
											}`}
										>
											<div className="mb-1 flex items-center justify-between gap-2">
												<div className="flex items-center gap-0 text-slate-100">
													<HiOutlineHashtag className="h-3 w-3 text-slate-400" />
													<span className="text-sm font-medium">{channel.name}</span>
												</div>
												{channel.unread ? (
													<span className="rounded-full border border-white/40 bg-white/10 w-5 h-5 flex items-center justify-center text-[10px] font-semibold text-white">
														{channel.unread}
													</span>
												) : null}
											</div>
											<p className="line-clamp-2 text-xs text-slate-400">{channel.description}</p>
										</button>
									);
								})}
								</div>

								{visibleChannels.length === 0 ? (
									<div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
										No channels found.
									</div>
								) : null}

								<div className="pt-2">
									<div className="mb-2 flex items-center justify-between">
										<h3 className="text-xs uppercase tracking-wider text-slate-400">Direct Messages</h3>
										<span className="text-[11px] text-slate-500">{directMessages.length}</span>
									</div>
									<div className="space-y-2.5">
										{directMessages.map((dm) => {
                                            const tone = avatarTones[Math.floor(Math.random() * avatarTones.length)];
                                            const avatarClass = `flex h-6 w-6 items-center justify-center rounded-full border ${tone}`;
                                            return (
                                                <button
                                                    key={dm.id}
                                                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/15 hover:bg-white/10"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={avatarClass}>
                                                            {dm.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm text-slate-100">{dm.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {dm.unread ? (
                                                            <span className="rounded-full border border-white/40 bg-white/10 w-5 h-5 flex items-center justify-center text-[10px] font-semibold text-white">
                                                                {dm.unread}
                                                            </span>
                                                        ) : null}
                                                        <span className={`h-2 w-2 rounded-full ${dm.status === "online" ? "bg-emerald-300" : "bg-amber-300"}`} />
                                                    </div>
                                                </button>
                                            )
                                        })}
									</div>
								</div>
							</div>
						</div>
					</aside>

                    {/* Main Panel */}
					<main className="min-w-0 flex-1 flex min-h-0 flex-col border-r border-white/10 bg-black/10">
						<div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
							<div>
								<div className="flex items-center gap-2 text-slate-100">
									<HiOutlineHashtag className="h-4 w-4 text-slate-400" />
									<h3 className="text-base font-semibold">{activeChannel?.name || "No channel"}</h3>
								</div>
								<p className="text-xs text-slate-400">{activeChannel?.description || "Select a channel"}</p>
							</div>
							<div className="flex items-center gap-2 text-slate-300">
								<button className="rounded-lg border border-white/15 bg-white/5 p-2 hover:bg-white/10">
									<HiOutlinePhone className="h-4 w-4" />
								</button>
								<button className="rounded-lg border border-white/15 bg-white/5 p-2 hover:bg-white/10">
									<HiOutlineVideoCamera className="h-4 w-4" />
								</button>
								<button className="rounded-lg border border-white/15 bg-white/5 p-2 hover:bg-white/10">
									<FaUserGroup className="h-4 w-4" />
								</button>
							</div>
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto px-4 py-5"
							style={{
								backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
								backgroundSize: "26px 26px",
							}}
						>
							<div className="space-y-2">
								{activeMessages.map((message, index) => {
									return (
										<MessageBubble key={message.id + ':' + index} message={message} />
									);
								})}
							</div>
						</div>

						<div className="border-t border-white/10 px-4 py-3">
							<div className="rounded-xl border border-white/15 bg-white/5 p-2">
								<textarea
									rows={2}
									placeholder={`Message #${activeChannel?.name || "channel"}`}
									className="w-full resize-none bg-transparent px-2 py-1 text-sm text-slate-100 outline-none placeholder:text-slate-500"
								/>
								<div className="mt-2 flex items-center justify-between">
									<div className="flex items-center gap-2 text-slate-300">
										<button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
											Attach
										</button>
										<button className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
											Templates
										</button>
									</div>
									<button className="rounded-lg border border-black bg-white/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white">
										<span className="inline-flex items-center gap-1">
											Send
											<HiOutlinePaperAirplane className="h-3.5 w-3.5" />
										</span>
									</button>
								</div>
							</div>
						</div>
					</main>

                    {/* Right Panel */}
					<aside className="w-full max-w-[320px] min-w-[260px] min-h-0 px-3 py-3">
						<div className="mb-1 rounded-lg border border-white/10 bg-white/5 p-2">
							<div className="mb-2 flex items-center justify-between">
								<h4 className="text-sm font-semibold text-slate-100">Channel Intel</h4>
								<HiOutlineSparkles className="h-4 w-4 text-white" />
							</div>
							<p className="text-xs text-slate-400">
								AI summarizes corporate priorities, delivery health, and decision points for this channel.
							</p>
						</div>

						<div className="h-[calc(100%-94px)] overflow-y-auto pr-1">
							<div className="space-y-2 py-1">
								<div className="rounded-lg border border-white/10 bg-white/5 p-2">
									<p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Summary</p>
									<p className="text-sm text-slate-200">Revenue outlook improved with stronger enterprise renewals and reduced delivery risk.</p>
								</div>

								<div className="rounded-lg border border-white/10 bg-white/5 p-2">
									<p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Stakeholders</p>
									<div className="flex flex-wrap gap-2 text-xs text-slate-200">
										<span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Executive Team</span>
										<span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Finance</span>
										<span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Sales Leadership</span>
									</div>
								</div>

								<div className="rounded-lg border border-white/10 bg-white/5 p-2">
									<p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Actions</p>
									<div className="space-y-2 text-xs">
										<button className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-slate-200 hover:bg-white/10">
											<BiMessageDetail className="h-4 w-4" />
											Create brief
										</button>
										<button className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-slate-200 hover:bg-white/10">
											<FaRegBookmark className="h-3.5 w-3.5" />
											Pin channel insights
										</button>
										<button className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-slate-200 hover:bg-white/10">
											<FaRegBell className="h-3.5 w-3.5" />
											Tune alerts
										</button>
									</div>
								</div>
							</div>
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
};

export default MessagesPage;
