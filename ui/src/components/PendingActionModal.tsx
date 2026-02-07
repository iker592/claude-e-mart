import { useState } from 'react';
import type { PendingAction } from '../stores/sessionStore';
import { submitAgentResponse } from '../hooks/useNotifications';

interface PendingActionModalProps {
  sessionId: string;
  action: PendingAction;
  onClose: () => void;
  onResolved: () => void;
}

export function PendingActionModal({
  sessionId,
  action,
  onClose,
  onResolved,
}: PendingActionModalProps) {
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (value: string) => {
    setIsSubmitting(true);
    const success = await submitAgentResponse(sessionId, action.id, { value });
    setIsSubmitting(false);

    if (success) {
      onResolved();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {action.title}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          {action.description}
        </p>

        {action.type === 'approval_required' && action.options && (
          <div className="flex gap-3 justify-end">
            {action.options.map((option) => (
              <button
                key={option}
                onClick={() => handleSubmit(option)}
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  option.toLowerCase() === 'approve'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : option.toLowerCase() === 'reject'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white'
                } disabled:opacity-50`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {action.type === 'question' && (
          <div className="space-y-3">
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Enter your response..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmit(response)}
                disabled={isSubmitting || !response.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {action.type === 'error' && (
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
