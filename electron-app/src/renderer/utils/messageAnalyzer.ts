import { ContactWithSummary } from '../types/contact';
import { loadChatMessages, parseMessages } from './dataLoader';
import { ConversationData, ParsedMessage } from '../types/contact';

// Common English stop words to filter out
const STOP_WORDS = new Set([
  // Articles
  'a',
  'an',
  'the',
  // Pronouns
  'i',
  'me',
  'my',
  'myself',
  'we',
  'our',
  'ours',
  'ourselves',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'he',
  'him',
  'his',
  'himself',
  'she',
  'her',
  'hers',
  'herself',
  'it',
  'its',
  'itself',
  'they',
  'them',
  'their',
  'theirs',
  'themselves',
  'what',
  'which',
  'who',
  'whom',
  'this',
  'that',
  'these',
  'those',
  // Common verbs
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'do',
  'does',
  'did',
  'doing',
  'will',
  'would',
  'should',
  'could',
  'ought',
  'can',
  'may',
  'might',
  'shall',
  'should',
  'must',
  // Prepositions
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'to',
  'with',
  'about',
  'against',
  'between',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'up',
  'down',
  'out',
  'off',
  'over',
  'under',
  'again',
  // Conjunctions
  'and',
  'but',
  'or',
  'nor',
  'if',
  'then',
  'else',
  'when',
  'where',
  'why',
  'how',
  'because',
  'as',
  'until',
  'while',
  'since',
  'unless',
  'although',
  'though',
  'whether',
  // Common words
  'all',
  'any',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  's',
  't',
  'can',
  'will',
  'just',
  'don',
  'now',
  've',
  'll',
  'd',
  'm',
  're',
  // Common chat words
  'yeah',
  'yes',
  'no',
  'ok',
  'okay',
  'oh',
  'ah',
  'um',
  'uh',
  'like',
  'lol',
  'haha',
  'hahaha',
  'hey',
  'hi',
  'hello',
  'bye',
  'thanks',
  'thank',
  'please',
]);

export interface WordFrequency {
  word: string;
  count: number;
  contacts: string[];
}

