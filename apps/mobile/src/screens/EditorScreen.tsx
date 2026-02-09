import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  route: { params: { workspaceId: string; path: string } };
};

export const EditorScreen: React.FC<Props> = ({ route }) => {
  const { workspaceId, path } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contents, setContents] = useState("");
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => path.split("/").pop() || path, [path]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const client = getClient();
      const qs = new URLSearchParams({ workspaceId, path }).toString();
      const res = await client.get<{ contents: string }>(`/file?${qs}`);
      setContents(res.contents ?? "");
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, path]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const client = getClient();
      await client.put("/file", { workspaceId, path, contents });
      Alert.alert("Saved", title);
    } catch (e: any) {
      Alert.alert("Save failed", String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }, [workspaceId, path, contents, title]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {path}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, saving ? styles.buttonDisabled : null]}
          disabled={saving}
          onPress={save}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text style={styles.primaryButtonText}>{saving ? "Saving" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.muted}>Loading...</Text>
        </View>
      ) : error ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.card}>
            <Text style={styles.errorTitle}>Failed to load</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={load}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <TextInput
          style={styles.editor}
          value={contents}
          onChangeText={setContents}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  header: {
    padding: 12,
    backgroundColor: "#111113",
    borderBottomWidth: 1,
    borderBottomColor: "#27272a",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { color: "#fff", fontSize: 14, fontWeight: "800" },
  subtitle: { color: "#a1a1aa", fontSize: 11, marginTop: 2 },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  buttonDisabled: { opacity: 0.6 },
  editor: {
    flex: 1,
    padding: 12,
    color: "#e5e7eb",
    fontSize: 13,
    backgroundColor: "#0b0b0c",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  center: { alignItems: "center", paddingVertical: 24 },
  muted: { color: "#a1a1aa", marginTop: 8 },
  card: {
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  errorTitle: { color: "#fff", fontWeight: "800" },
  errorBody: { color: "#fca5a5", fontSize: 12 },
});
