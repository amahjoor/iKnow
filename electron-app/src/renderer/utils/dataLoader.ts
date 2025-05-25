import {
  ContactsData,
  ConversationSummariesData,
  ContactWithSummary,
  ConversationData,
  ParsedMessage,
  ChatData,
} from '../types/contact';

export const loadContactsData = async (): Promise<ContactsData | null> => {
  try {
    const response =
      await window.electron.ipcRenderer.invoke('load-contacts-from-originals');
    if (response.success) {
      return response.data as ContactsData;
    }
    console.error('Failed to load contacts data:', response.error);
    return null;
  } catch (error) {
    console.error('Error loading contacts data:', error);
    return null;
  }
};

export const loadConversationSummaries =
  async (): Promise<ConversationSummariesData | null> => {
    try {
      const response = await window.electron.ipcRenderer.invoke(
        'load-conversation-summaries',
      );
      if (response.success) {
        return response.data as ConversationSummariesData;
      }
      console.error('Failed to load conversation summaries:', response.error);
      return null;
    } catch (error) {
      console.error('Error loading conversation summaries:', error);
      return null;
    }
  };

export const loadContactPhoto = async (
  contactName: string,
): Promise<string | null> => {
  try {
    const response = await window.electron.ipcRenderer.invoke(
      'load-contact-photo',
      contactName,
    );

    if (response.success) {
      return response.data as string;
    }

    // Photo not found is normal, don't log as error
    return null;
  } catch (error) {
    console.error(`Error loading photo for ${contactName}:`, error);
    return null;
  }
};

// Load detailed contact information from contact.json
export const loadContactDetails = async (
  contactName: string,
): Promise<any | null> => {
  try {
    const response = await window.electron.ipcRenderer.invoke(
      'load-contact-details',
      contactName,
    );

    if (response.success) {
      return response.data;
    }

    // Contact details not found is normal for some contacts
    return null;
  } catch (error) {
    console.error(`Error loading contact details for ${contactName}:`, error);
    return null;
  }
};

// Load chat messages from messages.txt files
export const loadChatMessages = async (
  contactName: string,
): Promise<string | null> => {
  try {
    const response = await window.electron.ipcRenderer.invoke(
      'load-chat-messages',
      contactName,
    );

    if (response.success) {
      return response.data;
    }

    // Messages file not found is normal for some contacts
    return null;
  } catch (error) {
    console.error(`Error loading chat messages for ${contactName}:`, error);
    return null;
  }
};

export const combineContactData = async (): Promise<ContactWithSummary[]> => {
  const contactsData = await loadContactsData();
  const summariesData = await loadConversationSummaries();

  if (!contactsData || !summariesData) {
    console.error('Failed to load required data files');
    return [];
  }

  // Create a map of summaries by file path for matching (since names are anonymized in summaries)
  const summariesMap = new Map(
    summariesData.summaries.map((summary) => {
      // Extract contact name from file path (e.g., "Charles/conversation_llm.json" -> "Charles")
      const contactNameFromPath = summary.file_path.split('/')[0];
      return [contactNameFromPath, summary.conversation_metadata];
    }),
  );

  // Combine contact data with summaries, photos, and detailed contact info
  const combinedContacts = await Promise.all(
    contactsData.conversations.map(async (contact) => {
      const [photo, contactDetails] = await Promise.all([
        loadContactPhoto(contact.contact_name),
        loadContactDetails(contact.contact_name),
      ]);

      // Extract birthday information
      let birthday;
      if (contactDetails?.personal_information?.birthday) {
        birthday = {
          date: contactDetails.personal_information.birthday.date,
          original: contactDetails.personal_information.birthday.original,
        };
      }

      // Extract social media information
      let socialMedia;
      if (contactDetails?.online_presence?.urls) {
        socialMedia = contactDetails.online_presence.urls.map((url: any) => ({
          url: url.url,
          platform: url.platform,
          original: url.original,
        }));
      }

      // Extract detailed email information
      let detailedEmails;
      if (contactDetails?.contact_information?.emails) {
        detailedEmails = contactDetails.contact_information.emails.map(
          (email: any) => ({
            address: email.address,
            mailto_link: email.mailto_link,
            type: email.type,
          }),
        );
      }

      // Extract professional information
      let professionalInfo;
      if (contactDetails?.professional_information) {
        professionalInfo = {
          organization: contactDetails.professional_information.organization,
          title: contactDetails.professional_information.title,
          role: contactDetails.professional_information.role,
        };
      }

      // Extract last message information
      let lastMessageInfo;
      if (contactDetails?.last_message_info) {
        lastMessageInfo = {
          last_message_date: contactDetails.last_message_info.last_message_date,
          last_message_sender:
            contactDetails.last_message_info.last_message_sender,
          last_message_preview:
            contactDetails.last_message_info.last_message_preview,
          last_message_date_formatted:
            contactDetails.last_message_info.last_message_date_formatted,
          last_message_timestamp:
            contactDetails.last_message_info.last_message_timestamp,
        };
      }

      return {
        ...contact,
        summary: summariesMap.get(contact.contact_name),
        photo: photo || undefined,
        birthday,
        socialMedia,
        detailedEmails,
        professionalInfo,
        last_message_info: lastMessageInfo,
      };
    }),
  );

  return combinedContacts;
};

