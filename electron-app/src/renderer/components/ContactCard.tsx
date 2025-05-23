import React from 'react';
import { ContactWithSummary } from '../types/contact';

interface ContactCardProps {
  contact: ContactWithSummary;
  onClick: (contact: ContactWithSummary) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onClick,
}) => {
  const getActivityLevel = (messageCount: number): 'active' | 'inactive' => {
    if (messageCount > 0) return 'active';
    return 'inactive';
  };

  const formatMessageFrequency = (frequency: number): string => {
    if (frequency >= 1) return `${frequency.toFixed(1)}/day`;
    const perWeek = frequency * 7;
    if (perWeek >= 1) return `${perWeek.toFixed(1)}/week`;
    const perMonth = frequency * 30;
    return `${perMonth.toFixed(1)}/month`;
  };

  const initials = contact.contact_name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const activityLevel = getActivityLevel(contact.total_messages);

  const activityColors = {
    active: 'border-l-green-500 bg-green-50',
    inactive: 'border-l-gray-500 bg-gray-50',
  };

  const avatarColors = {
    active: 'bg-gradient-to-br from-green-500 to-emerald-600',
    inactive: 'bg-gradient-to-br from-gray-500 to-slate-600',
  };

  const dotColors = {
    active: 'bg-green-500',
    inactive: 'bg-gray-500',
  };

  return (
    <div
      className={`${activityColors[activityLevel]} border-l-4 bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-500 relative overflow-hidden group`}
      onClick={() => onClick(contact)}
    >
      {/* Header */}
      <div className="flex items-center mb-4 relative">
        {contact.photo ? (
          <img
            src={contact.photo}
            alt={contact.contact_name}
            className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-lg mr-3"
          />
        ) : (
          <div
            className={`w-12 h-12 rounded-xl ${avatarColors[activityLevel]} flex items-center justify-center text-white font-bold text-lg shadow-lg mr-3`}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">
            {contact.contact_name}
          </h3>
          {contact.organization && (
            <p className="text-sm text-gray-600 truncate">
              {contact.organization}
            </p>
          )}
        </div>
        <div
          className={`w-3 h-3 rounded-full ${dotColors[activityLevel]} animate-pulse`}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-xl font-bold text-gray-900">
            {contact.total_messages}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            Messages
          </div>
        </div>
        {contact.summary && (
          <>
            <div className="text-center">
              <div className="text-sm font-bold text-gray-900">
                {formatMessageFrequency(
                  contact.summary.message_frequency_per_day,
                )}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Frequency
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {contact.summary.conversation_span_days}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Days
              </div>
            </div>
          </>
        )}
      </div>

      {/* Summary info */}
      {contact.summary && (
        <div className="mt-2 text-xs text-gray-500">
          <div>
            {contact.summary.sent_messages} sent /{' '}
            {contact.summary.received_messages} received
          </div>
          <div>
            {contact.summary.message_frequency_per_day.toFixed(1)} msgs/day
          </div>
          {contact.last_message_info && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-gray-400">Last:</span>
              {contact.last_message_info.last_message_sender === 'me' ? (
                <span className="text-blue-600">You</span>
              ) : (
                <span className="text-green-600">Them</span>
              )}
              <span className="text-gray-400">•</span>
              <span>
                {new Date(
                  contact.last_message_info.last_message_timestamp,
                ).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-gray-100">
        <span className="font-medium">{contact.date_range}</span>
        <span className="bg-gray-100 px-2 py-1 rounded-md text-xs">
          {contact.phone_numbers.length} number
          {contact.phone_numbers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
    </div>
  );
};
