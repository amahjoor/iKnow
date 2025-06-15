import React, { useState, useEffect } from 'react';
import {
  ContactWithSummary,
  ConversationData,
  GroupChatsData,
  GroupChat,
} from '../types/contact';
import {
  loadConversationData,
  getConversationContext,
  getFullConversationForAI,
  loadGroupChats,
  loadGroupChatDetails,
} from '../utils/dataLoader';
import ChatHistory from './ChatHistory';
import { CommunicationAnalytics } from './CommunicationAnalytics';
import {
  analyzeCommunicationHours,
  analyzeCommunicationTrends,
  analyzeResponseTimePatterns,
  CommunicationHours,
  CommunicationTrends,
  ResponseTimePatterns,
} from '../utils/messageAnalyzer';

interface ContactDetailProps {
  contact: ContactWithSummary;
  contacts: ContactWithSummary[];
  onBack: () => void;
}

function ContactDetail({ contact, contacts, onBack }: ContactDetailProps) {
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: 'user' | 'assistant'; message: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationData, setConversationData] =
    useState<ConversationData | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [viewMode, setViewMode] = useState<'ai' | 'chat'>('ai'); // Toggle between AI insights and chat history
  const [conversationType, setConversationType] = useState<'individual' | 'group'>('individual'); // Toggle between individual and group chats
  const [showGlobalAnalysis] = useState(false);
  const [showSidebar] = useState(true);

  // Group chat state
  const [groupChatsData, setGroupChatsData] = useState<GroupChatsData | null>(null);
  const [selectedGroupChat, setSelectedGroupChat] = useState<GroupChat | null>(null);
  const [isLoadingGroupChats, setIsLoadingGroupChats] = useState(false);

  // Analytics state
  const [communicationHours, setCommunicationHours] =
    useState<CommunicationHours | null>(null);
  const [communicationTrends, setCommunicationTrends] =
    useState<CommunicationTrends | null>(null);
  const [responsePatterns, setResponsePatterns] =
    useState<ResponseTimePatterns | null>(null);

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

  // Helper function to get the most active phone number using real phone numbers
  const getMostActivePhoneNumber = (): string => {
    if (!contact.phone_numbers || contact.phone_numbers.length === 0) {
      return 'No phone number';
    }

    // If we have phone usage data from summary, use it to find the most active real phone number
    if (
      contact.summary?.phone_number_usage &&
      Object.keys(contact.summary.phone_number_usage).length > 0
    ) {
      // Find the phone number with the highest usage count
      let maxUsage = 0;
      let mostActiveIndex = 0;

      Object.entries(contact.summary.phone_number_usage).forEach(
        ([phoneKey, usage]) => {
          // Try to map the usage key to our real phone numbers
          // The usage key might be anonymized, so we'll use the index/order instead
          const keyIndex = parseInt(phoneKey.replace(/\D/g, ''), 10) - 1; // Extract number and convert to 0-based index
          if (
            keyIndex >= 0 &&
            keyIndex < contact.phone_numbers.length &&
            usage &&
            usage > maxUsage
          ) {
            maxUsage = usage;
            mostActiveIndex = keyIndex;
          }
        },
      );

      return contact.phone_numbers[mostActiveIndex] || contact.phone_numbers[0];
    }

    // If no usage data, return the first phone number
    return contact.phone_numbers[0];
  };

  // Load conversation data when component mounts
  useEffect(() => {
    const loadConversation = async () => {
      setIsLoadingConversation(true);
      try {
        const data = await loadConversationData(contact.contact_name);
        setConversationData(data);

        // Calculate analytics if conversation data is available
        if (data && data.messages.length > 0) {
          const hours = analyzeCommunicationHours(data);
          const trends = analyzeCommunicationTrends(data);
          const patterns = await analyzeResponseTimePatterns(
            contact.contact_name,
          );

          setCommunicationHours(hours);
          setCommunicationTrends(trends);
          setResponsePatterns(patterns);
        }
      } catch (error) {
        console.error('Failed to load conversation data:', error);
      } finally {
        setIsLoadingConversation(false);
      }
    };

    loadConversation();
  }, [contact.contact_name]);

  // Load group chats when component mounts
  useEffect(() => {
    const loadGroupChatData = async () => {
      setIsLoadingGroupChats(true);
      try {
        const data = await loadGroupChats();
        setGroupChatsData(data);
      } catch (error) {
        console.error('Failed to load group chats:', error);
      } finally {
        setIsLoadingGroupChats(false);
      }
    };

    loadGroupChatData();
  }, []);

  // Find group chats that include this contact's phone numbers
  const getContactGroupChats = () => {
    if (!groupChatsData || !contact.phone_numbers) return [];
    
    return groupChatsData.group_chats.filter((groupChat) => 
      groupChat.participants.some((participantPhone) => 
        contact.phone_numbers.includes(participantPhone),
      ),
    );
  };

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
      (acc, contactItem) => {
        if (contactItem.organization) {
          if (!acc[contactItem.organization]) {
            acc[contactItem.organization] = [];
          }
          acc[contactItem.organization].push({
            name: contactItem.contact_name,
            messages: contactItem.total_messages,
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

        {/* Conversation Type Toggle */}
        <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-200 mb-6">
          <div className="flex items-center justify-center">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setConversationType('individual')}
                className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
                  conversationType === 'individual'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                1-on-1 Messages
              </button>
              <button
                type="button"
                onClick={() => setConversationType('group')}
                className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
                  conversationType === 'group'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Group Chats
              </button>
            </div>
          </div>
        </div>

        {/* Contact Info Panel */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-100">
            {conversationType === 'individual' ? 'Contact Information' : 'Group Chat Participation'}
          </h2>

          <div className="space-y-6">
            {conversationType === 'individual' ? (
              <>
                {/* Individual Contact Info */}
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
                      {getMostActivePhoneNumber()}
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
                  {contact.socialMedia.map((social) => (
                    <div
                      key={`${social.platform}-${social.url}`}
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
              </>
            ) : (
              /* Group Chat Section */
              <div className="space-y-6">
                {isLoadingGroupChats ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading group chats...</span>
                  </div>
                ) : (
                  <div>
                    {getContactGroupChats().length > 0 ? (
                      <>
                        <div className="text-sm text-gray-600 mb-4">
                          {contact.contact_name} participates in {getContactGroupChats().length} group chat{getContactGroupChats().length > 1 ? 's' : ''}
                        </div>
                        <div className="space-y-4">
                          {getContactGroupChats().map((groupChat) => (
                            <div
                              key={groupChat.group_name}
                              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={async () => {
                                try {
                                  const details = await loadGroupChatDetails(groupChat.file_path);
                                  setSelectedGroupChat(details);
                                } catch (error) {
                                  console.error('Failed to load group chat details:', error);
                                }
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 mb-2">
                                    {groupChat.group_name}
                                  </h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                    <div>
                                      <span className="font-medium">Total Messages:</span>
                                      <span className="ml-1">{groupChat.total_messages.toLocaleString()}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium">Participants:</span>
                                      <span className="ml-1">{groupChat.participants.length}</span>
                                    </div>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    Click to view details
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl">👥</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-4xl mb-4">👥</div>
                        <p className="text-lg font-medium mb-2">No Group Chats Found</p>
                        <p className="text-sm">
                          {contact.contact_name} doesn't appear to participate in any group chats
                          based on their phone numbers.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Group Chat Detail Modal */}
        {selectedGroupChat && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {selectedGroupChat.group_name}
                  </h3>
                  <button
                    onClick={() => setSelectedGroupChat(null)}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-96">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-semibold text-gray-700">Total Messages:</span>
                      <span className="ml-2 text-gray-900">
                        {selectedGroupChat.conversation_insights.total_messages.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Participants:</span>
                      <span className="ml-2 text-gray-900">
                        {selectedGroupChat.participants.count}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Date Range:</span>
                      <span className="ml-2 text-gray-900">
                        {selectedGroupChat.conversation_insights.date_range}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Messages/Day:</span>
                      <span className="ml-2 text-gray-900">
                        {selectedGroupChat.conversation_insights.message_frequency_per_day.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-800 mb-3">Participants</h4>
                    <div className="space-y-2">
                      {selectedGroupChat.participants.phone_numbers.map((phone) => (
                        <div key={phone} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                          <span className="font-mono text-sm">{phone}</span>
                          <span className="text-xs text-gray-500">
                            {selectedGroupChat.participants.activity[phone] || 0} messages
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Communication Analytics */}
        {communicationHours && communicationTrends && responsePatterns && (
          <div className="mt-8">
            <CommunicationAnalytics
              hours={communicationHours}
              trends={communicationTrends}
              responsePatterns={responsePatterns}
              contactName={contact.contact_name}
            />
          </div>
        )}
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
              <ChatHistory
                contactName={contact.contact_name}
                contactPhoneNumbers={contact.phone_numbers}
                contactEmails={contact.emails}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ContactDetail;
