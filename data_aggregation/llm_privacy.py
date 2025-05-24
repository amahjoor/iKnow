"""
LLM Privacy Module

This module handles privacy-aware processing of conversation data for LLM consumption.
It provides anonymization, message optimization, and privacy mapping functionality.
"""

import re
import json
import os
from datetime import datetime, timedelta
from dateutil.parser import parse
import emoji

# Privacy Configuration for LLM Data
ANONYMIZE_LLM_DATA = True  # Enable/disable privacy features
PERSON_PLACEHOLDER = "[[PERSON]]"  # Placeholder for contact names
PHONE_PLACEHOLDER_PREFIX = "[[PHONE_"  # Prefix for phone number placeholders
EMAIL_PLACEHOLDER_PREFIX = "[[EMAIL_"  # Prefix for email placeholders
SOCIAL_PLACEHOLDER = "[[SOCIAL_MEDIA]]"  # Placeholder for social media handles/usernames
ADDRESS_PLACEHOLDER = "[[ADDRESS]]"  # Placeholder for physical addresses
PASSWORD_PLACEHOLDER = "[[CREDENTIALS]]"  # Placeholder for passwords and credentials
PRIVACY_MAPPING_FILE = "privacy_mapping.json"  # File containing the mapping data

# Regex patterns for sensitive data detection
EMAIL_PATTERN = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
PARTIAL_EMAIL_PATTERN = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\b'  # Catches partial emails like user@gmail
PHONE_PATTERN = r'\b(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'
SOCIAL_MEDIA_PATTERNS = [
    r'(?:twitter\.com|x\.com)/([A-Za-z0-9_]+)',  # Twitter/X handles
    r'(?:instagram\.com)/([A-Za-z0-9_\.]+)',     # Instagram handles
    r'(?:linkedin\.com/in)/([A-Za-z0-9_-]+)',    # LinkedIn profiles
    r'(?:facebook\.com)/([A-Za-z0-9\.]+)',       # Facebook profiles
    r'(?:github\.com)/([A-Za-z0-9_-]+)',         # GitHub usernames
    r'@([A-Za-z0-9_]+)'                          # Generic @ mentions
]

# Enhanced username patterns to catch directly mentioned usernames
USERNAME_CONTEXT_PATTERNS = [
    r'github\s+username\s+is\s+([A-Za-z0-9_-]{3,})',        # GitHub username is X
    r'gh\s+username\s+is\s+([A-Za-z0-9_-]{3,})',            # gh username is X
    r'github\s+user\s+is\s+([A-Za-z0-9_-]{3,})',            # GitHub user is X
    r'twitter\s+handle\s+is\s+@?([A-Za-z0-9_]{3,})',        # Twitter handle is X
    r'instagram\s+(?:is|username)\s+@?([A-Za-z0-9_\.]{3,})', # Instagram is X or username is X
    r'ig\s+(?:is|username)\s+@?([A-Za-z0-9_\.]{3,})',        # ig is X or username is X 
    r'linkedin\s+(?:is|profile)\s+([A-Za-z0-9_-]{3,})',      # LinkedIn is X or profile is X
    r'facebook\s+(?:is|username)\s+([A-Za-z0-9\.]{3,})',     # Facebook is X or username is X
    r'discord\s+(?:is|tag)\s+([A-Za-z0-9_#\.]{3,})',         # Discord is X or tag is X
    r'telegram\s+(?:is|username)\s+@?([A-Za-z0-9_]{3,})',    # Telegram is X or username is X
    r'my\s+username\s+(?:is|:)\s+([A-Za-z0-9_\.-]{3,})',      # My username is X
    r'username\s+(?:is|:)\s+([A-Za-z0-9_\.-]{3,})',           # Username is X (general)
    r'my\s+github\s+username\s+is\s+([A-Za-z0-9_-]{3,})',     # My GitHub username is X
    r'my\s+twitter\s+(?:handle|username)\s+is\s+@?([A-Za-z0-9_]{3,})'  # My Twitter handle/username is X
]

