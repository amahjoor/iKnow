import React, { useState, useEffect } from 'react';
import { ContactWithSummary, ConversationData } from '../types/contact';
import {
  loadConversationData,
  getConversationContext,
  getFullConversationForAI,
} from '../utils/dataLoader';
import ChatHistory from './ChatHistory';

interface ContactDetailProps {
  contact: ContactWithSummary;
  contacts: ContactWithSummary[];
  onBack: () => void;
}

export const ContactDetail: React.FC<ContactDetailProps> = ({
  contact,
  contacts,
  onBack,
}) => {
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: 'user' | 'assistant'; message: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationData, setConversationData] =
    useState<ConversationData | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [viewMode, setViewMode] = useState<'ai' | 'chat'>('ai'); // Toggle between AI insights and chat history
  const [showGlobalAnalysis, setShowGlobalAnalysis] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const initials = contact.contact_name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const getActivityLevel = (
    messageCount: number,
  ): 'high' | 'medium' | 'low' => {
    if (messageCount > 500) return 'high';
    if (messageCount > 100) return 'medium';
    return 'low';
  };

  const activityLevel = getActivityLevel(contact.total_messages);

  const activityColors: Record<'high' | 'medium' | 'low', string> = {
    high: 'bg-green-100 text-green-800 border-green-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  // Load conversation data when component mounts
  useEffect(() => {
    const loadConversation = async () => {
      setIsLoadingConversation(true);
      try {
        const data = await loadConversationData(contact.contact_name);
        setConversationData(data);
      } catch (error) {
        console.error('Failed to load conversation data:', error);
      } finally {
        setIsLoadingConversation(false);
      }
    };

    loadConversation();
  }, [contact.contact_name]);

  // Generate database context for global AI analysis
  const getDatabaseContext = () => {
    const stats = {
      totalContacts: contacts.length,
      totalMessages: contacts.reduce((sum, c) => sum + c.total_messages, 0),
      averageMessages: Math.round(
        contacts.reduce((sum, c) => sum + c.total_messages, 0) /
          contacts.length,
      ),
      highActivity: contacts.filter((c) => c.total_messages > 500).length,
      mediumActivity: contacts.filter(
        (c) => c.total_messages > 100 && c.total_messages <= 500,
      ).length,
      lowActivity: contacts.filter((c) => c.total_messages <= 100).length,
    };

    const topContactsSummary = [...contacts]
      .sort((a, b) => b.total_messages - a.total_messages)
      .slice(0, 10)
      .map((c) => ({
        name: c.contact_name,
        messages: c.total_messages,
        organization: c.organization,
        frequency: c.summary?.message_frequency_per_day || 0,
      }));

    const organizationGroups = contacts.reduce(
      (acc, contact) => {
        if (contact.organization) {
          if (!acc[contact.organization]) {
            acc[contact.organization] = [];
          }
          acc[contact.organization].push({
            name: contact.contact_name,
            messages: contact.total_messages,
          });
        }
        return acc;
      },
      {} as Record<string, Array<{ name: string; messages: number }>>,
    );

    const withPhotos = contacts.filter((c) => c.photo).length;

    return {
      totalContacts: stats.totalContacts,
      totalMessages: stats.totalMessages,
      averageMessages: stats.averageMessages,
      activityDistribution: {
        high: stats.highActivity,
        medium: stats.mediumActivity,
        low: stats.lowActivity,
      },
      topContacts: topContactsSummary,
      organizations: organizationGroups,
      withPhotos,
    };
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isLoading) return;

    const userMessage = chatMessage.trim();
    setChatMessage('');
    setIsLoading(true);

    setChatHistory((prev) => [...prev, { role: 'user', message: userMessage }]);

    try {
      let contextData;

      if (showGlobalAnalysis) {
        // Global database analysis
        contextData = {
          type: 'global_analysis',
          databaseStats: getDatabaseContext(),
        };
      } else {
        // Individual contact analysis
        const context = getConversationContext(contact, conversationData);

        // Include full conversation if available
        let fullConversationText = '';
        if (conversationData) {
          fullConversationText = getFullConversationForAI(conversationData);
        }

        contextData = {
          ...context,
          fullConversation: fullConversationText,
        };
      }

      // Prepare messages for OpenAI
      const messages = [
        ...chatHistory.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.message,
        })),
        { role: 'user' as const, content: userMessage },
      ];

      // Call OpenAI API through Electron IPC
      const response = await window.electron.ipcRenderer.invoke('openai-chat', {
        messages,
        contactContext: contextData,
      });

      if (response.success) {
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', message: response.message },
        ]);
      } else {
        console.error('OpenAI API error:', response.error);
        setChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            message: `Sorry, I encountered an error: ${response.error}. Please make sure your OpenAI API key is configured in the .env file.`,
          },
        ]);
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          message:
            'Sorry, I encountered an error connecting to the AI service. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen py-0">
      {/* Main Content */}
      <div className={`px-6 ${showSidebar ? 'pr-[440px]' : ''}`}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mt-6 mb-6">
            <button
              type="button"
              onClick={onBack}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              ← Back to Contacts
            </button>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 rounded-2xl p-8 text-white shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {contact.photo ? (
                <img
                  src={contact.photo}
                  alt={contact.contact_name}
                  className="w-20 h-20 rounded-2xl object-cover border-4 border-white/30 shadow-lg mx-auto md:mx-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-2xl font-bold text-white mx-auto md:mx-0">
                  {initials}
                </div>
              )}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl font-bold mb-2">
                  {contact.contact_name}
                </h1>
                {contact.organization && (
                  <p className="text-lg opacity-90 mb-3">
                    {contact.organization}
                  </p>
                )}
                <div
                  className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${activityColors[activityLevel]}`}
                >
                  {activityLevel.charAt(0).toUpperCase() +
                    activityLevel.slice(1)}{' '}
                  Activity
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info Panel */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-100">
            Contact Information
          </h2>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <span className="font-semibold text-gray-700">
                  Total Messages:
                </span>
                <span className="ml-2 text-gray-900">
                  {contact.total_messages.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Date Range:</span>
                <span className="ml-2 text-gray-900">{contact.date_range}</span>
              </div>
              {contact.summary && (
                <>
                  <div>
                    <span className="font-semibold text-gray-700">
                      Messages/Day:
                    </span>
                    <span className="ml-2 text-gray-900">
                      {contact.summary.message_frequency_per_day.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">
                      Conversation Span:
                    </span>
                    <span className="ml-2 text-gray-900">
                      {contact.summary.conversation_span_days} days
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">
                      Sent/Received:
                    </span>
                    <span className="ml-2 text-gray-900">
                      {contact.summary.sent_messages} /{' '}
                      {contact.summary.received_messages}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">
                      Most Active:
                    </span>
                    <span className="ml-2 text-gray-900 font-mono text-xs">
                      {contact.summary.most_active_number ||
                        contact.phone_numbers[0]}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Personal Information */}
            {(contact.birthday ||
              contact.organization ||
              contact.professionalInfo) && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {contact.birthday && (
                    <div>
                      <span className="font-semibold text-gray-700">
                        Birthday:
                      </span>
                      <span className="ml-2 text-gray-900">
                        {new Date(contact.birthday.date).toLocaleDateString(
                          'en-US',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          },
                        )}
                      </span>
                    </div>
                  )}
                  {contact.organization && (
                    <div>
                      <span className="font-semibold text-gray-700">
                        Organization:
                      </span>
                      <span className="ml-2 text-gray-900">
                        {contact.organization}
                      </span>
                    </div>
                  )}
                  {contact.professionalInfo?.title && (
                    <div>
                      <span className="font-semibold text-gray-700">
                        Title:
                      </span>
                      <span className="ml-2 text-gray-900">
                        {contact.professionalInfo.title}
                      </span>
                    </div>
                  )}
                  {contact.professionalInfo?.role && (
                    <div>
                      <span className="font-semibold text-gray-700">Role:</span>
                      <span className="ml-2 text-gray-900">
                        {contact.professionalInfo.role}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contact Methods */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                Contact Methods
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-gray-700 text-sm mb-2">
                    Phone Numbers ({contact.phone_numbers.length})
                  </div>
                  <div className="space-y-1">
                    {contact.phone_numbers.map((phone) => (
                      <div
                        key={phone}
                        className="flex items-center justify-between py-1"
                      >
                        <span className="font-mono text-sm text-gray-900">
                          {phone}
                        </span>
                        <div className="flex gap-2">
                          <a
                            href={`tel:${phone}`}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Call
                          </a>
                          <a
                            href={`sms:${phone}`}
                            className="text-green-600 hover:text-green-800 text-xs font-medium"
                          >
                            Message
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {contact.emails && contact.emails.length > 0 && (
                  <div>
                    <div className="font-semibold text-gray-700 text-sm mb-2">
                      Email Addresses ({contact.emails.length})
                    </div>
                    <div className="space-y-1">
                      {contact.emails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center justify-between py-1"
                        >
                          <span className="font-mono text-sm text-gray-900">
                            {email}
                          </span>
                          <a
                            href={`mailto:${email}`}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            Email
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Social Media */}
            {contact.socialMedia && contact.socialMedia.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">
                  Social Media
                </h3>
                <div className="space-y-2">
                  {contact.socialMedia.map((social, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 capitalize">
                          {social.platform}
                        </span>
                        <a
                          href={
                            social.url.startsWith('http')
                              ? social.url
                              : `https://${social.url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 break-all"
                        >
                          {social.url
                            .replace(/^https?:\/\//, '')
                            .replace(/^www\./, '')}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - AI Analysis */}
      {showSidebar && (
        <div className="fixed top-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 h-screen transition-all duration-300 flex flex-col z-50">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            {/* Toggle Buttons */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setViewMode('ai')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'ai'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🤖 AI Insights
              </button>
              <button
                type="button"
                onClick={() => setViewMode('chat')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'chat'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                💬 Chat History
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          {viewMode === 'ai' ? (
            <>
              {/* AI Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-4">
                {chatHistory.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    {showGlobalAnalysis ? (
                      <div className="space-y-3">
                        <p className="text-sm mb-4">
                          Ask me anything about your contact database!
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setChatMessage(
                              'What are my main social circles and communication patterns?',
                            )
                          }
                          className="block w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-200"
                        >
                          Social circles analysis
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setChatMessage(
                              'Who are my strongest relationships and why?',
                            )
                          }
                          className="block w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-200"
                        >
                          Relationship strength
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm mb-4">
                          Ask me anything about your relationship with{' '}
                          {contact.contact_name}!
                          {isLoadingConversation && (
                            <span className="block text-xs text-gray-400 mt-1">
                              (Loading conversation data...)
                            </span>
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setChatMessage(
                              `What are the main topics ${contact.contact_name} and I discuss?`,
                            )
                          }
                          className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-200"
                        >
                          Main conversation topics
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setChatMessage(
                              `How has my relationship with ${contact.contact_name} evolved over time?`,
                            )
                          }
                          className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-200"
                        >
                          Relationship evolution
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {chatHistory.map((message, index) => {
                  const messageKey = `${message.role}-${message.message.slice(0, 20)}-${index}`;
                  const userMessageBg = showGlobalAnalysis
                    ? 'bg-purple-600 text-white rounded-br-sm'
                    : 'bg-blue-600 text-white rounded-br-sm';

                  return (
                    <div
                      key={messageKey}
                      className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                          message.role === 'user'
                            ? userMessageBg
                            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                        }`}
                      >
                        {message.message}
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex justify-start mb-4">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: '0.1s' }}
                        />
                        <div
                          className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={
                      showGlobalAnalysis
                        ? 'Ask about your network...'
                        : `Ask about ${contact.contact_name}...`
                    }
                    disabled={isLoading}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all duration-200 disabled:bg-gray-100 disabled:text-gray-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!chatMessage.trim() || isLoading}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:cursor-not-allowed text-sm ${
                      showGlobalAnalysis
                        ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white'
                    }`}
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Chat History View
            <div className="flex-1 min-h-0">
              <ChatHistory contactName={contact.contact_name} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
