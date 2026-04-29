import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cookies from "js-cookie";
import { FaMagnifyingGlass, FaUserGroup } from "react-icons/fa6";
import {
  HiOutlineArrowDown,
  HiMiniEllipsisVertical,
  HiOutlineChatBubbleLeftRight,
  HiOutlineInformationCircle,
  HiOutlineHashtag,
  HiOutlineLockClosed,
  HiOutlinePencilSquare,
  HiOutlinePaperAirplane,
  HiOutlinePhone,
  HiOutlinePlusSmall,
  HiOutlineTrash,
  HiOutlineVideoCamera,
} from "react-icons/hi2";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import { useMessagesWebSocket } from "../../hooks/useMessagesWebSocket";
import { ToastContainer } from "../../components/ToastContainer";
import { useToast } from "../../hooks/useToast";
import {
  createWorkspaceConversationMessage,
  createWorkspaceChannel,
  createWorkspaceDirectConversation,
  createWorkspaceGroupConversation,
  deleteWorkspaceChannel,
  deleteWorkspaceDirectConversation,
  deleteWorkspaceGroupConversation,
  fetchWorkspaceMessagingState,
  markWorkspaceConversationRead,
  updateWorkspaceChannel,
  updateWorkspaceGroupConversation,
  type WorkspaceApiMessage,
} from "../../api/messages";
import type { WsNewMessage } from "../../api/websocket";
import MessageBubble from "./components/MessageBubble";
import RightPanel from "./components/RightPanel";
import sampleData from "./sample-data.json";
import type {
  Channel,
  ChatMessage,
  ChatMode,
  ContextMenuState,
  ContextTarget,
  DirectMessage,
  GroupConversation,
  ProfilePreview,
  RightPanelTab,
  WorkspaceMember,
  WorkspaceSample,
} from "./types";

const DEFAULT_WORKSPACE_ID = "demo";
const SELECTED_WORKSPACE_STORAGE_KEY = "selectedWorkspaceId";

const { workspaces, avatarTones } = sampleData as unknown as {
  workspaces: WorkspaceSample[];
  avatarTones: string[];
};