# Password detection patterns (look for context followed by potential password)
PASSWORD_PATTERNS = [
    r'password\s+(?:is|:)\s+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]{6,})',  # "password is X" or "password: X"
    r'pwd\s+(?:is|:)\s+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]{6,})',       # "pwd is X" or "pwd: X"
    r'credentials\s+(?:are|is|:)\s+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]{6,})',  # "credentials are X"
    r'login\s+(?:is|:)\s+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]{6,})',     # "login is X" or "login: X"
    r'passw[o0]rd\s*[=:]\s*([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]{6,})',   # password=X or password:X
    r'the\s+password\s+(?:is|:)\s+([A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]{6,})',  # "the password is X"
]


def set_privacy_enabled(enabled):
    """Set whether privacy features are enabled globally."""
    global ANONYMIZE_LLM_DATA
    ANONYMIZE_LLM_DATA = enabled


def process_emojis_for_llm(content):
    """
    Process emojis for LLM optimization:
    1. Convert emojis to text descriptions
    2. Remove consecutive duplicate emojis
    3. Clean up excessive emoji usage
    """
    if not content:
        return content
    
    # Convert emojis to text descriptions first
    content = emoji.demojize(content, delimiters=(":", ":"))
    
    # Reduce consecutive duplicate emoji descriptions BEFORE replacements
    # This handles cases like :heart::heart::heart: → :heart:
    content = re.sub(r'(:[\w_-]+:)(\1)+', r'\1', content)
    
    # Replace common emojis with shorter, LLM-friendly text
    emoji_replacements = {
        ':face_with_tears_of_joy:': '(laughing)',
        ':red_heart:': '(heart)',
        ':smiling_face_with_heart-eyes:': '(heart eyes)', 
        ':thumbs_up:': '(thumbs up)',
        ':thumbs_down:': '(thumbs down)',
        ':fire:': '(fire)',
        ':clapping_hands:': '(clapping)',
        ':folded_hands:': '(praying)',
        ':rolling_on_the_floor_laughing:': '(laughing)',
        ':crying_face:': '(crying)',
        ':smiling_face:': '',  # Remove simple smiles as they add little value
        ':winking_face:': '',  # Remove simple winks
        ':kissing_face:': '(kiss)',
        ':thinking_face:': '(thinking)',
        ':face_with_rolling_eyes:': '(eye roll)',
        ':person_shrugging:': '(shrug)',
        ':shrugging:': '(shrug)',
        # Add some more common ones
        ':grinning_face:': '',
        ':beaming_face_with_smiling_eyes:': '',
        ':star-struck:': '(amazed)',
        ':partying_face:': '(party)'
    }
    
    for emoji_code, replacement in emoji_replacements.items():
        content = content.replace(emoji_code, replacement)
    
    # For remaining complex emoji descriptions, be more selective
    # Remove very long/complex emoji descriptions
    content = re.sub(r':[\w_-]{15,}:', '', content)  # Remove very long emoji descriptions
    # Convert remaining medium-length emojis to simple tag
    content = re.sub(r':[\w_-]+:', '(emoji)', content)
    
    # Clean up multiple consecutive (emoji) tags
    content = re.sub(r'\(emoji\)\s*\(emoji\)+', '(emoji)', content)
    
    # Remove standalone (emoji) that don't add value
    if content.strip() == '(emoji)':
        return ''
    
    # Clean up extra spaces
    content = ' '.join(content.split())
    
    return content


