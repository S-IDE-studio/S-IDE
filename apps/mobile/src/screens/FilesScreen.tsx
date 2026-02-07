import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  route: { params: { workspaceId: string; path?: string } };
};

type FileSystemEntry = {
  name: string;
  path: string;
  type: "dir" | "file";
};

function buildQuery(params: Record<string, string>): string {
  const qs = new URLSearchParams(params);
  return qs.toString();
}

export const FilesScreen: React.FC<Props> = ({ navigation, route }) => {
  const workspaceId = route.params.workspaceId;
  const path = route.params.path || "";

  const [items, setItems] = useState<FileSystemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breadcrumb = useMemo(() => (path ? `/${path}` : "/"), [path]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = getClient();
      const qs = buildQuery({ workspaceId, path });
      const data = await client.get<FileSystemEntry[]>(`/files?${qs}`);
      setItems(data);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, path]);

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
      <Text style={styles.title}>Files</Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {breadcrumb}
      </Text>

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
      ) : (
        <View style={{ gap: 8 }}>
          {path ? (
            <TouchableOpacity
              style={[styles.item, styles.upItem]}
              onPress={() => {
                const parts = path.split("/").filter(Boolean);
                parts.pop();
                navigation.replace("Files", { workspaceId, path: parts.join("/") });
              }}
            >
              <Text style={styles.itemTitle}>..</Text>
              <Text style={styles.itemSub}>parent</Text>
            </TouchableOpacity>
          ) : null}

          {items.map((it) => (
            <TouchableOpacity
              key={it.path}
              style={styles.item}
              onPress={() => {
                if (it.type === "dir") {
                  navigation.push("Files", { workspaceId, path: it.path });
                } else {
                  navigation.navigate("Editor", { workspaceId, path: it.path });
                }
              }}
            >
              <Text style={styles.itemTitle} numberOfLines={1}>
                {it.type === "dir" ? `/${it.name}` : it.name}
              </Text>
              <Text style={styles.itemSub} numberOfLines={1}>
                {it.type}
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
  upItem: { borderStyle: "dashed" },
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

