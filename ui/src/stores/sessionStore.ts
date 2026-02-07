import { create } from 'zustand';

export type AgentStatus = 'idle' | 'running' | 'waiting_user' | 'completed' | 'error';

export type PendingAction = {
  id: string;
  type: 'approval_required' | 'question' | 'error';
  title: string;
  description: string;
  options?: string[];
};

export type SessionState = {
  sessionId: string;
  status: AgentStatus;
  pendingAction: PendingAction | null;
  progressMessage: string | null;
  lastActivity: string;
};

interface SessionStore {
  sessions: Record<string, SessionState>;
  activeSessionId: string | null;

  // Actions
  setActiveSession: (id: string | null) => void;
  updateSessionStatus: (id: string, status: AgentStatus) => void;
  setPendingAction: (id: string, action: PendingAction | null) => void;
  updateSession: (id: string, updates: Partial<SessionState>) => void;
  removeSession: (id: string) => void;

  // Selectors
  getSessionsNeedingAttention: () => SessionState[];
  getActiveSession: () => SessionState | null;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: {},
  activeSessionId: null,

  setActiveSession: (id) => set({ activeSessionId: id }),

  updateSessionStatus: (id, status) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [id]: {
          ...state.sessions[id],
          sessionId: id,
          status,
          lastActivity: new Date().toISOString(),
        },
      },
    })),

  setPendingAction: (id, action) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [id]: {
          ...state.sessions[id],
          sessionId: id,
          pendingAction: action,
          status: action ? 'waiting_user' : state.sessions[id]?.status || 'idle',
          lastActivity: new Date().toISOString(),
        },
      },
    })),

  updateSession: (id, updates) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [id]: {
          ...state.sessions[id],
          sessionId: id,
          ...updates,
          lastActivity: new Date().toISOString(),
        },
      },
    })),

  removeSession: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.sessions;
      return { sessions: rest };
    }),

  getSessionsNeedingAttention: () => {
    const { sessions } = get();
    return Object.values(sessions).filter(
      (s) => s.status === 'waiting_user' && s.pendingAction
    );
  },

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return activeSessionId ? sessions[activeSessionId] || null : null;
  },
}));
