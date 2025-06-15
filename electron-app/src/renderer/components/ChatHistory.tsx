import React, { useState, useEffect, useRef } from 'react';
import { ChatData, ParsedMessage } from '../types/contact';
import { loadChatMessages, parseMessages, loadGroupChatMessages, parseGroupChatMessages } from '../utils/dataLoader';
import AIMessageAssistant from './AIMessageAssistant';

interface ChatHistoryProps {
  contactName: string;
  contactPhoneNumbers: string[];
  contactEmails?: string[];
  isGroupChat?: boolean;
  groupChatPath?: string;
}

interface ContactStatus {
  isReachable: boolean;
  service: 'iMessage' | 'SMS' | 'unknown';
}

function ChatHistory({
  contactName,
  contactPhoneNumbers,
  contactEmails = [],
  isGroupChat = false,
  groupChatPath = '',
}: ChatHistoryProps) {
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Message sending state
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [contactStatus, setContactStatus] = useState<ContactStatus | null>(
    null,
  );
  const [messagesAppAvailable, setMessagesAppAvailable] = useState<
    boolean | null
  >(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // AI Assistant state
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const recipient = contactPhoneNumbers[0] || contactEmails?.[0] || '';

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true);
        setError(null);

        const rawMessages = await loadChatMessages(contactName);

        if (rawMessages) {
          const parsedData = parseMessages(rawMessages, contactName);
          setChatData(parsedData);
        } else {
          setError('No chat history found for this contact');
        }
      } catch (err) {
        console.error('Error loading chat messages:', err);
        setError('Failed to load chat history');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [contactName]);

  // Check Messages.app availability and contact status on mount
  useEffect(() => {
    const checkAvailability = async () => {
      if (!recipient) return;

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
        setSendError('Failed to check messaging availability');
      }
    };

    checkAvailability();
  }, [recipient]);

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    setSending(true);
    setSendError(null);
    setSendSuccess(null);

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
        message: messageText.trim(),
      });

      if (result.success) {
        setSendSuccess('Message sent successfully!');

        // Add the sent message to the chat display
        const newMessage: ParsedMessage = {
          content: messageText.trim(),
          timestamp: new Date(),
          sender: 'me',
        };

        setChatData((prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages, newMessage],
                totalCount: prev.totalCount + 1,
              }
            : null,
        );

        setMessageText('');

        // Clear success message after 3 seconds
        setTimeout(() => setSendSuccess(null), 3000);

        // Scroll to bottom to show new message
        setTimeout(() => scrollToBottom(), 100);
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setSendError(errorMessage);
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

  const handleAIInsertMessage = (aiMessage: string) => {
    setMessageText(aiMessage);
    setShowAIAssistant(false);
  };

  const filteredMessages =
    chatData?.messages.filter((msg) =>
      msg.content.toLowerCase().includes(searchTerm.toLowerCase()),
    ) || [];

  useEffect(() => {
    if (chatData && chatData.messages.length > 0) {
      // Scroll to bottom when messages load
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [chatData]);

  useEffect(() => {
    if (filteredMessages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [filteredMessages.length]);

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = (msg: ParsedMessage, index: number) => {
    const isUser = msg.sender === 'me';
    const prevMessage = index > 0 ? filteredMessages[index - 1] : null;
    const showDateSeparator =
      !prevMessage ||
      msg.timestamp.toDateString() !== prevMessage.timestamp.toDateString();

    return (
      <div key={index} className="mb-4">
        {showDateSeparator && (
          <div className="flex justify-center mb-4">
            <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
              {formatDate(msg.timestamp)}
            </div>
          </div>
        )}

        <div
          className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}
        >
          <div
            className={`max-w-sm lg:max-w-lg px-4 py-2 rounded-2xl break-words ${
              isUser
                ? 'bg-blue-500 text-white rounded-br-md'
                : 'bg-gray-200 text-gray-800 rounded-bl-md'
            }`}
          >
            <div className="text-sm whitespace-pre-wrap break-all">
              {msg.content}
            </div>
            <div
              className={`text-xs mt-1 ${
                isUser ? 'text-blue-100' : 'text-gray-500'
              }`}
            >
              {formatTime(msg.timestamp)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getStatusColor = () => {
    if (!contactStatus) return 'text-gray-500';
    if (contactStatus.service === 'iMessage') return 'text-blue-600';
    if (contactStatus.service === 'SMS') return 'text-green-600';
    return 'text-red-500';
  };

  const getStatusText = () => {
    if (!contactStatus) return 'Checking...';
    if (contactStatus.service === 'iMessage') return 'iMessage';
    if (contactStatus.service === 'SMS') return 'SMS';
    return 'Not reachable';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading chat history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-4">💬</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and stats */}
      <div className="border-b border-gray-200 p-4 bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Chat History with {contactName}
          </h3>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500">
              {chatData?.totalCount || 0} messages
            </div>
            {recipient && (
              <div className={`text-xs ${getStatusColor()}`}>
                {getStatusText()}
              </div>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400 text-sm">🔍</span>
          </div>
        </div>

        {/* Date range */}
        {chatData?.dateRange && (
          <div className="mt-2 text-xs text-gray-500">
            {formatDate(chatData.dateRange.start)} -{' '}
            {formatDate(chatData.dateRange.end)}
          </div>
        )}
      </div>

      {/* Messages container - Scrollable area */}
      <div
        className="flex-1 overflow-y-scroll p-4 bg-gray-50"
        style={{ height: 0 }}
        ref={scrollContainerRef}
      >
        {filteredMessages.length > 0 ? (
          <div className="space-y-2">
            {filteredMessages.map((msg, index) => renderMessage(msg, index))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-gray-400 text-4xl mb-4">🔍</div>
              <p className="text-gray-600">
                {searchTerm
                  ? 'No messages found matching your search'
                  : 'No messages to display'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* AI Message Assistant */}
      {recipient && (
        <AIMessageAssistant
          contactName={contactName}
          onInsertMessage={handleAIInsertMessage}
          isVisible={showAIAssistant}
          onToggle={() => setShowAIAssistant(!showAIAssistant)}
        />
      )}

      {/* Message Composer - Fixed at bottom */}
      {recipient && (
        <div className="border-t border-gray-200 bg-white p-4 flex-shrink-0">
          {sendError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-700">{sendError}</p>
            </div>
          )}

          {sendSuccess && (
            <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
              <p className="text-xs text-green-700">{sendSuccess}</p>
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              rows={2}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
              disabled={sending || !contactStatus?.isReachable}
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={
                !messageText.trim() || sending || !contactStatus?.isReachable
              }
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                !messageText.trim() || sending || !contactStatus?.isReachable
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }`}
            >
              {sending ? (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Send
                </div>
              ) : (
                'Send'
              )}
            </button>
          </div>

          {!contactStatus?.isReachable && contactStatus && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-xs text-yellow-700">
                This contact may not be reachable via iMessage. Make sure they
                have an iPhone or Mac with iMessage enabled.
              </p>
            </div>
          )}

          {messagesAppAvailable === false && (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs text-gray-600">Messages.app not running</p>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}

ChatHistory.defaultProps = {
  contactEmails: [],
};

export default ChatHistory;
