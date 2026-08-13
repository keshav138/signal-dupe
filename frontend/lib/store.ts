import { create } from "zustand";
import { api, clearToken, getToken, setToken } from "./api";
import type { ConversationListItem, User, WsEvent } from "./types";

interface AuthState {
  user: User | null;
  token: string | null;
  conversations: ConversationListItem[];
  initialized: boolean;
  init: () => Promise<void>;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  loadConversations: () => Promise<void>;
  upsertConversation: (convo: ConversationListItem) => void;
  handleWsEvent: (event: WsEvent) => void;
}

export const useStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  conversations: [],
  initialized: false,

  init: async () => {
    const token = getToken();
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const user = await api.get<User>("/auth/me");
      set({ token, user, initialized: true });
      await get().loadConversations();
    } catch {
      clearToken();
      set({ token: null, user: null, initialized: true });
    }
  },

  setAuth: (token, user) => {
    setToken(token);
    set({ token, user });
    get().loadConversations();
  },

  logout: () => {
    clearToken();
    set({ token: null, user: null, conversations: [] });
  },

  loadConversations: async () => {
    try {
      const conversations = await api.get<ConversationListItem[]>("/conversations");
      set({ conversations });
    } catch {
      /* network issue; keep last known list */
    }
  },

  upsertConversation: (convo) => {
    const conversations = get().conversations;
    const idx = conversations.findIndex((c) => c.id === convo.id);
    const next =
      idx === -1
        ? [convo, ...conversations]
        : [...conversations.slice(0, idx), convo, ...conversations.slice(idx + 1)];
    next.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    set({ conversations: next });
  },

  handleWsEvent: (event) => {
    if (event.type === "conversation:update") {
      get().upsertConversation(event.conversation);
    }
  },
}));
