import { create } from "zustand";
import { api, clearToken, getToken, setToken } from "./api";
import type {
  Contact,
  ConversationDetail,
  ConversationListItem,
  Message,
  User,
  WsEvent,
} from "./types";

interface AppState {
  user: User | null;
  token: string | null;
  initialized: boolean;
  conversations: ConversationListItem[];
  contacts: Contact[];
  messages: Record<number, Message[]>; // conversation_id -> messages
  typing: Record<number, number[]>; // conversation_id -> user_ids typing
  presence: Record<number, boolean>; // user_id -> online
  activeConversationId: number | null;
  wsConnected: boolean;
  replyTo: Message | null;
  setReplyTo: (message: Message | null) => void;
  sendMessage: (payload: {
    conversation_id: number;
    content: string;
    reply_to_id: number | null;
    client_temp_id: string;
  }) => void;
  sendTyping: (conversation_id: number, isTyping: boolean) => void;
  sendRead: (conversation_id: number, lastMessageId: number) => void;
  sendReaction: (message_id: number, emoji: string) => void;
  removeReaction: (message_id: number) => void;
  openConversation: (id: number) => Promise<void>;
  setActiveConversation: (id: number | null) => void;
  init: () => Promise<void>;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  loadConversations: () => Promise<void>;
  loadContacts: () => Promise<void>;
  upsertConversation: (convo: ConversationListItem) => void;
  getConversationDetail: (id: number) => Promise<ConversationDetail>;
  handleWsEvent: (event: WsEvent) => void;
  setWsConnected: (connected: boolean) => void;
  addContact: (contactUserId: number, nickname?: string) => Promise<Contact>;
  removeContact: (contactId: number) => Promise<void>;
  createGroup: (name: string, memberIds: number[]) => Promise<ConversationDetail>;
  startDirectConversation: (userId: number) => Promise<ConversationDetail>;
  lookupUserByUsername: (username: string) => Promise<User | null>;
}

let ws: WebSocket | null = null;
let wsHeartbeat: ReturnType<typeof setInterval> | null = null;

