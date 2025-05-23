import React, { useState, useEffect, useRef } from 'react';
import { ChatData, ParsedMessage } from '../types/contact';
import { loadChatMessages, parseMessages } from '../utils/dataLoader';

interface ChatHistoryProps {
  contactName: string;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ contactName }) => {
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const filteredMessages =
    chatData?.messages.filter((message) =>
      message.content.toLowerCase().includes(searchTerm.toLowerCase()),
    ) || [];

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  };

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
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = (message: ParsedMessage, index: number) => {
    const isUser = message.sender === 'user';
    const prevMessage = index > 0 ? filteredMessages[index - 1] : null;
    const showDateSeparator =
      !prevMessage ||
      message.timestamp.toDateString() !== prevMessage.timestamp.toDateString();

    return (
      <div key={index} className="mb-4">
        {showDateSeparator && (
          <div className="flex justify-center mb-4">
            <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
              {formatDate(message.timestamp)}
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
              {message.content}
            </div>
            <div
              className={`text-xs mt-1 ${
                isUser ? 'text-blue-100' : 'text-gray-500'
              }`}
            >
              {formatTime(message.timestamp)}
            </div>
          </div>
        </div>
      </div>
    );
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
          <div className="text-sm text-gray-500">
            {chatData?.totalCount || 0} messages
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
            {filteredMessages.map((message, index) =>
              renderMessage(message, index),
            )}
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
    </div>
  );
};

export default ChatHistory;
