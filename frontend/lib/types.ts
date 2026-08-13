export interface User {
  id: number;
  phone_number: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  last_seen: string | null;
}

export interface Contact {
  id: number;
  contact_user_id: number;
  nickname: string | null;
  created_at: string;
  contact_user: User;
}

export interface ConversationListItem {
  id: number;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
  last_message: {
    id: number;
    sender_id: number;
    content: string;
    created_at: string;
  } | null;
  unread_count: number;
  other_user: User | null;
}

export interface ConversationDetail {
  id: number;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  participants: {
    user_id: number;
    role: "admin" | "member";
    joined_at: string;
    user: User;
  }[];
}

export interface MessageReaction {
  user_id: number;
  emoji: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  reply_to_id: number | null;
  created_at: string;
  sender: User | null;
  reply_to: {
    id: number;
    sender_id: number;
    content: string;
    created_at: string;
    sender: User | null;
  } | null;
  reactions: MessageReaction[];
  status: "sent" | "delivered" | "read";
}

export type WsEvent =
  | { type: "message:new"; message: Message; client_temp_id: string | null }
  | { type: "message:status"; message_id: number; user_id: number; status: "delivered" | "read" }
  | { type: "typing"; conversation_id: number; user_id: number; is_typing: boolean }
  | {
      type: "presence";
      user_id: number;
      online: boolean;
      last_seen: string | null;
    }
  | { type: "reaction:update"; message_id: number; reactions: MessageReaction[] }
  | { type: "conversation:update"; conversation: ConversationListItem }
  | { type: "error"; detail: string };
