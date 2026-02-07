import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import type { SessionState, PendingAction } from '../stores/sessionStore';

interface NotificationEvent {
  type: 'needs_attention' | 'status_update' | 'progress';
  session_id: string;
  status?: string;
  pending_action?: PendingAction;
  progress_message?: string;
}

interface UseNotificationsOptions {
  sessionIds: string[];
  onNotification?: (event: NotificationEvent) => void;
  enabled?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useNotifications({
  sessionIds,
  onNotification,
  enabled = true,
}: UseNotificationsOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const { updateSession, setPendingAction } = useSessionStore();

  const connect = useCallback(() => {
    if (!enabled || sessionIds.length === 0) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_BASE}/api/notifications?session_ids=${sessionIds.join(',')}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: NotificationEvent = JSON.parse(event.data);

        // Update store based on event type
        if (data.type === 'needs_attention' && data.pending_action) {
          setPendingAction(data.session_id, data.pending_action);

          // Show browser notification if permission granted
          if (Notification.permission === 'granted') {
            new Notification('Agent needs attention', {
              body: data.pending_action.title,
              tag: data.session_id,
            });
          }
        } else if (data.type === 'status_update' && data.status) {
          updateSession(data.session_id, {
            status: data.status as SessionState['status'],
            pendingAction: data.pending_action || null,
          });
        } else if (data.type === 'progress' && data.progress_message) {
          updateSession(data.session_id, {
            progressMessage: data.progress_message,
          });
        }

        onNotification?.(data);
      } catch (error) {
        console.error('Failed to parse notification:', error);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 5000);
    };
  }, [enabled, sessionIds, updateSession, setPendingAction, onNotification]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Connect when sessionIds change
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Polling fallback
  const pollStatus = useCallback(async () => {
    if (sessionIds.length === 0) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/sessions/status?session_ids=${sessionIds.join(',')}`
      );
      if (response.ok) {
        const statuses: SessionState[] = await response.json();
        statuses.forEach((s) => {
          updateSession(s.sessionId, s);
        });
      }
    } catch (error) {
      console.error('Failed to poll status:', error);
    }
  }, [sessionIds, updateSession]);

  return { pollStatus };
}

// Helper to submit response to waiting agent
export async function submitAgentResponse(
  sessionId: string,
  actionId: string,
  response: Record<string, unknown>
): Promise<boolean> {
  const API_BASE = import.meta.env.VITE_API_URL || '';

  try {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_id: actionId, response }),
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to submit response:', error);
    return false;
  }
}

// Helper to cancel agent
export async function cancelAgent(sessionId: string): Promise<boolean> {
  const API_BASE = import.meta.env.VITE_API_URL || '';

  try {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/cancel`, {
      method: 'POST',
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to cancel agent:', error);
    return false;
  }
}
