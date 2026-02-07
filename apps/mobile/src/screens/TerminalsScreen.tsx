import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getClient } from "../api/client";

type Props = {
  navigation: any;
  route: { params: { deckId: string; deckName?: string } };
};

type TerminalListItem = {
  id: string;
  title: string;
  createdAt: string;
};

export const TerminalsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { deckId } = route.params;

  const [items, setItems] = useState<TerminalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("Terminal");
  const [newCommand, setNewCommand] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = getClient();
      const qs = new URLSearchParams({ deckId }).toString();
      const data = await client.get<TerminalListItem[]>(`/terminals?${qs}`);
      setItems(data);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const createTerminal = useCallback(async () => {
    setCreating(true);
    try {
      const client = getClient();
      const payload: any = { deckId, title: newTitle.trim() || "Terminal" };
      if (newCommand.trim()) payload.command = newCommand;
      const created = await client.post<{ id: string; title: string }>("/terminals", payload);
      await load();
      navigation.navigate("Terminal", { terminalId: created.id, title: created.title });
    } catch (e: any) {
      Alert.alert("Create failed", String(e?.message || e));
    } finally {
      setCreating(false);
    }
  }, [deckId, newTitle, newCommand, navigation, load]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [items]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Terminals</Text>
      <Text style={styles.subtitle}>Deck: {deckId}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>New Terminal</Text>
        <TextInput
          style={styles.input}
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Title"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={newCommand}
          onChangeText={setNewCommand}
          placeholder="Optional command (empty = default shell)"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.primaryButton, creating ? styles.buttonDisabled : null]}
          onPress={createTerminal}
          disabled={creating}
        >
          {creating ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text style={styles.primaryButtonText}>{creating ? "Creating..." : "Create"}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.muted}>Loading...</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>Failed to load</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={load}>
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Terminalがありません。上で作成できます。</Text>
        </View>
      ) : (
        <View style={{ gap: 10, marginTop: 14 }}>
          {sorted.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.item}
              onPress={() => navigation.navigate("Terminal", { terminalId: t.id, title: t.title })}
            >
              <Text style={styles.itemTitle} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={styles.itemSub} numberOfLines={1}>
                {t.id}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  content: { padding: 16, paddingBottom: 24 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#a1a1aa", marginTop: 6, marginBottom: 14, fontSize: 12 },
  muted: { color: "#a1a1aa", marginTop: 8 },
  center: { alignItems: "center", paddingVertical: 24 },
  sectionTitle: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 6,
  },
  card: {
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  input: {
    backgroundColor: "#18181b",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
  item: {
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  itemTitle: { color: "#fff", fontWeight: "800" },
  itemSub: { color: "#a1a1aa", fontSize: 12 },
  errorTitle: { color: "#fff", fontWeight: "800" },
  errorBody: { color: "#fca5a5", fontSize: 12 },
});

