import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { getClient } from '../api/client';
import { TerminalCard } from '../components/TerminalCard';

export const HomeScreen: React.FC = () => {
  const [terminals, setTerminals] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTerminals();
  }, []);

  const loadTerminals = async () => {
    try {
      const client = getClient();
      // Fetch terminals from server
      setLoading(false);
    } catch (err) {
      setError('Failed to load terminals');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Deck IDE</Text>
      <ScrollView style={styles.terminalList}>
        {terminals.length === 0 ? (
          <Text style={styles.emptyText}>No terminals active</Text>
        ) : (
          terminals.map((terminal) => (
            <TerminalCard
              key={terminal.id}
              id={terminal.id}
              title={terminal.title}
              status={terminal.status as 'running' | 'stopped'}
              onPress={() => {}}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a'
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16
  },
  terminalList: {
    flex: 1
  },
  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 32
  },
  errorText: {
    color: '#ef4444'
  }
});
