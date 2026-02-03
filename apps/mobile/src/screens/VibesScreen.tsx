import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { VibesInput } from '../components/VibesInput';
import { getClient } from '../api/client';

export interface VibesScreenProps {
  terminalId: string;
}

export const VibesScreen: React.FC<VibesScreenProps> = ({ terminalId }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const handleSend = async (prompt: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);

    try {
      const client = getClient();
      // Send vibe coding prompt to terminal
      // API endpoint to be implemented
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Vibe coding sent to terminal!'
      }]);
    } catch (error) {
      Alert.alert('Error', 'Failed to send vibe coding prompt');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.messages}>
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage
            ]}
          >
            <Text style={[
              styles.messageText,
              message.role === 'user' ? styles.userMessageText : styles.assistantMessageText
            ]}>
              {message.content}
            </Text>
          </View>
        ))}
      </ScrollView>
      <VibesInput onSend={handleSend} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a'
  },
  messages: {
    flex: 1,
    padding: 16
  },
  messageBubble: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  userMessage: {
    backgroundColor: '#2563eb',
    alignSelf: 'flex-end'
  },
  assistantMessage: {
    backgroundColor: '#3a3a3a',
    alignSelf: 'flex-start'
  },
  messageText: {
    fontSize: 14
  },
  userMessageText: {
    color: '#ffffff'
  },
  assistantMessageText: {
    color: '#e5e7eb'
  }
});
