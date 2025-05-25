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
              <XAxis dataKey="hour" interval={2} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === 'userMessages' ? 'You' : contactName,
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
          {hours.peakHours.overall.map((hour) => (
            <span
              key={hour}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
            >
              {getHourLabel(hour)}
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

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends.monthlyData.slice(-12)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickFormatter={(value) => {
                  const date = new Date(value + '-01');
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    year: '2-digit',
                  });
                }}
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === 'userMessages' ? 'You' : contactName,
                ]}
                labelFormatter={(label) => {
                  const date = new Date(label + '-01');
                  return date.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  });
                }}
              />
              <Line
                type="monotone"
                dataKey="userMessages"
                stroke="#10b981"
                strokeWidth={3}
              />
              <Line
                type="monotone"
                dataKey="contactMessages"
                stroke="#f59e0b"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Response Time Patterns - Now Read Receipt Analytics */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          📖 Message Read Patterns
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          How quickly messages are read based on when they're sent
        </p>

        {/* Read Time by Send Hour Chart */}
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">
            Read Time by Send Hour
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={responsePatterns.readTimeByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                <YAxis
                  tickFormatter={(minutes) => {
                    if (minutes >= 60) {
                      return `${Math.round(minutes / 60)}h`;
                    }
                    return `${Math.round(minutes)}m`;
                  }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (value >= 60) {
                      const readHours = Math.floor(value / 60);
                      const mins = Math.round(value % 60);
                      const label =
                        name === 'userAverageReadTime'
                          ? `${contactName} reads your messages`
                          : `You read ${contactName}'s messages`;
                      return [`${readHours}h ${mins}m`, label];
                    }
                    const label =
                      name === 'userAverageReadTime'
                        ? `${contactName} reads your messages`
                        : `You read ${contactName}'s messages`;
                    return [`${Math.round(value)}m`, label];
                  }}
                  labelFormatter={(hour) => `Messages sent at ${hour}:00`}
                />
                <Line
                  type="monotone"
                  dataKey="userAverageReadTime"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  name="userAverageReadTime"
                />
                <Line
                  type="monotone"
                  dataKey="contactAverageReadTime"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="contactAverageReadTime"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span className="text-sm text-gray-600">
                How long {contactName} takes to read your messages
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm text-gray-600">
                How long you take to read {contactName}&apos;s messages
              </span>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {formatResponseTime(responsePatterns.userAvgResponseTime)}
              </div>
              <div className="text-sm text-gray-600">
                Your avg response time
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {formatResponseTime(responsePatterns.contactAvgResponseTime)}
              </div>
              <div className="text-sm text-gray-600">
                {contactName}&apos;s avg response time
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
