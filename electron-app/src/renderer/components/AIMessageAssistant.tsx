import React, { useState } from 'react';

interface AIMessageAssistantProps {
  contactName: string;
  onInsertMessage: (message: string) => void;
  isVisible: boolean;
  onToggle: () => void;
}

function AIMessageAssistant({
  contactName,
  onInsertMessage,
  isVisible,
  onToggle,
}: AIMessageAssistantProps) {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMessage = async (
    prompt: string,
    messageType: string = 'custom',
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Send request to backend with full context
      const response = await window.electron.ipcRenderer.invoke(
        'generate-message',
        {
          contactName,
          prompt,
          messageType,
          // Backend will load full conversation JSON and analyze user style
        },
      );

      if (response.success) {
        // Put the generated message directly into the message box
        onInsertMessage(response.message);
        setUserInput(''); // Clear the input

        // Auto-collapse the assistant after generating
        if (messageType !== 'analyze_style') {
          setTimeout(() => onToggle(), 500);
        }
      } else {
        setError(response.error || 'Failed to generate message');
      }
    } catch (err) {
      setError('Failed to connect to AI service');
      console.error('AI Assistant error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action: string) => {
    let prompt = '';

    switch (action) {
      case 'suggest_reply':
        prompt = 'Suggest a thoughtful reply to their last message';
        break;
      case 'make_formal':
        prompt = 'Write a more formal message';
        break;
      case 'make_casual':
        prompt = 'Write a casual, friendly message';
        break;
      case 'conversation_starter':
        prompt = 'Suggest a good conversation starter';
        break;
      case 'analyze_style':
        prompt = 'Analyze my messaging style';
        break;
      default:
        return;
    }

    await generateMessage(prompt, action);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const prompt = userInput.trim();
    await generateMessage(prompt, 'custom');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isVisible) {
    return (
      <div className="border-t border-gray-200 bg-blue-50 p-2">
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium py-1"
        >
          <span>🤖</span>
          <span>AI Message Generator</span>
          <span className="text-xs">▼</span>
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Header */}
      <div className="bg-blue-50 p-3 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🤖</span>
            <span className="font-medium text-blue-900">
              AI Message Generator
            </span>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              Recent Interactions Powered
            </span>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            ▲
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            type="button"
            onClick={() => handleQuickAction('suggest_reply')}
            disabled={isLoading}
            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md text-xs font-medium hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            💬 Suggest Reply
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction('conversation_starter')}
            disabled={isLoading}
            className="px-3 py-2 bg-green-100 text-green-700 rounded-md text-xs font-medium hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚀 Start Conversation
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction('make_formal')}
            disabled={isLoading}
            className="px-3 py-2 bg-purple-100 text-purple-700 rounded-md text-xs font-medium hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            👔 Make Formal
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction('make_casual')}
            disabled={isLoading}
            className="px-3 py-2 bg-orange-100 text-orange-700 rounded-md text-xs font-medium hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            😎 Make Casual
          </button>
        </div>
      </div>

      {/* Status Area */}
      {isLoading && (
        <div className="p-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center gap-2 text-blue-700 text-sm">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
              <div
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: '0.1s' }}
              />
              <div
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              />
            </div>
            <span>Analyzing your recent message style...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border-b border-red-200">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="p-3">
        <div className="text-center text-gray-500 mb-3">
          <p className="text-sm">
            Tell me what you want to say to {contactName}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            I&apos;ll generate a message using your authentic style from recent
            conversations
          </p>
        </div>

        {/* Input Area */}
        <div className="space-y-3">
          <textarea
            rows={3}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`e.g., "I want to hang out" or "Ask about weekend plans" or
              "Say thanks for dinner"`}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!userInput.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Generating...' : 'Generate Message'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIMessageAssistant;
