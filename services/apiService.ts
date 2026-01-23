
import { Conversation, Message, Role } from '../types';
import { getSummary as fetchSummaryFromLLM } from './edenAiService';
import { CHAT_HISTORY_KEY } from '../constants';

const db = {
  conversations: {
    get: (id: string): Conversation | null => {
      try {
        const item = localStorage.getItem(`qmai-convo-${id}`);
        if (!item) return null;
        return JSON.parse(item);
      } catch (e) {
        console.error("Corrupt conversation data for id:", id, e);
        return null;
      }
    },
    set: (id: string, convo: Conversation) => {
      try {
        localStorage.setItem(`qmai-convo-${id}`, JSON.stringify(convo));
      } catch (e) {
        console.error("Failed to save conversation to localStorage", e);
      }
    },
    delete: (id: string) => {
      localStorage.removeItem(`qmai-convo-${id}`);
    },
    list: (): Conversation[] => {
      const convos: Conversation[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('qmai-convo-')) {
          try {
            const item = localStorage.getItem(key);
            if (item) {
              const parsed = JSON.parse(item);
              if (parsed && typeof parsed === 'object') {
                convos.push(parsed);
              }
            }
          } catch (e) {
             console.error("Failed to parse archive entry:", key, e);
             // Continue to next item rather than crashing
          }
        }
      }
      return convos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  },
  currentConversationId: {
    get: (): string | null => localStorage.getItem(CHAT_HISTORY_KEY),
    set: (id: string) => localStorage.setItem(CHAT_HISTORY_KEY, id),
    clear: () => localStorage.removeItem(CHAT_HISTORY_KEY)
  }
};

const createNewConversation = (): Conversation => {
    const newId = `convo-${Date.now()}`;
    return {
        id: newId,
        messages: [],
        summary: "The conversation has just begun.",
        simulationHistory: [],
        createdAt: Date.now(),
        isPublic: false,
    };
};

export const loadConversation = async (id?: string): Promise<Conversation> => {
    if (id) {
        const convo = db.conversations.get(id);
        if (convo) {
            db.currentConversationId.set(id);
            return convo;
        }
    }

    const currentId = db.currentConversationId.get();
    if (currentId) {
        const convo = db.conversations.get(currentId);
        if (convo) return convo;
    }

    const newConvo = createNewConversation();
    db.currentConversationId.set(newConvo.id);
    db.conversations.set(newConvo.id, newConvo);
    return newConvo;
};

export const saveConversation = async (conversation: Conversation): Promise<void> => {
    db.conversations.set(conversation.id, conversation);
    db.currentConversationId.set(conversation.id);
};

export const deleteConversation = async (id: string): Promise<void> => {
    db.conversations.delete(id);
    if (db.currentConversationId.get() === id) {
        db.currentConversationId.clear();
    }
};

export const listConversations = async (): Promise<Conversation[]> => {
    return db.conversations.list();
};

export const shareConversation = async (conversation: Conversation): Promise<{ shareUrl: string }> => {
    const sharedConvo = { ...conversation, isPublic: true };
    await saveConversation(sharedConvo);
    const shareUrl = `${window.location.origin}/share/${conversation.id}`;
    return { shareUrl };
};

export const getSummary = async (messages: Message[]): Promise<string> => {
    return await fetchSummaryFromLLM(messages);
};
