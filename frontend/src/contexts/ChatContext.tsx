import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface ChatMessage {
  id: string;
  type: "request" | "response";
  timestamp: Date | string;
  requestedCount?: number;
  status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  completedCount?: number;
  jobId?: string;
  errorMessage?: string | null;
  prompt?: string;
  images?: { data: string; mimeType: string }[];
  questions?: {
    id: string;
    content: Record<string, unknown>;
    questionText: string;
    difficulty: string;
    tags: string[];
    status: string;
  }[];
}

export interface ChatSession {
  id: string;
  title: string;
  skillId: string;
  count: number;
  messages: ChatMessage[];
  createdAt: string;
}

interface ChatContextType {
  sessions: ChatSession[];
  activeSessionId: string | null;
  selectedSkillId: string | null;
  count: number;
  setActiveSessionId: (id: string | null) => void;
  setSelectedSkillId: (id: string | null) => void;
  setCount: (count: number) => void;
  createSession: (skillId: string, count: number, title?: string, messages?: ChatMessage[]) => string;
  deleteSession: (id: string) => void;
  updateSession: (id: string, patch: Partial<ChatSession>) => void;
  updateSessionMessage: (sessionId: string, msgId: string, patch: Partial<ChatMessage>) => void;
  addMessageToSession: (sessionId: string, message: ChatMessage) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  // Synchronous state initialization from localStorage to avoid blank initial states or timing race conditions
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem("generator_chat_sessions");
    if (saved) {
      try {
        return JSON.parse(saved) as ChatSession[];
      } catch (e) {
        console.error("Failed to parse chat sessions from localStorage", e);
      }
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const saved = localStorage.getItem("generator_chat_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        return parsed.length > 0 ? parsed[0].id : null;
      } catch {}
    }
    return null;
  });

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(() => {
    const saved = localStorage.getItem("generator_chat_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        return parsed.length > 0 ? parsed[0].skillId : null;
      } catch {}
    }
    return null;
  });

  const [count, setCount] = useState<number>(() => {
    const saved = localStorage.getItem("generator_chat_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        return parsed.length > 0 ? parsed[0].count || 5 : 5;
      } catch {}
    }
    return 5;
  });

  // Sync sessions state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("generator_chat_sessions", JSON.stringify(sessions));
  }, [sessions]);

  // Mutations defined with functional state updates so they never close over stale array instances
  const createSession = useCallback((skillId: string, count: number, title?: string, messages?: ChatMessage[]) => {
    const newId = crypto.randomUUID();
    const newSession: ChatSession = {
      id: newId,
      title: title || `Percakapan ${new Date().toLocaleDateString("id-ID")}`,
      skillId,
      count,
      messages: messages || [],
      createdAt: new Date().toISOString(),
    };
    
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setSelectedSkillId(skillId);
    setCount(count);
    return newId;
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      
      // Update active selection context if the deleted session was currently selected
      setActiveSessionId((currActive) => {
        if (currActive === id) {
          if (next.length > 0) {
            setSelectedSkillId(next[0].skillId);
            setCount(next[0].count || 5);
            return next[0].id;
          } else {
            setSelectedSkillId(null);
            setCount(5);
            return null;
          }
        }
        return currActive;
      });
      
      return next;
    });
  }, []);

  const updateSession = useCallback((id: string, patch: Partial<ChatSession>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }, []);

  const updateSessionMessage = useCallback((sessionId: string, msgId: string, patch: Partial<ChatMessage>) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: s.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
        };
      })
    );
  }, []);

  const addMessageToSession = useCallback((sessionId: string, message: ChatMessage) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          messages: [...s.messages, message],
        };
      })
    );
  }, []);

  return (
    <ChatContext.Provider
      value={{
        sessions,
        activeSessionId,
        selectedSkillId,
        count,
        setActiveSessionId,
        setSelectedSkillId,
        setCount,
        createSession,
        deleteSession,
        updateSession,
        updateSessionMessage,
        addMessageToSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
