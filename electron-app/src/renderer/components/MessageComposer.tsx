import React, { useState, useEffect } from 'react';

interface MessageComposerProps {
  recipient: string;
  recipientName: string;
  onMessageSent?: (message: string, success: boolean) => void;
}

interface ContactStatus {
  isReachable: boolean;
  service: 'iMessage' | 'SMS' | 'unknown';
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  recipient,
  recipientName,
  onMessageSent,
}) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [contactStatus, setContactStatus] = useState<ContactStatus | null>(
    null,
  );
  const [messagesAppAvailable, setMessagesAppAvailable] = useState<
    boolean | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check Messages.app availability and contact status on mount
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        // Check if Messages.app is available
        const appResult =
          await window.electron.ipcRenderer.invoke('check-messages-app');
        if (appResult.success) {
          setMessagesAppAvailable(appResult.isAvailable);
        }

        // Check contact status
        const statusResult = await window.electron.ipcRenderer.invoke(
          'check-contact-status',
          {
            recipient,
          },
        );
        if (statusResult.success) {
          setContactStatus(statusResult.status);
        }
      } catch (err) {
        console.error('Error checking availability:', err);
        setError('Failed to check messaging availability');
      }
    };

    if (recipient) {
      checkAvailability();
    }
  }, [recipient]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      // Launch Messages.app if not available
      if (!messagesAppAvailable) {
        const launchResult = await window.electron.ipcRenderer.invoke(
          'launch-messages-app',
        );
        if (!launchResult.success) {
          throw new Error(
            launchResult.error || 'Failed to launch Messages.app',
          );
        }
        setMessagesAppAvailable(true);
      }

      // Send the message
      const result = await window.electron.ipcRenderer.invoke('send-imessage', {
        recipient,
        message: message.trim(),
      });

      if (result.success) {
        setSuccess('Message sent successfully!');
        setMessage('');
        onMessageSent?.(message.trim(), true);

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      onMessageSent?.(message.trim(), false);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusColor = () => {
    if (!contactStatus) return 'text-gray-500';
    if (contactStatus.service === 'iMessage') return 'text-blue-600';
    if (contactStatus.service === 'SMS') return 'text-green-600';
    return 'text-red-500';
  };

  const getStatusText = () => {
    if (!contactStatus) return 'Checking...';
    if (contactStatus.service === 'iMessage') return 'iMessage available';
    if (contactStatus.service === 'SMS') return 'SMS available';
    return 'Not reachable';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-900">
          Send Message to {recipientName}
        </h3>
        <div className="flex items-center gap-2">
          <div className={`text-sm ${getStatusColor()}`}>{getStatusText()}</div>
          {messagesAppAvailable === false && (
            <button
              type="button"
              onClick={async () => {
                const result = await window.electron.ipcRenderer.invoke(
                  'launch-messages-app',
                );
                if (result.success) {
                  setMessagesAppAvailable(true);
                }
              }}
              className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
            >
              Launch Messages
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label htmlFor="message" className="sr-only">
            Message
          </label>
          <textarea
            id="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
            disabled={sending || !contactStatus?.isReachable}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {message.length} characters
          </div>
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!message.trim() || sending || !contactStatus?.isReachable}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !message.trim() || sending || !contactStatus?.isReachable
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }`}
          >
            {sending ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </div>
            ) : (
              'Send Message'
            )}
          </button>
        </div>
      </div>

      {!contactStatus?.isReachable && contactStatus && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700">
            This contact may not be reachable via iMessage. Make sure they have
            an iPhone or Mac with iMessage enabled.
          </p>
        </div>
      )}
    </div>
  );
};
