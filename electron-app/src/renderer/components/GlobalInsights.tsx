import React, { useState } from 'react';
import { ContactWithSummary } from '../types/contact';

interface GlobalInsightsProps {
  contacts: ContactWithSummary[];
  onBack: () => void;
}

export const GlobalInsights: React.FC<GlobalInsightsProps> = ({
  contacts,
  onBack,
}) => {
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: 'user' | 'assistant'; message: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate global statistics
  const getGlobalStats = () => {
    const totalContacts = contacts.length;
    const totalMessages = contacts.reduce(
      (sum, contact) => sum + contact.total_messages,
      0,
    );
    const averageMessages = totalMessages / totalContacts;

    // Activity distribution
    const highActivity = contacts.filter((c) => c.total_messages > 500).length;
    const mediumActivity = contacts.filter(
      (c) => c.total_messages > 100 && c.total_messages <= 500,
    ).length;
    const lowActivity = contacts.filter((c) => c.total_messages <= 100).length;

    // Organizations
    const withOrganizations = contacts.filter((c) => c.organization).length;
    const organizations = new Set(
      contacts.map((c) => c.organization).filter(Boolean),
    );

    // Top contacts
    const topContacts = [...contacts]
      .sort((a, b) => b.total_messages - a.total_messages)
      .slice(0, 10);

    // Contact with photos
    const withPhotos = contacts.filter((c) => c.photo).length;

    return {
      totalContacts,
      totalMessages,
      averageMessages: Math.round(averageMessages),
      highActivity,
      mediumActivity,
      lowActivity,
      withOrganizations,
      totalOrganizations: organizations.size,
      topContacts,
      withPhotos,
    };
  };

  const globalStats = getGlobalStats();

  // Generate database context for AI
  const getDatabaseContext = () => {
    const stats = getGlobalStats();
    const topContactsSummary = stats.topContacts.map((c) => ({
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
      withPhotos: stats.withPhotos,
    };
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || isLoading) return;

    const userMessage = chatMessage.trim();
    setChatMessage('');
    setIsLoading(true);

    setChatHistory((prev) => [...prev, { role: 'user', message: userMessage }]);

    try {
      const databaseContext = getDatabaseContext();

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
        contactContext: {
          type: 'global_analysis',
          databaseStats: databaseContext,
        },
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
    <div className="bg-slate-50 min-h-screen px-6 py-0">
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={onBack}
          className="mt-6 mb-6 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          ← Back to Contacts
        </button>

        <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 rounded-2xl p-8 text-white shadow-2xl">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
              🌐
            </div>
            <h1 className="text-4xl font-bold mb-2">Global Contact Insights</h1>
            <p className="text-lg opacity-90 font-light">
              AI-powered analysis of your entire communication network
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Statistics Panel */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-100">
            Database Overview
          </h2>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-xl">
                <div className="text-2xl font-bold text-blue-900">
                  {globalStats.totalContacts}
                </div>
                <div className="text-sm text-blue-700">Total Contacts</div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl">
                <div className="text-2xl font-bold text-green-900">
                  {globalStats.totalMessages.toLocaleString()}
                </div>
                <div className="text-sm text-green-700">Total Messages</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-100 p-3 rounded-lg text-center">
                <div className="text-lg font-bold text-green-800">
                  {globalStats.highActivity}
                </div>
                <div className="text-xs text-green-600">High Activity</div>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg text-center">
                <div className="text-lg font-bold text-yellow-800">
                  {globalStats.mediumActivity}
                </div>
                <div className="text-xs text-yellow-600">Medium Activity</div>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg text-center">
                <div className="text-lg font-bold text-gray-800">
                  {globalStats.lowActivity}
                </div>
                <div className="text-xs text-gray-600">Low Activity</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-purple-50 p-4 rounded-xl">
                <div className="text-xl font-bold text-purple-900">
                  {globalStats.totalOrganizations}
                </div>
                <div className="text-sm text-purple-700">Organizations</div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl">
                <div className="text-xl font-bold text-indigo-900">
                  {globalStats.withPhotos}
                </div>
                <div className="text-sm text-indigo-700">With Photos</div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Top 5 Most Active Contacts
              </h3>
              <div className="space-y-2">
                {globalStats.topContacts.slice(0, 5).map((contact, index) => (
                  <div
                    key={contact.contact_name}
                    className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {index + 1}. {contact.contact_name}
                      </span>
                      {contact.organization && (
                        <span className="text-sm text-gray-500 ml-2">
                          ({contact.organization})
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-blue-600">
                      {contact.total_messages} msgs
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Chat Panel */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-gray-100">
            AI Database Analysis
          </h2>

          <div className="flex flex-col h-96">
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-xl mb-4 border">
              {chatHistory.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-lg mb-6">
                    Ask me anything about your contact database and
                    communication patterns!
                  </p>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() =>
                        setChatMessage(
                          'What are my main social circles and communication patterns?',
                        )
                      }
                      className="block w-full max-w-80 mx-auto bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-lg text-sm transition-colors duration-200"
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
                      className="block w-full max-w-80 mx-auto bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-lg text-sm transition-colors duration-200"
                    >
                      Relationship strength
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setChatMessage(
                          'Analyze my communication patterns by organization or group',
                        )
                      }
                      className="block w-full max-w-80 mx-auto bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-lg text-sm transition-colors duration-200"
                    >
                      Organization insights
                    </button>
                  </div>
                </div>
              )}

              {chatHistory.map((message, index) => (
                <div
                  key={index}
                  className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm ${
                      message.role === 'user'
                        ? 'bg-purple-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                    }`}
                  >
                    {message.message}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-4">
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

            <div className="flex gap-3">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about your communication network..."
                disabled={isLoading}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 disabled:bg-gray-100 disabled:text-gray-500"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!chatMessage.trim() || isLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl font-medium transition-colors duration-200 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