def clean_message_content(content):
    """
    Clean message content for LLM processing by removing noise and stop words
    """
    if not content or not isinstance(content, str):
        return ""
    
    # Remove excessive whitespace and normalize
    content = ' '.join(content.split())
    
    # Process emojis for LLM optimization
    content = process_emojis_for_llm(content)
    
    # Remove read receipt and delivery artifacts
    content = re.sub(r'\(Read by .+?\)', '', content)
    content = re.sub(r'\(Delivered.+?\)', '', content)
    
    # Remove system messages about replies and reactions
    content = re.sub(r'This message responded to an earlier message\.?', '', content)
    content = re.sub(r'Replied to ".+?"', '', content)
    content = re.sub(r'Reacted to ".+?" with .+', '', content)
    content = re.sub(r'Emphasized ".+?"', '', content)
    content = re.sub(r'Liked ".+?"', '', content)
    content = re.sub(r'Loved ".+?"', '', content)
    content = re.sub(r'Laughed at ".+?"', '', content)
    content = re.sub(r'Questioned ".+?"', '', content)
    content = re.sub(r'Disliked ".+?"', '', content)
    
    # Remove tapback artifacts
    content = re.sub(r'Tapback: .+', '', content)
    
    # Remove other system messages
    content = re.sub(r'\[.+?\]', '', content)  # Remove bracketed system messages
    
    # Clean up multiple spaces again after removals
    content = ' '.join(content.split())
    
    # Remove very short meaningless messages
    short_meaningless = {
        'ok', 'okay', 'k', 'kk', 'lol', 'haha', 'yeah', 'yes', 'no', 'np', 
        'yep', 'nope', 'sure', 'cool', 'nice', 'alright', 'ty', 'thx', 'thanks',
        'hmm', 'mhm', 'yup', 'nah', 'sup', 'hey', 'hi', 'hello', 'bye'
    }
    
    if content.lower().strip() in short_meaningless:
        return ""
    
    # Remove if it's just emojis or very short
    if len(content.strip()) <= 2:
        return ""
    
    # Remove excessive punctuation
    content = re.sub(r'[.]{3,}', '...', content)
    content = re.sub(r'[!]{2,}', '!', content)
    content = re.sub(r'[?]{2,}', '?', content)
    
    return content.strip()


def should_start_new_group(prev_timestamp, curr_timestamp, time_window_minutes):
    """
    Determine if we should start a new message group based on time gap
    """
    try:
        prev_time = parse(prev_timestamp)
        curr_time = parse(curr_timestamp)
        
        time_diff = curr_time - prev_time
        return time_diff > timedelta(minutes=time_window_minutes)
    except Exception:
        # If we can't parse timestamps, start new group to be safe
        return True


def is_content_similar(content1, content2, similarity_threshold=0.8):
    """
    Check if two pieces of content are too similar (to prevent duplication)
    """
    # Simple similarity check - if one is contained in the other and they're similar length
    shorter = content1 if len(content1) < len(content2) else content2
    longer = content2 if len(content1) < len(content2) else content1
    
    if len(shorter) == 0:
        return False
    
    # If the shorter text is mostly contained in the longer text
    if shorter in longer and len(shorter) / len(longer) > similarity_threshold:
        return True
    
    return False


def group_consecutive_messages(messages, time_window_minutes=10):
    """
    Group consecutive messages from the same sender within a time window
    """
    if not messages:
        return []
    
    grouped_messages = []
    current_group = None
    
    for message in messages:
        # Clean the content first
        cleaned_content = clean_message_content(message.get('content', ''))
        
        # Skip empty messages after cleaning
        if not cleaned_content:
            continue
        
        sender = message.get('sender', 'unknown')
        timestamp = message.get('timestamp', '')
        
        # If this is the first message or different sender, start new group
        if (current_group is None or 
            current_group['sender'] != sender or 
            should_start_new_group(current_group['timestamp'], timestamp, time_window_minutes)):
            
            # Save previous group if it exists
            if current_group:
                grouped_messages.append(current_group)
            
            # Start new group
            current_group = {
                'timestamp': timestamp,
                'sender': sender,
                'content': cleaned_content
            }
        else:
            # Check for duplication before adding to current group
            existing_content = current_group['content'].lower()
            new_content = cleaned_content.lower()
            
            # Only add if it's not a duplicate or very similar
            if (new_content not in existing_content and 
                not is_content_similar(existing_content, new_content)):
                current_group['content'] += ' ' + cleaned_content
    
    # Add the last group
    if current_group:
        grouped_messages.append(current_group)
    
    return grouped_messages


