import { create } from "zustand";
import { api, clearToken, getToken, setToken } from "./api";
import type { Contact, ConversationListItem, User, WsEvent } from "./types";

interface AppState {
  user: User | null;
  token: string | null;
  conversations: ConversationListItem[];
  contacts: Contact[];
  initialized: boolean;
  init: () => Promise<void>;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  loadConversations: () => Promise<void>;
  loadContacts: () => Promise<void>;
  upsertConversation: (convo: ConversationListItem) => void;
  handleWsEvent: (event: WsEvent) => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  token: null,
  conversations: [],
  contacts: [],
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
      await Promise.all([get().loadConversations(), get().loadContacts()]);
    } catch {
      clearToken();
      set({ token: null, user: null, initialized: true });
    }
  },

  setAuth: (token, user) => {
    setToken(token);
    set({ token, user });
    get().loadConversations();
    get().loadContacts();
  },

  logout: () => {
    clearToken();
    set({ token: null, user: null, conversations: [], contacts: [] });
  },

  loadConversations: async () => {
    try {
      const conversations = await api.get<ConversationListItem[]>("/conversations");
      set({ conversations });
    } catch {
      /* network issue; keep last known list */
    }
  },

  loadContacts: async () => {
    try {
      const contacts = await api.get<Contact[]>("/contacts");
      set({ contacts });
    } catch {
      /* network issue */
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

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__store = useStore;
}
