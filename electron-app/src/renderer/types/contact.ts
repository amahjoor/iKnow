export interface Contact {
  contact_name: string;
  file_path: string;
  phone_numbers: string[];
  total_messages: number;
  date_range: string;
  most_active_number: string;
  organization?: string;
  emails?: string[];
}

export interface ContactMetadata {
  total_conversations: number;
  generated_at: string;
  format: string;
  min_message_count: number;
  overall_stats: {
    total_messages_all_conversations: number;
    total_sent_messages: number;
    total_received_messages: number;
    average_messages_per_conversation: number;
    most_active_contacts: Array<{
      name: string;
      message_count: number;
    }>;
  };
}

export interface ContactsData {
  metadata: ContactMetadata;
  conversations: Contact[];
}

export interface ConversationSummary {
  contact_name: string;
  conversation_metadata: {
    total_messages: number;
    sent_messages: number;
    received_messages: number;
    date_range: string;
    conversation_span_days: number;
    message_frequency_per_day: number;
    most_active_number: string;
    phone_number_usage: Record<string, number | undefined>;
  };
  file_path: string;
}

export interface ConversationSummariesData {
  metadata: {
    total_conversations: number;
    generated_at: string;
    format: string;
  };
  summaries: ConversationSummary[];
}

export interface GroupChatSummary {
  group_name: string;
  file_path: string;
  participants: string[];
  total_messages: number;
}

export interface ContactWithSummary {
  contact_name: string;
  phone_numbers: string[];
  emails?: string[];
  organization?: string;
  photo?: string;
  birthday?: {
    date: string;
    original: string;
  };
  professionalInfo?: {
    title?: string;
    role?: string;
  };
  socialMedia?: Array<{
    platform: string;
    url: string;
  }>;
  total_messages: number;
  date_range: string;
  // Summary fields from the _summary directory
  summary?: ConversationSummary['conversation_metadata'];
  // Last message information
  last_message_info?: {
    last_message_date: string;
    last_message_sender: 'me' | 'contact' | 'unknown';
    last_message_preview: string;
    last_message_date_formatted: string;
    last_message_timestamp: string;
  };
  // Group chat participation
  group_chats?: GroupChatSummary[];
}

// Types for parsed chat messages
export interface ParsedMessage {
  timestamp: Date;
  sender: 'me' | 'contact';
  content: string;
  type?: 'text' | 'media' | 'system';
  readReceipt?: {
    readBy: 'them' | 'you';
    readTimeText: string;
  };
}

export interface ChatData {
  messages: ParsedMessage[];
  totalCount: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// New types for conversation data
export interface Message {
  timestamp: string;
  sender: 'me' | 'contact' | 'unknown';
  content: string;
}

export interface ConversationData {
  contact: {
    name: string;
    phone_numbers: string[];
  };
  conversation_metadata: {
    total_messages: number;
    sent_messages: number;
    received_messages: number;
    date_range: string;
    conversation_span_days: number;
    message_frequency_per_day: number;
    most_active_number: string;
    phone_number_usage: Record<string, number>;
  };
  messages: Message[];
}

// New types for group chat data
export interface GroupChatParticipant {
  phone_number?: string;
  email?: string;
  activity_count: number;
}

export interface GroupChatInsights {
  total_messages: number;
  sent_messages: number;
  received_messages: number;
  date_range: string;
  conversation_span_days: number;
  message_frequency_per_day: number;
  most_active_participant: string;
}

export interface GroupChat {
  group_name: string;
  file_name: string;
  type: 'group_chat';
  participants: {
    phone_numbers: string[];
    count: number;
    activity: Record<string, number>;
  };
  conversation_insights: GroupChatInsights;
  message_history: Array<{
    filename: string;
    path: string;
    type: string;
  }>;
  metadata: {
    generated_at: string;
    format: string;
  };
}

export interface GroupChatsData {
  metadata: {
    total_group_chats: number;
    generated_at: string;
    format: string;
  };
  group_chats: GroupChatSummary[];
}
