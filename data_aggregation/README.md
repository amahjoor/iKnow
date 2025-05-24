# Contacts & Messages Exporter

Export your contacts and iMessage conversations to structured JSON format with intelligent group chat filtering.

## Features

- **📱 Complete Contact Export** - Exports all contact information to structured JSON
- **💬 Message Integration** - Automatically exports individual message conversations
- **🚫 Group Chat Filtering** - Excludes group chats, exports only individual conversations
- **📊 Message Count Filtering** - Only exports contacts with 10+ messages (configurable)
- **🧠 Conversation Insights** - Adds communication analytics to each contact file
- **🤖 LLM-Ready Format** - Creates consolidated conversation files optimized for AI processing
- **🔒 Privacy Protection** - Anonymizes sensitive data in LLM files with name/phone placeholders
- **🎯 Message Grouping** - Combines consecutive messages from same sender within 10 minutes
- **🧽 Content Cleaning** - Removes stop words, noise, and system artifacts
- **😀 Emoji Optimization** - Converts emojis to text descriptions, removes duplicates
- **📞 Phone Number Standardization** - Converts all numbers to `+1xxxxxxxxxx` format
- **🗂️ Individual Contact Folders** - Each contact gets their own folder with all related files
- **📎 Attachment Handling** - Contact photos saved in individual folders
- **📊 Summary Generation** - JSON index files for easy navigation

## Quick Start

### Prerequisites

1. **Install Rust** (for imessage-exporter):

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

2. **Install imessage-exporter**:

   ```bash
   cargo install imessage-exporter
   ```

3. **Grant Terminal Full Disk Access**:

   - System Settings → Privacy & Security → Full Disk Access
   - Add Terminal.app

4. **Python Dependencies**:
   ```bash
   pip install vobject python-dateutil
   ```

### Usage

1. **Prepare a VCF file** to process (exported from your Contacts app or other source)
2. **Run the exporter** in one of these ways:
   ```bash
   # Method 1: Run and it will auto-detect any .vcf files in current directory
   python contacts_exporter.py
   
   # Method 2: Specify a .vcf file path directly
   python contacts_exporter.py path/to/your/contacts.vcf
   
   # Method 3: Specify a .vcf file and minimum message count
   python contacts_exporter.py path/to/your/contacts.vcf --min-messages 5
   ```

If multiple VCF files are found in the directory, you'll be prompted to select which one to use.

### Command Line Options

```
usage: contacts_exporter.py [-h] [--min-messages MIN_MESSAGES] [--disable-privacy] [vcf_file]

Export contacts and iMessage conversations to structured JSON format

positional arguments:
  vcf_file              Path to the VCF file to process. If not provided, will
                        scan current directory

optional arguments:
  -h, --help            show this help message and exit
  --min-messages MIN_MESSAGES
                        Minimum number of messages for a contact to be exported
                        (default: 10)
  --disable-privacy     Disable privacy features for LLM data (don't anonymize
                        sensitive information)
   ```

## Configuration

### Minimum Message Count Filter

By default, only contacts with **10 or more messages** are exported. To change this:

1. **Edit `contacts_exporter.py`**
2. **Modify this line** near the top:
   ```python
   MIN_MESSAGE_COUNT = 10  # Change this number
   ```
3. **Save and run** the script

**Examples:**

- `MIN_MESSAGE_COUNT = 5` - Export contacts with 5+ messages
- `MIN_MESSAGE_COUNT = 50` - Export only very active conversations
- `MIN_MESSAGE_COUNT = 1` - Export contacts with any message history

## Privacy Protection Features

By default, the exporter anonymizes sensitive information in the LLM-ready files to protect privacy while preserving conversation context for AI processing.

### Privacy Features

- **Name Anonymization** - Contact names replaced with `[[PERSON]]` placeholders
- **Phone Number Anonymization** - Phone numbers replaced with unique identifiers like `[[PHONE_1]]`
- **Address Removal** - Address information is completely removed from LLM data
- **De-identification Mapping** - Privacy mappings stored separately to allow restoration if needed

### Privacy Mapping Files

A separate mapping file (`privacy_mapping.json`) is created for each contact, containing:

```json
{
  "name": "Original Contact Name",
  "phones": {
    "[[PHONE_1]]": "+15551234567",
    "[[PHONE_2]]": "+15559876543"
  },
  "original_data": {
    "contact": { /* original contact information */ },
    "metadata": { /* original conversation metadata */ }
  }
}
```

### Master Privacy Mapping

A master mapping file is created in the `_llm_ready` folder, containing mappings for all contacts.

### Disabling Privacy Features

If you need the original unmodified data in your LLM files, you can disable privacy features:

```bash
python contacts_exporter.py --disable-privacy
```

## Output Structure

```
📇 data/
├── [ContactName]/              # Individual contact folders
│   ├── contact.json           # Structured contact data
│   ├── conversation_llm.json  # LLM-optimized conversation
│   ├── messages_+1XXX_type.txt # Message history files
│   └── attachments/           # Contact photos
├── _all_messages/             # Flat folder for tool compatibility
│   └── +1XXXXXXXXXX.txt       # Individual conversations only
├── _llm_ready/                # LLM master files
│   ├── master_index.json      # Complete conversation index
│   └── conversation_summaries.json # Quick stats per contact
└── _summary/                  # JSON index files
    ├── all_contacts.json      # Complete contact index
    └── contacts_with_messages.json # Contacts with message history
```