function connectWs(get: () => AppState, set: (partial: Partial<AppState>) => void) {
  const token = get().token;
  if (!token || typeof window === "undefined") return;
  ws?.close();
  const wsUrl =
    (process.env.NEXT_PUBLIC_WS_URL ||
      (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws")) +
    `/ws?token=${token}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    set({ wsConnected: true });
    if (wsHeartbeat) clearInterval(wsHeartbeat);
    wsHeartbeat = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }, 30000);
    // Re-sync state after a (re)connect — we may have missed events while offline.
    get().loadConversations();
    const activeId = get().activeConversationId;
    if (activeId !== null) {
      get().openConversation(activeId);
    }
  };

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as WsEvent;
      get().handleWsEvent(event);
    } catch {
      /* ignore */
    }
  };

  ws.onclose = () => {
    if (wsHeartbeat) clearInterval(wsHeartbeat);
    set({ wsConnected: false });
    // Exponential-ish backoff with jitter to avoid thundering herds.
    const delay = Math.min(1500 + Math.random() * 2000, 5000);
    setTimeout(() => {
      if (get().token) connectWs(get, set);
    }, delay);
  };

  ws.onerror = () => ws?.close();
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  token: null,
  initialized: false,
  conversations: [],
  contacts: [],
  messages: {},
  typing: {},
  presence: {},
  activeConversationId: null,
  wsConnected: false,
  replyTo: null,

  setReplyTo: (message) => set({ replyTo: message }),

  init: async () => {
    const token = getToken();
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const user = await api.get<User>("/auth/me");
      set({ token, user, initialized: true });
      connectWs(get, set);
      await Promise.all([get().loadConversations(), get().loadContacts()]);
    } catch {
      clearToken();
      set({ token: null, user: null, initialized: true });
    }
  },

  setAuth: (token, user) => {
    setToken(token);
    set({ token, user });
    connectWs(get, set);
    get().loadConversations();
    get().loadContacts();
  },

  logout: () => {
    clearToken();
    ws?.close();
    set({
      token: null,
      user: null,
      conversations: [],
      contacts: [],
      messages: {},
      typing: {},
      presence: {},
      activeConversationId: null,
      wsConnected: false,
    });
  },

  loadConversations: async () => {
    try {
      const conversations = await api.get<ConversationListItem[]>("/conversations");
      set({ conversations });
    } catch {
      /* keep last known */
    }
  },

  loadContacts: async () => {
    try {
      const contacts = await api.get<Contact[]>("/contacts");
      set({ contacts });
    } catch {
      /* keep last known */
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

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  sendMessage: (payload) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Resolve the quoted message locally for the optimistic bubble.
    const list = get().messages[payload.conversation_id] || [];
    const quoted = payload.reply_to_id
      ? list.find((m) => m.id === payload.reply_to_id)
      : null;
    const optimistic: Message = {
      id: -Date.now(),
      conversation_id: payload.conversation_id,
      sender_id: get().user?.id ?? 0,
      content: payload.content,
      reply_to_id: payload.reply_to_id,
      created_at: new Date().toISOString(),
      sender: get().user,
      reply_to: quoted
        ? {
            id: quoted.id,
            sender_id: quoted.sender_id,
            content: quoted.content,
            created_at: quoted.created_at,
            sender: quoted.sender,
          }
        : null,
      reactions: [],
      status: "sent",
      client_temp_id: payload.client_temp_id,
    };
    const messages = get().messages;
    set({
      messages: {
        ...messages,
        [payload.conversation_id]: [
          ...(messages[payload.conversation_id] || []),
          optimistic,
        ],
      },
    });
    ws.send(JSON.stringify({ type: "message:send", ...payload }));
  },

  sendTyping: (conversation_id, isTyping) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: isTyping ? "typing:start" : "typing:stop",
        conversation_id,
      })
    );
  },

  sendRead: (conversation_id, lastMessageId) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({ type: "message:read", conversation_id, last_message_id: lastMessageId })
    );
  },

  sendReaction: (message_id, emoji) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "reaction:add", message_id, emoji }));
  },

  removeReaction: (message_id) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "reaction:remove", message_id }));
  },

  openConversation: async (id) => {
    set({ activeConversationId: id });
    // Clear unread badge locally right away — don't wait for the WS round trip.
    const convo = get().conversations.find((c) => c.id === id);
    if (convo && convo.unread_count > 0) {
      get().upsertConversation({ ...convo, unread_count: 0 });
    }
    if (get().messages[id]) {
      // Mark read if there are messages.
      const msgs = get().messages[id];
      if (msgs.length > 0) get().sendRead(id, msgs[msgs.length - 1].id);
      return;
    }
    try {
      const messages = await api.get<Message[]>(`/conversations/${id}/messages?limit=50`);
      set({ messages: { ...get().messages, [id]: messages } });
      if (messages.length > 0) get().sendRead(id, messages[messages.length - 1].id);
    } catch {
      /* network issue */
    }
  },

  getConversationDetail: (id) => api.get<ConversationDetail>(`/conversations/${id}`),

  handleWsEvent: (event) => {
    const messages = get().messages;
    switch (event.type) {
      case "conversation:update":
        get().upsertConversation(event.conversation);
        break;
      case "message:new": {
        const m = event.message;
        const existing = messages[m.conversation_id] || [];
        // Reconcile optimistic by client_temp_id; server payload is authoritative.
        let next = existing;
        if (event.client_temp_id) {
          const idx = existing.findIndex(
            (x) => x.client_temp_id === event.client_temp_id && x.id < 0
          );
          if (idx !== -1) {
            next = [...existing];
            next[idx] = { ...m, client_temp_id: event.client_temp_id };
          } else if (!existing.some((x) => x.id === m.id)) {
            next = [...existing, m];
          }
        } else if (!existing.some((x) => x.id === m.id)) {
          next = [...existing, m];
        }
        set({ messages: { ...messages, [m.conversation_id]: next } });
        // If viewing, mark read.
        if (get().activeConversationId === m.conversation_id) {
          get().sendRead(m.conversation_id, m.id);
        }
        break;
      }
      case "message:status": {
        const convoId = get().activeConversationId;
        if (convoId === null) break;
        const list = messages[convoId] || [];
        const idx = list.findIndex((x) => x.id === event.message_id);
        if (idx === -1) break;
        const updated = [...list];
        updated[idx] = { ...updated[idx], status: event.status };
        set({ messages: { ...messages, [convoId]: updated } });
        break;
      }
      case "typing": {
        const current = get().typing[event.conversation_id] || [];
        const filtered = current.filter((uid) => uid !== event.user_id);
        if (event.is_typing) filtered.push(event.user_id);
        set({
          typing: { ...get().typing, [event.conversation_id]: filtered },
        });
        break;
      }
      case "presence":
        set({ presence: { ...get().presence, [event.user_id]: event.online } });
        break;
      case "reaction:update": {
        for (const [convoId, list] of Object.entries(messages)) {
          const idx = list.findIndex((x) => x.id === event.message_id);
          if (idx === -1) continue;
          const updated = [...list];
          updated[idx] = { ...updated[idx], reactions: event.reactions };
          set({ messages: { ...messages, [Number(convoId)]: updated } });
          break;
        }
        break;
      }
      default:
        break;
    }
  },

  addContact: async (contactUserId, nickname) => {
    const contact = await api.post<Contact>("/contacts", {
      contact_user_id: contactUserId,
      nickname: nickname || null,
    });
    set({ contacts: [...get().contacts, contact] });
    return contact;
  },

  removeContact: async (contactId) => {
    await api.delete(`/contacts/${contactId}`);
    set({ contacts: get().contacts.filter((c) => c.id !== contactId) });
  },

  createGroup: async (name, memberIds) => {
    const detail = await api.post<ConversationDetail>("/conversations/group", {
      name,
      member_ids: memberIds,
    });
    await get().loadConversations();
    return detail;
  },

  startDirectConversation: async (userId) => {
    const detail = await api.post<ConversationDetail>("/conversations/direct", {
      user_id: userId,
    });
    await get().loadConversations();
    return detail;
  },

  lookupUserByUsername: async (username) => {
    try {
      return await api.get<User>(
        `/users/lookup?username=${encodeURIComponent(username.trim())}`
      );
    } catch {
      return null;
    }
  },
}));

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__store = useStore;
}