def optimize_messages_for_llm(messages):
    """
    Apply all LLM optimizations: grouping, cleaning, and filtering
    """
    # First group consecutive messages
    grouped = group_consecutive_messages(messages)
    
    # Filter out any remaining empty or very short messages
    filtered = []
    for msg in grouped:
        content = msg.get('content', '').strip()
        if len(content) >= 3:  # Keep messages with at least 3 characters
            filtered.append(msg)
    
    return filtered


def anonymize_data_for_llm(data, contact_name):
    """
    Anonymize sensitive data for LLM processing while maintaining a mapping for restoration
    """
    if not ANONYMIZE_LLM_DATA:
        return data, None
    
    # Create mapping dictionary to store original values
    mapping = {
        "name": contact_name,
        "phones": {},
        "emails": {},
        "organizations": {},
        "social_media": {},
        "addresses": {},
        "credentials": {},
        "original_data": {}
    }
    
    # Create a copy of the data to modify
    anonymized = json.loads(json.dumps(data))
    
    # Extract first name for more comprehensive replacement
    # This handles cases where only the first name is used in messages
    first_name = contact_name.split()[0] if contact_name else ""
    
    # Anonymize contact information
    if "contact" in anonymized:
        # Save original contact info
        mapping["original_data"]["contact"] = json.loads(json.dumps(anonymized["contact"]))
        
        # Replace contact name with placeholder
        anonymized["contact"]["name"] = PERSON_PLACEHOLDER
        
        # Create unique placeholders for each phone number
        if "phone_numbers" in anonymized["contact"]:
            for i, phone in enumerate(anonymized["contact"]["phone_numbers"]):
                placeholder = f"{PHONE_PLACEHOLDER_PREFIX}{i+1}]]"
                mapping["phones"][placeholder] = phone
                anonymized["contact"]["phone_numbers"][i] = placeholder
        
        # Create unique placeholders for each email
        if "emails" in anonymized["contact"]:
            for i, email in enumerate(anonymized["contact"]["emails"]):
                placeholder = f"{EMAIL_PLACEHOLDER_PREFIX}{i+1}]]"
                mapping["emails"][placeholder] = email
                anonymized["contact"]["emails"][i] = placeholder
        
        # Anonymize organization if present
        if "organization" in anonymized["contact"]:
            org_placeholder = "[[ORGANIZATION]]"
            mapping["organizations"][org_placeholder] = anonymized["contact"]["organization"]
            anonymized["contact"]["organization"] = org_placeholder
        
        # Remove addresses if present
        if "addresses" in anonymized["contact"]:
            addr_placeholder = ADDRESS_PLACEHOLDER
            for i, address in enumerate(anonymized["contact"]["addresses"]):
                mapping["addresses"][f"{addr_placeholder}_{i+1}"] = address
            del anonymized["contact"]["addresses"]
    
    # Anonymize phone numbers in conversation metadata
    if "conversation_metadata" in anonymized:
        # Save original metadata
        mapping["original_data"]["metadata"] = json.loads(json.dumps(anonymized["conversation_metadata"]))
        
        # Replace phone numbers in metadata
        if "most_active_number" in anonymized["conversation_metadata"]:
            phone = anonymized["conversation_metadata"]["most_active_number"]
            # Find or create placeholder for this phone
            placeholder = None
            for ph_placeholder, ph_value in mapping["phones"].items():
                if ph_value == phone:
                    placeholder = ph_placeholder
                    break
                    
            if not placeholder:
                placeholder = f"{PHONE_PLACEHOLDER_PREFIX}{len(mapping['phones'])+1}]]"
                mapping["phones"][placeholder] = phone
                
            anonymized["conversation_metadata"]["most_active_number"] = placeholder
        
        # Replace phone numbers in phone_number_usage
        if "phone_number_usage" in anonymized["conversation_metadata"]:
            phone_usage = {}
            for phone, count in anonymized["conversation_metadata"]["phone_number_usage"].items():
                # Find or create placeholder for this phone
                placeholder = None
                for ph_placeholder, ph_value in mapping["phones"].items():
                    if ph_value == phone:
                        placeholder = ph_placeholder
                        break
                        
                if not placeholder:
                    placeholder = f"{PHONE_PLACEHOLDER_PREFIX}{len(mapping['phones'])+1}]]"
                    mapping["phones"][placeholder] = phone
                    
                phone_usage[placeholder] = count
                
            anonymized["conversation_metadata"]["phone_number_usage"] = phone_usage
    
    # Anonymize message content
    if "messages" in anonymized:
        # Replace sensitive information in message content with placeholders
        for msg in anonymized["messages"]:
            if "content" in msg:
                content = msg["content"]
                
                # Replace the full contact name with placeholder (case-insensitive)
                content = re.sub(re.escape(contact_name), PERSON_PLACEHOLDER, content, flags=re.IGNORECASE)
                
                # Replace just the first name if it's different from the full name
                # Use word boundary to avoid replacing partial matches
                if first_name and first_name != contact_name and len(first_name) > 1:
                    # Create pattern that matches the first name as a whole word (case-insensitive)
                    pattern = r'\b' + re.escape(first_name) + r'\b'
                    content = re.sub(pattern, PERSON_PLACEHOLDER, content, flags=re.IGNORECASE)
                
                # Replace organization names in content if present
                for org_placeholder, org_value in mapping["organizations"].items():
                    if org_value and len(org_value) > 2:  # Only replace if meaningful
                        content = content.replace(org_value, org_placeholder)
                
                # Replace any phone numbers in content
                for placeholder, phone in mapping["phones"].items():
                    content = content.replace(phone, placeholder)
                
                # Replace known emails in content
                for placeholder, email in mapping["emails"].items():
                    content = content.replace(email, placeholder)
                
                # Find and replace additional phone numbers in content using regex
                phone_matches = re.findall(PHONE_PATTERN, content)
                for phone_match in phone_matches:
                    # Check if we already have this phone in our mapping
                    existing = False
                    for _, phone in mapping["phones"].items():
                        if phone_match in phone:
                            existing = True
                            break
                    
                    if not existing:
                        placeholder = f"{PHONE_PLACEHOLDER_PREFIX}{len(mapping['phones'])+1}]]"
                        mapping["phones"][placeholder] = phone_match
                        content = content.replace(phone_match, placeholder)
                
                # Find and replace additional emails in content using regex
                email_matches = re.findall(EMAIL_PATTERN, content)
                for email_match in email_matches:
                    # Check if we already have this email in our mapping
                    existing = False
                    for _, email in mapping["emails"].items():
                        if email_match == email:
                            existing = True
                            break
                    
                    if not existing:
                        placeholder = f"{EMAIL_PLACEHOLDER_PREFIX}{len(mapping['emails'])+1}]]"
                        mapping["emails"][placeholder] = email_match
                        content = content.replace(email_match, placeholder)
                
                # Find and replace partial emails (like user@gmail without .com)
                partial_email_matches = re.findall(PARTIAL_EMAIL_PATTERN, content)
                for partial_email_match in partial_email_matches:
                    # Skip if this was already handled by the full email pattern
                    already_handled = False
                    for _, email in mapping["emails"].items():
                        if partial_email_match in email:
                            already_handled = True
                            break
                    
                    if not already_handled:
                        placeholder = f"{EMAIL_PLACEHOLDER_PREFIX}{len(mapping['emails'])+1}]]"
                        mapping["emails"][placeholder] = partial_email_match
                        content = content.replace(partial_email_match, placeholder)
                
                # Find and replace social media handles/links
                for pattern in SOCIAL_MEDIA_PATTERNS:
                    social_matches = re.findall(pattern, content)
                    for social_match in social_matches:
                        full_match = re.search(f"({pattern})", content)
                        if full_match:
                            full_text = full_match.group(0)
                            placeholder = SOCIAL_PLACEHOLDER
                            mapping["social_media"][placeholder + "_" + social_match] = full_text
                            content = content.replace(full_text, placeholder)
                
                # Find and replace directly mentioned usernames using enhanced patterns
                for pattern in USERNAME_CONTEXT_PATTERNS:
                    try:
                        username_matches = re.findall(pattern, content, re.IGNORECASE)
                        for username in username_matches:
                            if username:
                                # Extract the platform hint from the pattern name
                                platform_hint = ""
                                for platform in ["github", "twitter", "instagram", "facebook", "linkedin", "discord", "telegram"]:
                                    if platform in pattern:
                                        platform_hint = platform
                                        break
                                
                                # Create a meaningful key with platform if available
                                if platform_hint:
                                    key = f"{SOCIAL_PLACEHOLDER}_{platform_hint}_{len(mapping['social_media'])+1}"
                                else:
                                    key = f"{SOCIAL_PLACEHOLDER}_{len(mapping['social_media'])+1}"
                                
                                mapping["social_media"][key] = username
                                
                                # Create the regex to find the exact match including context
                                context_pattern = pattern.replace("([A-Za-z0-9", "([A-Za-z0-9")  # Ensure we match the same pattern
                                match_with_context = re.search(context_pattern, content, re.IGNORECASE)
                                
                                if match_with_context:
                                    full_match = match_with_context.group(0)
                                    replacement = full_match.replace(username, SOCIAL_PLACEHOLDER)
                                    content = content.replace(full_match, replacement)
                    except Exception as e:
                        # If there's an error with a particular pattern, continue with other patterns
                        print(f"  ! Error with pattern {pattern}: {str(e)}")
                        continue
                
                # Find and replace passwords and credentials
                for pattern in PASSWORD_PATTERNS:
                    password_matches = re.findall(pattern, content, re.IGNORECASE)
                    for pwd_match in password_matches:
                        # Don't store the password itself in the mapping to enhance security
                        # Just store a note that a password was found at this location
                        cred_key = f"{PASSWORD_PLACEHOLDER}_{len(mapping['credentials'])+1}"
                        mapping["credentials"][cred_key] = "Password redacted for security"
                        
                        # Replace the exact password match with a placeholder
                        content = re.sub(
                            f"({re.escape(pwd_match)})", 
                            PASSWORD_PLACEHOLDER, 
                            content
                        )
                
                # Update the message content
                msg["content"] = content
    
    return anonymized, mapping


