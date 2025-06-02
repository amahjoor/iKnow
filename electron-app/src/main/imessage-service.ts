import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface MessageSendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

export interface ContactStatus {
  isReachable: boolean;
  service: 'iMessage' | 'SMS' | 'unknown';
}

export class iMessageService {
  /**
   * Send an iMessage to a contact
   */
  async sendMessage(
    recipient: string,
    message: string,
  ): Promise<MessageSendResult> {
    try {
      // Clean the recipient (remove any formatting)
      const cleanRecipient = this.cleanPhoneNumber(recipient);

      // Escape the message content for AppleScript
      const escapedMessage = this.escapeAppleScriptString(message);

      // AppleScript to send message
      const appleScript = `
        tell application "Messages"
          set targetService to 1st account whose service type = iMessage
          set targetBuddy to participant "${cleanRecipient}" of targetService
          send "${escapedMessage}" to targetBuddy
        end tell
      `;

      await execAsync(`osascript -e '${appleScript}'`);

      return {
        success: true,
        messageId: this.generateMessageId(),
      };
    } catch (error) {
      console.error('Error sending iMessage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a contact is reachable via iMessage
   */
  async checkContactStatus(recipient: string): Promise<ContactStatus> {
    try {
      const cleanRecipient = this.cleanPhoneNumber(recipient);

      // AppleScript to check if contact is available for iMessage
      const appleScript = `
        tell application "Messages"
          try
            set targetService to 1st account whose service type = iMessage
            set targetBuddy to participant "${cleanRecipient}" of targetService
            return "iMessage"
          on error
            try
              set targetService to 1st account whose service type = SMS
              set targetBuddy to participant "${cleanRecipient}" of targetService
              return "SMS"
            on error
              return "unknown"
            end try
          end try
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      const service = stdout.trim() as 'iMessage' | 'SMS' | 'unknown';

      return {
        isReachable: service !== 'unknown',
        service,
      };
    } catch (error) {
      console.error('Error checking contact status:', error);
      return {
        isReachable: false,
        service: 'unknown',
      };
    }
  }

  /**
   * Check if Messages.app is running and accessible
   */
  async isMessagesAppAvailable(): Promise<boolean> {
    try {
      const appleScript = `
        tell application "System Events"
          return (name of processes) contains "Messages"
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${appleScript}'`);
      return stdout.trim() === 'true';
    } catch (error) {
      console.error('Error checking Messages.app availability:', error);
      return false;
    }
  }

  /**
   * Launch Messages.app if not running
   */
  async launchMessagesApp(): Promise<boolean> {
    try {
      const appleScript = `
        tell application "Messages"
          activate
        end tell
      `;

      await execAsync(`osascript -e '${appleScript}'`);

      // Wait a moment for the app to launch
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return await this.isMessagesAppAvailable();
    } catch (error) {
      console.error('Error launching Messages.app:', error);
      return false;
    }
  }

  /**
   * Clean and format phone number for Messages.app
   */
  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // If it starts with +1, keep it as is
    if (cleaned.startsWith('+1')) {
      return cleaned;
    }

    // If it starts with 1 and has 11 digits, add +
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      return '+' + cleaned;
    }

    // If it has 10 digits, add +1
    if (cleaned.length === 10) {
      return '+1' + cleaned;
    }

    // Return as is if we can't determine format
    return phoneNumber;
  }

  /**
   * Escape special characters for AppleScript
   */
  private escapeAppleScriptString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Generate a unique message ID for tracking
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const imessageService = new iMessageService();
