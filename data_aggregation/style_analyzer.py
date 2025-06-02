"""
Style Analyzer Module

This module provides advanced analysis of user messaging style from recent interactions
for improved AI message generation that matches the user's authentic communication patterns.
"""

import re
import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from collections import Counter


class MessageStyleAnalyzer:
    """Analyzes user messaging style from recent interactions with preserved formatting."""
    
    def __init__(self, recent_interactions_data: Dict[str, Any]):
        """Initialize with recent interactions data."""
        self.data = recent_interactions_data
        self.user_messages = self._extract_user_messages()
        self.all_messages = recent_interactions_data.get('recent_messages', [])
        
    def _extract_user_messages(self) -> List[str]:
        """Extract all messages sent by the user ('me') from recent interactions."""
        messages = self.data.get('recent_messages', [])
        return [msg.get('content', '') for msg in messages if msg.get('sender') == 'me']
    
    def get_comprehensive_style_analysis(self) -> Dict[str, Any]:
        """Get comprehensive style analysis optimized for AI message generation."""
        if not self.user_messages:
            return self._empty_analysis()
        
        return {
            'basic_stats': self._analyze_basic_stats(),
            'formatting_patterns': self._analyze_formatting(),
            'language_patterns': self._analyze_language(),
            'emotional_patterns': self._analyze_emotional_style(),
            'response_patterns': self._analyze_response_patterns(),
            'timing_patterns': self._analyze_timing(),
            'examples': self._get_representative_examples(),
            'recommendations': self._generate_style_recommendations()
        }
    
    def _empty_analysis(self) -> Dict[str, Any]:
        """Return empty analysis when no user messages are available."""
        return {
            'basic_stats': {'message_count': 0, 'average_length': 0},
            'formatting_patterns': {},
            'language_patterns': {},
            'emotional_patterns': {},
            'response_patterns': {},
            'timing_patterns': {},
            'examples': [],
            'recommendations': []
        }
    
    def _analyze_basic_stats(self) -> Dict[str, Any]:
        """Analyze basic message statistics."""
        total_chars = sum(len(msg) for msg in self.user_messages)
        total_words = sum(len(msg.split()) for msg in self.user_messages)
        
        return {
            'message_count': len(self.user_messages),
            'average_length': round(total_chars / len(self.user_messages)),
            'average_words': round(total_words / len(self.user_messages), 1),
            'shortest_message': min(len(msg) for msg in self.user_messages),
            'longest_message': max(len(msg) for msg in self.user_messages),
            'total_characters': total_chars,
            'total_words': total_words
        }
    
    def _analyze_formatting(self) -> Dict[str, Any]:
        """Analyze formatting and structural patterns."""
        patterns = {
            'capitalization': self._analyze_capitalization(),
            'punctuation': self._analyze_punctuation(),
            'emojis': self._analyze_emojis(),
            'special_chars': self._analyze_special_characters(),
            'spacing': self._analyze_spacing(),
            'structure': self._analyze_message_structure()
        }
        return patterns
    
    def _analyze_capitalization(self) -> Dict[str, Any]:
        """Analyze capitalization patterns."""
        starts_capital = sum(1 for msg in self.user_messages if msg and msg[0].isupper())
        all_caps_words = sum(1 for msg in self.user_messages if re.search(r'\b[A-Z]{2,}\b', msg))
        
        return {
            'starts_capital_ratio': round(starts_capital / len(self.user_messages), 2),
            'uses_all_caps': all_caps_words > 0,
            'all_caps_frequency': round(all_caps_words / len(self.user_messages), 2),
            'capital_style': self._determine_capital_style(starts_capital / len(self.user_messages))
        }
    
    def _determine_capital_style(self, ratio: float) -> str:
        """Determine capitalization style based on ratio."""
        if ratio > 0.8:
            return 'consistent'
        elif ratio > 0.5:
            return 'frequent'
        elif ratio > 0.2:
            return 'occasional'
        else:
            return 'rare'
    
    def _analyze_punctuation(self) -> Dict[str, Any]:
        """Analyze punctuation usage patterns."""
        punct_counts = {
            'periods': sum(msg.count('.') for msg in self.user_messages),
            'exclamations': sum(msg.count('!') for msg in self.user_messages),
            'questions': sum(msg.count('?') for msg in self.user_messages),
            'commas': sum(msg.count(',') for msg in self.user_messages),
            'ellipsis': sum(1 for msg in self.user_messages if '...' in msg)
        }
        
        ends_with_punct = sum(1 for msg in self.user_messages if msg and msg[-1] in '.!?')
        
        return {
            **punct_counts,
            'ends_with_punctuation_ratio': round(ends_with_punct / len(self.user_messages), 2),
            'punctuation_style': self._determine_punct_style(punct_counts),
            'uses_ellipsis': punct_counts['ellipsis'] > 0
        }
    
    def _determine_punct_style(self, counts: Dict[str, int]) -> str:
        """Determine punctuation style."""
        total = sum(counts.values())
        if total == 0:
            return 'minimal'
        elif counts['exclamations'] > counts['periods']:
            return 'expressive'
        elif counts['periods'] > counts['exclamations']:
            return 'formal'
        else:
            return 'balanced'
    
    def _analyze_emojis(self) -> Dict[str, Any]:
        """Analyze emoji usage patterns."""
        emoji_pattern = re.compile(r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000026FF\U00002700-\U000027BF]')
        
        messages_with_emojis = [msg for msg in self.user_messages if emoji_pattern.search(msg)]
        all_emojis = []
        for msg in self.user_messages:
            all_emojis.extend(emoji_pattern.findall(msg))
        
        emoji_freq = Counter(all_emojis)
        
        return {
            'uses_emojis': len(messages_with_emojis) > 0,
            'emoji_frequency': round(len(messages_with_emojis) / len(self.user_messages), 2),
            'total_emojis': len(all_emojis),
            'unique_emojis': len(emoji_freq),
            'most_common_emojis': emoji_freq.most_common(5),
            'emoji_style': self._determine_emoji_style(len(messages_with_emojis) / len(self.user_messages))
        }
    
    def _determine_emoji_style(self, ratio: float) -> str:
        """Determine emoji usage style."""
        if ratio > 0.5:
            return 'frequent'
        elif ratio > 0.2:
            return 'moderate'
        elif ratio > 0:
            return 'occasional'
        else:
            return 'none'
    
    def _analyze_special_characters(self) -> Dict[str, Any]:
        """Analyze usage of special characters."""
        return {
            'uses_multiple_punctuation': sum(1 for msg in self.user_messages if re.search(r'[!?]{2,}', msg)) > 0,
            'uses_repeated_letters': sum(1 for msg in self.user_messages if re.search(r'([a-zA-Z])\1{2,}', msg)) > 0,
            'uses_asterisks': sum(1 for msg in self.user_messages if '*' in msg) > 0,
            'uses_parentheses': sum(1 for msg in self.user_messages if '(' in msg and ')' in msg) > 0
        }
    
    def _analyze_spacing(self) -> Dict[str, Any]:
        """Analyze spacing patterns."""
        return {
            'uses_multiple_spaces': sum(1 for msg in self.user_messages if '  ' in msg) > 0,
            'uses_line_breaks': sum(1 for msg in self.user_messages if '\n' in msg) > 0,
            'average_spaces_per_message': round(sum(msg.count(' ') for msg in self.user_messages) / len(self.user_messages), 1)
        }
    
    def _analyze_message_structure(self) -> Dict[str, Any]:
        """Analyze message structure patterns."""
        single_word = sum(1 for msg in self.user_messages if len(msg.split()) == 1)
        short_msgs = sum(1 for msg in self.user_messages if len(msg.split()) <= 3)
        long_msgs = sum(1 for msg in self.user_messages if len(msg.split()) > 10)
        
        return {
            'single_word_ratio': round(single_word / len(self.user_messages), 2),
            'short_message_ratio': round(short_msgs / len(self.user_messages), 2),
            'long_message_ratio': round(long_msgs / len(self.user_messages), 2),
            'prefers_short_messages': short_msgs > long_msgs
        }
    
    def _analyze_language(self) -> Dict[str, Any]:
        """Analyze language patterns and vocabulary."""
        all_text = ' '.join(self.user_messages).lower()
        words = re.findall(r'\b\w+\b', all_text)
        
        # Common abbreviations and slang
        abbreviations = re.findall(r'\b(lol|omg|btw|tbh|nvm|idk|imo|fyi|asap|ttyl|brb|wtf|smh|irl|dm|rn|af|fr|ngl)\b', all_text)
        slang = re.findall(r'\b(gonna|wanna|gotta|kinda|sorta|yeah|yep|nah|sup|hey|yo|dude|bro|sis|bestie|lowkey|highkey|deadass|facts|bet)\b', all_text)
        
        return {
            'total_words': len(words),
            'unique_words': len(set(words)),
            'vocabulary_richness': round(len(set(words)) / len(words), 2) if words else 0,
            'uses_abbreviations': len(abbreviations) > 0,
            'abbreviation_frequency': round(len(abbreviations) / len(words), 3) if words else 0,
            'uses_slang': len(slang) > 0,
            'slang_frequency': round(len(slang) / len(words), 3) if words else 0,
            'most_common_words': Counter(words).most_common(10)
        }
    
    def _analyze_emotional_style(self) -> Dict[str, Any]:
        """Analyze emotional expression patterns."""
        # Simple sentiment indicators
        positive_words = ['good', 'great', 'awesome', 'cool', 'nice', 'love', 'like', 'happy', 'fun', 'yes', 'yeah']
        negative_words = ['bad', 'hate', 'no', 'nah', 'sucks', 'terrible', 'awful', 'annoying', 'sad', 'mad']
        
        all_text = ' '.join(self.user_messages).lower()
        positive_count = sum(all_text.count(word) for word in positive_words)
        negative_count = sum(all_text.count(word) for word in negative_words)
        
        enthusiasm_indicators = sum(1 for msg in self.user_messages if '!' in msg or 'excited' in msg.lower() or 'amazing' in msg.lower())
        
        return {
            'positive_indicators': positive_count,
            'negative_indicators': negative_count,
            'enthusiasm_level': round(enthusiasm_indicators / len(self.user_messages), 2),
            'emotional_style': self._determine_emotional_style(positive_count, negative_count, enthusiasm_indicators)
        }
    
    def _determine_emotional_style(self, positive: int, negative: int, enthusiasm: int) -> str:
        """Determine emotional communication style."""
        if enthusiasm > len(self.user_messages) * 0.3:
            return 'enthusiastic'
        elif positive > negative * 2:
            return 'positive'
        elif negative > positive * 2:
            return 'direct'
        else:
            return 'balanced'
    
    def _analyze_response_patterns(self) -> Dict[str, Any]:
        """Analyze how the user responds in conversations."""
        if not self.all_messages:
            return {}
        
        user_response_times = []
        user_initiations = 0
        
        for i, msg in enumerate(self.all_messages):
            if msg.get('sender') == 'me':
                if i == 0 or self.all_messages[i-1].get('sender') != 'me':
                    # This is either the first message or a response/initiation
                    if i == 0 or self.all_messages[i-1].get('sender') == 'contact':
                        # This is a response
                        pass
                    else:
                        # This is an initiation
                        user_initiations += 1
        
        user_messages_count = sum(1 for msg in self.all_messages if msg.get('sender') == 'me')
        
        return {
            'initiation_ratio': round(user_initiations / user_messages_count, 2) if user_messages_count > 0 else 0,
            'prefers_responding': user_initiations < user_messages_count / 2,
            'conversation_style': 'initiator' if user_initiations > user_messages_count / 2 else 'responder'
        }
    
    def _analyze_timing(self) -> Dict[str, Any]:
        """Analyze timing patterns from message timestamps."""
        # This would need actual timestamp analysis
        # For now, return basic structure
        return {
            'has_timing_data': False,
            'message_frequency': 'unknown'
        }
    
    def _get_representative_examples(self) -> List[str]:
        """Get representative examples of user's messaging style."""
        if len(self.user_messages) <= 5:
            return self.user_messages
        
        # Get a mix of short, medium, and long messages
        sorted_by_length = sorted(self.user_messages, key=len)
        
        examples = []
        if len(sorted_by_length) >= 3:
            examples.append(sorted_by_length[len(sorted_by_length)//4])  # Short
            examples.append(sorted_by_length[len(sorted_by_length)//2])  # Medium
            examples.append(sorted_by_length[3*len(sorted_by_length)//4])  # Long
        
        # Add 2-3 most recent messages
        examples.extend(self.user_messages[-2:])
        
        return list(set(examples))[:5]  # Remove duplicates and limit to 5
    
    def _generate_style_recommendations(self) -> List[str]:
        """Generate recommendations for AI message generation."""
        recommendations = []
        
        # Basic stats analysis
        stats = self._analyze_basic_stats()
        if stats['average_length'] < 20:
            recommendations.append("Keep messages short and concise")
        elif stats['average_length'] > 100:
            recommendations.append("User tends to write longer, more detailed messages")
        
        # Formatting analysis
        formatting = self._analyze_formatting()
        
        if formatting['capitalization']['capital_style'] == 'rare':
            recommendations.append("Use minimal capitalization, even at sentence starts")
        elif formatting['capitalization']['capital_style'] == 'consistent':
            recommendations.append("Always capitalize sentence starts properly")
        
        if formatting['punctuation']['punctuation_style'] == 'minimal':
            recommendations.append("Avoid ending punctuation on most messages")
        elif formatting['punctuation']['punctuation_style'] == 'expressive':
            recommendations.append("Use exclamation points for enthusiasm")
        
        if formatting['emojis']['emoji_style'] == 'frequent':
            recommendations.append("Include emojis regularly to match user's style")
        elif formatting['emojis']['emoji_style'] == 'none':
            recommendations.append("Avoid using emojis")
        
        # Language analysis
        language = self._analyze_language()
        if language['uses_abbreviations']:
            recommendations.append("Use common text abbreviations like 'lol', 'btw', etc.")
        if language['uses_slang']:
            recommendations.append("Include casual slang and informal language")
        
        return recommendations


def analyze_contact_style(contact_name: str, data_folder: str = "data") -> Optional[Dict[str, Any]]:
    """
    Analyze a contact's messaging style from their recent interactions file.
    
    Args:
        contact_name: Name of the contact (folder name)
        data_folder: Path to the data folder containing contact directories
    
    Returns:
        Style analysis dictionary or None if file not found
    """
    # Sanitize contact name for file path
    safe_name = re.sub(r'[\\/*?:"<>|]', '_', contact_name)
    contact_dir = os.path.join(data_folder, safe_name)
    recent_interactions_path = os.path.join(contact_dir, 'conversation_recent_interactions.json')
    
    if not os.path.exists(recent_interactions_path):
        return None
    
    try:
        with open(recent_interactions_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        analyzer = MessageStyleAnalyzer(data)
        return analyzer.get_comprehensive_style_analysis()
        
    except Exception as e:
        print(f"Error analyzing style for {contact_name}: {str(e)}")
        return None


if __name__ == "__main__":
    # Example usage
    import sys
    
    if len(sys.argv) > 1:
        contact_name = sys.argv[1]
        result = analyze_contact_style(contact_name)
        
        if result:
            print(f"\n=== Style Analysis for {contact_name} ===")
            print(json.dumps(result, indent=2))
        else:
            print(f"Could not analyze style for {contact_name}")
    else:
        print("Usage: python style_analyzer.py 'Contact Name'") 