## Sample Output

### Contact JSON Structure

```json
{
  "name": "John Smith",
  "contact_information": {
    "emails": [
      {
        "address": "john@company.com",
        "mailto_link": "mailto:john@company.com",
        "type": "work"
      }
    ],
    "phone_numbers": [
      {
        "number": "+15551234567",
        "tel_link": "tel:+15551234567",
        "original": "(555) 123-4567",
        "type": "mobile"
      }
    ]
  },
  "personal_information": {
    "birthday": {
      "date": "1985-03-15",
      "original": "1985-03-15"
    }
  },
  "conversation_insights": {
    "total_messages": 156,
    "sent_messages": 89,
    "received_messages": 67,
    "date_range": "2020-01-15 to present",
    "conversation_span_days": 1825,
    "message_frequency_per_day": 0.09,
    "most_active_number": "+15551234567",
    "phone_number_usage": {
      "+15551234567": 142,
      "+15559876543": 14
    }
  },
  "message_history": [
    {
      "phone_number": "+15551234567",
      "phone_type": "mobile",
      "filename": "messages_+15551234567_mobile.txt",
      "path": "messages_+15551234567_mobile.txt"
    }
  ],
  "attachments": [
    {
      "type": "photo",
      "filename": "photo.jpeg",
      "path": "attachments/photo.jpeg",
      "mime_type": "jpeg"
    }
  ]
}
```

## LLM-Ready Format

### Conversation File Structure (`ContactName/conversation_llm.json`)

```json
{
  "contact": {
    "name": "John Smith",
    "phone_numbers": ["+15551234567", "+15559876543"],
    "emails": ["john@company.com"],
    "organization": "Acme Corporation"
  },
  "conversation_metadata": {
    "total_messages": 156,
    "sent_messages": 89,
    "received_messages": 67,
    "date_range": "2020-01-15 to present",
    "conversation_span_days": 1825,
    "message_frequency_per_day": 0.09,
    "most_active_number": "+15551234567",
    "phone_number_usage": {
      "+15551234567": 142,
      "+15559876543": 14
    }
  },
  "messages": [
    {
      "timestamp": "2025-01-10T14:30:15",
      "sender": "me",
      "content": "Hey John, how's the project going?"
    },
    {
      "timestamp": "2025-01-10T15:45:22",
      "sender": "contact",
      "content": "Great! Should be done by Friday."
    }
  ]
}
```

### Master Index (`_llm_ready/master_index.json`)

- **Complete conversation index** with metadata and file paths to each contact's LLM conversation
- **Overall statistics** - Total messages, most active contacts, etc.
- **Quick filtering** - Find conversations by message count, date range, etc.

## Conversation Intelligence

Each contact file now includes rich **conversation insights** that provide analytics about your relationship:

### 📊 **Communication Patterns**

- **Message frequency** - How often you communicate (messages per day)
- **Conversation balance** - Ratio of sent vs received messages
- **Communication span** - How long you've been in contact
- **Activity patterns** - Which phone numbers are used most

### 🎯 **Relationship Intelligence**

```json
"conversation_insights": {
  "total_messages": 156,
  "message_frequency_per_day": 0.09,
  "conversation_span_days": 1825,
  "most_active_number": "+15551234567"
}
```

### 💡 **Use Cases**

- **Find neglected relationships** - Low frequency or old last message
- **Identify close contacts** - High message frequency and balance
- **Communication auditing** - Who do you text most vs least?
- **Relationship management** - Build CRM tools from your data
- **Social analytics** - Understand your communication network

## Key Features

### 🎯 **Intelligent Group Chat Filtering**

- **Excluded**: `DMV Gang 💯.txt`, `+15551234567, +15559876543.txt`
- **Included**: `+15551234567.txt`, `john@company.com.txt`, `12345.txt`

### 📞 **Phone Number Standardization**

| Input Format      | Output Format  |
| ----------------- | -------------- |
| `(555) 123-4567`  | `+15551234567` |
| `1-555-123-4567`  | `+15551234567` |
| `+1 555 123 4567` | `+15551234567` |

### 📁 **Organized Structure**

- Each contact has their own folder
- LLM conversation integrated with contact data
- Message files include phone type labels
- Attachments stored per-contact
- Summary files for easy navigation

## Benefits

- **🤖 Machine Readable** - Structured JSON for easy processing
- **🧠 LLM Optimized** - Consolidated conversations perfect for AI analysis
- **📊 Relationship Intelligence** - Communication patterns and insights in every contact
- **⚡ Token Efficient** - Message grouping, emoji optimization, and content cleaning
- **📱 Complete Backup** - Contacts + individual conversations + analytics
- **🔍 Easy to Query** - Filter and search structured data with conversation metrics
- **🛠️ Developer Friendly** - Perfect for APIs, databases, analysis
- **📈 Analytics Ready** - Clean format for data analysis and relationship management
- **🔄 Batch Processing** - Master index enables efficient LLM workflows

## License