def generate_conversation_metadata(messages, contact_data):
    """
    Generate conversation intelligence metadata for LLM processing
    """
    if not messages:
        return {}
    
    # Basic stats
    total_messages = len(messages)
    sent_messages = sum(1 for m in messages if m.get('sender') == 'me')
    received_messages = sum(1 for m in messages if m.get('sender') == 'contact')
    
    # Date range
    timestamps = [m.get('timestamp') for m in messages if m.get('timestamp')]
    if timestamps:
        first_message = min(timestamps)
        
        try:
            first_date = parse(first_message)
            current_date = datetime.now()
            conversation_span_days = (current_date - first_date).days
            
            date_range = f"{first_date.strftime('%Y-%m-%d')} to present"
        except Exception:
            date_range = f"{first_message} to present"
            conversation_span_days = 0
    else:
        date_range = "Unknown"
        conversation_span_days = 0
    
    # Phone number usage - we'll need to get this from the consolidation process
    phone_usage = contact_data.get('phone_usage', {})
    most_active_number = max(phone_usage.items(), key=lambda x: x[1])[0] if phone_usage else "unknown"
    
    # Message frequency
    message_frequency = round(total_messages / max(conversation_span_days, 1), 2)
    
    metadata = {
        "total_messages": total_messages,
        "sent_messages": sent_messages,
        "received_messages": received_messages,
        "date_range": date_range,
        "conversation_span_days": conversation_span_days,
        "message_frequency_per_day": message_frequency,
        "most_active_number": most_active_number,
        "phone_number_usage": phone_usage
    }
    
    return metadata


