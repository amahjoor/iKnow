import { ContactWithSummary } from '../types/contact';
import { loadChatMessages, parseMessages } from './dataLoader';

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
