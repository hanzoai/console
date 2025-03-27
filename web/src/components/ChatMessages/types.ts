import type { ChatMessageRole, ChatMessageWithId } from "@hanzo/shared";

export type MessagesContext = {
  messages: ChatMessageWithId[];
  addMessage: (role: ChatMessageRole, content?: string) => ChatMessageWithId;
  setMessages: (messages: ChatMessageWithId[]) => void;
  deleteMessage: (id: string) => void;
  updateMessage: <Key extends keyof ChatMessageWithId>(
    id: string,
    key: Key,
    value: ChatMessageWithId[Key],
  ) => void;
  availableRoles?: string[]; // Only defined if user has extended default roles (ChatMessageRole) with custom roles via SDK/API
};