export interface MessageAnalysis {
  totalMessages: number;
  totalWords: number;
  uniqueWords: number;
  topWords: WordFrequency[];
  topBigrams: { bigram: string; count: number }[];
  averageMessageLength: number;
  messagesByHour: number[];
  messagesByDayOfWeek: number[];
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface CommunicationHours {
  hourlyDistribution: { hour: number; count: number }[];
  userHourlyDistribution: { hour: number; count: number }[];
  contactHourlyDistribution: { hour: number; count: number }[];
  peakHours: {
    user: number[];
    contact: number[];
    overall: number[];
  };
  totalMessages: number;
}

export interface CommunicationTrends {
  dailyData: {
    date: string;
    userMessages: number;
    contactMessages: number;
    total: number;
  }[];
  weeklyData: {
    week: string;
    userMessages: number;
    contactMessages: number;
    total: number;
  }[];
  monthlyData: {
    month: string;
    userMessages: number;
    contactMessages: number;
    total: number;
  }[];
}

export interface ReadTimeByHour {
  hour: number;
  userAverageReadTime: number; // in minutes - how long it takes for user's messages to be read
  contactAverageReadTime: number; // in minutes - how long it takes for contact's messages to be read
  userMessageCount: number;
  contactMessageCount: number;
}

export interface ReadTimeDistribution {
  under15min: number;
  min15to1hr: number;
  hr1to4hr: number;
  hr4to1day: number;
  over1day: number;
  neverRead: number;
}

export interface ResponseTimePatterns {
  userAvgResponseTime: number;
  contactAvgResponseTime: number;
  userResponseTimes: number[];
  contactResponseTimes: number[];
  readTimeByHour: ReadTimeByHour[];
  readTimeDistribution: ReadTimeDistribution;
}

// Clean and normalize text
const cleanText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '') // Remove URLs
    .replace(/[^\w\s'-]/g, ' ') // Keep only words, spaces, apostrophes, hyphens
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

// Extract words from text, filtering out stop words
const extractWords = (text: string): string[] => {
  const cleaned = cleanText(text);
  return cleaned.split(' ').filter(
    (word) =>
      word.length > 2 && // Filter out very short words
      !STOP_WORDS.has(word) &&
      !word.match(/^\d+$/), // Filter out pure numbers
  );
};

// Extract bigrams (two-word phrases)
const extractBigrams = (words: string[]): string[] => {
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
};

// Analyze messages from all contacts
export const analyzeAllMessages = async (
  contacts: ContactWithSummary[],
): Promise<MessageAnalysis> => {
  const wordFrequencyMap = new Map<
    string,
    { count: number; contacts: Set<string> }
  >();
  const bigramFrequencyMap = new Map<string, number>();
  let totalMessages = 0;
  let totalWords = 0;
  const messagesByHour = new Array(24).fill(0);
  const messagesByDayOfWeek = new Array(7).fill(0);
  let totalMessageLength = 0;

  // Process each contact's messages
  for (const contact of contacts) {
    try {
      const messagesData = await loadChatMessages(contact.contact_name);
      if (!messagesData) continue;

      const parsedData = parseMessages(messagesData, contact.contact_name);
      const messages = parsedData.messages;

      for (const message of messages) {
        if (message.sender === 'user') {
          totalMessages++;

          // Extract time-based patterns
          const messageDate = new Date(message.timestamp);
          messagesByHour[messageDate.getHours()]++;
          messagesByDayOfWeek[messageDate.getDay()]++;

          // Extract words
          const words = extractWords(message.content);
          totalWords += words.length;
          totalMessageLength += message.content.length;

          // Count word frequencies
          for (const word of words) {
            if (!wordFrequencyMap.has(word)) {
              wordFrequencyMap.set(word, { count: 0, contacts: new Set() });
            }
            const entry = wordFrequencyMap.get(word)!;
            entry.count++;
            entry.contacts.add(contact.contact_name);
          }

          // Extract and count bigrams
          const bigrams = extractBigrams(words);
          for (const bigram of bigrams) {
            bigramFrequencyMap.set(
              bigram,
              (bigramFrequencyMap.get(bigram) || 0) + 1,
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `Error processing messages for ${contact.contact_name}:`,
        error,
      );
    }
  }

  // Convert maps to sorted arrays
  const topWords = Array.from(wordFrequencyMap.entries())
    .map(([word, data]) => ({
      word,
      count: data.count,
      contacts: Array.from(data.contacts),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100); // Top 100 words

  const topBigrams = Array.from(bigramFrequencyMap.entries())
    .map(([bigram, count]) => ({ bigram, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50); // Top 50 bigrams

  // Simple sentiment analysis based on word patterns
  const sentimentBreakdown = analyzeSentiment(wordFrequencyMap);

  return {
    totalMessages,
    totalWords,
    uniqueWords: wordFrequencyMap.size,
    topWords,
    topBigrams,
    averageMessageLength:
      totalMessages > 0 ? totalMessageLength / totalMessages : 0,
    messagesByHour,
    messagesByDayOfWeek,
    sentimentBreakdown,
  };
};

// Simple sentiment analysis
const analyzeSentiment = (
  wordMap: Map<string, { count: number; contacts: Set<string> }>,
): { positive: number; neutral: number; negative: number } => {
  const positiveWords = new Set([
    'love',
    'great',
    'amazing',
    'awesome',
    'excellent',
    'good',
    'happy',
    'wonderful',
    'fantastic',
    'beautiful',
    'perfect',
    'excited',
    'fun',
    'enjoy',
    'glad',
    'nice',
    'cool',
    'best',
    'brilliant',
    'super',
  ]);

  const negativeWords = new Set([
    'hate',
    'bad',
    'terrible',
    'awful',
    'horrible',
    'sad',
    'angry',
    'disappointed',
    'annoying',
    'frustrating',
    'difficult',
    'hard',
    'sorry',
    'unfortunately',
    'problem',
    'issue',
    'wrong',
    'mistake',
    'fail',
    'failed',
    'worst',
    'sucks',
    'damn',
    'crap',
  ]);

  let positiveCount = 0;
  let negativeCount = 0;

  for (const [word, data] of wordMap) {
    if (positiveWords.has(word)) {
      positiveCount += data.count;
    } else if (negativeWords.has(word)) {
      negativeCount += data.count;
    }
  }

  const total = positiveCount + negativeCount;
  if (total === 0) {
    return { positive: 33, neutral: 34, negative: 33 };
  }

  const positivePercent = Math.round((positiveCount / total) * 100);
  const negativePercent = Math.round((negativeCount / total) * 100);
  const neutralPercent = 100 - positivePercent - negativePercent;

  return {
    positive: positivePercent,
    neutral: neutralPercent,
    negative: negativePercent,
  };
};

// Get communication patterns and insights
export const getCommunicationInsights = (analysis: MessageAnalysis) => {
  const insights: string[] = [];

  // Peak communication hours
  const peakHour = analysis.messagesByHour.indexOf(
    Math.max(...analysis.messagesByHour),
  );
  const peakDay = analysis.messagesByDayOfWeek.indexOf(
    Math.max(...analysis.messagesByDayOfWeek),
  );
  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  insights.push(`Most active hour: ${peakHour}:00-${peakHour + 1}:00`);
  insights.push(`Most active day: ${dayNames[peakDay]}`);

  // Message patterns
  if (analysis.averageMessageLength < 50) {
    insights.push('You tend to send short, concise messages');
  } else if (analysis.averageMessageLength > 150) {
    insights.push('You tend to send longer, detailed messages');
  }

  // Vocabulary insights
  insights.push(
    `Unique vocabulary: ${analysis.uniqueWords.toLocaleString()} words`,
  );

  // Top topics (from bigrams)
  const topTopics = analysis.topBigrams
    .slice(0, 5)
    .map((b) => b.bigram)
    .join(', ');
  insights.push(`Common topics: ${topTopics}`);

  return insights;
};

export const analyzeCommunicationHours = (
  conversationData: ConversationData,
): CommunicationHours => {
  const hourlyDistribution = new Array(24).fill(0);
  const userHourlyDistribution = new Array(24).fill(0);
  const contactHourlyDistribution = new Array(24).fill(0);

  conversationData.messages.forEach((message) => {
    const hour = new Date(message.timestamp).getHours();
    hourlyDistribution[hour]++;

    if (message.sender === 'me') {
      userHourlyDistribution[hour]++;
    } else {
      contactHourlyDistribution[hour]++;
    }
  });

  // Find peak hours (top 3)
  const overallPeakHours = hourlyDistribution
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((item) => item.hour);

  const userPeakHours = userHourlyDistribution
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((item) => item.hour);

  const contactPeakHours = contactHourlyDistribution
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((item) => item.hour);

  const peakHours = {
    user: userPeakHours,
    contact: contactPeakHours,
    overall: overallPeakHours,
  };

  return {
    hourlyDistribution,
    userHourlyDistribution,
    contactHourlyDistribution,
    peakHours,
    totalMessages: conversationData.messages.length,
  };
};

export const analyzeCommunicationTrends = (
  conversationData: ConversationData,
): CommunicationTrends => {
  const dailyMap = new Map<string, { user: number; contact: number }>();
  const weeklyMap = new Map<string, { user: number; contact: number }>();
  const monthlyMap = new Map<string, { user: number; contact: number }>();

  conversationData.messages.forEach((message) => {
    const date = new Date(message.timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const weekStr = getWeekString(date);
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const isUser = message.sender === 'me';

    // Daily data
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { user: 0, contact: 0 });
    }
    const dailyData = dailyMap.get(dateStr)!;
    if (isUser) dailyData.user++;
    else dailyData.contact++;

    // Weekly data
    if (!weeklyMap.has(weekStr)) {
      weeklyMap.set(weekStr, { user: 0, contact: 0 });
    }
    const weeklyData = weeklyMap.get(weekStr)!;
    if (isUser) weeklyData.user++;
    else weeklyData.contact++;

    // Monthly data
    if (!monthlyMap.has(monthStr)) {
      monthlyMap.set(monthStr, { user: 0, contact: 0 });
    }
    const monthlyData = monthlyMap.get(monthStr)!;
    if (isUser) monthlyData.user++;
    else monthlyData.contact++;
  });

  // Convert maps to arrays and sort by date
  const dailyData = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      userMessages: data.user,
      contactMessages: data.contact,
      total: data.user + data.contact,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weeklyData = Array.from(weeklyMap.entries())
    .map(([week, data]) => ({
      week,
      userMessages: data.user,
      contactMessages: data.contact,
      total: data.user + data.contact,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const monthlyData = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      userMessages: data.user,
      contactMessages: data.contact,
      total: data.user + data.contact,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    dailyData,
    weeklyData,
    monthlyData,
  };
};

export const analyzeResponseTimePatterns = async (
  contactName: string,
): Promise<ResponseTimePatterns> => {
  // Load raw messages to get read receipt data
  const rawMessages = await loadChatMessages(contactName);
  if (!rawMessages) {
    // Return empty data if no messages
    return {
      userAvgResponseTime: 0,
      contactAvgResponseTime: 0,
      userResponseTimes: [],
      contactResponseTimes: [],
      readTimeByHour: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        userAverageReadTime: 0,
        contactAverageReadTime: 0,
        userMessageCount: 0,
        contactMessageCount: 0,
      })),
      readTimeDistribution: {
        under15min: 0,
        min15to1hr: 0,
        hr1to4hr: 0,
        hr4to1day: 0,
        over1day: 0,
        neverRead: 0,
      },
    };
  }

  // Parse messages with read receipt data
  const chatData = parseMessages(rawMessages, contactName);
  const { messages } = chatData;

  // Initialize data structures
  const readTimeByHour: ReadTimeByHour[] = Array.from(
    { length: 24 },
    (_, hour) => ({
      hour,
      userAverageReadTime: 0,
      contactAverageReadTime: 0,
      userMessageCount: 0,
      contactMessageCount: 0,
    }),
  );

  const readTimeDistribution: ReadTimeDistribution = {
    under15min: 0,
    min15to1hr: 0,
    hr1to4hr: 0,
    hr4to1day: 0,
    over1day: 0,
    neverRead: 0,
  };

  let totalReadTimes: number[] = [];
  let userResponseTimes: number[] = [];
  let contactResponseTimes: number[] = [];

  // Helper function to parse read time from text like "1 minute, 5 seconds" or "3 hours, 27 minutes, 39 seconds"
  const parseReadTime = (readTimeText: string): number => {
    let totalMinutes = 0;

    // Extract hours
    const hoursMatch = readTimeText.match(/(\d+)\s+hours?/);
    if (hoursMatch) {
      totalMinutes += parseInt(hoursMatch[1]) * 60;
    }

    // Extract minutes
    const minutesMatch = readTimeText.match(/(\d+)\s+minutes?/);
    if (minutesMatch) {
      totalMinutes += parseInt(minutesMatch[1]);
    }

    // Extract seconds (convert to fraction of minutes)
    const secondsMatch = readTimeText.match(/(\d+)\s+seconds?/);
    if (secondsMatch) {
      totalMinutes += parseInt(secondsMatch[1]) / 60;
    }

    return totalMinutes;
  };

  // Analyze messages for read receipt patterns
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const messageTime = new Date(message.timestamp);
    const sendHour = messageTime.getHours();

    // Check if this message has read receipt data
    // Use the readReceipt field from the parsed message
    const readReceipt = message.readReceipt;

    if (readReceipt) {
      const readBy = readReceipt.readBy; // "them" or "you"
      const readTimeText = readReceipt.readTimeText; // "1 minute, 5 seconds"
      const readTimeMinutes = parseReadTime(readTimeText);

      // Update read time by hour based on who sent the message and who read it
      if (message.sender === 'me' && readBy === 'them') {
        // User sent message, contact read it
        readTimeByHour[sendHour].userAverageReadTime += readTimeMinutes;
        readTimeByHour[sendHour].userMessageCount += 1;
      } else if (message.sender === 'contact' && readBy === 'you') {
        // Contact sent message, user read it
        readTimeByHour[sendHour].contactAverageReadTime += readTimeMinutes;
        readTimeByHour[sendHour].contactMessageCount += 1;
      }

      // Update distribution
      if (readTimeMinutes < 15) {
        readTimeDistribution.under15min += 1;
      } else if (readTimeMinutes < 60) {
        readTimeDistribution.min15to1hr += 1;
      } else if (readTimeMinutes < 240) {
        readTimeDistribution.hr1to4hr += 1;
      } else if (readTimeMinutes < 1440) {
        readTimeDistribution.hr4to1day += 1;
      } else {
        readTimeDistribution.over1day += 1;
      }

      totalReadTimes.push(readTimeMinutes);
    } else {
      readTimeDistribution.neverRead += 1;
    }

    // Analyze response times (existing logic simplified)
    if (i > 0) {
      const prevMessage = messages[i - 1];
      const timeDiff =
        messageTime.getTime() - new Date(prevMessage.timestamp).getTime();
      const responseTimeMinutes = timeDiff / (1000 * 60);

      if (message.sender === 'me' && prevMessage.sender === 'contact') {
        userResponseTimes.push(responseTimeMinutes);
      } else if (message.sender === 'contact' && prevMessage.sender === 'me') {
        contactResponseTimes.push(responseTimeMinutes);
      }
    }
  }

  // Calculate averages for read time by hour
  readTimeByHour.forEach((hourData) => {
    if (hourData.userMessageCount > 0) {
      hourData.userAverageReadTime =
        hourData.userAverageReadTime / hourData.userMessageCount;
    }
    if (hourData.contactMessageCount > 0) {
      hourData.contactAverageReadTime =
        hourData.contactAverageReadTime / hourData.contactMessageCount;
    }
  });

  // Convert distribution to percentages
  const totalMessages = messages.length;
  if (totalMessages > 0) {
    readTimeDistribution.under15min =
      (readTimeDistribution.under15min / totalMessages) * 100;
    readTimeDistribution.min15to1hr =
      (readTimeDistribution.min15to1hr / totalMessages) * 100;
    readTimeDistribution.hr1to4hr =
      (readTimeDistribution.hr1to4hr / totalMessages) * 100;
    readTimeDistribution.hr4to1day =
      (readTimeDistribution.hr4to1day / totalMessages) * 100;
    readTimeDistribution.over1day =
      (readTimeDistribution.over1day / totalMessages) * 100;
    readTimeDistribution.neverRead =
      (readTimeDistribution.neverRead / totalMessages) * 100;
  }

  // Calculate average response times
  const avgUserResponse =
    userResponseTimes.length > 0
      ? userResponseTimes.reduce((sum, time) => sum + time, 0) /
        userResponseTimes.length
      : 0;
  const avgContactResponse =
    contactResponseTimes.length > 0
      ? contactResponseTimes.reduce((sum, time) => sum + time, 0) /
        contactResponseTimes.length
      : 0;

  return {
    userAvgResponseTime: avgUserResponse,
    contactAvgResponseTime: avgContactResponse,
    userResponseTimes,
    contactResponseTimes,
    readTimeByHour,
    readTimeDistribution,
  };
};

// Helper function to get week string (YYYY-WW format)
const getWeekString = (date: Date): string => {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
  );
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
};

// Helper function to format response time
export const formatResponseTime = (minutes: number): string => {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
  return `${Math.round(minutes / 1440)} days`;
};