// Load conversation data for a specific contact
export const loadConversationData = async (
  contactName: string,
): Promise<ConversationData | null> => {
  try {
    // Use IPC to load conversation file from data_aggregation folder
    const response = await window.electron.ipcRenderer.invoke(
      'load-conversation-file',
      contactName,
    );

    if (response.success) {
      return response.data as ConversationData;
    }

    console.log(
      `No conversation data available for ${contactName}: ${response.error}`,
    );
    return null;
  } catch (error) {
    console.error(`Error loading conversation data for ${contactName}:`, error);
    return null;
  }
};

// Get recent messages for context (last N messages)
export const getRecentMessages = (
  conversationData: ConversationData,
  count: number = 10,
) => {
  return conversationData.messages.slice(-count);
};

// Get conversation summary for AI context
export const getConversationContext = (
  contact: ContactWithSummary,
  conversationData: ConversationData | null,
) => {
  const context = {
    contactName: contact.contact_name,
    organization: contact.organization,
    phoneNumbers: contact.phone_numbers,
    emails: contact.emails,
    totalMessages: contact.total_messages,
    dateRange: contact.date_range,
    summary: contact.summary,
  };

  if (conversationData) {
    // Include the entire conversation for comprehensive analysis
    const allMessages = conversationData.messages;
    return {
      ...context,
      allMessages, // Full conversation history
      conversationMetadata: conversationData.conversation_metadata,
      hasFullConversation: true,
      messageCount: allMessages.length,
    };
  }

  return {
    ...context,
    hasFullConversation: false,
  };
};

// Get full conversation formatted for AI analysis
export const getFullConversationForAI = (
  conversationData: ConversationData,
): string => {
  const { messages, contact } = conversationData;

  // Format messages in a readable way for the AI
  const formattedMessages = messages
    .map((msg, index) => {
      const timestamp = new Date(msg.timestamp).toLocaleString();
      const sender = msg.sender === 'me' ? 'You' : contact.name;
      return `[${index + 1}] ${timestamp} - ${sender}: ${msg.content}`;
    })
    .join('\n');

  return `FULL CONVERSATION HISTORY (${messages.length} messages):\n\n${formattedMessages}`;
};

export const searchContacts = (
  contacts: ContactWithSummary[],
  query: string,
): ContactWithSummary[] => {
  const lowercaseQuery = query.toLowerCase();
  return contacts.filter(
    (contact) =>
      contact.contact_name.toLowerCase().includes(lowercaseQuery) ||
      (contact.organization &&
        contact.organization.toLowerCase().includes(lowercaseQuery)),
  );
};

export const sortContactsByActivity = (
  contacts: ContactWithSummary[],
): ContactWithSummary[] => {
  return [...contacts].sort((a, b) => b.total_messages - a.total_messages);
};

export const getContactByName = (
  contacts: ContactWithSummary[],
  name: string,
): ContactWithSummary | undefined => {
  return contacts.find((contact) => contact.contact_name === name);
};

// Parse raw messages.txt content into structured ChatData
export const parseMessages = (
  rawMessages: string,
  contactName: string,
): ChatData => {
  const lines = rawMessages.split('\n').filter((line) => line.trim());
  const messages: ParsedMessage[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for date/time pattern (e.g., "Jun 07, 2024  4:46:59 PM")
    const timestampRegex =
      /^[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)/;

    if (timestampRegex.test(line)) {
      // Parse the timestamp
      const timestamp = new Date(line);

      // Check if next line exists and contains sender info
      if (i + 1 < lines.length) {
        const senderLine = lines[i + 1].trim();

        // Skip read receipt lines and other metadata
        if (
          senderLine.includes('(Read by') ||
          senderLine.includes('Tapbacks:') ||
          senderLine.includes('This message responded')
        ) {
          continue;
        }

        // Determine sender - either "Me" or phone number
        const isFromUser = senderLine === 'Me';
        const sender: 'user' | 'contact' = isFromUser ? 'user' : 'contact';

        // Look for message content (could be on the next line or lines after)
        let messageContent = '';
        let contentStartIndex = i + 2;

        // Collect message content until we hit the next timestamp or end of file
        for (let j = contentStartIndex; j < lines.length; j++) {
          const contentLine = lines[j].trim();

          // Stop if we hit another timestamp
          if (timestampRegex.test(contentLine)) {
            break;
          }

          // Skip metadata lines
          if (
            contentLine.includes('(Read by') ||
            contentLine.includes('Tapbacks:') ||
            contentLine.includes('This message responded') ||
            contentLine.includes('Edited') ||
            contentLine.startsWith('/Users/') // File attachments
          ) {
            continue;
          }

          // Add non-empty content
          if (contentLine) {
            if (messageContent) {
              messageContent += '\n' + contentLine;
            } else {
              messageContent = contentLine;
            }
          }
        }

        // Only add if we have actual message content
        if (messageContent) {
          messages.push({
            timestamp,
            sender,
            content: messageContent,
            type: 'text',
          });
        }

        // Skip ahead to avoid reprocessing lines
        i = contentStartIndex;
      }
    }
  }

  // Sort messages by timestamp
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const dateRange =
    messages.length > 0
      ? {
          start: messages[0].timestamp,
          end: messages[messages.length - 1].timestamp,
        }
      : undefined;

  return {
    messages,
    totalCount: messages.length,
    dateRange,
  };
};
