import vobject
import os
import sys
import re
import subprocess
import shutil
import json
from dateutil.parser import parse
from datetime import datetime, timedelta
import emoji

# Configuration
MAIN_OUTPUT_FOLDER = "data"
ALL_MESSAGES_FOLDER = "_all_messages"
SUMMARY_FOLDER = "_summary"
ATTACHMENT_FOLDER = "attachments"
MIN_MESSAGE_COUNT = 10  # Only export contacts with this many messages or more

# LLM-Ready Format Configuration
LLM_FOLDER = "_llm_ready"
LLM_CONVERSATIONS_FOLDER = "conversations"
LLM_INDEX_FILE = "master_index.json"
LLM_SUMMARIES_FILE = "conversation_summaries.json"

def count_messages_in_file(file_path):
    """
    Count the number of messages in a message text file.
    Messages are typically separated by timestamps.
    """
    if not os.path.exists(file_path):
        return 0
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Count message blocks - each message typically starts with a timestamp
        # Look for patterns like "Jan 15, 2025  2:30:15 PM" or similar
        timestamp_patterns = [
            r'\b\w{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M\b',  # Jan 15, 2025  2:30:15 PM
            r'\d{1,2}/\d{1,2}/\d{2,4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M',        # 1/15/25 2:30:15 PM
            r'\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}',                        # 2025-01-15 14:30:15
        ]
        
        message_count = 0
        for pattern in timestamp_patterns:
            matches = re.findall(pattern, content)
            if matches:
                message_count = max(message_count, len(matches))
        
        # Fallback: count by line breaks if no timestamps found
        if message_count == 0:
            lines = [line.strip() for line in content.split('\n') if line.strip()]
            # Estimate messages (very rough - actual messages might be multi-line)
            message_count = max(1, len(lines) // 3)  # Assume ~3 lines per message on average
        
        return message_count
        
    except Exception as e:
        print(f"  ! Error counting messages in {file_path}: {str(e)}")
        return 0

def get_total_message_count_for_contact(phone_numbers, temp_export_dir):
    """
    Get the total message count across all phone numbers for a contact
    """
    total_count = 0
    
    for phone_number in phone_numbers:
        # Find the message file in temp export
        phone_clean = phone_number.replace('+', '')
        possible_filenames = [
            f"{phone_number}.txt",
            f"{phone_clean}.txt"
        ]
        
        for filename in possible_filenames:
            file_path = os.path.join(temp_export_dir, filename)
            if os.path.exists(file_path):
                count = count_messages_in_file(file_path)
                total_count += count
                break  # Found the file, don't check other variations
    
    return total_count

def normalize_phone_number(phone_str):
    """
    Normalize phone number to match iMessage exporter format (+1xxxxxxxxxx)
    """
    # Remove all non-digit characters
    digits_only = re.sub(r'[^\d]', '', phone_str)
    
    # Handle different phone number formats
    if len(digits_only) == 10:
        # US number without country code
        return f"+1{digits_only}"
    elif len(digits_only) == 11 and digits_only.startswith('1'):
        # US number with country code
        return f"+{digits_only}"
    elif digits_only.startswith('1') and len(digits_only) > 11:
        # Handle cases like +15713580363
        return f"+{digits_only}"
    else:
        # International number or other format
        return f"+{digits_only}" if not phone_str.startswith('+') else phone_str

def is_group_chat_filename(filename):
    """
    Determine if a filename represents a group chat vs individual conversation
    """
    # Remove .txt extension
    name = filename.replace('.txt', '')
    
    # Group chat indicators:
    # 1. Contains " - " followed by numbers (group chat IDs)
    if re.search(r' - \d+$', name):
        return True
    
    # 2. Contains multiple phone numbers (comma separated)
    if ',' in name:
        return True
    
    # 3. Contains spaces and isn't just a phone number or email
    if ' ' in name and not re.match(r'^\+?\d+$', name) and '@' not in name:
        return True
    
    # Individual conversation indicators:
    # 1. Single phone number format
    if re.match(r'^\+?\d{10,15}$', name):
        return False
    
    # 2. Single email address
    if re.match(r'^[^@]+@[^@]+\.[^@]+$', name):
        return False
    
    # 3. Short codes (like 12345)
    if re.match(r'^\d{3,6}$', name):
        return False
    
    # Default to group chat if uncertain
    return True

def export_individual_messages_only(temp_export_dir):
    """
    Export all messages, then filter to keep only individual conversations
    """
    try:
        print("Exporting all messages...")
        
        # Run imessage-exporter to export all messages to temp directory
        cmd = [
            'imessage-exporter',
            '--format', 'txt',
            '--export-path', temp_export_dir
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Warning: imessage-exporter returned code {result.returncode}")
            print(f"stderr: {result.stderr}")
        
        # Filter out group chats
        individual_files = []
        group_files = []
        
        if os.path.exists(temp_export_dir):
            for filename in os.listdir(temp_export_dir):
                if filename.endswith('.txt'):
                    if is_group_chat_filename(filename):
                        group_files.append(filename)
                    else:
                        individual_files.append(filename)
        
        print(f"Found {len(individual_files)} individual conversations")
        print(f"Filtered out {len(group_files)} group chats")
        
        return individual_files
        
    except Exception as e:
        print(f"Error exporting messages: {str(e)}")
        return []

def get_phone_type_from_vcard(vcard, phone_number):
    """
    Get the type/label for a phone number from the vcard
    """
    if hasattr(vcard, 'tel'):
        for tel in vcard.tel_list:
            normalized = normalize_phone_number(tel.value)
            if normalized == phone_number:
                try:
                    params = str(tel.params["TYPE"]).replace("[","").replace("]","").replace("'","").lower()
                    return params
                except KeyError:
                    return "phone"
    return "phone"

def copy_message_file_for_contact(phone_number, contact_folder, contact_name, vcard, temp_export_dir):
    """
    Copy the message file for a specific phone number to the contact's folder
    """
    # Find the message file in temp export
    phone_clean = phone_number.replace('+', '')
    possible_filenames = [
        f"{phone_number}.txt",
        f"{phone_clean}.txt"
    ]
    
    for filename in possible_filenames:
        source_path = os.path.join(temp_export_dir, filename)
        if os.path.exists(source_path):
            # Get phone type for filename
            phone_type = get_phone_type_from_vcard(vcard, phone_number)
            
            # Create descriptive filename
            dest_filename = f"messages_{phone_number}_{phone_type}.txt"
            dest_path = os.path.join(contact_folder, dest_filename)
            
            # Copy the file
            shutil.copy2(source_path, dest_path)
            print(f"  ✓ Copied messages for {phone_number} ({phone_type})")
            return dest_filename
    
    print(f"  ! No messages found for {phone_number}")
    return None

def read_vcf_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error reading VCF file: {str(e)}", file=sys.stderr)
        sys.exit(1)

def get_last_message_info(messages):
    """
    Get information about the last message in a conversation
    Returns: dict with last_message_date, last_message_sender, last_message_preview
    """
    if not messages:
        return None
    
    # Messages should already be sorted chronologically
    last_message = messages[-1]
    
    # Extract the info
    last_message_info = {
        'last_message_date': last_message.get('timestamp', ''),
        'last_message_sender': last_message.get('sender', 'unknown'),
        'last_message_preview': last_message.get('content', '')[:100]  # First 100 chars
    }
    
    # Try to format the date nicely
    try:
        parsed_date = parse(last_message_info['last_message_date'])
        last_message_info['last_message_date_formatted'] = parsed_date.strftime('%Y-%m-%d')
        last_message_info['last_message_timestamp'] = parsed_date.isoformat()
    except Exception:
        # If parsing fails, use the raw timestamp
        last_message_info['last_message_date_formatted'] = last_message_info['last_message_date']
        last_message_info['last_message_timestamp'] = last_message_info['last_message_date']
    
    return last_message_info

def vcard_to_json(vcard, contact_folder, message_files, conversation_metadata=None, last_message_info=None):
    """
    Convert vCard to structured JSON data with optional conversation insights
    """
    contact_data = {
        "name": vcard.fn.value,
        "contact_information": {},
        "personal_information": {},
        "professional_information": {},
        "online_presence": {},
        "additional_information": {},
        "message_history": [],
        "attachments": [],
        "metadata": {}
    }
    
    # Add conversation insights if available
    if conversation_metadata and conversation_metadata.get('total_messages', 0) > 0:
        contact_data["conversation_insights"] = conversation_metadata
    
    # Add last message information if available
    if last_message_info:
        contact_data["last_message_info"] = last_message_info

    # Add addressbook link if available
    if hasattr(vcard, 'x_abuid'):
        contact_data["metadata"]["addressbook_id"] = vcard.x_abuid.value
        contact_data["metadata"]["addressbook_link"] = f"addressbook://{vcard.x_abuid.value}"

    # Collect phone numbers for message export
    phone_numbers = []
    
    # Email addresses
    if hasattr(vcard, 'email'):
        contact_data["contact_information"]["emails"] = []
        for email in vcard.email_list:
            email_entry = {
                "address": email.value,
                "mailto_link": f"mailto:{email.value}"
            }
            try:
                email_entry["type"] = str(email.params["TYPE"]).replace("[","").replace("]","").replace("'","").lower()
            except KeyError:  
                email_entry["type"] = "email"
            contact_data["contact_information"]["emails"].append(email_entry)

    # Phone numbers
    if hasattr(vcard, 'tel'):
        contact_data["contact_information"]["phone_numbers"] = []
        for tel in vcard.tel_list:
            normalized_phone = normalize_phone_number(tel.value)
            phone_numbers.append(normalized_phone)
            phone_entry = {
                "number": normalized_phone,
                "tel_link": f"tel:{normalized_phone}",
                "original": tel.value
            }
            try:
                phone_entry["type"] = str(tel.params["TYPE"]).replace("[","").replace("]","").replace("'","").lower()
            except KeyError:
                phone_entry["type"] = "phone"
            contact_data["contact_information"]["phone_numbers"].append(phone_entry)

    # Personal information
    if hasattr(vcard, 'bday'):
        try:
            bday = parse(vcard.bday.value)
            contact_data["personal_information"]["birthday"] = {
                "date": bday.strftime("%Y-%m-%d"),
                "original": vcard.bday.value
            }
        except Exception:
            pass

    if hasattr(vcard, 'x_anniversary'):
        try:
            anniversary = parse(vcard.x_anniversary.value)
            contact_data["personal_information"]["anniversary"] = {
                "date": anniversary.strftime("%Y-%m-%d"),
                "original": vcard.x_anniversary.value
            }
        except Exception:
            pass

    if hasattr(vcard, 'x_gender'):
        gender = "Female" if vcard.x_gender.value.lower() == "f" else "Male"
        contact_data["personal_information"]["gender"] = {
            "display": gender,
            "original": vcard.x_gender.value
        }

    # Professional information
    if hasattr(vcard, 'org'):
        contact_data["professional_information"]["organization"] = vcard.org.value[0]

    if hasattr(vcard, 'title'):
        contact_data["professional_information"]["title"] = vcard.title.value

    if hasattr(vcard, 'role'):
        contact_data["professional_information"]["role"] = vcard.role.value

    # Social media and websites
    if hasattr(vcard, 'url'):
        contact_data["online_presence"]["urls"] = []
        urls_to_process = vcard.url_list if isinstance(vcard.url_list, list) else [vcard.url]
        
        for url in urls_to_process:
            url_value = url.value.strip()
            url_entry = {
                "url": url_value,
                "original": url_value
            }
            
            if 'linkedin.com' in url_value.lower():
                url_entry["platform"] = "linkedin"
            elif 'twitter.com' in url_value.lower():
                url_entry["platform"] = "twitter"
            elif 'instagram.com' in url_value.lower():
                url_entry["platform"] = "instagram"
            else:
                url_entry["platform"] = "website"
            
            contact_data["online_presence"]["urls"].append(url_entry)

    # Additional information
    if hasattr(vcard, 'note'):
        contact_data["additional_information"]["note"] = vcard.note.value

    if hasattr(vcard, 'lang'):
        contact_data["additional_information"]["language"] = vcard.lang.value

    if hasattr(vcard, 'geo'):
        contact_data["additional_information"]["location"] = vcard.geo.value

    if hasattr(vcard, 'adr'):
        contact_data["additional_information"]["addresses"] = []
        for adr in vcard.adr_list:
            address_str = str(adr.value).replace('\n', ' ')
            contact_data["additional_information"]["addresses"].append(address_str)

    # Handle photo attachment
    if hasattr(vcard, 'photo'):
        try:
            # Save photo in contact's folder
            attachment_folder = os.path.join(contact_folder, ATTACHMENT_FOLDER)
            os.makedirs(attachment_folder, exist_ok=True)
            
            file_name = f"photo.{vcard.photo.params['TYPE'][0].lower()}"
            photo_path = os.path.join(attachment_folder, file_name)
            
            with open(photo_path, 'wb') as fid:
                fid.write(vcard.photo.value)
            
            contact_data["attachments"].append({
                "type": "photo",
                "filename": file_name,
                "path": f"{ATTACHMENT_FOLDER}/{file_name}",
                "mime_type": vcard.photo.params['TYPE'][0].lower()
            })
        except Exception:
            pass

    # Add message history
    if message_files:
        for i, message_file in enumerate(message_files):
            if message_file:
                # Extract phone number and type from filename
                match = re.match(r'messages_(\+\d+)_(.+)\.txt', message_file)
                if match:
                    phone_num, phone_type = match.groups()
                    contact_data["message_history"].append({
                        "phone_number": phone_num,
                        "phone_type": phone_type,
                        "filename": message_file,
                        "path": message_file
                    })

    # Clean up empty sections
    contact_data = {k: v for k, v in contact_data.items() if v}
    
    return contact_data, phone_numbers

def create_summary_files(contact_data, output_folder):
    """
    Create summary index files in JSON format
    """
    summary_folder = os.path.join(output_folder, SUMMARY_FOLDER)
    os.makedirs(summary_folder, exist_ok=True)
    
    # All contacts summary
    all_contacts = {
        "metadata": {
            "total_contacts": len(contact_data),
            "generated_at": "2025-01-15T06:06:00Z",
            "format": "contacts_export_v2_json"
        },
        "contacts": []
    }
    
    contacts_with_messages = {
        "metadata": {
            "total_contacts_with_messages": 0,
            "generated_at": "2025-01-15T06:06:00Z",
            "format": "contacts_export_v2_json"
        },
        "contacts": []
    }
    
    contacts_with_msgs = 0
    
    for contact_name, data in sorted(contact_data.items()):
        phone_numbers = data['phone_numbers']
        message_files = data['message_files']
        has_messages = any(message_files)
        
        if has_messages:
            contacts_with_msgs += 1
        
        contact_entry = {
            "name": contact_name,
            "file_path": f"{contact_name}/contact.json",
            "phone_numbers": phone_numbers
        }
        
        all_contacts["contacts"].append(contact_entry)
        
        # Add to contacts with messages if applicable
        if has_messages:
            contact_entry_with_msgs = contact_entry.copy()
            contact_entry_with_msgs["message_files"] = [f for f in message_files if f]
            contacts_with_messages["contacts"].append(contact_entry_with_msgs)
    
    # Update metadata
    contacts_with_messages["metadata"]["total_contacts_with_messages"] = contacts_with_msgs
    
    # Write summary files
    with open(os.path.join(summary_folder, 'all_contacts.json'), 'w', encoding='utf-8') as f:
        json.dump(all_contacts, f, indent=2, ensure_ascii=False)
    
    with open(os.path.join(summary_folder, 'contacts_with_messages.json'), 'w', encoding='utf-8') as f:
        json.dump(contacts_with_messages, f, indent=2, ensure_ascii=False)
    
    print(f"\n📊 Summary:")
    print(f"   Total contacts: {len(contact_data)}")
    print(f"   Contacts with messages: {contacts_with_msgs}")

def process_vcard_data(vcard_data):
    try:
        vcards = vobject.readComponents(vcard_data)
        
        # Create main output folder
        os.makedirs(MAIN_OUTPUT_FOLDER, exist_ok=True)
        
        # Create temporary directory for message export
        temp_export_dir = os.path.join(MAIN_OUTPUT_FOLDER, "_temp_messages")
        os.makedirs(temp_export_dir, exist_ok=True)
        
        print("🔄 Step 1: Exporting all individual messages...")
        individual_message_files = export_individual_messages_only(temp_export_dir)
        
        print(f"\n🔄 Step 2: Processing {len(list(vcards))} contacts...")
        
        # Reset vcards iterator
        vcards = vobject.readComponents(vcard_data)
        
        contact_count = 0
        contact_data = {}
        filtered_count = 0  # Track how many contacts were filtered out
        llm_conversations_data = {}  # Track LLM conversation data for master files
        
        # Create all messages folder for flat compatibility
        all_messages_folder = os.path.join(MAIN_OUTPUT_FOLDER, ALL_MESSAGES_FOLDER)
        os.makedirs(all_messages_folder, exist_ok=True)
        
        for vcard in vcards:
            if hasattr(vcard, 'fn'):
                contact_name = vcard.fn.value
                safe_contact_name = re.sub(r'[\\/*?:"<>|]', '_', contact_name)
                
                # Get phone numbers first to check message count
                phone_numbers = []
                if hasattr(vcard, 'tel'):
                    for tel in vcard.tel_list:
                        phone_numbers.append(normalize_phone_number(tel.value))
                
                # Check if contact has enough messages
                if phone_numbers:
                    total_message_count = get_total_message_count_for_contact(phone_numbers, temp_export_dir)
                    print(f"\n📇 {contact_name}: {total_message_count} messages")
                    
                    if total_message_count < MIN_MESSAGE_COUNT:
                        print(f"  ⏭️  Skipping (less than {MIN_MESSAGE_COUNT} messages)")
                        filtered_count += 1
                        continue
                else:
                    print(f"\n📇 {contact_name}: No phone numbers")
                    print(f"  ⏭️  Skipping (no phone numbers)")
                    filtered_count += 1
                    continue
                
                print(f"  ✅ Processing (has {total_message_count} messages)")
                
                # Create contact folder
                contact_folder = os.path.join(MAIN_OUTPUT_FOLDER, safe_contact_name)
                os.makedirs(contact_folder, exist_ok=True)
                
                # Copy message files for this contact
                message_files = []
                for phone in phone_numbers:
                    message_file = copy_message_file_for_contact(
                        phone, contact_folder, contact_name, vcard, temp_export_dir
                    )
                    message_files.append(message_file)
                
                # Process contact for LLM-ready format to get conversation metadata
                llm_file_path, llm_data = process_contact_for_llm(
                    contact_name, phone_numbers, vcard, temp_export_dir, MAIN_OUTPUT_FOLDER
                )
                
                # Extract conversation metadata for contact file
                conversation_metadata = llm_data['metadata'] if llm_data else None
                
                # Get last message info
                messages, _ = consolidate_contact_messages(contact_name, phone_numbers, temp_export_dir)
                last_message_info = get_last_message_info(messages)
                
                # Generate contact JSON with conversation insights
                contact_json, _ = vcard_to_json(vcard, contact_folder, message_files, conversation_metadata, last_message_info)
                
                # Save contact file as JSON
                contact_file_path = os.path.join(contact_folder, 'contact.json')
                with open(contact_file_path, 'w', encoding='utf-8') as json_file:
                    json.dump(contact_json, json_file, indent=2, ensure_ascii=False)
                
                if llm_data:
                    llm_conversations_data[safe_contact_name] = llm_data
                    print(f"  ✓ Created LLM conversation: {llm_data['metadata']['total_messages']} messages")
                    print(f"  ✓ Added conversation insights to contact.json")
                
                # Store contact data for summary
                contact_data[safe_contact_name] = {
                    'phone_numbers': phone_numbers,
                    'message_files': message_files
                }
                
                print(f"  ✓ Saved: {contact_file_path}")
                contact_count += 1
        
        # Copy all individual message files to flat folder for compatibility
        print(f"\n🔄 Step 3: Creating flat message folder for compatibility...")
        for filename in individual_message_files:
            source = os.path.join(temp_export_dir, filename)
            dest = os.path.join(all_messages_folder, filename)
            if os.path.exists(source):
                shutil.copy2(source, dest)
        
        # Create summary files
        print(f"\n🔄 Step 4: Creating summary files...")
        create_summary_files(contact_data, MAIN_OUTPUT_FOLDER)
        
        # Create LLM master files
        print(f"\n🔄 Step 5: Creating LLM-ready conversation files...")
        if llm_conversations_data:
            master_index_path, summaries_path = create_llm_master_files(llm_conversations_data, MAIN_OUTPUT_FOLDER)
            print(f"  ✓ Created master index: {master_index_path}")
            print(f"  ✓ Created conversation summaries: {summaries_path}")
        else:
            print("  ! No conversations met the minimum message criteria")
        
        # Clean up temp directory
        shutil.rmtree(temp_export_dir)
        
        print(f"\n" + "="*60)
        print(f"✅ JSON EXPORT COMPLETE")
        print(f"="*60)
        print(f"📊 Filtering Results:")
        print(f"   Minimum message count: {MIN_MESSAGE_COUNT}")
        print(f"   Contacts exported: {contact_count}")
        print(f"   Contacts filtered out: {filtered_count}")
        print(f"   Total contacts processed: {contact_count + filtered_count}")
        print(f"   LLM conversations created: {len(llm_conversations_data)}")
        print(f"\n📁 Output location: {MAIN_OUTPUT_FOLDER}/")
        print(f"📁 Individual contacts: {MAIN_OUTPUT_FOLDER}/[ContactName]/contact.json")
        print(f"📁 LLM conversations: {MAIN_OUTPUT_FOLDER}/[ContactName]/conversation_llm.json")
        print(f"📁 All messages (flat): {MAIN_OUTPUT_FOLDER}/{ALL_MESSAGES_FOLDER}/")
        print(f"📁 Summary files: {MAIN_OUTPUT_FOLDER}/{SUMMARY_FOLDER}/")
        print(f"📁 LLM master index: {MAIN_OUTPUT_FOLDER}/{LLM_FOLDER}/{LLM_INDEX_FILE}")
        
    except Exception as e:
        print(f"❌ Error processing contacts: {str(e)}", file=sys.stderr)
        sys.exit(1)

def check_imessage_exporter():
    """Check if imessage-exporter is installed"""
    try:
        result = subprocess.run(['imessage-exporter', '--version'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ imessage-exporter found: {result.stdout.strip()}")
            return True
    except FileNotFoundError:
        print("❌ imessage-exporter not found!")
        print("\nTo install imessage-exporter:")
        print("1. Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh")
        print("2. Install imessage-exporter: cargo install imessage-exporter")
        print("3. Ensure Terminal has Full Disk Access in System Settings")
        return False
    
    return False

def parse_message_file_for_llm(file_path, phone_number):
    """
    Parse a message file and extract structured message data for LLM processing
    """
    if not os.path.exists(file_path):
        return []
    
    messages = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split content into blocks by double newlines or timestamp patterns
        lines = content.split('\n')
        current_message = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check if line is a timestamp
            timestamp_patterns = [
                r'^(\w{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)',  # Jan 15, 2025  2:30:15 PM (removed $ to allow extra text)
                r'^(\d{1,2}/\d{1,2}/\d{2,4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)',    # 1/15/25 2:30:15 PM (removed $ to allow extra text)
            ]
            
            timestamp_match = None
            for pattern in timestamp_patterns:
                timestamp_match = re.match(pattern, line)
                if timestamp_match:
                    break
            
            if timestamp_match:
                # Save previous message if exists
                if current_message.get('content'):
                    messages.append(current_message.copy())
                
                # Start new message
                current_message = {
                    'timestamp_raw': timestamp_match.group(1),
                    'content': '',
                    'sender': 'unknown'
                }
                
            elif line in ['Me', 'me']:
                current_message['sender'] = 'me'
                
            elif line.startswith('+') or line.startswith('1'):
                # Phone number line - indicates contact sent this
                current_message['sender'] = 'contact'
                
            elif line.startswith('(Read by them') or line.startswith('(Delivered'):
                # Read receipt or delivery info - add to metadata
                if 'metadata' not in current_message:
                    current_message['metadata'] = []
                current_message['metadata'].append(line)
                
            else:
                # Content line
                if current_message.get('content'):
                    current_message['content'] += ' ' + line
                else:
                    current_message['content'] = line
        
        # Add the last message
        if current_message.get('content'):
            messages.append(current_message)
        
        # Convert timestamps to standardized format
        for msg in messages:
            try:
                # Parse the timestamp and convert to ISO format
                parsed_time = parse(msg['timestamp_raw'])
                msg['timestamp'] = parsed_time.isoformat()
                # Remove the raw timestamp since we have the standardized one
                del msg['timestamp_raw']
            except Exception:
                # If parsing fails, keep the raw timestamp as the timestamp
                msg['timestamp'] = msg['timestamp_raw']
                del msg['timestamp_raw']
        
        return messages
        
    except Exception as e:
        print(f"  ! Error parsing message file {file_path}: {str(e)}")
        return []

def consolidate_contact_messages(contact_name, phone_numbers, temp_export_dir):
    """
    Consolidate all messages for a contact from multiple phone numbers into a single timeline
    Returns: (all_messages, phone_usage)
    """
    all_messages = []
    phone_usage = {}
    
    for phone_number in phone_numbers:
        # Find message file for this phone number
        phone_clean = phone_number.replace('+', '')
        possible_filenames = [
            f"{phone_number}.txt",
            f"{phone_clean}.txt"
        ]
        
        for filename in possible_filenames:
            file_path = os.path.join(temp_export_dir, filename)
            if os.path.exists(file_path):
                messages = parse_message_file_for_llm(file_path, phone_number)
                all_messages.extend(messages)
                phone_usage[phone_number] = len(messages)
                break
    
    # Sort all messages chronologically
    all_messages.sort(key=lambda x: x.get('timestamp', ''))
    
    return all_messages, phone_usage

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
    
    # Save inside the contact's folder instead of separate _llm_ready folder
    safe_name = re.sub(r'[\\/*?:"<>|]', '_', contact_name)
    contact_folder = os.path.join(output_folder, safe_name)
    llm_file_path = os.path.join(contact_folder, 'conversation_llm.json')
    
    with open(llm_file_path, 'w', encoding='utf-8') as f:
        json.dump(llm_data, f, indent=2, ensure_ascii=False)
    
    return llm_file_path, conversation_metadata

def create_llm_master_files(llm_conversations_data, output_folder):
    """
    Create master index and summary files for LLM processing
    """
    llm_folder = os.path.join(output_folder, LLM_FOLDER)
    os.makedirs(llm_folder, exist_ok=True)
    
    # Master Index - Full index of all conversations
    master_index = {
        "metadata": {
            "total_conversations": len(llm_conversations_data),
            "generated_at": "2025-01-15T06:06:00Z",
            "format": "llm_ready_conversations",
            "min_message_count": MIN_MESSAGE_COUNT
        },
        "conversations": []
    }
    
    # Conversation Summaries - Quick stats for each conversation
    conversation_summaries = {
        "metadata": {
            "total_conversations": len(llm_conversations_data),
            "generated_at": "2025-01-15T06:06:00Z",
            "format": "llm_conversation_summaries"
        },
        "summaries": []
    }
    
    # Overall statistics
    total_messages = 0
    total_sent = 0
    total_received = 0
    most_active_contacts = []
    
    for contact_name, data in sorted(llm_conversations_data.items()):
        file_path = data['file_path']
        metadata = data['metadata']
        
        # Add to master index
        index_entry = {
            "contact_name": contact_name,
            "file_path": file_path,
            "phone_numbers": data['phone_numbers'],
            "total_messages": metadata.get('total_messages', 0),
            "date_range": metadata.get('date_range', 'Unknown'),
            "most_active_number": metadata.get('most_active_number', 'Unknown')
        }
        
        if 'emails' in data:
            index_entry['emails'] = data['emails']
        if 'organization' in data:
            index_entry['organization'] = data['organization']
        
        master_index["conversations"].append(index_entry)
        
        # Add to conversation summaries
        summary_entry = {
            "contact_name": contact_name,
            "conversation_metadata": metadata,
            "file_path": file_path
        }
        conversation_summaries["summaries"].append(summary_entry)
        
        # Update overall stats
        msg_count = metadata.get('total_messages', 0)
        total_messages += msg_count
        total_sent += metadata.get('sent_messages', 0)
        total_received += metadata.get('received_messages', 0)
        
        most_active_contacts.append({
            "name": contact_name,
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
    master_index_path = os.path.join(llm_folder, LLM_INDEX_FILE)
    with open(master_index_path, 'w', encoding='utf-8') as f:
        json.dump(master_index, f, indent=2, ensure_ascii=False)
    
    summaries_path = os.path.join(llm_folder, LLM_SUMMARIES_FILE)
    with open(summaries_path, 'w', encoding='utf-8') as f:
        json.dump(conversation_summaries, f, indent=2, ensure_ascii=False)
    
    return master_index_path, summaries_path

def process_contact_for_llm(contact_name, phone_numbers, vcard, temp_export_dir, output_folder):
    """
    Process a single contact for LLM-ready format
    """
    # Get consolidated messages
    messages, phone_usage = consolidate_contact_messages(contact_name, phone_numbers, temp_export_dir)
    
    if not messages:
        return None, None
    
    # Extract contact data from vcard for context
    contact_data = {'phone_numbers': phone_numbers, 'phone_usage': phone_usage}
    
    if hasattr(vcard, 'email'):
        contact_data['emails'] = [{'address': email.value} for email in vcard.email_list]
    
    if hasattr(vcard, 'org'):
        contact_data['organization'] = vcard.org.value[0]
    
    if hasattr(vcard, 'title'):
        contact_data['title'] = vcard.title.value
    
    # Create LLM conversation file
    llm_file_path, conversation_metadata = create_llm_conversation_file(
        contact_name, contact_data, messages, output_folder
    )
    
    # Return data for master index with updated file path
    safe_contact_name = re.sub(r'[\\/*?:"<>|]', '_', contact_name)
    llm_data = {
        'file_path': f"{safe_contact_name}/conversation_llm.json",
        'metadata': conversation_metadata,
        'phone_numbers': phone_numbers
    }
    
    if 'emails' in contact_data:
        llm_data['emails'] = [email['address'] for email in contact_data['emails']]
    if 'organization' in contact_data:
        llm_data['organization'] = contact_data['organization']
    
    return llm_file_path, llm_data

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

if __name__ == "__main__":
    print("🚀 Starting Integrated Contacts & Messages Exporter v2 (JSON)")
    print("="*60)
    
    # Check prerequisites
    if not check_imessage_exporter():
        sys.exit(1)
    
    # Check VCF file
    vcf_path = "all.vcf"
    if not os.path.exists(vcf_path):
        print(f"❌ Error: Could not find {vcf_path}")
        print("Please make sure the file exists in the same directory as this script.")
        sys.exit(1)
    
    print(f"✓ Found VCF file: {vcf_path}")
    print("\n🎯 This script will:")
    print("• Export all contacts to individual folders as JSON")
    print("• Export individual message conversations only (no group chats)")
    print(f"• Only export contacts with {MIN_MESSAGE_COUNT}+ messages")
    print("• Standardize phone number formatting")
    print("• Create structured, machine-readable JSON files")
    print("• Create LLM-ready conversation format with message grouping & cleaning")
    print("• Link message files to contact records")
    print("• Generate summary and index files in JSON")
    
    input("\nPress Enter to continue...")
    
    vcard_data = read_vcf_file(vcf_path)
    process_vcard_data(vcard_data) 