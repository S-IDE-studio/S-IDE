import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getClient } from "../api/client";

type Props = {
  navigation: any;
};

type Workspace = {
  id: string;
  name: string;
  path: string;
  createdAt: string;
};

export const WorkspacesScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = getClient();
      const data = await client.get<Workspace[]>("/workspaces");
      setItems(data);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Workspaces</Text>
      <Text style={styles.subtitle}>接続できました。Workspaceを選んでください。</Text>

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
      ) : items.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Workspaceがありません。Desktop側でWorkspaceを追加してから、ここで更新してください。
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((ws) => (
            <TouchableOpacity
              key={ws.id}
              style={styles.item}
              onPress={() =>
                navigation.navigate("Workspace", { workspaceId: ws.id, workspaceName: ws.name })
              }
            >
              <Text style={styles.itemTitle} numberOfLines={1}>
                {ws.name}
              </Text>
              <Text style={styles.itemSub} numberOfLines={1}>
                {ws.path}
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
  subtitle: { color: "#a1a1aa", marginTop: 6, marginBottom: 14 },
  muted: { color: "#a1a1aa", marginTop: 8 },
  center: { alignItems: "center", paddingVertical: 24 },
  card: {
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
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
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
});
