import React, { useState, useMemo, useEffect } from 'react';
import { ContactWithSummary } from '../types/contact';
import { ContactCard } from './ContactCard';
import { searchContacts, sortContactsByActivity } from '../utils/dataLoader';
import {
  analyzeAllMessages,
  getCommunicationInsights,
} from '../utils/messageAnalyzer';

interface DashboardProps {
  contacts: ContactWithSummary[];
  onContactSelect: (contact: ContactWithSummary) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  contacts,
  onContactSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'activity'>('activity');
  const [filterBy, setFilterBy] = useState<'all' | 'high' | 'medium' | 'low'>(
    'all',
  );
  const [organizationFilter, setOrganizationFilter] = useState<string>('all');
  const [frequencyRange, setFrequencyRange] = useState<[number, number]>([
    0, 10,
  ]); // Messages per day range
  const [photoFilter, setPhotoFilter] = useState<'with' | 'without' | 'all'>(
    'all',
  );
  const [contactTypeFilter, setContactTypeFilter] = useState<
    'professional' | 'personal' | 'all'
  >('all');
  const [lastMessageSenderFilter, setLastMessageSenderFilter] = useState<
    'me' | 'them' | 'all'
  >('all');
  const [showFilters, setShowFilters] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState<'min' | 'max' | null>(
    null,
  );
  const [draggingDateHandle, setDraggingDateHandle] = useState<
    'min' | 'max' | null
  >(null);

  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: 'user' | 'assistant'; message: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);

  // Get unique organizations for filter dropdown
  const organizations = useMemo(() => {
    const orgs = new Set(contacts.map((c) => c.organization).filter(Boolean));
    return Array.from(orgs).sort();
  }, [contacts]);

  // Calculate max frequency for slider
  const maxFrequency = useMemo(() => {
    const frequencies = contacts
      .map((c) => c.summary?.message_frequency_per_day || 0)
      .filter((f) => f > 0);
    return Math.max(...frequencies, 10); // At least 10 messages per day as max
  }, [contacts]);

  // Calculate date range for last message sent slider
  const { minDate, maxDate } = useMemo(() => {
    const dates: Date[] = [];

    contacts.forEach((contact) => {
      // First try to use last_message_info if available
      if (contact.last_message_info?.last_message_timestamp) {
        const date = new Date(contact.last_message_info.last_message_timestamp);
        if (!isNaN(date.getTime())) {
          dates.push(date);
          return; // Continue to next contact
        }
      }

      // Fallback to parsing date_range
      const dateRange = contact.date_range || contact.summary?.date_range || '';
      // Match the end date (last message sent date)
      const endDateMatch = dateRange.match(/to\s+(\d{4}-\d{2}-\d{2})/);

      if (endDateMatch && endDateMatch[1]) {
        const date = new Date(endDateMatch[1] + 'T00:00:00');
        // Only add valid dates
        if (!isNaN(date.getTime())) {
          dates.push(date);
        }
      }
    });

    if (dates.length === 0) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const yearAgo = new Date(now);
      yearAgo.setFullYear(now.getFullYear() - 1);
      return { minDate: yearAgo, maxDate: now };
    }

    const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());

    // Add some padding to the date range for better UX
    const firstDate = new Date(sortedDates[0]);
    firstDate.setDate(firstDate.getDate() - 7); // 7 days before earliest

    const lastDate = new Date(sortedDates[sortedDates.length - 1]);
    lastDate.setDate(lastDate.getDate() + 7); // 7 days after latest

    return {
      minDate: firstDate,
      maxDate: lastDate,
    };
  }, [contacts]);

  // Initialize date range state
  const [dateRange, setDateRange] = useState<[Date, Date]>([minDate, maxDate]);

  // Update date range when min/max dates change
  useEffect(() => {
    setDateRange([minDate, maxDate]);
  }, [minDate, maxDate]);

  // Helper function to format date
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Helper function to get frequency label
  const getFrequencyLabel = (frequency: number): string => {
    if (frequency >= 5) return 'Multiple daily';
    if (frequency >= 1) return 'Daily';
    if (frequency >= 0.14) return 'Weekly'; // ~1 per week (1/7 = 0.143)
    if (frequency >= 0.03) return 'Monthly'; // ~1 per month (1/30 = 0.033)
    if (frequency >= 0.008) return 'Quarterly'; // ~1 per quarter (1/120 = 0.008)
    return 'Rarely';
  };

  // Calculate active filters count
  const activeFiltersCount = [
    filterBy !== 'all',
    organizationFilter !== 'all',
    dateRange[0].getTime() > minDate.getTime() ||
      dateRange[1].getTime() < maxDate.getTime(),
    frequencyRange[0] > 0 || frequencyRange[1] < maxFrequency,
    photoFilter !== 'all',
    contactTypeFilter !== 'all',
    lastMessageSenderFilter !== 'all',
  ].filter(Boolean).length;

  const filteredAndSortedContacts = useMemo(() => {
    let filtered = searchQuery
      ? searchContacts(contacts, searchQuery)
      : contacts;

    // Filter by activity level
    if (filterBy !== 'all') {
      filtered = filtered.filter((contact) => {
        const messageCount = contact.total_messages;
        switch (filterBy) {
          case 'high':
            return messageCount > 500;
          case 'medium':
            return messageCount > 100 && messageCount <= 500;
          case 'low':
            return messageCount <= 100;
          default:
            return true;
        }
      });
    }

    // Filter by organization
    if (organizationFilter !== 'all') {
      filtered = filtered.filter(
        (contact) => contact.organization === organizationFilter,
      );
    }

    // Filter by date range
    filtered = filtered.filter((contact) => {
      // First try to use last_message_info if available
      if (contact.last_message_info?.last_message_timestamp) {
        const lastMessageDate = new Date(
          contact.last_message_info.last_message_timestamp,
        );
        const startDate = new Date(dateRange[0]);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange[1]);
        endDate.setHours(23, 59, 59, 999);

        return lastMessageDate >= startDate && lastMessageDate <= endDate;
      }

      // Fallback to parsing date_range string
      const dateRangeStr =
        contact.date_range || contact.summary?.date_range || '';
      const dateMatch = dateRangeStr.match(/to\s+(\d{4}-\d{2}-\d{2})/);

      if (!dateMatch || !dateMatch[1]) {
        // If we can't parse the date and we're filtering, exclude the contact
        // Only include if the date range is at its default (showing all)
        return (
          dateRange[0].getTime() === minDate.getTime() &&
          dateRange[1].getTime() === maxDate.getTime()
        );
      }

      // Parse the date and ensure we're comparing at the start of the day
      const lastMessageDate = new Date(dateMatch[1] + 'T00:00:00');
      const startDate = new Date(dateRange[0]);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange[1]);
      endDate.setHours(23, 59, 59, 999);

      return lastMessageDate >= startDate && lastMessageDate <= endDate;
    });

    // Filter by communication frequency range
    filtered = filtered.filter((contact) => {
      const frequency = contact.summary?.message_frequency_per_day || 0;
      return frequency >= frequencyRange[0] && frequency <= frequencyRange[1];
    });

    // Filter by photo
    if (photoFilter !== 'all') {
      filtered = filtered.filter((contact) =>
        photoFilter === 'with' ? contact.photo : !contact.photo,
      );
    }

    // Filter by contact type
    if (contactTypeFilter !== 'all') {
      filtered = filtered.filter((contact) =>
        contactTypeFilter === 'professional'
          ? contact.organization
          : !contact.organization,
      );
    }

    // Filter by last message sender
    if (lastMessageSenderFilter !== 'all') {
      filtered = filtered.filter((contact) => {
        // Use last_message_info if available
        if (contact.last_message_info?.last_message_sender) {
          const sender = contact.last_message_info.last_message_sender;
          if (lastMessageSenderFilter === 'me') {
            return sender === 'me';
          } else if (lastMessageSenderFilter === 'them') {
            return sender === 'contact' || sender === 'unknown';
          }
        }
        // If no last_message_info, exclude from filtered results when filter is active
        return false;
      });
    }

    // Sort contacts
    switch (sortBy) {
      case 'activity':
        return sortContactsByActivity(filtered);
      case 'name':
        return [...filtered].sort((a, b) =>
          a.contact_name.localeCompare(b.contact_name),
        );
      default:
        return filtered;
    }
  }, [
    contacts,
    searchQuery,
    sortBy,
    filterBy,
    organizationFilter,
    dateRange,
    frequencyRange,
    photoFilter,
    contactTypeFilter,
    maxFrequency,
    lastMessageSenderFilter,
  ]);

  const clearAllFilters = () => {
    setFilterBy('all');
    setOrganizationFilter('all');
    setDateRange([minDate, maxDate]);
    setFrequencyRange([0, maxFrequency]);
    setPhotoFilter('all');
    setContactTypeFilter('all');
    setLastMessageSenderFilter('all');
    setSearchQuery('');
  };

  // Format AI message content with proper line breaks and basic formatting
  const formatAIMessage = (content: string) => {
    // Split content into lines for processing
    const lines = content.split('\n');
    const elements: React.JSX.Element[] = [];
    let currentParagraph: string[] = [];
    let inList = false;
    let listItems: string[] = [];

    const processParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(' ').trim();
        if (text) {
          elements.push(
            <p key={elements.length} className="mb-3 text-sm leading-relaxed">
              {formatInlineText(text)}
            </p>,
          );
        }
        currentParagraph = [];
      }
    };

    const processList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul
            key={elements.length}
            className="mb-3 space-y-1 list-disc list-inside"
          >
            {listItems.map((item, index) => (
              <li key={index} className="text-sm leading-relaxed">
                {formatInlineText(item)}
              </li>
            ))}
          </ul>,
        );
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      // Check for headers
      if (trimmedLine.startsWith('### ')) {
        processParagraph();
        processList();
        elements.push(
          <h3 key={elements.length} className="font-semibold text-sm mb-2">
            {formatInlineText(trimmedLine.substring(4))}
          </h3>,
        );
      } else if (trimmedLine.startsWith('## ')) {
        processParagraph();
        processList();
        elements.push(
          <h2 key={elements.length} className="font-bold text-base mb-2">
            {formatInlineText(trimmedLine.substring(3))}
          </h2>,
        );
      } else if (trimmedLine.startsWith('# ')) {
        processParagraph();
        processList();
        elements.push(
          <h1 key={elements.length} className="font-bold text-lg mb-2">
            {formatInlineText(trimmedLine.substring(2))}
          </h1>,
        );
      }
      // Check for numbered lists
      else if (/^\d+\.\s/.test(trimmedLine)) {
        if (!inList) {
          processParagraph();
          inList = true;
        }
        listItems.push(trimmedLine.replace(/^\d+\.\s/, ''));
      }
      // Check for bullet lists
      else if (/^[-•*]\s/.test(trimmedLine)) {
        if (!inList) {
          processParagraph();
          inList = true;
        }
        listItems.push(trimmedLine.replace(/^[-•*]\s/, ''));
      }
      // Empty line - end current paragraph/list
      else if (trimmedLine === '') {
        processParagraph();
        processList();
      }
      // Regular text line
      else {
        if (inList) {
          processList();
        }
        currentParagraph.push(trimmedLine);
      }
    });

    // Process any remaining content
    processParagraph();
    processList();

    return <>{elements}</>;
  };

  // Format inline text with markdown support
  const formatInlineText = (text: string): (string | React.JSX.Element)[] => {
    const elements: (string | React.JSX.Element)[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Check for bold text **text**
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        // Add text before the bold
        if (boldMatch.index > 0) {
          elements.push(remaining.substring(0, boldMatch.index));
        }
        // Add the bold text
        elements.push(
          <strong key={`bold-${key++}`} className="font-semibold">
            {boldMatch[1]}
          </strong>,
        );
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
        continue;
      }

      // Check for inline code `code`
      const codeMatch = remaining.match(/`([^`]+)`/);
      if (codeMatch && codeMatch.index !== undefined) {
        // Add text before the code
        if (codeMatch.index > 0) {
          elements.push(remaining.substring(0, codeMatch.index));
        }
        // Add the code text
        elements.push(
          <code
            key={`code-${key++}`}
            className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono"
          >
            {codeMatch[1]}
          </code>,
        );
        remaining = remaining.substring(codeMatch.index + codeMatch[0].length);
        continue;
      }

      // No more formatting found, add the rest as plain text
      elements.push(remaining);
      break;
    }

    return elements;
  };

  const getStats = () => {
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
    const organizations = new Set(
      contacts.map((c) => c.organization).filter(Boolean),
    );

    return {
      totalContacts,
      totalMessages,
      averageMessages: Math.round(averageMessages),
      highActivity,
      mediumActivity,
      lowActivity,
      totalOrganizations: organizations.size,
    };
  };

  const stats = getStats();

  // Generate database context for global AI analysis
  const getDatabaseContext = () => {
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
      // Perform message analysis for more comprehensive insights
      const messageAnalysis = await analyzeAllMessages(contacts);

      // Global database analysis
      const contextData = {
        type: 'global_analysis',
        databaseStats: getDatabaseContext(),
        messageAnalysis,
      };

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

  const handleGlobalDatabaseAnalysis = async () => {
    setIsAILoading(true);
    setShowSidebar(true);

    try {
      // First, perform message analysis
      const messageAnalysis = await analyzeAllMessages(contacts);
      const insights = getCommunicationInsights(messageAnalysis);

      // Calculate database statistics
      const totalMessages = contacts.reduce(
        (sum, contact) => sum + contact.total_messages,
        0,
      );
      const avgMessages = Math.round(totalMessages / contacts.length);

      const activityDistribution = {
        high: contacts.filter((c) => c.total_messages >= 500).length,
        medium: contacts.filter(
          (c) => c.total_messages >= 100 && c.total_messages < 500,
        ).length,
        low: contacts.filter((c) => c.total_messages < 100).length,
      };

      const topContacts = [...contacts]
        .sort((a, b) => b.total_messages - a.total_messages)
        .slice(0, 10)
        .map((c) => ({
          name: c.contact_name,
          messages: c.total_messages,
          organization: c.organization,
          frequency: c.summary?.message_frequency_per_day || 0,
        }));

      // Group by organizations
      const organizations: Record<string, ContactWithSummary[]> = {};
      contacts.forEach((contact) => {
        const org = contact.organization || 'No Organization';
        if (!organizations[org]) {
          organizations[org] = [];
        }
        organizations[org].push(contact);
      });

      const topOrganizations = Object.entries(organizations)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5)
        .reduce(
          (acc, [org, contactsList]) => ({
            ...acc,
            [org]: contactsList,
          }),
          {},
        );

      const databaseStats = {
        totalContacts: contacts.length,
        totalMessages,
        averageMessages: avgMessages,
        activityDistribution,
        topContacts,
        organizations: topOrganizations,
        withPhotos: contacts.filter((c) => c.photo).length,
      };

      // Send initial message to AI with database stats and message analysis
      const initialMessage = {
        role: 'user' as const,
        content:
          'Analyze my entire contact database and provide insights about my communication patterns, social circles, and relationship dynamics. Include analysis of my vocabulary, messaging habits, and communication style.',
      };

      setChatHistory((prev) => [
        ...prev,
        { role: 'user', message: initialMessage.content },
      ]);

      const response = await window.electron.ipcRenderer.invoke('openai-chat', {
        messages: [initialMessage],
        contactContext: {
          type: 'global_analysis',
          databaseStats,
          messageAnalysis,
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
      setIsAILoading(false);
    }
  };

  return (
    <div className="py-0 max-w-full mx-auto bg-slate-50 min-h-screen">
      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${showSidebar ? 'lg:mr-96' : ''}`}
      >
        <div className="px-6">
          {/* Header */}
          <div className="mt-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                  Contacts Dashboard
                </h1>
                <p className="text-lg text-gray-600 mt-1">
                  Search and filter your {contacts.length} contacts
                </p>
              </div>

              {/* AI Toggle Button */}
              <button
                type="button"
                onClick={() => setShowSidebar(!showSidebar)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200 hover:scale-105 shadow-lg flex items-center gap-2"
              >
                <span className="text-lg">🤖</span>
                <span className="hidden sm:inline">AI Analysis</span>
                <span className="text-sm opacity-80">
                  {showSidebar ? '→' : '←'}
                </span>
              </button>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
            {/* Search Bar and Primary Controls */}
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
              {/* Search Bar */}
              <div className="flex-1">
                <div className="relative">
                  <svg
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21L15.803 15.803M15.803 15.803A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-500 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Sort and Filter Controls */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSortBy(sortBy === 'activity' ? 'name' : 'activity')
                  }
                  className="flex-1 lg:flex-initial px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-900 hover:bg-white hover:border-blue-500 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 cursor-pointer min-w-[140px] font-medium"
                >
                  <span className="text-sm text-gray-500">Sort by</span>
                  <span className="ml-2 text-gray-900">
                    {sortBy === 'activity' ? 'Activity' : 'Name'}
                  </span>
                </button>

                {/* Filter Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 py-3 border-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
                    showFilters || activeFiltersCount > 0
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-label={`Filters${activeFiltersCount > 0 ? ` (${activeFiltersCount} active)` : ''}`}
                  title={`Filters${activeFiltersCount > 0 ? ` (${activeFiltersCount} active)` : ''}`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                    />
                  </svg>
                  {activeFiltersCount > 0 && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full -ml-1">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Expandable Filter Panel */}
            {showFilters && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div
                  className={`grid gap-4 ${
                    showSidebar
                      ? 'grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3'
                      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                  }`}
                >
                  {/* Activity Level Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Activity Level
                    </label>
                    <select
                      value={filterBy}
                      onChange={(e) => setFilterBy(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    >
                      <option value="all">All Levels</option>
                      <option value="high">High (500+ messages)</option>
                      <option value="medium">Medium (100-500)</option>
                      <option value="low">Low (&lt;100)</option>
                    </select>
                  </div>

                  {/* Organization Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization
                    </label>
                    <select
                      value={organizationFilter}
                      onChange={(e) => setOrganizationFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    >
                      <option value="all">All Organizations</option>
                      {organizations.map((org) => (
                        <option key={org} value={org}>
                          {org}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Range Filter */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Message Sent
                      <span className="ml-2 text-xs text-gray-500">
                        ({formatDate(dateRange[0])} - {formatDate(dateRange[1])}
                        )
                      </span>
                    </label>
                    <div className="px-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-500 w-12 text-left">
                          {formatDate(minDate).split(',')[0]}
                        </span>
                        <div className="flex-1 relative">
                          {/* Custom date range slider container */}
                          <div
                            className="relative h-8 flex items-center cursor-pointer"
                            onMouseDown={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              const percentage = x / rect.width;
                              const totalDays =
                                (maxDate.getTime() - minDate.getTime()) /
                                (1000 * 60 * 60 * 24);
                              const targetDays = percentage * totalDays;
                              const targetDate = new Date(
                                minDate.getTime() +
                                  targetDays * 24 * 60 * 60 * 1000,
                              );

                              // Determine which handle is closer
                              const distToMin = Math.abs(
                                targetDate.getTime() - dateRange[0].getTime(),
                              );
                              const distToMax = Math.abs(
                                targetDate.getTime() - dateRange[1].getTime(),
                              );

                              if (distToMin < distToMax) {
                                // Move min handle
                                if (targetDate <= dateRange[1]) {
                                  setDateRange([targetDate, dateRange[1]]);
                                  setDraggingDateHandle('min');
                                }
                              } else {
                                // Move max handle
                                if (targetDate >= dateRange[0]) {
                                  setDateRange([dateRange[0], targetDate]);
                                  setDraggingDateHandle('max');
                                }
                              }
                            }}
                          >
                            {/* Track */}
                            <div className="absolute w-full h-2 bg-gray-200 rounded-full pointer-events-none" />

                            {/* Active track */}
                            <div
                              className="absolute h-2 bg-blue-500 rounded-full pointer-events-none"
                              style={{
                                left: `${((dateRange[0].getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100}%`,
                                right: `${100 - ((dateRange[1].getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100}%`,
                              }}
                            />

                            {/* Min handle */}
                            <div
                              className="absolute w-5 h-5 bg-blue-600 rounded-full shadow-lg border-2 border-white cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                              style={{
                                left: `${((dateRange[0].getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100}%`,
                                transform: 'translateX(-50%)',
                                zIndex:
                                  draggingDateHandle === 'min'
                                    ? 30
                                    : dateRange[0].getTime() ===
                                        dateRange[1].getTime()
                                      ? 25
                                      : 20,
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setDraggingDateHandle('min');
                              }}
                            />

                            {/* Max handle */}
                            <div
                              className="absolute w-5 h-5 bg-blue-600 rounded-full shadow-lg border-2 border-white cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                              style={{
                                left: `${((dateRange[1].getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * 100}%`,
                                transform: 'translateX(-50%)',
                                zIndex: draggingDateHandle === 'max' ? 30 : 20,
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setDraggingDateHandle('max');
                              }}
                            />
                          </div>

                          {/* Mouse move and up handlers */}
                          {draggingDateHandle && (
                            <div
                              className="fixed inset-0 cursor-grabbing z-50"
                              onMouseMove={(e) => {
                                const sliderEl = e.currentTarget
                                  .previousSibling as HTMLElement;
                                const rect = sliderEl.getBoundingClientRect();
                                const x = Math.max(
                                  0,
                                  Math.min(e.clientX - rect.left, rect.width),
                                );
                                const percentage = x / rect.width;
                                const totalDays =
                                  (maxDate.getTime() - minDate.getTime()) /
                                  (1000 * 60 * 60 * 24);
                                const targetDays = percentage * totalDays;
                                const targetDate = new Date(
                                  minDate.getTime() +
                                    targetDays * 24 * 60 * 60 * 1000,
                                );

                                if (draggingDateHandle === 'min') {
                                  if (targetDate <= dateRange[1]) {
                                    setDateRange([targetDate, dateRange[1]]);
                                  }
                                } else {
                                  if (targetDate >= dateRange[0]) {
                                    setDateRange([dateRange[0], targetDate]);
                                  }
                                }
                              }}
                              onMouseUp={() => setDraggingDateHandle(null)}
                              onMouseLeave={() => setDraggingDateHandle(null)}
                            />
                          )}
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">
                          {formatDate(maxDate).split(',')[0]}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-600 text-center">
                        {dateRange[0].getTime() === minDate.getTime() &&
                        dateRange[1].getTime() === maxDate.getTime() ? (
                          <span>Showing entire date range</span>
                        ) : (
                          <span>
                            Showing contacts where last message was sent between{' '}
                            {formatDate(dateRange[0])} and{' '}
                            {formatDate(dateRange[1])}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Communication Frequency Slider */}
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Communication Frequency
                      <span className="ml-2 text-xs text-gray-500">
                        ({getFrequencyLabel(frequencyRange[0])} -{' '}
                        {getFrequencyLabel(frequencyRange[1])})
                      </span>
                    </label>
                    <div className="px-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-500 w-12">
                          Rarely
                        </span>
                        <div className="flex-1 relative">
                          {/* Custom range slider container */}
                          <div
                            className="relative h-8 flex items-center cursor-pointer"
                            onMouseDown={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              const percentage = x / rect.width;
                              const value = percentage * maxFrequency;

                              // Determine which handle is closer
                              const distToMin = Math.abs(
                                value - frequencyRange[0],
                              );
                              const distToMax = Math.abs(
                                value - frequencyRange[1],
                              );

                              if (distToMin < distToMax) {
                                // Move min handle
                                if (value <= frequencyRange[1]) {
                                  setFrequencyRange([value, frequencyRange[1]]);
                                  setDraggingHandle('min');
                                }
                              } else {
                                // Move max handle
                                if (value >= frequencyRange[0]) {
                                  setFrequencyRange([frequencyRange[0], value]);
                                  setDraggingHandle('max');
                                }
                              }
                            }}
                          >
                            {/* Track */}
                            <div className="absolute w-full h-2 bg-gray-200 rounded-full pointer-events-none" />

                            {/* Active track */}
                            <div
                              className="absolute h-2 bg-blue-500 rounded-full pointer-events-none"
                              style={{
                                left: `${(frequencyRange[0] / maxFrequency) * 100}%`,
                                right: `${100 - (frequencyRange[1] / maxFrequency) * 100}%`,
                              }}
                            />

                            {/* Min handle */}
                            <div
                              className="absolute w-5 h-5 bg-blue-600 rounded-full shadow-lg border-2 border-white cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                              style={{
                                left: `${(frequencyRange[0] / maxFrequency) * 100}%`,
                                transform: 'translateX(-50%)',
                                zIndex:
                                  draggingHandle === 'min'
                                    ? 30
                                    : frequencyRange[0] === frequencyRange[1]
                                      ? 25
                                      : 20,
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setDraggingHandle('min');
                              }}
                            />

                            {/* Max handle */}
                            <div
                              className="absolute w-5 h-5 bg-blue-600 rounded-full shadow-lg border-2 border-white cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                              style={{
                                left: `${(frequencyRange[1] / maxFrequency) * 100}%`,
                                transform: 'translateX(-50%)',
                                zIndex: draggingHandle === 'max' ? 30 : 20,
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setDraggingHandle('max');
                              }}
                            />
                          </div>

                          {/* Mouse move and up handlers */}
                          {draggingHandle && (
                            <div
                              className="fixed inset-0 cursor-grabbing z-50"
                              onMouseMove={(e) => {
                                const sliderEl = e.currentTarget
                                  .previousSibling as HTMLElement;
                                const rect = sliderEl.getBoundingClientRect();
                                const x = Math.max(
                                  0,
                                  Math.min(e.clientX - rect.left, rect.width),
                                );
                                const percentage = x / rect.width;
                                const value = percentage * maxFrequency;

                                if (draggingHandle === 'min') {
                                  if (value <= frequencyRange[1]) {
                                    setFrequencyRange([
                                      value,
                                      frequencyRange[1],
                                    ]);
                                  }
                                } else {
                                  if (value >= frequencyRange[0]) {
                                    setFrequencyRange([
                                      frequencyRange[0],
                                      value,
                                    ]);
                                  }
                                }
                              }}
                              onMouseUp={() => setDraggingHandle(null)}
                              onMouseLeave={() => setDraggingHandle(null)}
                            />
                          )}

                          {/* Frequency markers */}
                          <div className="flex justify-between mt-1 text-xs text-gray-400">
                            <span>0</span>
                            <span>{maxFrequency.toFixed(1) * 0.2}</span>
                            <span>{maxFrequency.toFixed(1) * 0.4}</span>
                            <span>{maxFrequency.toFixed(1) * 0.6}</span>
                            <span>{maxFrequency.toFixed(1) * 0.8}</span>
                            <span>{maxFrequency.toFixed(1)}</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">
                          Multiple
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-600 text-center">
                        {frequencyRange[0].toFixed(2)} -{' '}
                        {frequencyRange[1].toFixed(2)} messages per day
                      </div>
                    </div>
                  </div>

                  {/* Contact Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Type
                    </label>
                    <select
                      value={contactTypeFilter}
                      onChange={(e) =>
                        setContactTypeFilter(e.target.value as any)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    >
                      <option value="all">All Types</option>
                      <option value="professional">Professional</option>
                      <option value="personal">Personal</option>
                    </select>
                  </div>

                  {/* Last Message Sender Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Message Sent By
                    </label>
                    <select
                      value={lastMessageSenderFilter}
                      onChange={(e) =>
                        setLastMessageSenderFilter(e.target.value as any)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    >
                      <option value="all">Anyone</option>
                      <option value="me">Me</option>
                      <option value="them">Them</option>
                    </select>
                  </div>

                  {/* Photo Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profile Photo
                    </label>
                    <select
                      value={photoFilter}
                      onChange={(e) => setPhotoFilter(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    >
                      <option value="all">All Contacts</option>
                      <option value="with">With Photo</option>
                      <option value="without">Without Photo</option>
                    </select>
                  </div>
                </div>

                {/* Clear Filters Button */}
                {activeFiltersCount > 0 && (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results Info */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <span className="text-gray-700 font-medium">
                Showing {filteredAndSortedContacts.length} of {contacts.length}{' '}
                contacts
              </span>
              {activeFiltersCount > 0 && (
                <span className="text-gray-500 text-sm ml-2">
                  ({activeFiltersCount} filter
                  {activeFiltersCount !== 1 ? 's' : ''} active)
                </span>
              )}
            </div>
          </div>

          {/* Contacts Grid - Adjust columns based on available space */}
          <div
            className={`grid gap-6 mb-8 ${
              showSidebar
                ? 'grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {filteredAndSortedContacts.map((contact) => (
              <ContactCard
                key={contact.contact_name}
                contact={contact}
                onClick={onContactSelect}
              />
            ))}
          </div>

          {/* No Results */}
          {filteredAndSortedContacts.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <div className="text-6xl mb-4 opacity-50">🔍</div>
              <h3 className="text-2xl font-semibold mb-2 text-gray-700">
                No contacts found
              </h3>
              <p className="text-lg mb-4">
                Try adjusting your search or filter criteria
              </p>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Global AI Analysis */}
      {showSidebar && (
        <>
          {/* Mobile/Tablet Overlay Background */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setShowSidebar(false)}
          />

          {/* Sidebar */}
          <div
            className={`
            fixed top-0 right-0 h-screen bg-white shadow-2xl border-l border-gray-200 
            transition-all duration-300 flex flex-col z-50
            w-full sm:w-96 lg:w-96
            ${showSidebar ? 'translate-x-0' : 'translate-x-full'}
          `}
          >
            {/* Sidebar Header */}
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex justify-between items-start mb-4">
                <div className="text-center flex-1">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                    🌐
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Global Database Analysis
                  </h3>
                  <p className="text-sm text-gray-500">
                    AI insights about your entire network
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSidebar(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl ml-4 p-1"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {chatHistory.length === 0 && (
                <div className="text-center text-gray-500 py-8">
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
                    <button
                      type="button"
                      onClick={handleGlobalDatabaseAnalysis}
                      disabled={isAILoading}
                      className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-200 font-medium mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      🔍 Run Comprehensive Analysis
                    </button>
                  </div>
                </div>
              )}

              {chatHistory.map((message, index) => (
                <div
                  key={`${message.role}-${message.message.slice(0, 20)}-${index}`}
                  className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`${
                      message.role === 'user'
                        ? 'max-w-xs px-3 py-2 bg-purple-600 text-white rounded-2xl rounded-br-sm'
                        : 'max-w-sm px-4 py-3 bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <div className="text-sm">{message.message}</div>
                    ) : (
                      <div>{formatAIMessage(message.message)}</div>
                    )}
                  </div>
                </div>
              ))}

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
                  placeholder="Ask about your network..."
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200 transition-all duration-200 disabled:bg-gray-100 disabled:text-gray-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || isLoading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:cursor-not-allowed text-sm"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