const readSelectedWorkspaceId = () => {
  try {
    const raw = window.localStorage.getItem(SELECTED_WORKSPACE_STORAGE_KEY);
    return raw?.trim() || DEFAULT_WORKSPACE_ID;
  } catch {
    return DEFAULT_WORKSPACE_ID;
  }
};

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  useDocumentTitle("MESSAGES - SERVERHUB");

  const { toasts, showToast, removeToast } = useToast();

  const [query, setQuery] = useState("");
  const [selectedWorkspaceId] = useState(() => readSelectedWorkspaceId());

  const displayNamesRef = useRef<Record<string, string>>({});
  const [displayNames, setDisplayNames] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem("userDisplayNames");
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  displayNamesRef.current = displayNames;

  const resolveDisplayName = (username: string): string => {
    const trimmed = username.trim();
    return displayNamesRef.current[trimmed] || displayNamesRef.current[trimmed.toLowerCase()] || trimmed;
  };

  const activeWorkspace = useMemo(
    () =>
      workspaces.find((w) => w.id === selectedWorkspaceId) ??
      workspaces.find((w) => w.id === DEFAULT_WORKSPACE_ID) ??
      workspaces[0] ??
      null,
    [selectedWorkspaceId],
  );

  const channels = useMemo(() => activeWorkspace?.channels ?? [], [activeWorkspace]);
  const sampleChannelMessages = useMemo(() => activeWorkspace?.channelMessages ?? {}, [activeWorkspace]);
  const workspaceScopeId = activeWorkspace?.id ?? DEFAULT_WORKSPACE_ID;

  const [channelsState, setChannelsState] = useState<Channel[]>(channels);
  const [directMessagesState, setDirectMessagesState] = useState<DirectMessage[]>([]);
  const [groupsState, setGroupsState] = useState<GroupConversation[]>([]);

  const [activeMode, setActiveMode] = useState<ChatMode>("channel");
  const [activeChannelId, setActiveChannelId] = useState(channels[0]?.id ?? "");
  const [activeDirectId, setActiveDirectId] = useState("");
  const [activeGroupId, setActiveGroupId] = useState("");

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const [showNewChannelForm, setShowNewChannelForm] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");

  const [showNewConversationForm, setShowNewConversationForm] = useState(false);
  const [newConversationUserId, setNewConversationUserId] = useState("");

  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [membersState, setMembersState] = useState<WorkspaceMember[]>([]);
  const [channelMessagesState, setChannelMessagesState] = useState<Record<string, ChatMessage[]>>({});
  const [directConversationMessagesState, setDirectConversationMessagesState] = useState<Record<string, ChatMessage[]>>({});
  const [groupConversationMessagesState, setGroupConversationMessagesState] = useState<Record<string, ChatMessage[]>>({});
  const [composerText, setComposerText] = useState("");
  const [loadingWorkspaceState, setLoadingWorkspaceState] = useState(false);
  const [workspaceStateError, setWorkspaceStateError] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("conversation");
  const [selectedProfile, setSelectedProfile] = useState<ProfilePreview | null>(null);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingChannelName, setEditingChannelName] = useState("");
  const [editingChannelDescription, setEditingChannelDescription] = useState("");
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, Record<string, number>>>({
    "msg-001": { "👍": 4, "🔥": 2 },
    "msg-002": { "✅": 1, "🎯": 1 },
    "msg-003": { "👀": 2 },
  });
  const processedWsMessageIdsRef = useRef<Set<string>>(new Set());
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const isMessageListAtBottomRef = useRef(true);
  const previousActiveMessagesCountRef = useRef(0);
  const [isMessageListAtBottom, setIsMessageListAtBottom] = useState(true);
  const [pendingNewMessagesCount, setPendingNewMessagesCount] = useState(0);
  const [pendingConversationJump, setPendingConversationJump] = useState<{ type: ChatMode; id: string } | null>(null);

  const appendUniqueMessageById = useCallback((messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] => {
    return messages.some((item) => item.id === incoming.id) ? messages : [...messages, incoming];
  }, []);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const node = messageScrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);

  const handleMessageListScroll = useCallback(() => {
    const node = messageScrollRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - (node.scrollTop + node.clientHeight) <= 40;
    isMessageListAtBottomRef.current = nearBottom;
    setIsMessageListAtBottom(nearBottom);
    if (nearBottom) {
      setPendingNewMessagesCount(0);
    }
  }, []);

  useEffect(() => {
    const normalizedSampleMessages = Object.entries(sampleChannelMessages).reduce(
      (acc, [channelId, items]) => {
        acc[channelId] = items ?? [];
        return acc;
      },
      {} as Record<string, ChatMessage[]>,
    );

    setChannelsState(channels);
    setDirectMessagesState([]);
    setGroupsState([]);
    setMembersState([]);
    setChannelMessagesState(normalizedSampleMessages);
    setDirectConversationMessagesState({});
    setGroupConversationMessagesState({});
    setActiveMode("channel");
    setActiveChannelId(channels[0]?.id ?? "");
    setActiveDirectId("");
    setActiveGroupId("");
    setRightPanelTab("conversation");
    setSelectedProfile(null);
    setEditingChannelId(null);
    setEditingChannelName("");
    setEditingChannelDescription("");
    setNewConversationUserId("");
    setNewGroupDescription("");
    setSelectedGroupMemberIds([]);
  }, [channels, sampleChannelMessages, activeWorkspace?.id]);

  const currentUsername = useMemo(() => {
    const raw = Cookies.get("user") ?? "";
    return raw.trim().toLowerCase();
  }, []);

  const currentMember = useMemo(
    () => membersState.find((member) => member.username.trim().toLowerCase() === currentUsername) ?? null,
    [membersState, currentUsername],
  );

  const selectableMembers = useMemo(
    () => membersState.filter((member) => member.username.trim().toLowerCase() !== currentUsername),
    [membersState, currentUsername],
  );

  const mapApiMessageToUi = useCallback((item: WorkspaceApiMessage): ChatMessage => {
    const ts = new Date(item.created_at);
    const author = item.author_username.trim().toLowerCase();
    return {
      id: item.message_id,
      author: resolveDisplayName(item.author_username),
      authorUsername: item.author_username,
      authorUserId: item.author_user_id,
      role: item.conversation_type === "channel" ? "Member" : item.conversation_type === "direct" ? "Direct" : "Group",
      time: Number.isNaN(ts.getTime()) ? "Now" : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      content: item.content,
      ownership: author && author === currentUsername ? "mine" : "their",
    };
  }, [currentUsername]);

  const loadWorkspaceState = useCallback(async () => {
    setLoadingWorkspaceState(true);
    setWorkspaceStateError(null);
    try {
      const data = await fetchWorkspaceMessagingState(workspaceScopeId);

      const mappedChannels: Channel[] = data.channels.map((channel) => ({
        id: channel.channel_id,
        name: channel.name,
        description: channel.description,
        unread: channel.unread,
      }));

      const mappedDirectMessages: DirectMessage[] = data.direct_conversations.map((conversation) => {
        const otherUser = data.users.find((user) => user.user_id === conversation.other_user_id);
        return {
          id: conversation.direct_id,
          userId: conversation.other_user_id,
          username: conversation.other_username,
          name: resolveDisplayName(conversation.other_username),
          status: otherUser?.is_active ? "online" : "offline",
          unread: conversation.unread,
        };
      });

      const mappedGroups: GroupConversation[] = data.group_conversations.map((conversation) => ({
        id: conversation.group_id,
        name: conversation.name,
        description: conversation.description,
        members: conversation.member_user_ids.length,
        memberIds: conversation.member_user_ids,
        unread: conversation.unread,
      }));

      const mappedChannelMessages: Record<string, ChatMessage[]> = {};
      const mappedDirectConversationMessages: Record<string, ChatMessage[]> = {};
      const mappedGroupConversationMessages: Record<string, ChatMessage[]> = {};

      Object.entries(data.messages_by_conversation).forEach(([conversationKey, items]) => {
        const [conversationType, ...idParts] = conversationKey.split(":");
        const conversationId = idParts.join(":");
        const mappedItems = items.map(mapApiMessageToUi);

        if (conversationType === "channel") {
          mappedChannelMessages[conversationId] = mappedItems;
          return;
        }

        if (conversationType === "direct") {
          mappedDirectConversationMessages[conversationId] = mappedItems;
          return;
        }

        if (conversationType === "group") {
          mappedGroupConversationMessages[conversationId] = mappedItems;
        }
      });

      const mappedMembers: WorkspaceMember[] = data.users.map((user) => ({
        id: user.user_id,
        username: user.username,
        name: resolveDisplayName(user.username),
        role: user.username.trim().toLowerCase() === currentUsername ? "You" : "Workspace user",
        status: user.is_active ? "online" : "offline",
        lastSeen: user.is_active
          ? "active now"
          : new Date(user.updated_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      }));

      setChannelsState(mappedChannels);
      setDirectMessagesState(mappedDirectMessages);
      setGroupsState(mappedGroups);
      setChannelMessagesState(mappedChannelMessages);
      setDirectConversationMessagesState(mappedDirectConversationMessages);
      setGroupConversationMessagesState(mappedGroupConversationMessages);
      setMembersState(mappedMembers);

      if (mappedChannels.length > 0) {
        setActiveChannelId((prev) => (mappedChannels.some((channel) => channel.id === prev) ? prev : mappedChannels[0].id));
      }

      if (mappedDirectMessages.length > 0) {
        setActiveDirectId((prev) => (mappedDirectMessages.some((item) => item.id === prev) ? prev : mappedDirectMessages[0].id));
      }

      if (mappedGroups.length > 0) {
        setActiveGroupId((prev) => (mappedGroups.some((item) => item.id === prev) ? prev : mappedGroups[0].id));
      }
    } catch (error) {
      setWorkspaceStateError(error instanceof Error ? error.message : "Unable to load workspace messages.");
    } finally {
      setLoadingWorkspaceState(false);
    }
  }, [workspaceScopeId, mapApiMessageToUi, currentUsername]);

  useEffect(() => {
    void loadWorkspaceState();
  }, [loadWorkspaceState]);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<Record<string, string>>;
      setDisplayNames(customEvent.detail ?? {});
    };
    window.addEventListener("user-display-names-updated", onUpdate as EventListener);
    return () => window.removeEventListener("user-display-names-updated", onUpdate as EventListener);
  }, []);

  useEffect(() => {
    const resolveFromMap = (username: string): string => {
      const trimmed = username.trim();
      return displayNames[trimmed] || displayNames[trimmed.toLowerCase()] || trimmed;
    };

    const remapMessages = (messagesByConversation: Record<string, ChatMessage[]>) => {
      return Object.fromEntries(
        Object.entries(messagesByConversation).map(([conversationId, items]) => [
          conversationId,
          items.map((item) => ({
            ...item,
            author: item.authorUsername ? resolveFromMap(item.authorUsername) : item.author,
          })),
        ]),
      ) as Record<string, ChatMessage[]>;
    };

    setMembersState((prev) => prev.map((m) => ({ ...m, name: resolveFromMap(m.username) })));
    setDirectMessagesState((prev) =>
      prev.map((dm) => ({ ...dm, name: dm.username ? resolveFromMap(dm.username) : dm.name })),
    );
    setChannelMessagesState((prev) => remapMessages(prev));
    setDirectConversationMessagesState((prev) => remapMessages(prev));
    setGroupConversationMessagesState((prev) => remapMessages(prev));
  }, [displayNames]);

  useMessagesWebSocket(workspaceScopeId, {
    getCurrentConversation: () => {
      if (activeMode === "channel") return { type: "channel", id: activeChannelId };
      if (activeMode === "direct") return { type: "direct", id: activeDirectId };
      if (activeMode === "group") return { type: "group", id: activeGroupId };
      return null;
    },
    getCurrentUsername: () => currentUsername,
    getDisplayName: resolveDisplayName,
    onToastClickMessage: (message) => {
      setPendingConversationJump({ type: message.conversation_type, id: message.conversation_id });
    },
    onNewMessage: (message: WsNewMessage) => {
      if (processedWsMessageIdsRef.current.has(message.message_id)) {
        return;
      }
      processedWsMessageIdsRef.current.add(message.message_id);
      if (processedWsMessageIdsRef.current.size > 2000) {
        const iterator = processedWsMessageIdsRef.current.values().next();
        if (!iterator.done) {
          processedWsMessageIdsRef.current.delete(iterator.value);
        }
      }

      const chatMessage: ChatMessage = {
        id: message.message_id,
        author: resolveDisplayName(message.author_username),
        authorUsername: message.author_username,
        authorUserId: message.author_user_id,
        content: message.content,
        time: new Date(message.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        ownership: message.author_username.trim().toLowerCase() === currentUsername ? "mine" : "their",
        role: "Workspace user",
        system: false,
      };

      // Update appropriate conversation state and unread counts
      if (message.conversation_type === "channel") {
        setChannelMessagesState((prev) => ({
          ...prev,
          [message.conversation_id]: appendUniqueMessageById(prev[message.conversation_id] ?? [], chatMessage),
        }));
        // Increment unread count if not in active conversation
        if (activeMode !== "channel" || activeChannelId !== message.conversation_id) {
          setChannelsState((prev) =>
            prev.map((ch) =>
              ch.id === message.conversation_id ? { ...ch, unread: (ch.unread ?? 0) + 1 } : ch,
            ),
          );
        }
      } else if (message.conversation_type === "direct") {
        setDirectConversationMessagesState((prev) => ({
          ...prev,
          [message.conversation_id]: appendUniqueMessageById(prev[message.conversation_id] ?? [], chatMessage),
        }));
        if (activeMode !== "direct" || activeDirectId !== message.conversation_id) {
          setDirectMessagesState((prev) =>
            prev.map((dm) =>
              dm.id === message.conversation_id ? { ...dm, unread: (dm.unread ?? 0) + 1 } : dm,
            ),
          );
        }
      } else if (message.conversation_type === "group") {
        setGroupConversationMessagesState((prev) => ({
          ...prev,
          [message.conversation_id]: appendUniqueMessageById(prev[message.conversation_id] ?? [], chatMessage),
        }));
        if (activeMode !== "group" || activeGroupId !== message.conversation_id) {
          setGroupsState((prev) =>
            prev.map((grp) =>
              grp.id === message.conversation_id ? { ...grp, unread: (grp.unread ?? 0) + 1 } : grp,
            ),
          );
        }
      }
    },
    onShowToast: showToast,
  });

  useEffect(() => {
    if (!channelsState.length) {
      setActiveChannelId("");
      return;
    }
    if (!channelsState.some((c) => c.id === activeChannelId)) {
      setActiveChannelId(channelsState[0].id);
    }
  }, [channelsState, activeChannelId]);

  useEffect(() => {
    if (!directMessagesState.length) {
      setActiveDirectId("");
      return;
    }
    if (!directMessagesState.some((conversation) => conversation.id === activeDirectId)) {
      setActiveDirectId(directMessagesState[0].id);
    }
  }, [directMessagesState, activeDirectId]);

  useEffect(() => {
    if (!groupsState.length) {
      setActiveGroupId("");
      return;
    }
    if (!groupsState.some((conversation) => conversation.id === activeGroupId)) {
      setActiveGroupId(groupsState[0].id);
    }
  }, [groupsState, activeGroupId]);

  useEffect(() => {
    const close = () => {
      setContextMenu(null);
      setShowQuickCreate(false);
      setReactionPickerFor(null);
    };
    const closeQuickCreate = () => setShowQuickCreate(false);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", closeQuickCreate);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", closeQuickCreate);
    };
  }, []);

  const activeChannel = useMemo(
    () => channelsState.find((c) => c.id === activeChannelId) ?? channelsState[0] ?? null,
    [channelsState, activeChannelId],
  );

  const activeDirect = useMemo(
    () => directMessagesState.find((d) => d.id === activeDirectId) ?? null,
    [directMessagesState, activeDirectId],
  );

  const activeGroup = useMemo(
    () => groupsState.find((g) => g.id === activeGroupId) ?? null,
    [groupsState, activeGroupId],
  );

  const visibleChannels = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return channelsState;
    return channelsState.filter(
      (c) => c.name.toLowerCase().includes(search) || c.description.toLowerCase().includes(search),
    );
  }, [query, channelsState]);

  const visibleGroups = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return groupsState;
    return groupsState.filter((g) => g.name.toLowerCase().includes(search));
  }, [query, groupsState]);

  const directConversationByUserId = useMemo(() => {
    const map = new Map<string, DirectMessage>();
    directMessagesState.forEach((conversation) => {
      map.set(conversation.userId, conversation);
    });
    return map;
  }, [directMessagesState]);

  const visibleDirectMembers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return selectableMembers;
    return selectableMembers.filter(
      (member) =>
        member.name.toLowerCase().includes(search) ||
        member.role.toLowerCase().includes(search) ||
        member.status.toLowerCase().includes(search),
    );
  }, [query, selectableMembers]);

  const activeMessages = useMemo(() => {
    if (activeMode === "channel") {
      return activeChannel ? (channelMessagesState[activeChannel.id] ?? []) : [];
    }
    if (activeMode === "direct") {
      return activeDirect ? (directConversationMessagesState[activeDirect.id] ?? []) : [];
    }
    return activeGroup ? (groupConversationMessagesState[activeGroup.id] ?? []) : [];
  }, [
    activeMode,
    activeChannel,
    activeDirect,
    activeGroup,
    channelMessagesState,
    directConversationMessagesState,
    groupConversationMessagesState,
  ]);

  const activeConversationKey = useMemo(() => {
    if (activeMode === "channel") {
      return `channel:${activeChannel?.id ?? ""}`;
    }
    if (activeMode === "direct") {
      return `direct:${activeDirect?.id ?? ""}`;
    }
    return `group:${activeGroup?.id ?? ""}`;
  }, [activeMode, activeChannel?.id, activeDirect?.id, activeGroup?.id]);

  // Stable tone per message id so colour doesn't flicker on re-render
  const messageTones = useMemo(() => {
    const map: Record<string, string> = {};
    activeMessages.forEach((m) => {
      if (!map[m.id]) {
        map[m.id] = avatarTones[Math.abs(m.id.charCodeAt(0)) % avatarTones.length];
      }
    });
    return map;
  }, [activeMessages]);

  const dmTones = useMemo(() => {
    const map: Record<string, string> = {};
    directMessagesState.forEach((dm) => {
      map[dm.id] = avatarTones[Math.abs(dm.id.charCodeAt(0)) % avatarTones.length];
    });
    return map;
  }, [directMessagesState]);

  const groupTones = useMemo(() => {
    const map: Record<string, string> = {};
    groupsState.forEach((group) => {
      map[group.id] = avatarTones[Math.abs(group.id.charCodeAt(0)) % avatarTones.length];
    });
    return map;
  }, [groupsState]);

  const activeTitle =
    activeMode === "channel"
      ? `#${activeChannel?.name ?? "channel"}`
      : activeMode === "direct"
        ? activeDirect?.name ?? "Conversation"
        : activeGroup?.name ?? "Group";

  const activeSubtitle =
    activeMode === "channel"
      ? activeChannel?.description ?? "Select a channel"
      : activeMode === "direct"
        ? activeDirect?.status === "online"
          ? "Direct conversation • active now"
          : "Direct conversation"
        : activeGroup?.description || `${activeGroup?.members ?? 0} members`;

  const activeUnread =
    activeMode === "channel"
      ? activeChannel?.unread ?? 0
      : activeMode === "direct"
        ? activeDirect?.unread ?? 0
        : activeGroup?.unread ?? 0;

  const addReaction = (messageId: string, emoji: string) => {
    const targetMessage = activeMessages.find((item) => item.id === messageId);
    if (
      targetMessage?.ownership === "mine"
      || targetMessage?.author.trim().toLowerCase() === "you"
      || targetMessage?.author.trim().toLowerCase() === currentUsername
    ) {
      return;
    }

    setReactionsByMessage((prev) => {
      const current = prev[messageId] ?? {};
      return {
        ...prev,
        [messageId]: {
          ...current,
          [emoji]: (current[emoji] ?? 0) + 1,
        },
      };
    });
    setReactionPickerFor(null);
  };

  const openProfile = (profile: ProfilePreview) => {
    setSelectedProfile(profile);
    setRightPanelTab("profile");
    setShowRightPanel(true);
  };

  const openProfileByName = (name: string, role = "Member") => {
    const normalized = name.trim().toLowerCase();
    const member = membersState.find((m) => (
      m.name.trim().toLowerCase() === normalized || m.username.trim().toLowerCase() === normalized
    ));
    if (member) {
      openProfile({
        id: member.id,
        name: member.name,
        role: member.role,
        status: member.status,
        lastSeen: member.lastSeen,
      });
      return;
    }
    openProfile({
      id: `profile-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      role,
      status: "offline",
      lastSeen: "recently",
    });
  };

  const openContextMenu = (
    e: React.MouseEvent,
    target: ContextTarget,
  ) => {
    e.preventDefault();
    setShowQuickCreate(false);
    setContextMenu({ x: e.clientX, y: e.clientY, target });
  };

  const openChannelEdit = (channelId: string) => {
    const channel = channelsState.find((item) => item.id === channelId);
    if (!channel) return;
    setEditingChannelId(channelId);
    setEditingChannelName(channel.name);
    setEditingChannelDescription(channel.description);
    setRightPanelTab("channel-edit");
    setShowRightPanel(true);
  };

  const markConversationRead = useCallback(async (mode: ChatMode, conversationId: string) => {
    try {
      await markWorkspaceConversationRead(workspaceScopeId, mode, conversationId);

      if (mode === "channel") {
        setChannelsState((prev) => prev.map((item) => (item.id === conversationId ? { ...item, unread: 0 } : item)));
      }

      if (mode === "direct") {
        setDirectMessagesState((prev) => prev.map((item) => (item.id === conversationId ? { ...item, unread: 0 } : item)));
      }

      if (mode === "group") {
        setGroupsState((prev) => prev.map((item) => (item.id === conversationId ? { ...item, unread: 0 } : item)));
      }
    } catch (error) {
      setWorkspaceStateError(error instanceof Error ? error.message : "Unable to mark conversation as read.");
    }
  }, [workspaceScopeId]);

  const openConversation = useCallback((mode: ChatMode, conversationId: string) => {
    setActiveMode(mode);
    if (mode === "channel") {
      setActiveChannelId(conversationId);
    }
    if (mode === "direct") {
      setActiveDirectId(conversationId);
    }
    if (mode === "group") {
      setActiveGroupId(conversationId);
    }

    void markConversationRead(mode, conversationId);
  }, [markConversationRead]);

  useEffect(() => {
    if (!pendingConversationJump) return;
    openConversation(pendingConversationJump.type, pendingConversationJump.id);
    setPendingConversationJump(null);
  }, [pendingConversationJump, openConversation]);

  useEffect(() => {
    previousActiveMessagesCountRef.current = activeMessages.length;
    setPendingNewMessagesCount(0);
    requestAnimationFrame(() => {
      scrollMessagesToBottom("auto");
      isMessageListAtBottomRef.current = true;
      setIsMessageListAtBottom(true);
    });
  }, [activeConversationKey, scrollMessagesToBottom]);

  useEffect(() => {
    const previousCount = previousActiveMessagesCountRef.current;
    if (activeMessages.length <= previousCount) {
      previousActiveMessagesCountRef.current = activeMessages.length;
      return;
    }

    const addedCount = activeMessages.length - previousCount;
    previousActiveMessagesCountRef.current = activeMessages.length;

    if (isMessageListAtBottomRef.current) {
      requestAnimationFrame(() => {
        scrollMessagesToBottom("smooth");
      });
      setPendingNewMessagesCount(0);
      return;
    }

    setPendingNewMessagesCount((prev) => prev + addedCount);
  }, [activeMessages, scrollMessagesToBottom]);

  const openOrCreateDirectConversation = useCallback(async (member: WorkspaceMember) => {
    const existing = directConversationByUserId.get(member.id);
    if (existing) {
      openConversation("direct", existing.id);
      return;
    }

    try {
      const created = await createWorkspaceDirectConversation(workspaceScopeId, {
        participant_user_id: member.id,
      });

      const directMessage: DirectMessage = {
        id: created.direct_id,
        userId: created.other_user_id,
        username: created.other_username,
        name: resolveDisplayName(created.other_username),
        status: member.status,
        unread: created.unread,
      };

      setDirectMessagesState((prev) => [directMessage, ...prev.filter((item) => item.id !== directMessage.id)]);
      setDirectConversationMessagesState((prev) => ({
        ...prev,
        [directMessage.id]: prev[directMessage.id] ?? [],
      }));
      openConversation("direct", directMessage.id);
    } catch (error) {
      setWorkspaceStateError(error instanceof Error ? error.message : "Unable to create conversation.");
    }
  }, [directConversationByUserId, openConversation, workspaceScopeId]);

  const startDirectMessageFromProfile = useCallback(() => {
    if (!selectedProfile) {
      return;
    }

    const member = membersState.find((item) => item.id === selectedProfile.id);
    if (!member) {
      setWorkspaceStateError("This profile is not a workspace member.");
      return;
    }

    void openOrCreateDirectConversation(member);
  }, [selectedProfile, membersState, openOrCreateDirectConversation]);

  const saveEditedChannel = async () => {
    if (!editingChannelId) return;
    const nextName = editingChannelName.trim().replace(/^#/, "");
    if (!nextName) return;

    try {
      const updated = await updateWorkspaceChannel(workspaceScopeId, editingChannelId, {
        name: nextName,
        description: editingChannelDescription.trim(),
      });

      setChannelsState((prev) =>
        prev.map((channel) =>
          channel.id === editingChannelId
            ? {
                ...channel,
                name: updated.name,
                description: updated.description,
                unread: updated.unread,
              }
            : channel,
        ),
      );

      setRightPanelTab("conversation");
      setEditingChannelId(null);
    } catch (error) {
      setWorkspaceStateError(error instanceof Error ? error.message : "Unable to update channel.");
    }
  };

  const cancelChannelEdit = () => {
    setRightPanelTab("conversation");
    setEditingChannelId(null);
  };

  const closeForms = () => {
    setShowNewChannelForm(false);
    setShowNewConversationForm(false);
    setShowNewGroupForm(false);
  };

  const createChannel = async () => {
    const name = newChannelName.trim().replace(/^#/, "");
    if (!name) return;
    try {
      const created = await createWorkspaceChannel(workspaceScopeId, {
        name,
        description: newChannelDescription.trim() || "New channel",
      });
      const channel: Channel = {
        id: created.channel_id,
        name: created.name,
        description: created.description,
        unread: created.unread,
      };
      setChannelsState((prev) => [channel, ...prev.filter((item) => item.id !== channel.id)]);
      setChannelMessagesState((prev) => ({ ...prev, [channel.id]: prev[channel.id] ?? [] }));
      openConversation("channel", channel.id);
      setNewChannelName("");
      setNewChannelDescription("");
      setShowNewChannelForm(false);
      setShowQuickCreate(false);
    } catch (error) {
      setWorkspaceStateError(error instanceof Error ? error.message : "Unable to create channel.");
    }
  };

  const sendMessage = async () => {
    const content = composerText.trim();
    if (!content) return;

    const targetConversationId = activeMode === "channel"
      ? activeChannel?.id
      : activeMode === "direct"
        ? activeDirect?.id
        : activeGroup?.id;

    if (!targetConversationId) {
      setComposerText("");
      return;
    }

    try {
      const created = await createWorkspaceConversationMessage(workspaceScopeId, activeMode, targetConversationId, { content });
      const mineMessage: ChatMessage = {
        id: created.message_id,
        author: resolveDisplayName(created.author_username),
        authorUsername: created.author_username,
        authorUserId: created.author_user_id,
        role: activeMode === "channel" ? "Member" : activeMode === "direct" ? "Direct" : "Group",
        time: new Date(created.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        content: created.content,
        ownership: "mine",
      };

      if (activeMode === "channel") {
        setChannelMessagesState((prev) => ({
          ...prev,
          [targetConversationId]: appendUniqueMessageById(prev[targetConversationId] ?? [], mineMessage),
        }));
      }

      if (activeMode === "direct") {
        setDirectConversationMessagesState((prev) => ({
          ...prev,
          [targetConversationId]: appendUniqueMessageById(prev[targetConversationId] ?? [], mineMessage),
        }));
      }

      if (activeMode === "group") {
        setGroupConversationMessagesState((prev) => ({
          ...prev,
          [targetConversationId]: appendUniqueMessageById(prev[targetConversationId] ?? [], mineMessage),
        }));
      }

      setComposerText("");
    } catch (error) {
      setWorkspaceStateError(error instanceof Error ? error.message : "Unable to send message.");
    }
  };

  const createConversation = async () => {
    if (!newConversationUserId) return;

    try {
      const created = await createWorkspaceDirectConversation(workspaceScopeId, {
        participant_user_id: newConversationUserId,
      });
      const participant = membersState.find((member) => member.id === created.other_user_id);
      const directMessage: DirectMessage = {
        id: created.direct_id,
        userId: created.other_user_id,
        username: created.other_username,
        name: resolveDisplayName(created.other_username),
        status: participant?.status ?? "offline",
        unread: created.unread,
      };

      setDirectMessagesState((prev) => [directMessage, ...prev.filter((item) => item.id !== directMessage.id)]);
      setDirectConversationMessagesState((prev) => ({
        ...prev,
        [directMessage.id]: prev[directMessage.id] ?? [],
      }));
      openConversation("direct", directMessage.id);
      setNewConversationUserId("");
      setShowNewConversationForm(false);
      setShowQuickCreate(false);
    } catch (error) {
      setWorkspaceStateError(error instanceof Error ? error.message : "Unable to create conversation.");
    }
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;

    try {
      const created = await createWorkspaceGroupConversation(workspaceScopeId, {
        name,
        description: newGroupDescription.trim(),
        member_user_ids: selectedGroupMemberIds,
      });

      const group: GroupConversation = {
        id: created.group_id,
        name: created.name,
        description: created.description,
        members: created.member_user_ids.length,
        memberIds: created.member_user_ids,
        unread: created.unread,
      };

      setGroupsState((prev) => [group, ...prev.filter((item) => item.id !== group.id)]);
      setGroupConversationMessagesState((prev) => ({
        ...prev,
        [group.id]: prev[group.id] ?? [],
      }));
      openConversation("group", group.id);
      setNewGroupName("");
      setNewGroupDescription("");
      setSelectedGroupMemberIds([]);
      setShowNewGroupForm(false);
      setShowQuickCreate(false);
    } catch (error) {
      setWorkspaceStateError(error instanceof Error ? error.message : "Unable to create group.");
    }
  };

  const handleContextAction = async (action: "markRead" | "rename" | "delete" | "edit") => {
    if (!contextMenu) return;
    const { target } = contextMenu;

    try {
      if (target.kind === "channel") {
        if (action === "markRead") {
          await markConversationRead("channel", target.id);
        }
        if (action === "edit") {
          openChannelEdit(target.id);
        }
        if (action === "delete") {
          await deleteWorkspaceChannel(workspaceScopeId, target.id);
          setChannelsState((prev) => prev.filter((item) => item.id !== target.id));
          setChannelMessagesState((prev) => {
            const next = { ...prev };
            delete next[target.id];
            return next;
          });
          if (activeMode === "channel" && activeChannelId === target.id) {
            const nextChannel = channelsState.find((item) => item.id !== target.id);
            if (nextChannel) {
              openConversation("channel", nextChannel.id);
            } else {
              setActiveChannelId("");
            }
          }
        }
      }

      if (target.kind === "direct") {
        if (action === "markRead") {
          await markConversationRead("direct", target.id);
        }
        if (action === "rename") {
          const direct = directMessagesState.find((item) => item.id === target.id);
          if (direct) {
            openProfileByName(direct.name, "Direct contact");
          }
        }
        if (action === "delete") {
          await deleteWorkspaceDirectConversation(workspaceScopeId, target.id);
          setDirectMessagesState((prev) => prev.filter((item) => item.id !== target.id));
          setDirectConversationMessagesState((prev) => {
            const next = { ...prev };
            delete next[target.id];
            return next;
          });
          if (activeMode === "direct" && activeDirectId === target.id) {
            const nextDirect = directMessagesState.find((item) => item.id !== target.id);
            if (nextDirect) {
              openConversation("direct", nextDirect.id);
            } else {
              setActiveDirectId("");
            }
          }
        }
      }

      if (target.kind === "group") {
        if (action === "markRead") {
          await markConversationRead("group", target.id);
        }
        if (action === "rename") {
          const group = groupsState.find((item) => item.id === target.id);
          if (group) {
            const nextName = window.prompt("Rename group", group.name)?.trim();
            if (nextName) {
              const updated = await updateWorkspaceGroupConversation(workspaceScopeId, target.id, {
                name: nextName,
                description: group.description ?? "",
              });
              setGroupsState((prev) => prev.map((item) => (
                item.id === target.id
                  ? {
                      ...item,
                      name: updated.name,
                      description: updated.description,
                      members: updated.member_user_ids.length,
                      memberIds: updated.member_user_ids,
                      unread: updated.unread,
                    }
                  : item
              )));
            }
          }
        }
        if (action === "delete") {
          await deleteWorkspaceGroupConversation(workspaceScopeId, target.id);
          setGroupsState((prev) => prev.filter((item) => item.id !== target.id));
          setGroupConversationMessagesState((prev) => {
            const next = { ...prev };
            delete next[target.id];
            return next;
          });
          if (activeMode === "group" && activeGroupId === target.id) {
            const nextGroup = groupsState.find((item) => item.id !== target.id);
            if (nextGroup) {
              openConversation("group", nextGroup.id);
            } else {
              setActiveGroupId("");
            }
          }
        }
      }
    } catch (error) {
      setWorkspaceStateError(error instanceof Error ? error.message : "Unable to complete conversation action.");
    } finally {
      setContextMenu(null);
    }
  };

  const openCreateForm = (kind: "channel" | "conversation" | "group") => {
    closeForms();
    setShowQuickCreate(false);
    if (kind === "channel") setShowNewChannelForm(true);
    if (kind === "conversation") setShowNewConversationForm(true);
    if (kind === "group") setShowNewGroupForm(true);
  };

  return (
    <div className="relative h-full w-full overflow-hidden text-white">
      {/* background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-28 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-0 top-12 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_45%)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        {/* Top bar */}
        <header className="border-b border-white/10 bg-black/30 px-6 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Messages</p>
              <h1 className="text-2xl font-semibold">
                {activeWorkspace?.name ?? "No workspace"}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <HiOutlineHashtag className="h-3.5 w-3.5" />
                {channelsState.length} channels
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <FaUserGroup className="h-3.5 w-3.5" />
                {directMessagesState.length} direct
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <HiOutlineChatBubbleLeftRight className="h-3.5 w-3.5" />
                {groupsState.length} groups
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <HiOutlineLockClosed className="h-3.5 w-3.5" />
                End-to-end encrypted
              </span>
            </div>
          </div>
          {loadingWorkspaceState ? (
            <p className="mt-2 text-xs text-slate-400">Loading workspace messaging state...</p>
          ) : null}
          {workspaceStateError ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-2 py-1 text-xs text-rose-200">
              <span>{workspaceStateError}</span>
              <button
                onClick={() => {
                  void loadWorkspaceState();
                }}
                className="rounded border border-rose-300/30 bg-rose-400/15 px-2 py-0.5 transition hover:bg-rose-400/25"
              >
                Retry
              </button>
            </div>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 gap-0">
          {/* ── Left panel ── */}
          <aside className="w-full min-w-[220px] max-w-[300px] border-r border-white/10 px-3 py-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Channels</h2>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu(null);
                    setShowQuickCreate((v) => !v);
                  }}
                  className="rounded-lg border border-white/15 bg-white/10 p-1 text-slate-100 transition hover:bg-white/20"
                >
                  <HiOutlinePlusSmall className="h-4 w-4" />
                </button>
                {showQuickCreate ? (
                  <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-white/15 bg-zinc-950/95 p-1.5 shadow-xl">
                    <button
                      onClick={() => openCreateForm("channel")}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-100 hover:bg-white/10"
                    >
                      <HiOutlineHashtag className="h-3.5 w-3.5" /> New channel
                    </button>
                    <button
                      onClick={() => openCreateForm("conversation")}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-100 hover:bg-white/10"
                    >
                      <HiOutlinePencilSquare className="h-3.5 w-3.5" /> New conversation
                    </button>
                    <button
                      onClick={() => openCreateForm("group")}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-100 hover:bg-white/10"
                    >
                      <FaUserGroup className="h-3.5 w-3.5" /> New group
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus-within:ring-1 focus-within:ring-white/50">
              <FaMagnifyingGlass className="shrink-0 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages"
                className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
              />
            </div>

            <div className="h-[calc(100%-86px)] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                {visibleChannels.map((channel) => {
                  const isActive = channel.id === activeChannelId;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => openConversation("channel", channel.id)}
                      onContextMenu={(e) => openContextMenu(e, { kind: "channel", id: channel.id })}
                      className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${
                        isActive && activeMode === "channel"
                          ? "border-white/30 bg-white/10"
                          : "border-white/10 bg-white/5 hover:border-white/15 hover:bg-white/10"
                      }`}
                    >
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-0.5 text-slate-100">
                          <HiOutlineHashtag className="h-3 w-3 text-slate-400" />
                          <span className="text-sm font-medium">{channel.name}</span>
                        </div>
                        {channel.unread ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/40 bg-white/10 text-[10px] font-semibold text-white">
                            {channel.unread}
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-1 text-xs text-slate-400">{channel.description}</p>
                    </button>
                  );
                })}
                {!visibleChannels.length ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                    No channels found.
                  </div>
                ) : null}
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-wider text-slate-400">Direct Chats</h3>
                  <span className="text-[11px] text-slate-500">{selectableMembers.length}</span>
                </div>
                <div className="space-y-2">
                  {visibleDirectMembers.map((member) => {
                    const conversation = directConversationByUserId.get(member.id);
                    const tone = conversation
                      ? dmTones[conversation.id]
                      : avatarTones[Math.abs(member.id.charCodeAt(0)) % avatarTones.length];

                    return (
                    <button
                      key={member.id}
                      onClick={() => {
                        void openOrCreateDirectConversation(member);
                      }}
                      onContextMenu={(e) => {
                        if (conversation) {
                          openContextMenu(e, { kind: "direct", id: conversation.id });
                        }
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/15 hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openProfile({
                              id: member.id,
                              name: member.name,
                              role: member.role,
                              status: member.status,
                              lastSeen: member.lastSeen,
                            });
                          }}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${tone}`}
                          title={`View ${member.name}`}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </button>
                        <div className="min-w-0">
                          <span className="block truncate text-sm text-slate-100">{member.name}</span>
                          <span className="block text-[11px] text-slate-500">
                            {conversation ? "Open conversation" : "Start conversation"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {conversation?.unread ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/40 bg-white/10 text-[10px] font-semibold text-white">
                            {conversation.unread}
                          </span>
                        ) : null}
                        <span
                          className={`h-2 w-2 rounded-full ${
                            member.status === "online"
                              ? "bg-emerald-400"
                              : member.status === "away"
                                ? "bg-amber-400"
                                : "bg-slate-500"
                          }`}
                        />
                      </div>
                    </button>
                    );
                  })}
                  {!visibleDirectMembers.length ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                      No direct chats found.
                    </div>
                  ) : null}
                </div>

                <div className="mb-2 mt-4 flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-wider text-slate-400">Groups</h3>
                  <span className="text-[11px] text-slate-500">{groupsState.length}</span>
                </div>
                <div className="space-y-2">
                  {visibleGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => openConversation("group", group.id)}
                      onContextMenu={(e) => openContextMenu(e, { kind: "group", id: group.id })}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-white/15 hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${groupTones[group.id]}`}
                        >
                          {group.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm text-slate-100">{group.name}</span>
                          <p className="text-[11px] text-slate-500">{group.description || `${group.members} members`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {group.unread ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/40 bg-white/10 text-[10px] font-semibold text-white">
                            {group.unread}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pb-2" />
              </div>
            </div>
          </aside>

          {/* ── Main message panel ── */}
          <main className={`flex min-h-0 min-w-0 flex-1 flex-col bg-black/10 ${showRightPanel ? "border-r border-white/10" : ""}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
              <div>
                <div className="flex items-center gap-2 text-slate-100">
                  {activeMode === "channel" ? (
                    <HiOutlineHashtag className="h-4 w-4 text-slate-400" />
                  ) : activeMode === "direct" ? (
                    <HiOutlinePencilSquare className="h-4 w-4 text-slate-400" />
                  ) : (
                    <FaUserGroup className="h-4 w-4 text-slate-400" />
                  )}
                  <h3 className="text-base font-semibold">{activeTitle}</h3>
                  {activeUnread ? (
                    <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/90">
                      {activeUnread} unread
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-400">{activeSubtitle}</p>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <button
                  onClick={() => window.alert("Voice calls are coming soon.")}
                  className="rounded-lg border border-white/15 bg-white/5 p-2 transition hover:bg-white/10"
                >
                  <HiOutlinePhone className="h-4 w-4" />
                </button>
                <button
                  onClick={() => window.alert("Video calls are coming soon.")}
                  className="rounded-lg border border-white/15 bg-white/5 p-2 transition hover:bg-white/10"
                >
                  <HiOutlineVideoCamera className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setShowRightPanel((prev) => {
                      if (prev && rightPanelTab === "conversation") return false;
                      return true;
                    });
                    setRightPanelTab("conversation");
                  }}
                  className={`rounded-lg border border-white/15 p-2 transition ${
                    showRightPanel && rightPanelTab === "conversation" ? "bg-white/15" : "bg-white/5 hover:bg-white/10"
                  }`}
                  title={showRightPanel && rightPanelTab === "conversation" ? "Hide details" : "Show details"}
                >
                  <HiOutlineInformationCircle className="h-4 w-4" />
                </button>
                <button className="rounded-lg border border-white/15 bg-white/5 p-2 transition hover:bg-white/10">
                  <HiMiniEllipsisVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              <div
                ref={messageScrollRef}
                onScroll={handleMessageListScroll}
                className="h-full overflow-y-auto px-4 py-4"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
                  backgroundSize: "26px 26px",
                }}
              >
                {activeMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No messages yet in {activeTitle}.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activeMessages.map((message, index) => {
                      const previousMessage = index > 0 ? activeMessages[index - 1] : null;
                      const previousAuthorIdentity = previousMessage
                        ? (previousMessage.authorUserId
                          || previousMessage.authorUsername?.trim().toLowerCase()
                          || previousMessage.author.trim().toLowerCase())
                        : null;
                      const currentAuthorIdentity = message.authorUserId
                        || message.authorUsername?.trim().toLowerCase()
                        || message.author.trim().toLowerCase();
                      const isGrouped = !!(previousMessage
                        && previousAuthorIdentity === currentAuthorIdentity
                        && previousMessage.ownership === message.ownership
                        && message.ownership === "their");

                      return (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          tone={messageTones[message.id] ?? avatarTones[0]}
                          reactions={reactionsByMessage[message.id] ?? {}}
                          reactionPickerFor={reactionPickerFor}
                          onTogglePicker={(id) => setReactionPickerFor((prev) => (prev === id ? null : id))}
                          onReact={addReaction}
                          onAvatarClick={(author, role) => openProfileByName(author, role)}
                          isGrouped={isGrouped}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {!isMessageListAtBottom && pendingNewMessagesCount > 0 ? (
                <button
                  onClick={() => {
                    scrollMessagesToBottom("smooth");
                    setPendingNewMessagesCount(0);
                  }}
                  className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-md transition hover:bg-black/35"
                >
                  <HiOutlineArrowDown className="h-4 w-4" />
                  {pendingNewMessagesCount} new message{pendingNewMessagesCount > 1 ? "s" : ""}
                </button>
              ) : null}
            </div>

            <div className="border-t border-white/10 px-4 py-3">
              <div className="rounded-xl border border-white/15 bg-white/5 p-2">
                <textarea
                  rows={2}
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  placeholder={`Message ${activeTitle}`}
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
                  <button
                    onClick={() => {
                      void sendMessage();
                    }}
                    className="rounded-lg border border-black bg-white/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white"
                  >
                    <span className="inline-flex items-center gap-1">
                      Send
                      <HiOutlinePaperAirplane className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </main>

          <RightPanel
            show={showRightPanel}
            tab={rightPanelTab}
            onClose={() => setShowRightPanel(false)}
            activeMode={activeMode}
            activeTitle={activeTitle}
            participantCount={
              activeMode === "channel"
                ? Math.max(5, activeMessages.length + 2)
                : activeMode === "direct"
                  ? 2
                  : activeGroup?.memberIds.length ?? activeGroup?.members ?? 0
            }
            activeUnread={activeUnread}
            members={membersState}
            selectedProfile={selectedProfile}
            avatarTones={avatarTones}
            onOpenProfile={openProfile}
            onStartDirectMessage={startDirectMessageFromProfile}
            channelName={editingChannelName}
            channelDescription={editingChannelDescription}
            onChannelNameChange={setEditingChannelName}
            onChannelDescriptionChange={setEditingChannelDescription}
            onSaveChannel={saveEditedChannel}
            onCancelChannelEdit={cancelChannelEdit}
          />
        </div>
      </div>

      {/* Context menu */}
      {contextMenu ? (
        <div
          className="fixed z-50 min-w-[180px] rounded-lg border border-white/15 bg-zinc-950/95 p-1.5 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleContextAction("markRead")}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-100 hover:bg-white/10"
          >
            <HiOutlineLockClosed className="h-3.5 w-3.5" /> Mark as read
          </button>
          <button
            onClick={() => handleContextAction(contextMenu.target.kind === "channel" ? "edit" : "rename")}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-100 hover:bg-white/10"
          >
            <HiOutlinePencilSquare className="h-3.5 w-3.5" />
            {contextMenu.target.kind === "channel"
              ? "Edit channel"
              : contextMenu.target.kind === "direct"
                ? "View profile"
                : "Rename group"}
          </button>
          <button
            onClick={() => handleContextAction("delete")}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-rose-300 hover:bg-rose-500/20"
          >
            <HiOutlineTrash className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      ) : null}

      {/* New channel form */}
      {showNewChannelForm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={closeForms}>
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-zinc-950 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold">New Channel</h3>
            <p className="mt-1 text-xs text-slate-400">Create a workspace channel for team discussions.</p>
            <div className="mt-3 space-y-2">
              <input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Channel name"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
              />
              <textarea
                rows={3}
                value={newChannelDescription}
                onChange={(e) => setNewChannelDescription(e.target.value)}
                placeholder="Description"
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={closeForms} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">Cancel</button>
              <button onClick={createChannel} className="rounded-lg border border-black bg-white/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-white">Create</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* New conversation form */}
      {showNewConversationForm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={closeForms}>
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-zinc-950 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold">New Conversation</h3>
            <p className="mt-1 text-xs text-slate-400">Start a direct conversation with a real workspace user.</p>
            <div className="mt-3 space-y-2">
              <select
                value={newConversationUserId}
                onChange={(e) => setNewConversationUserId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              >
                <option value="">Select a workspace user</option>
                {selectableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.status})
                  </option>
                ))}
              </select>
              {!selectableMembers.length ? (
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                  No other workspace users are available yet.
                </div>
              ) : null}
              {currentMember ? (
                <p className="text-[11px] text-slate-500">Conversation will be created as {currentMember.name}.</p>
              ) : null}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={closeForms} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">Cancel</button>
              <button
                onClick={() => {
                  void createConversation();
                }}
                disabled={!newConversationUserId}
                className="rounded-lg border border-black bg-white/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* New group form */}
      {showNewGroupForm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={closeForms}>
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-zinc-950 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold">New Group</h3>
            <p className="mt-1 text-xs text-slate-400">Create a shared conversation with workspace members.</p>
            <div className="mt-3 space-y-3">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
              />
              <textarea
                rows={3}
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Description"
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-slate-500"
              />
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Members</p>
                  <span className="text-[11px] text-slate-500">{selectedGroupMemberIds.length + 1} including you</span>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {selectableMembers.map((member) => {
                    const checked = selectedGroupMemberIds.includes(member.id);
                    return (
                      <label key={member.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100">
                        <span className="min-w-0">
                          <span className="block truncate">{member.name}</span>
                          <span className="block text-[11px] text-slate-500">{member.role}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedGroupMemberIds((prev) => (
                              e.target.checked
                                ? [...prev, member.id]
                                : prev.filter((item) => item !== member.id)
                            ));
                          }}
                          className="h-4 w-4 rounded border-white/20 bg-transparent"
                        />
                      </label>
                    );
                  })}
                  {!selectableMembers.length ? (
                    <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                      No other workspace users are available yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={closeForms} className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">Cancel</button>
              <button
                onClick={() => {
                  void createGroup();
                }}
                disabled={!newGroupName.trim() || selectedGroupMemberIds.length === 0}
                className="rounded-lg border border-black bg-white/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
