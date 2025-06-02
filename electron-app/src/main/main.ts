/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */

// Load environment variables
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import OpenAI from 'openai';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { imessageService } from './imessage-service';

config();

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// Handle loading conversation files from data_aggregation folder
ipcMain.handle('load-conversation-file', async (event, contactName) => {
  try {
    // Construct path to the conversation file
    const dataAggregationPath = path.join(
      __dirname,
      '../../../data_aggregation/data',
    );
    const contactFolder = path.join(dataAggregationPath, contactName);
    const conversationFile = path.join(contactFolder, 'conversation_llm.json');

    // Check if file exists
    if (!fs.existsSync(conversationFile)) {
      console.log(
        `Conversation file not found for ${contactName}: ${conversationFile}`,
      );
      return { success: false, error: 'File not found' };
    }

    // Read and parse the file
    const fileContent = fs.readFileSync(conversationFile, 'utf8');
    const conversationData = JSON.parse(fileContent);

    return {
      success: true,
      data: conversationData,
    };
  } catch (error) {
    console.error(`Error loading conversation for ${contactName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Handle loading master index from data_aggregation folder
ipcMain.handle('load-master-index', async () => {
  try {
    const masterIndexPath = path.join(
      __dirname,
      '../../../data_aggregation/data/_llm_ready/master_index.json',
    );

    if (!fs.existsSync(masterIndexPath)) {
      throw new Error('Master index file not found');
    }

    const fileContent = fs.readFileSync(masterIndexPath, 'utf8');
    const masterIndexData = JSON.parse(fileContent);

    return {
      success: true,
      data: masterIndexData,
    };
  } catch (error) {
    console.error('Error loading master index:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Handle loading conversation summaries from data_aggregation folder
ipcMain.handle('load-conversation-summaries', async () => {
  try {
    const summariesPath = path.join(
      __dirname,
      '../../../data_aggregation/data/_llm_ready/conversation_summaries.json',
    );

    if (!fs.existsSync(summariesPath)) {
      throw new Error('Conversation summaries file not found');
    }

    const fileContent = fs.readFileSync(summariesPath, 'utf8');
    const summariesData = JSON.parse(fileContent);

    return {
      success: true,
      data: summariesData,
    };
  } catch (error) {
    console.error('Error loading conversation summaries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Handle loading contact photos from data_aggregation folder
ipcMain.handle('load-contact-photo', async (event, contactName) => {
  try {
    const photoPath = path.join(
      __dirname,
      '../../../data_aggregation/data',
      contactName,
      'attachments',
      'photo.jpeg',
    );

    if (!fs.existsSync(photoPath)) {
      return { success: false, error: 'Photo not found' };
    }

    // Read the image file as base64
    const photoData = fs.readFileSync(photoPath);
    const base64Photo = photoData.toString('base64');

    return {
      success: true,
      data: `data:image/jpeg;base64,${base64Photo}`,
    };
  } catch (error) {
    console.error(`Error loading photo for ${contactName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Handle loading contact details from contact.json files
ipcMain.handle('load-contact-details', async (event, contactName) => {
  try {
    const contactPath = path.join(
      __dirname,
      '../../../data_aggregation/data',
      contactName,
      'contact.json',
    );

    if (!fs.existsSync(contactPath)) {
      return { success: false, error: 'Contact details not found' };
    }

    const contactData = fs.readFileSync(contactPath, 'utf8');
    const parsedData = JSON.parse(contactData);

    return {
      success: true,
      data: parsedData,
    };
  } catch (error) {
    console.error(`Error loading contact details for ${contactName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Handle loading chat messages from messages.txt files
ipcMain.handle('load-chat-messages', async (event, contactName) => {
  try {
    // Sanitize contact name to match how folders were created
    // Replace invalid filename characters with underscores (same as contacts_exporter.py)
    const safeContactName = contactName.replace(/[\\/*?:"<>|]/g, '_');

    const contactDir = path.join(
      __dirname,
      '../../../data_aggregation/data',
      safeContactName,
    );

    if (!fs.existsSync(contactDir)) {
      console.log(`Contact directory not found: ${contactDir}`);
      return { success: false, error: 'Contact directory not found' };
    }

    const files = fs.readdirSync(contactDir);
    console.log(
      `Looking for message files in ${contactDir}, found files:`,
      files,
    );

    // Look for the consolidated message file (standard since we no longer create individual files by default)
    const consolidatedFile = 'messages_consolidated.txt';
    if (files.includes(consolidatedFile)) {
      console.log(`Found consolidated message file: ${consolidatedFile}`);
      const messagesPath = path.join(contactDir, consolidatedFile);
      const messagesData = fs.readFileSync(messagesPath, 'utf8');

      return {
        success: true,
        data: messagesData,
      };
    }

    // Fallback for backwards compatibility (older exports that still have individual files)
    console.log(
      'Consolidated file not found, checking for individual message files...',
    );
    const messageFile = files.find(
      (file) =>
        file.startsWith('messages_') &&
        file.endsWith('.txt') &&
        file !== consolidatedFile,
    );

    if (!messageFile) {
      console.log(
        `No message files found in ${contactDir}. Try re-running the data aggregation script.`,
      );
      return {
        success: false,
        error:
          'No message files found. Try re-running the data aggregation script.',
      };
    }

    console.log(`Found legacy individual message file: ${messageFile}`);
    const messagesPath = path.join(contactDir, messageFile);
    const messagesData = fs.readFileSync(messagesPath, 'utf8');

    return {
      success: true,
      data: messagesData,
    };
  } catch (error) {
    console.error(`Error loading messages for ${contactName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Handle loading contacts from original contact.json files (for UI display with real phone numbers)
ipcMain.handle('load-contacts-from-originals', async () => {
  try {
    const dataPath = path.join(__dirname, '../../../data_aggregation/data');

    if (!fs.existsSync(dataPath)) {
      throw new Error('Data directory not found');
    }

    const contacts: any[] = [];
    const directories = fs
      .readdirSync(dataPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('_'))
      .map((dirent) => dirent.name);

    directories.forEach((contactName) => {
      try {
        const contactPath = path.join(dataPath, contactName, 'contact.json');

        if (fs.existsSync(contactPath)) {
          const contactData = JSON.parse(fs.readFileSync(contactPath, 'utf8'));

          // Extract phone numbers from contact.json
          const phoneNumbers =
            contactData.contact_information?.phone_numbers?.map(
              (phone: any) => phone.number,
            ) || [];

          // Extract emails from contact.json
          const emails =
            contactData.contact_information?.emails?.map(
              (email: any) => email.address,
            ) || [];

          // Build contact entry with real data
          const contact = {
            contact_name: contactData.name,
            phone_numbers: phoneNumbers,
            emails,
            organization: contactData.professional_information?.organization,
            total_messages:
              contactData.conversation_insights?.total_messages || 0,
            date_range:
              contactData.conversation_insights?.date_range || 'Unknown',
            most_active_number:
              contactData.conversation_insights?.most_active_number,
            file_path: `${contactName}/contact.json`,
          };

          contacts.push(contact);
        }
      } catch (error) {
        console.error(`Error loading contact ${contactName}:`, error);
        // Continue with other contacts
      }
    });

    // Sort by total messages descending
    contacts.sort((a, b) => b.total_messages - a.total_messages);

    const result = {
      metadata: {
        total_conversations: contacts.length,
        generated_at: new Date().toISOString(),
        format: 'original_contacts',
        privacy_enabled: false,
      },
      conversations: contacts,
    };

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Error loading contacts from originals:', error);
    const { message } =
      error instanceof Error ? error : { message: 'Unknown error' };
    return {
      success: false,
      error: message,
    };
  }
});

// Handle OpenAI chat requests
ipcMain.handle('openai-chat', async (event, { messages, contactContext }) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    let systemPrompt = '';

    // Check if this is a global database analysis request
    if (contactContext?.type === 'global_analysis') {
      const { databaseStats: stats, messageAnalysis } = contactContext;

      systemPrompt = `You are an AI assistant specializing in social network analysis and communication pattern insights. You have access to comprehensive data about the user's entire contact database.

DATABASE OVERVIEW:
- Total Contacts: ${stats.totalContacts}
- Total Messages: ${stats.totalMessages}
- Average Messages per Contact: ${stats.averageMessages}

ACTIVITY DISTRIBUTION:
- High Activity (500+ messages): ${stats.activityDistribution.high} contacts
- Medium Activity (100-500 messages): ${stats.activityDistribution.medium} contacts  
- Low Activity (<100 messages): ${stats.activityDistribution.low} contacts

TOP CONTACTS BY MESSAGE VOLUME:
${stats.topContacts.map((c: any, i: number) => `${i + 1}. ${c.name} - ${c.messages} messages${c.organization ? ` (${c.organization})` : ''} - ${c.frequency.toFixed(2)} msgs/day`).join('\n')}

ORGANIZATIONS:
${Object.entries(stats.organizations)
  .map(
    ([org, contacts]: [string, any]) =>
      `${org}: ${contacts.length} contacts, ${contacts.reduce((sum: number, c: any) => sum + c.messages, 0)} total messages`,
  )
  .join('\n')}

PHOTO DATA:
- Contacts with photos: ${stats.withPhotos}/${stats.totalContacts}`;

      // Add message analysis if available
      if (messageAnalysis) {
        systemPrompt += `

MESSAGE ANALYSIS:
- Total Messages Sent by User: ${messageAnalysis.totalMessages.toLocaleString()}
- Total Words: ${messageAnalysis.totalWords.toLocaleString()}
- Unique Vocabulary: ${messageAnalysis.uniqueWords.toLocaleString()} words
- Average Message Length: ${Math.round(messageAnalysis.averageMessageLength)} characters

TOP WORDS USED (excluding common words):
${messageAnalysis.topWords
  .slice(0, 20)
  .map(
    (w: any, i: number) =>
      `${i + 1}. "${w.word}" - ${w.count} times (used with ${w.contacts.length} contacts)`,
  )
  .join('\n')}

COMMON PHRASES:
${messageAnalysis.topBigrams
  .slice(0, 10)
  .map((b: any, i: number) => `${i + 1}. "${b.bigram}" - ${b.count} times`)
  .join('\n')}

COMMUNICATION PATTERNS:
- Most active hour: ${messageAnalysis.messagesByHour.indexOf(Math.max(...messageAnalysis.messagesByHour))}:00
- Most active day: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][messageAnalysis.messagesByDayOfWeek.indexOf(Math.max(...messageAnalysis.messagesByDayOfWeek))]}
- Message sentiment: ${messageAnalysis.sentimentBreakdown.positive}% positive, ${messageAnalysis.sentimentBreakdown.neutral}% neutral, ${messageAnalysis.sentimentBreakdown.negative}% negative`;
      }

      systemPrompt += `

Instructions: Provide deep insights about communication patterns, relationship dynamics, social circles, vocabulary usage, networking behavior, and overall communication style. Be analytical yet conversational. Focus on meaningful patterns and insights that help understand the user's social network, communication habits, and personality traits reflected in their messaging patterns. Reference specific data points to support your analysis.`;
    } else {
      // Individual contact analysis (existing logic)
      systemPrompt = `You are an AI assistant helping analyze conversation data and relationships. You have access to comprehensive conversation history and metadata.

Contact Information:
- Name: ${contactContext?.contactName || 'Unknown'}
- Organization: ${contactContext?.organization || 'None'}
- Phone Numbers: ${contactContext?.phoneNumbers?.join(', ') || 'None'}
- Emails: ${contactContext?.emails?.join(', ') || 'None'}
- Total Messages: ${contactContext?.totalMessages || 'Unknown'}
- Date Range: ${contactContext?.dateRange || 'Unknown'}`;

      if (contactContext?.summary) {
        systemPrompt += `
- Message Frequency: ${contactContext.summary.message_frequency_per_day.toFixed(2)} messages per day
- Conversation Span: ${contactContext.summary.conversation_span_days} days
- Sent/Received: ${contactContext.summary.sent_messages}/${contactContext.summary.received_messages}`;
      }

      // Include full conversation if available
      if (contactContext?.fullConversation) {
        systemPrompt += `

${contactContext.fullConversation}

Instructions: You have access to the complete conversation history above. Use this information to provide detailed, specific insights about the relationship, communication patterns, and any specific questions about the conversation content. You can reference specific messages, dates, and conversation topics. Be conversational and insightful.`;
      } else {
        systemPrompt += `

No full conversation data available. Provide insights based on the metadata and summary information provided.`;
      }
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1500, // Increased for more detailed responses
      temperature: 0.7,
    });

    return {
      success: true,
      message: response.choices[0]?.message?.content || 'No response generated',
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});

// Handle AI message generation with full conversation context and style analysis
ipcMain.handle(
  'generate-message',
  async (event, { contactName, prompt, messageType }) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      // Load full conversation JSON for the contact
      const contactDir = path.join(
        __dirname,
        '../../../data_aggregation/data',
        contactName,
      );

      if (!fs.existsSync(contactDir)) {
        throw new Error('Contact directory not found');
      }

      // Load recent interactions file for better style analysis (preserves original formatting)
      const recentInteractionsPath = path.join(
        contactDir,
        'conversation_recent_interactions.json',
      );
      let recentInteractionsData = null;

      if (fs.existsSync(recentInteractionsPath)) {
        const recentContent = fs.readFileSync(recentInteractionsPath, 'utf8');
        recentInteractionsData = JSON.parse(recentContent);
      }

      // Fallback to main conversation file if recent interactions not available
      const conversationPath = path.join(contactDir, 'conversation_llm.json');
      let conversationData = null;

      if (fs.existsSync(conversationPath)) {
        const conversationContent = fs.readFileSync(conversationPath, 'utf8');
        conversationData = JSON.parse(conversationContent);
      }

      // Load contact.json for additional context
      const contactPath = path.join(contactDir, 'contact.json');
      let contactData = null;

      if (fs.existsSync(contactPath)) {
        const contactContent = fs.readFileSync(contactPath, 'utf8');
        contactData = JSON.parse(contactContent);
      }

      // Analyze user's messaging style from recent interactions (preferred) or conversation data
      let userMessages = [];
      let conversationContext = '';
      let interactionAnalysis = null;

      if (recentInteractionsData) {
        // Use recent interactions data - much better for style analysis!
        const recentMessages = recentInteractionsData.recent_messages || [];

        // Get user's messages (sender: 'me') with preserved formatting
        userMessages = recentMessages
          .filter((msg: any) => msg.sender === 'me')
          .map((msg: any) => msg.content);

        // Get recent conversation context with preserved formatting
        conversationContext = recentMessages
          .slice(-15) // Last 15 messages for context
          .map(
            (msg: any) =>
              `${msg.sender === 'me' ? 'You' : contactName}: ${msg.content}`,
          )
          .join('\n');

        // Include interaction analysis from the recent interactions file
        interactionAnalysis = recentInteractionsData.interaction_analysis;
      } else if (conversationData && conversationData.messages) {
        // Fallback to main conversation data
        userMessages = conversationData.messages
          .filter((msg: any) => msg.sender === 'me')
          .slice(-20) // Last 20 user messages for style analysis
          .map((msg: any) => msg.content);

        // Get recent conversation context (last 15 messages)
        const recentMessages = conversationData.messages.slice(-15);
        conversationContext = recentMessages
          .map(
            (msg: any) =>
              `${msg.sender === 'me' ? 'You' : contactName}: ${msg.content}`,
          )
          .join('\n');
      }

      // Enhanced style analysis using preserved formatting from recent interactions
      const styleAnalysis = analyzeMessagingStyleAdvanced(userMessages);

      // Create comprehensive system prompt with recent interactions data
      let systemPrompt = `You are an AI assistant that generates messages to send to ${contactName}. You MUST always generate a direct message that will be sent to ${contactName} - never ask the user questions or say you need more information.

CONTACT: ${contactName}
${contactData?.professional_information?.organization ? `ORGANIZATION: ${contactData.professional_information.organization}` : ''}

${recentInteractionsData ? 'RECENT INTERACTIONS ANALYSIS (PRESERVED FORMATTING):' : 'CONVERSATION STYLE ANALYSIS:'}
${JSON.stringify(styleAnalysis, null, 2)}

${
  interactionAnalysis
    ? `
INTERACTION PATTERNS:
- User messages in recent conversations: ${interactionAnalysis.user_messages}
- Contact messages: ${interactionAnalysis.contact_messages}
- Response pairs: ${interactionAnalysis.response_pairs}
- User avg message length: ${interactionAnalysis.user_avg_message_length} chars
- Contact avg message length: ${interactionAnalysis.contact_avg_message_length} chars
- Interaction ratio: ${interactionAnalysis.interaction_ratio}
- Conversation timespan: ${interactionAnalysis.timespan_hours} hours
`
    : ''
}

RECENT CONVERSATION CONTEXT:
${conversationContext}

CRITICAL INSTRUCTIONS:
1. ALWAYS generate a message that will be sent directly to ${contactName}
2. NEVER ask the user questions or request clarification
3. NEVER say you need more information
4. If the user's request is vague, make reasonable assumptions and create a message anyway
5. The message should sound EXACTLY like how the user naturally writes based on their recent messages
6. Match their typical message length, tone, personality, and formatting style
7. Use their patterns for emojis, punctuation, capitalization, slang, abbreviations, and overall voice
8. The message should feel authentic - like ${contactName} would immediately recognize it as genuinely from the user
9. Consider the conversation context and relationship dynamic shown in recent interactions
10. Pay special attention to how the user actually formats their messages (spacing, punctuation, etc.)
11. Return ONLY the message text that will be sent to ${contactName}, nothing else

USER REQUEST: "${prompt}"
MESSAGE TYPE: ${messageType}

Generate a message to ${contactName} based on the user's request. Write it in their exact authentic style as shown in their recent messages.`;

      // Adjust prompt based on message type
      if (messageType === 'suggest_reply') {
        systemPrompt += `\n\nGenerate a thoughtful reply message to send to ${contactName} in response to their last message. Write it in the user's authentic style as shown in recent interactions.`;
      } else if (messageType === 'make_formal') {
        systemPrompt += `\n\nGenerate a more formal message to send to ${contactName}, but still maintain the user's core personality and voice patterns.`;
      } else if (messageType === 'make_casual') {
        systemPrompt += `\n\nGenerate a casual and relaxed message to send to ${contactName}, matching the user's typical informal style from recent messages.`;
      } else if (messageType === 'conversation_starter') {
        systemPrompt += `\n\nGenerate a natural conversation starter message to send to ${contactName} that fits the user's communication style and relationship dynamic.`;
      }

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200, // Keep messages concise like real texts
        temperature: 0.8, // Higher creativity for natural variation
      });

      const generatedMessage =
        response.choices[0]?.message?.content?.trim() || '';

      return {
        success: true,
        message: generatedMessage,
      };
    } catch (error) {
      console.error('Error generating message:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  },
);

// Enhanced helper function to analyze user's messaging style with preserved formatting
function analyzeMessagingStyleAdvanced(userMessages: string[]) {
  if (userMessages.length === 0) {
    return {
      messageCount: 0,
      averageLength: 0,
      usesEmojis: false,
      emojiFrequency: 0,
      usesPunctuation: false,
      punctuationStyle: 'none',
      usesCapitalization: false,
      capitalizationPattern: 'none',
      usesAbbreviations: false,
      usesSlang: false,
      commonPatterns: [],
      recentExamples: [],
      formattingPatterns: {},
    };
  }

  const totalLength = userMessages.reduce((sum, msg) => sum + msg.length, 0);
  const averageLength = Math.round(totalLength / userMessages.length);

  // Enhanced emoji detection and frequency
  const emojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const messagesWithEmojis = userMessages.filter((msg) => emojiRegex.test(msg));
  const usesEmojis = messagesWithEmojis.length > 0;
  const emojiFrequency = messagesWithEmojis.length / userMessages.length;

  // Detailed punctuation analysis
  const endsPunctuation = userMessages.filter((msg) =>
    /[.!?]$/.test(msg.trim()),
  );
  const usesPunctuation = endsPunctuation.length > 0;
  let punctuationStyle = 'none';

  if (usesPunctuation) {
    const periodsCount = userMessages.filter((msg) =>
      msg.trim().endsWith('.'),
    ).length;
    const exclamationCount = userMessages.filter((msg) =>
      msg.trim().endsWith('!'),
    ).length;
    const questionCount = userMessages.filter((msg) =>
      msg.trim().endsWith('?'),
    ).length;

    if (exclamationCount > periodsCount && exclamationCount > questionCount) {
      punctuationStyle = 'exclamatory';
    } else if (periodsCount > 0) {
      punctuationStyle = 'formal';
    } else {
      punctuationStyle = 'mixed';
    }
  }

  // Enhanced capitalization patterns
  const startsCapital = userMessages.filter((msg) => /^[A-Z]/.test(msg));
  const usesCapitalization = startsCapital.length > 0;
  let capitalizationPattern = 'none';

  if (usesCapitalization) {
    const capitalRatio = startsCapital.length / userMessages.length;
    if (capitalRatio > 0.8) {
      capitalizationPattern = 'consistent';
    } else if (capitalRatio > 0.3) {
      capitalizationPattern = 'mixed';
    } else {
      capitalizationPattern = 'minimal';
    }
  }

  // Common abbreviations
  const abbreviationRegex =
    /\b(lol|omg|btw|tbh|nvm|idk|imo|fyi|asap|ttyl|brb|wtf|smh|irl|dm|rn|af|fr|ngl|periodt)\b/gi;
  const usesAbbreviations = userMessages.some((msg) =>
    abbreviationRegex.test(msg),
  );

  // Slang detection
  const slangRegex =
    /\b(gonna|wanna|gotta|kinda|sorta|yeah|yep|nah|sup|hey|yo|dude|bro|sis|bestie|lowkey|highkey|deadass|facts|bet|cap|no cap|salty|sus|vibe|mood|stan|ship|tea|spill|flex|ghost|slide|fire|lit|slaps|hits different)\b/gi;
  const usesSlang = userMessages.some((msg) => slangRegex.test(msg));

  // Formatting patterns analysis
  const formattingPatterns = {
    usesMultipleSpaces: userMessages.some((msg) => /\s{2,}/.test(msg)),
    usesEllipsis: userMessages.some((msg) => /\.{2,}/.test(msg)),
    usesRepeatedChars: userMessages.some((msg) => /(.)\1{2,}/.test(msg)),
    usesAllCaps: userMessages.some((msg) => /[A-Z]{3,}/.test(msg)),
    averageWordsPerMessage:
      userMessages.reduce((sum, msg) => sum + msg.split(/\s+/).length, 0) /
      userMessages.length,
  };

  // Get recent examples for direct style reference
  const recentExamples = userMessages.slice(-8); // More examples for better analysis

  return {
    messageCount: userMessages.length,
    averageLength,
    usesEmojis,
    emojiFrequency: Math.round(emojiFrequency * 100) / 100,
    usesPunctuation,
    punctuationStyle,
    usesCapitalization,
    capitalizationPattern,
    usesAbbreviations,
    usesSlang,
    formattingPatterns,
    recentExamples,
  };
}

// Handle sending iMessages
ipcMain.handle('send-imessage', async (event, { recipient, message }) => {
  try {
    console.log(`Attempting to send message to ${recipient}: ${message}`);

    // Check if Messages.app is available
    const isAvailable = await imessageService.isMessagesAppAvailable();
    if (!isAvailable) {
      console.log('Messages.app not running, attempting to launch...');
      const launched = await imessageService.launchMessagesApp();
      if (!launched) {
        throw new Error(
          'Could not launch Messages.app. Please ensure it is installed and you have permission to access it.',
        );
      }
    }

    // Send the message
    const result = await imessageService.sendMessage(recipient, message);

    if (result.success) {
      console.log(`Message sent successfully with ID: ${result.messageId}`);
    } else {
      console.error(`Failed to send message: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error('Error in send-imessage handler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});

// Handle checking contact status for iMessage
ipcMain.handle('check-contact-status', async (event, { recipient }) => {
  try {
    console.log(`Checking contact status for: ${recipient}`);

    const status = await imessageService.checkContactStatus(recipient);
    console.log(`Contact status for ${recipient}:`, status);

    return {
      success: true,
      status,
    };
  } catch (error) {
    console.error('Error checking contact status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});

// Handle checking Messages.app availability
ipcMain.handle('check-messages-app', async () => {
  try {
    const isAvailable = await imessageService.isMessagesAppAvailable();

    return {
      success: true,
      isAvailable,
    };
  } catch (error) {
    console.error('Error checking Messages.app:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});

// Handle launching Messages.app
ipcMain.handle('launch-messages-app', async () => {
  try {
    const launched = await imessageService.launchMessagesApp();

    return {
      success: launched,
      error: launched ? undefined : 'Failed to launch Messages.app',
    };
  } catch (error) {
    console.error('Error launching Messages.app:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
