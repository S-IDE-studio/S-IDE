import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type React from "react";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getClient } from "../api/client";
import { TerminalCard } from "../components/TerminalCard";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [serverUrl, setServerUrl] = useState("http://192.168.1.1:8787");
  const [terminals, setTerminals] = useState<Array<{ id: string; title: string; status: string }>>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const loadTerminals = async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getClient(serverUrl);
      const terminals =
        await client.get<Array<{ id: string; title: string; status: string }>>("/terminals");
      setTerminals(terminals);
    } catch (_err) {
      setError("Failed to connect to server. Check your URL.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    loadTerminals();
    setShowSettings(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>S-IDE Mobile</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(!showSettings)}
        >
          <Text style={styles.settingsButtonText}>{showSettings ? "▼" : "⚙"}</Text>
        </TouchableOpacity>
      </View>

      {showSettings && (
        <View style={styles.settingsPanel}>
          <Text style={styles.settingsLabel}>Server URL</Text>
          <TextInput
            style={styles.settingsInput}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.1.1:8787"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Connecting to server...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTerminals}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Terminals ({terminals.length})</Text>
          {terminals.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No terminals found</Text>
              <Text style={styles.emptyHint}>
                Connect to your S-IDE server to see active terminals
              </Text>
            </View>
          ) : (
            terminals.map((terminal) => (
              <TerminalCard
                key={terminal.id}
                id={terminal.id}
                title={terminal.title}
                status={terminal.status as "running" | "stopped"}
                onPress={() =>
                  navigation.navigate("Terminal", {
                    terminalId: terminal.id,
                    title: terminal.title,
                  })
                }
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
  },
  settingsButton: {
    padding: 8,
  },
  settingsButtonText: {
    color: "#a1a1aa",
    fontSize: 18,
  },
  settingsPanel: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
    gap: 12,
  },
  settingsLabel: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  settingsInput: {
    backgroundColor: "#18181b",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  connectButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  connectButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: "#a1a1aa",
    marginTop: 8,
  },
  errorText: {
    color: "#ef4444",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    padding: 16,
    paddingBottom: 8,
  },
  emptyState: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#71717a",
    fontSize: 16,
    marginBottom: 8,
  },
  emptyHint: {
    color: "#52525b",
    fontSize: 14,
    textAlign: "center",
  },
});