def create_llm_conversation_file(contact_name, contact_data, messages, output_folder):
    """
    Create an LLM-ready conversation file for a single contact
    """
    # Apply LLM optimizations: grouping, cleaning, filtering
    optimized_messages = optimize_messages_for_llm(messages)
    
    # Extract contact information
    contact_info = {
        "name": contact_name,
        "phone_numbers": contact_data.get('phone_numbers', []),
    }
    
    # Add additional contact context if available
    if 'emails' in contact_data:
        contact_info['emails'] = [email['address'] for email in contact_data['emails']]
    
    if 'organization' in contact_data:
        contact_info['organization'] = contact_data['organization']
    
    if 'title' in contact_data:
        contact_info['title'] = contact_data['title']
    
    # Generate conversation metadata (use optimized messages for stats)
    conversation_metadata = generate_conversation_metadata(optimized_messages, contact_data)
    
    # Create the LLM-ready structure
    llm_data = {
        "contact": contact_info,
        "conversation_metadata": conversation_metadata,
        "messages": optimized_messages
    }
    
    # Apply anonymization if enabled
    anonymized_data, privacy_mapping = anonymize_data_for_llm(llm_data, contact_name)
    
    # Save inside the contact's folder instead of separate _llm_ready folder
    safe_name = re.sub(r'[\\/*?:"<>|]', '_', contact_name)
    contact_folder = os.path.join(output_folder, safe_name)
    llm_file_path = os.path.join(contact_folder, 'conversation_llm.json')
    
    with open(llm_file_path, 'w', encoding='utf-8') as f:
        json.dump(anonymized_data if ANONYMIZE_LLM_DATA else llm_data, f, indent=2, ensure_ascii=False)
    
    # Save privacy mapping if anonymization was applied
    if ANONYMIZE_LLM_DATA and privacy_mapping:
        mapping_file_path = os.path.join(contact_folder, 'privacy_mapping.json')
        with open(mapping_file_path, 'w', encoding='utf-8') as f:
            json.dump(privacy_mapping, f, indent=2, ensure_ascii=False)
    
    return llm_file_path, conversation_metadata


