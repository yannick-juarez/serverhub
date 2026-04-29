import type { GroupConversation } from "./types";

export const INITIAL_GROUPS: GroupConversation[] = [
  { id: "grp-ops", name: "Ops War Room", description: "Shared coordination", members: 6, memberIds: [], unread: 1 },
  { id: "grp-security", name: "Security Leads", description: "Security reviews", members: 4, memberIds: [] },
  { id: "grp-product", name: "Product Sync", description: "Product planning", members: 8, memberIds: [], unread: 2 },
];

export const REACTION_OPTIONS = ["👍", "🔥", "✅", "😂", "🎯", "👀", "🙏", "🚨", "❤️", "👎"];
