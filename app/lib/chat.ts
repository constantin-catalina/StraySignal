import { API_ENDPOINTS } from '@/constants/api';

export interface ConversationSummary {
  _id: string;
  participants: string[];
  peer: { id: string; name?: string; profileImage?: string };
  lastMessageText?: string;
  lastSenderId?: string;
  lastMessageAt?: string;
  lastMessageReadBy?: string[];
  unreadCount?: number;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  readBy?: string[];
}

function buildQuery(url: string, params: Record<string, string | undefined>) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k,v]) => { if (v) usp.append(k, v); });
  return `${url}?${usp.toString()}`;
}

export async function openOrCreateConversation(userId: string, peerId: string) {
  const res = await fetch(API_ENDPOINTS.CHAT_OPEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, peerId }),
  });
  if (!res.ok) throw new Error(`open conversation failed ${res.status}`);
  const data = await res.json();
  return data?.data?.conversationId as string;
}

export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const url = buildQuery(API_ENDPOINTS.CHAT_CONVERSATIONS, { userId });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`list conversations failed ${res.status}`);
  const data = await res.json();
  return data?.data || [];
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const url = `${API_ENDPOINTS.CHAT_MESSAGES}/${conversationId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`list messages failed ${res.status}`);
  const data = await res.json();
  return data?.data || [];
}

export async function sendMessage(conversationId: string, senderId: string, text: string) {
  const res = await fetch(API_ENDPOINTS.CHAT_MESSAGES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, senderId, text }),
  });
  if (!res.ok) throw new Error(`send message failed ${res.status}`);
  const data = await res.json();
  return data?.data as ChatMessage;
}
