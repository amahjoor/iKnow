import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  CommunicationHours,
  CommunicationTrends,
  ResponseTimePatterns,
  formatResponseTime,
} from '../utils/messageAnalyzer';

interface CommunicationAnalyticsProps {
  hours: CommunicationHours;
  trends: CommunicationTrends;
  responsePatterns: ResponseTimePatterns;
  contactName: string;
}

export const CommunicationAnalytics: React.FC<CommunicationAnalyticsProps> = ({
  hours,
  trends,
  responsePatterns,
  contactName,
}) => {
  // Helper function to get hour label
  const getHourLabel = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  // Prepare data for the chart
  const chartData = hours.hourlyDistribution.map((_, hour) => ({
    hour: getHourLabel(hour),
    hourNumber: hour,
    userMessages: hours.userHourlyDistribution[hour],
    contactMessages: hours.contactHourlyDistribution[hour],
    total: hours.hourlyDistribution[hour],
  }));

  return (
    <div className="space-y-8">
      {/* Communication Hours Line Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          📅 Peak Communication Hours
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          When you and {contactName} typically exchange messages
        </p>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                interval={2}
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip 
                formatter={(value, name) => [
                  value,
                  name === 'userMessages' ? 'You' : contactName
                ]}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="userMessages"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="contactMessages"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Hours Summary */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="text-sm font-medium text-gray-700">Peak hours:</span>
          {hours.peakHours.map(({ hour, count }) => (
            <span
              key={hour}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
            >
              {getHourLabel(hour)} ({count} msgs)
            </span>
          ))}
        </div>
      </div>

      {/* Communication Trends */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          📈 Communication Trends
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Message volume over time, showing who initiates conversations
        </p>

        {/* Monthly Trends */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">Monthly Activity</h4>
          <div className="space-y-2">
            {trends.monthlyData.slice(-6).map((month) => {
              const maxMessages = Math.max(month.userMessages, month.contactMessages);
              const userWidth = maxMessages > 0 ? (month.userMessages / maxMessages) * 100 : 0;
              const contactWidth = maxMessages > 0 ? (month.contactMessages / maxMessages) * 100 : 0;

              return (
                <div key={month.month} className="flex items-center space-x-3">
                  <div className="w-16 text-sm font-medium text-gray-600">
                    {new Date(month.month + '-01').toLocaleDateString('en-US', {
                      month: 'short',
                      year: '2-digit',
                    })}
                  </div>
                  <div className="flex-1 relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-blue-500 opacity-80"
                      style={{ width: `${userWidth}%` }}
                      title={`You: ${month.userMessages} messages`}
                    />
                    <div
                      className="absolute right-0 top-0 h-full bg-green-500 opacity-80"
                      style={{ width: `${contactWidth}%` }}
                      title={`${contactName}: ${month.contactMessages} messages`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                      {month.total} total
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center space-x-4 mt-3 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>You</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>{contactName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Response Time Patterns */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          ⚡ Response Time Patterns
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          How quickly you and {contactName} respond to each other
        </p>

        {/* Average Response Times */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm font-medium text-blue-800 mb-1">Your Average Response</div>
            <div className="text-2xl font-bold text-blue-900">
              {formatResponseTime(responsePatterns.averageResponseTime.user)}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm font-medium text-green-800 mb-1">
              {contactName}'s Average Response
            </div>
            <div className="text-2xl font-bold text-green-900">
              {formatResponseTime(responsePatterns.averageResponseTime.contact)}
            </div>
          </div>
        </div>

        {/* Response Time Distribution */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">Response Speed Distribution</h4>
          <div className="space-y-3">
            {Object.entries(responsePatterns.responseTimeDistribution).map(([category, data]) => {
              const categoryLabels = {
                immediate: 'Immediate (< 5 min)',
                quick: 'Quick (5-30 min)',
                moderate: 'Moderate (30min-2hr)',
                slow: 'Slow (2hr-24hr)',
                delayed: 'Delayed (> 24hr)',
              };

              const total = data.user + data.contact;
              const userPercentage = total > 0 ? (data.user / total) * 100 : 0;
              const contactPercentage = total > 0 ? (data.contact / total) * 100 : 0;

              return (
                <div key={category} className="flex items-center space-x-3">
                  <div className="w-32 text-sm font-medium text-gray-600">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </div>
                  <div className="flex-1 relative h-6 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-blue-500"
                      style={{ width: `${userPercentage}%` }}
                      title={`You: ${data.user} responses`}
                    />
                    <div
                      className="absolute right-0 top-0 h-full bg-green-500"
                      style={{ width: `${contactPercentage}%` }}
                      title={`${contactName}: ${data.contact} responses`}
                    />
                    {total > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                        {total}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Response Time by Hour */}
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3">Response Time by Hour</h4>
          <div className="grid grid-cols-12 gap-1">
            {responsePatterns.responseTimeByHour.map(({ hour, avgUserResponse, avgContactResponse }) => {
              const maxResponse = Math.max(avgUserResponse, avgContactResponse);
              const userHeight = maxResponse > 0 ? (avgUserResponse / maxResponse) * 100 : 0;
              const contactHeight = maxResponse > 0 ? (avgContactResponse / maxResponse) * 100 : 0;

              return (
                <div key={hour} className="flex flex-col items-center space-y-1">
                  <div className="h-20 w-full relative bg-gray-100 rounded-t">
                    {userHeight > 0 && (
                      <div
                        className="absolute bottom-0 left-0 w-1/2 bg-blue-500 rounded-tl"
                        style={{ height: `${userHeight}%` }}
                        title={`You: ${formatResponseTime(avgUserResponse)}`}
                      />
                    )}
                    {contactHeight > 0 && (
                      <div
                        className="absolute bottom-0 right-0 w-1/2 bg-green-500 rounded-tr"
                        style={{ height: `${contactHeight}%` }}
                        title={`${contactName}: ${formatResponseTime(avgContactResponse)}`}
                      />
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{hour}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}; 