def create_llm_master_files(llm_conversations_data, output_folder, min_message_count):
    """
    Create master index and summary files for LLM processing
    """
    llm_folder = os.path.join(output_folder, "_llm_ready")
    os.makedirs(llm_folder, exist_ok=True)
    
    # Master Index - Full index of all conversations
    master_index = {
        "metadata": {
            "total_conversations": len(llm_conversations_data),
            "generated_at": datetime.now().isoformat(),
            "format": "llm_ready_conversations",
            "min_message_count": min_message_count,
            "privacy_enabled": ANONYMIZE_LLM_DATA
        },
        "conversations": []
    }
    
    # Conversation Summaries - Quick stats for each conversation
    conversation_summaries = {
        "metadata": {
            "total_conversations": len(llm_conversations_data),
            "generated_at": datetime.now().isoformat(),
            "format": "llm_conversation_summaries",
            "privacy_enabled": ANONYMIZE_LLM_DATA
        },
        "summaries": []
    }
    
    # Master privacy mapping
    all_privacy_mappings = {
        "metadata": {
            "total_conversations": len(llm_conversations_data),
            "generated_at": datetime.now().isoformat()
        },
        "mappings": {}
    }
    
    # Overall statistics
    total_messages = 0
    total_sent = 0
    total_received = 0
    most_active_contacts = []
    
    for contact_name, data in sorted(llm_conversations_data.items()):
        file_path = data['file_path']
        metadata = data['metadata']
        
        index_name = PERSON_PLACEHOLDER if ANONYMIZE_LLM_DATA else contact_name
        
        # Add to master index
        index_entry = {
            "contact_name": index_name,
            "file_path": file_path,
            "total_messages": metadata.get('total_messages', 0),
            "date_range": metadata.get('date_range', 'Unknown'),
        }
        
        if ANONYMIZE_LLM_DATA:
            # Use placeholders for phone numbers
            if 'phone_numbers' in data:
                anonymized_phones = []
                for i, _ in enumerate(data['phone_numbers']):
                    anonymized_phones.append(f"{PHONE_PLACEHOLDER_PREFIX}{i+1}]]")
                index_entry['phone_numbers'] = anonymized_phones
            
            # Use placeholders for emails if present
            if 'emails' in data:
                anonymized_emails = []
                for i, _ in enumerate(data['emails']):
                    anonymized_emails.append(f"{EMAIL_PLACEHOLDER_PREFIX}{i+1}]]")
                index_entry['emails'] = anonymized_emails
            
            # Use placeholder for most active number
            if metadata.get('most_active_number'):
                index_entry['most_active_number'] = f"{PHONE_PLACEHOLDER_PREFIX}1]]"
        else:
            # Use real data
            if 'phone_numbers' in data:
                index_entry['phone_numbers'] = data['phone_numbers']
            if 'emails' in data:
                index_entry['emails'] = data['emails']
            if metadata.get('most_active_number'):
                index_entry['most_active_number'] = metadata.get('most_active_number')
        
        if 'organization' in data:
            index_entry['organization'] = data['organization']
        
        master_index["conversations"].append(index_entry)
        
        # Add to conversation summaries
        summary_entry = {
            "contact_name": index_name,
            "file_path": file_path
        }
        
        # Anonymize metadata for summary if needed
        if ANONYMIZE_LLM_DATA:
            anonymized_metadata = json.loads(json.dumps(metadata))
            if 'most_active_number' in anonymized_metadata:
                anonymized_metadata['most_active_number'] = f"{PHONE_PLACEHOLDER_PREFIX}1]]"
            if 'phone_number_usage' in anonymized_metadata:
                phone_usage = {}
                for i, (_, count) in enumerate(anonymized_metadata['phone_number_usage'].items()):
                    phone_usage[f"{PHONE_PLACEHOLDER_PREFIX}{i+1}]]"] = count
                anonymized_metadata['phone_number_usage'] = phone_usage
            summary_entry["conversation_metadata"] = anonymized_metadata
        else:
            summary_entry["conversation_metadata"] = metadata
            
        conversation_summaries["summaries"].append(summary_entry)
        
        # Store privacy mapping in master file
        if ANONYMIZE_LLM_DATA:
            # Check for individual privacy mapping file
            safe_name = re.sub(r'[\\/*?:"<>|]', '_', contact_name)
            mapping_file_path = os.path.join(output_folder, safe_name, 'privacy_mapping.json')
            
            if os.path.exists(mapping_file_path):
                try:
                    with open(mapping_file_path, 'r', encoding='utf-8') as f:
                        mapping_data = json.load(f)
                        all_privacy_mappings["mappings"][contact_name] = mapping_data
                except Exception as e:
                    print(f"  ! Error reading privacy mapping for {contact_name}: {str(e)}")
        
        # Update overall stats
        msg_count = metadata.get('total_messages', 0)
        total_messages += msg_count
        total_sent += metadata.get('sent_messages', 0)
        total_received += metadata.get('received_messages', 0)
        
        most_active_contacts.append({
            "name": index_name if ANONYMIZE_LLM_DATA else contact_name,
            "message_count": msg_count
        })
    
    # Sort by most active
    most_active_contacts.sort(key=lambda x: x['message_count'], reverse=True)
    
    # Add overall statistics to metadata
    master_index["metadata"]["overall_stats"] = {
        "total_messages_all_conversations": total_messages,
        "total_sent_messages": total_sent,
        "total_received_messages": total_received,
        "average_messages_per_conversation": round(total_messages / len(llm_conversations_data), 1) if llm_conversations_data else 0,
        "most_active_contacts": most_active_contacts[:10]  # Top 10
    }
    
    # Write files
    master_index_path = os.path.join(llm_folder, "master_index.json")
    with open(master_index_path, 'w', encoding='utf-8') as f:
        json.dump(master_index, f, indent=2, ensure_ascii=False)
    
    summaries_path = os.path.join(llm_folder, "conversation_summaries.json")
    with open(summaries_path, 'w', encoding='utf-8') as f:
        json.dump(conversation_summaries, f, indent=2, ensure_ascii=False)
    
    # Write the master privacy mapping file if anonymization is enabled
    if ANONYMIZE_LLM_DATA:
        mapping_path = os.path.join(llm_folder, PRIVACY_MAPPING_FILE)
        with open(mapping_path, 'w', encoding='utf-8') as f:
            json.dump(all_privacy_mappings, f, indent=2, ensure_ascii=False)
    
    return master_index_path, summaries_path 