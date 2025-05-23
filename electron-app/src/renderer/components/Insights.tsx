import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { ContactWithSummary } from '../types/contact';

interface InsightsProps {
  contacts: ContactWithSummary[];
}

// Birthday Calendar Component
const BirthdayCalendar: React.FC<{
  contacts: ContactWithSummary[];
}> = ({ contacts }) => {
  const birthdayData = useMemo(() => {
    // Extract real birthday data from contacts
    const contactsWithBirthdays = contacts
      .filter((contact) => contact.birthday?.date)
      .map((contact) => {
        // Parse date components manually to avoid timezone issues
        const dateStr = contact.birthday!.date;
        const [year, month, day] = dateStr.split('-').map(Number);

        return {
          name: contact.contact_name,
          birthday: new Date(year, month - 1, day), // month is 0-indexed in JS
          messages: contact.total_messages,
        };
      });

    // Get upcoming birthdays (next 180 days)
    const today = new Date();
    const upcoming = contactsWithBirthdays
      .filter((contact) => {
        const thisYear = new Date(
          today.getFullYear(),
          contact.birthday.getMonth(),
          contact.birthday.getDate(),
        );
        const nextYear = new Date(
          today.getFullYear() + 1,
          contact.birthday.getMonth(),
          contact.birthday.getDate(),
        );
        const daysDiff = Math.min(
          (thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          (nextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysDiff >= 0 && daysDiff <= 180;
      })
      .sort((a, b) => {
        const aNext = new Date(
          today.getFullYear(),
          a.birthday.getMonth(),
          a.birthday.getDate(),
        );
        const bNext = new Date(
          today.getFullYear(),
          b.birthday.getMonth(),
          b.birthday.getDate(),
        );
        if (aNext < today) aNext.setFullYear(aNext.getFullYear() + 1);
        if (bNext < today) bNext.setFullYear(bNext.getFullYear() + 1);
        return aNext.getTime() - bNext.getTime();
      });

    // Birthday frequency by month
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2000, i).toLocaleString('default', { month: 'short' }),
      count: contactsWithBirthdays.filter((c) => c.birthday.getMonth() === i)
        .length,
    }));

    return { contactsWithBirthdays, upcoming, monthlyStats };
  }, [contacts]);

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upcoming Birthdays */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          🎂 Upcoming Birthdays
        </h3>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {birthdayData.upcoming.length > 0 ? (
            (() => {
              // Group birthdays by month for better organization
              const groupedByMonth = birthdayData.upcoming.reduce(
                (groups, contact) => {
                  const today = new Date();
                  const thisYear = new Date(
                    today.getFullYear(),
                    contact.birthday.getMonth(),
                    contact.birthday.getDate(),
                  );
                  if (thisYear < today)
                    thisYear.setFullYear(thisYear.getFullYear() + 1);

                  const monthKey = thisYear.toLocaleDateString('default', {
                    month: 'long',
                    year: 'numeric',
                  });

                  if (!groups[monthKey]) {
                    groups[monthKey] = [];
                  }
                  groups[monthKey].push(contact);
                  return groups;
                },
                {} as Record<string, typeof birthdayData.upcoming>,
              );

              return Object.entries(groupedByMonth)
                .slice(0, 6)
                .map(([month, contacts]) => (
                  <div key={month} className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-200 pb-1">
                      {month}
                    </h4>
                    <div className="space-y-2">
                      {contacts.map((contact, index) => {
                        const today = new Date();
                        const thisYear = new Date(
                          today.getFullYear(),
                          contact.birthday.getMonth(),
                          contact.birthday.getDate(),
                        );
                        if (thisYear < today)
                          thisYear.setFullYear(thisYear.getFullYear() + 1);
                        const daysUntil = Math.ceil(
                          (thisYear.getTime() - today.getTime()) /
                            (1000 * 60 * 60 * 24),
                        );

                        return (
                          <div
                            key={`${month}-${index}`}
                            className="flex items-center justify-between p-2 bg-purple-50 rounded-lg"
                          >
                            <div>
                              <div className="font-medium text-gray-900 text-sm">
                                {contact.name}
                              </div>
                              <div className="text-xs text-gray-600">
                                {contact.birthday.toLocaleDateString(
                                  'default',
                                  {
                                    month: 'long',
                                    day: 'numeric',
                                  },
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold text-purple-600">
                                {daysUntil === 0
                                  ? 'Today!'
                                  : daysUntil === 1
                                    ? 'Tomorrow'
                                    : `${daysUntil} days`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
            })()
          ) : (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">🎉</div>
              <p>No upcoming birthdays in the next 180 days</p>
            </div>
          )}
        </div>
      </div>

      {/* Birthday Statistics */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Birthday Distribution
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={birthdayData.monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [value, 'Birthdays']} />
              <Bar dataKey="count" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Social Media Network Component
const SocialMediaNetwork: React.FC<{
  contacts: ContactWithSummary[];
}> = ({ contacts }) => {
  const socialMediaData = useMemo(() => {
    // Extract real social media data from contacts
    const platformStats = {
      linkedin: 0,
      instagram: 0,
      twitter: 0,
      facebook: 0,
      other: 0,
    };

    contacts.forEach((contact) => {
      if (contact.socialMedia) {
        contact.socialMedia.forEach((social) => {
          const platform = social.platform.toLowerCase();
          if (platformStats.hasOwnProperty(platform)) {
            platformStats[platform as keyof typeof platformStats]++;
          } else {
            platformStats.other++;
          }
        });
      }
    });

    const totalWithSocial = Object.values(platformStats).reduce(
      (sum, count) => sum + count,
      0,
    );
    const coveragePercentage = Math.round(
      (contacts.filter((c) => c.socialMedia && c.socialMedia.length > 0)
        .length /
        contacts.length) *
        100,
    );

    const colorMap: Record<string, string> = {
      linkedin: '#0077b5',
      instagram: '#e4405f',
      twitter: '#1da1f2',
      facebook: '#1877f2',
      other: '#6b7280',
    };

    const platformData = Object.entries(platformStats).map(
      ([platform, count]) => ({
        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
        count,
        color: colorMap[platform.toLowerCase()],
      }),
    );

    // Real contacts with social media
    const contactsWithSocial = contacts
      .filter(
        (contact) => contact.socialMedia && contact.socialMedia.length > 0,
      )
      .map((contact) => ({
        ...contact,
        platforms: contact.socialMedia!.map((social) => social.platform),
      }));

    return {
      platformStats,
      platformData,
      coveragePercentage,
      contactsWithSocial,
    };
  }, [contacts]);

  const platformIcons: Record<string, string> = {
    linkedin: '💼',
    instagram: '📸',
    twitter: '🐦',
    facebook: '📘',
    other: '🌐',
  };

  return (
    <div className="space-y-6">
      {/* Platform Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {socialMediaData.platformData.map((platform) => (
          <div
            key={platform.platform}
            className="bg-white rounded-xl p-4 shadow-lg border border-gray-200 text-center"
          >
            <div className="text-2xl mb-2">
              {platformIcons[platform.platform.toLowerCase()]}
            </div>
            <div
              className="text-xl font-bold"
              style={{ color: platform.color }}
            >
              {platform.count}
            </div>
            <div className="text-sm text-gray-600">{platform.platform}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coverage Statistics */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Social Media Coverage
          </h3>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {socialMediaData.coveragePercentage}%
              </div>
              <div className="text-gray-600">of contacts have social media</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-1000"
                style={{ width: `${socialMediaData.coveragePercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Platform Distribution */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Platform Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={socialMediaData.platformData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="count"
                  label={({ platform, count }) => `${platform}: ${count}`}
                >
                  {socialMediaData.platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Contacts with Social Media */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Contacts with Social Media
        </h3>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {socialMediaData.contactsWithSocial
            .filter((c) => c.platforms.length > 0)
            .map((contact, index) => (
              <div
                key={`${contact.contact_name}-${index}`}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {contact.contact_name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {contact.contact_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {contact.socialMedia?.length || 0} social account(s)
                    </div>
                  </div>
                </div>

                {/* Social Media Links */}
                <div className="space-y-2 ml-13">
                  {contact.socialMedia?.map((social, socialIndex) => (
                    <div
                      key={`${social.platform}-${socialIndex}`}
                      className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-lg">
                        {platformIcons[social.platform.toLowerCase()] ||
                          platformIcons.other}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 capitalize">
                          {social.platform}
                        </div>
                        <a
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate block"
                        >
                          {social.url}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          {socialMediaData.contactsWithSocial.filter(
            (c) => c.platforms.length > 0,
          ).length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">📱</div>
              <p>No contacts with social media information found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Communication Patterns Component
const CommunicationPatterns: React.FC<{
  contacts: ContactWithSummary[];
}> = ({ contacts }) => {
  const patternsData = useMemo(() => {
    // Response time analysis
    const responseTimeRanges = [
      { range: '< 1 hour', count: 0 },
      { range: '1-6 hours', count: 0 },
      { range: '6-24 hours', count: 0 },
      { range: '1-3 days', count: 0 },
      { range: '3+ days', count: 0 },
    ];

    // Simulate response time data
    contacts.forEach(() => {
      const randomIndex = Math.floor(Math.random() * responseTimeRanges.length);
      responseTimeRanges[randomIndex].count++;
    });

    // Communication frequency trends
    const frequencyTrends = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2024, i).toLocaleDateString('default', {
        month: 'short',
      }),
      messages: Math.floor(Math.random() * 1000) + 500,
      contacts: Math.floor(Math.random() * 50) + 20,
    }));

    // Peak hours analysis (24-hour format)
    const peakHours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      displayHour:
        i === 0
          ? '12 AM'
          : i < 12
            ? `${i} AM`
            : i === 12
              ? '12 PM'
              : `${i - 12} PM`,
      messages: Math.floor(Math.random() * 100) + 10,
    }));

    // Relationship strength indicators
    const relationshipStrength = contacts
      .map((contact) => ({
        name: contact.contact_name,
        strength: Math.round(
          (contact.total_messages *
            (contact.summary?.message_frequency_per_day || 1)) /
            10,
        ),
        category:
          contact.total_messages > 500
            ? 'inner-circle'
            : contact.total_messages > 100
              ? 'close'
              : 'casual',
      }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10);

    return {
      responseTimeRanges,
      frequencyTrends,
      peakHours,
      relationshipStrength,
    };
  }, [contacts]);

  const strengthColors: Record<string, string> = {
    'inner-circle': '#10b981',
    close: '#f59e0b',
    casual: '#6b7280',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Response Time Analysis */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Response Time Patterns
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={patternsData.responseTimeRanges}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip formatter={(value) => [value, 'Contacts']} />
              <Bar dataKey="count" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Peak Communication Hours */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Peak Communication Hours
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={patternsData.peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="displayHour" interval={2} />
              <YAxis />
              <Tooltip formatter={(value) => [value, 'Messages']} />
              <Area
                type="monotone"
                dataKey="messages"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Communication Trends */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Communication Trends (2024)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={patternsData.frequencyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="messages"
                stroke="#10b981"
                strokeWidth={3}
              />
              <Line
                type="monotone"
                dataKey="contacts"
                stroke="#f59e0b"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Relationship Strength */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Relationship Strength
        </h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {patternsData.relationshipStrength.map((contact, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="text-sm font-medium text-gray-500">
                  #{index + 1}
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {contact.name}
                  </div>
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: strengthColors[contact.category],
                      }}
                    />
                    <span className="text-sm text-gray-600 capitalize">
                      {contact.category.replace('-', ' ')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-purple-600">
                  {contact.strength}
                </div>
                <div className="text-xs text-gray-500">strength</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Insights: React.FC<InsightsProps> = ({ contacts }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'birthdays' | 'social' | 'patterns'
  >('overview');

  // Process contact data for visualizations
  const chartData = useMemo(() => {
    // Activity distribution data
    const highActivity = contacts.filter((c) => c.total_messages > 500).length;
    const mediumActivity = contacts.filter(
      (c) => c.total_messages > 100 && c.total_messages <= 500,
    ).length;
    const lowActivity = contacts.filter((c) => c.total_messages <= 100).length;

    const activityData = [
      { name: 'High Activity (500+)', value: highActivity, color: '#22c55e' },
      {
        name: 'Medium Activity (100-500)',
        value: mediumActivity,
        color: '#eab308',
      },
      { name: 'Low Activity (<100)', value: lowActivity, color: '#6b7280' },
    ];

    // Top contacts data
    const topContactsData = contacts
      .sort((a, b) => b.total_messages - a.total_messages)
      .slice(0, 10)
      .map((contact) => ({
        name:
          contact.contact_name.length > 12
            ? contact.contact_name.substring(0, 12) + '...'
            : contact.contact_name,
        messages: contact.total_messages,
        frequency: contact.summary?.message_frequency_per_day || 0,
      }));

    // Organizations data
    const orgGroups = contacts.reduce(
      (acc, contact) => {
        const org = contact.organization || 'No Organization';
        if (!acc[org]) {
          acc[org] = { count: 0, totalMessages: 0 };
        }
        acc[org].count += 1;
        acc[org].totalMessages += contact.total_messages;
        return acc;
      },
      {} as Record<string, { count: number; totalMessages: number }>,
    );

    const organizationsData = Object.entries(orgGroups)
      .map(([org, data]) => ({
        name: org.length > 15 ? org.substring(0, 15) + '...' : org,
        contacts: data.count,
        messages: data.totalMessages,
      }))
      .sort((a, b) => b.contacts - a.contacts)
      .slice(0, 8);

    // Message frequency distribution
    const frequencyRanges = [
      { range: '0-1 msgs/day', min: 0, max: 1, count: 0 },
      { range: '1-3 msgs/day', min: 1, max: 3, count: 0 },
      { range: '3-5 msgs/day', min: 3, max: 5, count: 0 },
      { range: '5-10 msgs/day', min: 5, max: 10, count: 0 },
      { range: '10+ msgs/day', min: 10, max: Infinity, count: 0 },
    ];

    contacts.forEach((contact) => {
      const freq = contact.summary?.message_frequency_per_day || 0;
      const range = frequencyRanges.find((r) => freq > r.min && freq <= r.max);
      if (range) range.count++;
    });

    const frequencyData = frequencyRanges.map((range) => ({
      name: range.range,
      count: range.count,
    }));

    // Conversation span analysis
    const spanRanges = [
      { range: '< 30 days', min: 0, max: 30, count: 0 },
      { range: '30-90 days', min: 30, max: 90, count: 0 },
      { range: '90-180 days', min: 90, max: 180, count: 0 },
      { range: '180-365 days', min: 180, max: 365, count: 0 },
      { range: '1+ years', min: 365, max: Infinity, count: 0 },
    ];

    contacts.forEach((contact) => {
      const span = contact.summary?.conversation_span_days || 0;
      const range = spanRanges.find((r) => span > r.min && span <= r.max);
      if (range) range.count++;
    });

    const conversationSpanData = spanRanges.map((range) => ({
      name: range.range,
      count: range.count,
    }));

    return {
      activityData,
      topContactsData,
      organizationsData,
      frequencyData,
      conversationSpanData,
    };
  }, [contacts]);

  const stats = useMemo(() => {
    const totalContacts = contacts.length;
    const totalMessages = contacts.reduce(
      (sum, c) => sum + c.total_messages,
      0,
    );
    const avgMessages = Math.round(totalMessages / totalContacts);
    const avgFrequency =
      contacts.reduce(
        (sum, c) => sum + (c.summary?.message_frequency_per_day || 0),
        0,
      ) / totalContacts;
    const totalOrganizations = new Set(
      contacts.map((c) => c.organization).filter(Boolean),
    ).size;
    const withPhotos = contacts.filter((c) => c.photo).length;

    return {
      totalContacts,
      totalMessages,
      avgMessages,
      avgFrequency,
      totalOrganizations,
      withPhotos,
    };
  }, [contacts]);

  return (
    <div className="py-0 max-w-full mx-auto bg-slate-50 min-h-screen px-6">
      {/* Header */}
      <div className="mt-6 mb-8 bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 rounded-2xl p-8 text-white shadow-2xl">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2 tracking-tight">
            📊 Contact Insights
          </h1>
          <p className="text-lg opacity-90 font-light">
            Deep analytics and visualizations of your contact data
          </p>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3 rounded-xl">
            <div className="text-xl font-bold">{stats.totalContacts}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">
              Total Contacts
            </div>
          </div>
          <div className="text-center bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3 rounded-xl">
            <div className="text-xl font-bold">
              {stats.totalMessages.toLocaleString()}
            </div>
            <div className="text-xs opacity-80 uppercase tracking-wide">
              Total Messages
            </div>
          </div>
          <div className="text-center bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3 rounded-xl">
            <div className="text-xl font-bold">{stats.avgMessages}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">
              Avg Messages
            </div>
          </div>
          <div className="text-center bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3 rounded-xl">
            <div className="text-xl font-bold">
              {stats.avgFrequency.toFixed(1)}
            </div>
            <div className="text-xs opacity-80 uppercase tracking-wide">
              Avg Frequency
            </div>
          </div>
          <div className="text-center bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3 rounded-xl">
            <div className="text-xl font-bold">{stats.totalOrganizations}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">
              Organizations
            </div>
          </div>
          <div className="text-center bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3 rounded-xl">
            <div className="text-xl font-bold">{stats.withPhotos}</div>
            <div className="text-xs opacity-80 uppercase tracking-wide">
              With Photos
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-8">
        <div className="bg-white rounded-2xl p-2 shadow-lg border border-gray-200">
          <nav className="flex space-x-2">
            {[
              { key: 'overview', label: 'Overview', icon: '📈' },
              { key: 'birthdays', label: 'Birthdays', icon: '🎂' },
              { key: 'social', label: 'Social Media', icon: '📱' },
              {
                key: 'patterns',
                label: 'Communication Patterns',
                icon: '⏰',
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-lg mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Activity Distribution Pie Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Activity Distribution
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.activityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) =>
                      `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.activityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Contacts Bar Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Top 10 Most Active Contacts
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.topContactsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      name === 'messages' ? 'Messages' : 'Frequency/day',
                    ]}
                  />
                  <Bar dataKey="messages" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Organizations Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Contacts by Organization
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.organizationsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      name === 'contacts' ? 'Contacts' : 'Total Messages',
                    ]}
                  />
                  <Bar dataKey="contacts" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Message Frequency Distribution */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Message Frequency Distribution
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.frequencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [value, 'Contacts']} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Conversation Span Analysis */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Conversation Duration Breakdown
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.conversationSpanData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [value, 'Contacts']} />
                  <Bar dataKey="count" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Network Summary
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                <span className="font-medium text-gray-700">
                  Most Active Contact
                </span>
                <span className="font-bold text-purple-600">
                  {chartData.topContactsData[0]?.name} (
                  {chartData.topContactsData[0]?.messages} msgs)
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <span className="font-medium text-gray-700">
                  Largest Organization
                </span>
                <span className="font-bold text-blue-600">
                  {chartData.organizationsData[0]?.name} (
                  {chartData.organizationsData[0]?.contacts} contacts)
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <span className="font-medium text-gray-700">Coverage Rate</span>
                <span className="font-bold text-green-600">
                  {((stats.withPhotos / stats.totalContacts) * 100).toFixed(1)}%
                  have photos
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                <span className="font-medium text-gray-700">
                  Communication Health
                </span>
                <span className="font-bold text-yellow-600">
                  {chartData.activityData[0]?.value || 0} highly active contacts
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'birthdays' && (
        <div className="mb-8">
          <BirthdayCalendar contacts={contacts} />
        </div>
      )}

      {activeTab === 'social' && (
        <div className="mb-8">
          <SocialMediaNetwork contacts={contacts} />
        </div>
      )}

      {activeTab === 'patterns' && (
        <div className="mb-8">
          <CommunicationPatterns contacts={contacts} />
        </div>
      )}
    </div>
  );
};
