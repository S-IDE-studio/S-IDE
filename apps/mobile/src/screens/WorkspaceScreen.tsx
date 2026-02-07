import type React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { clearClient } from "../api/client";
import { clearServerConfig } from "../storage/session";

type Props = {
  navigation: any;
  route: { params: { workspaceId: string; workspaceName?: string } };
};

export const WorkspaceScreen: React.FC<Props> = ({ navigation, route }) => {
  const { workspaceId, workspaceName } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{workspaceName || "Workspace"}</Text>
      <Text style={styles.subtitle}>何を開きますか？</Text>

      <View style={styles.card}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("Files", { workspaceId, path: "" })}
        >
          <Text style={styles.primaryButtonText}>Files</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("Decks", { workspaceId })}
        >
          <Text style={styles.secondaryButtonText}>Decks / Terminals</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { marginTop: 10 }]}
          onPress={() => {
            Alert.alert("Disconnect", "保存した接続情報を削除して、Connect画面に戻ります。", [
              { text: "Cancel", style: "cancel" },
              {
                text: "OK",
                style: "destructive",
                onPress: async () => {
                  await clearServerConfig().catch(() => {});
                  clearClient();
                  navigation.reset({ index: 0, routes: [{ name: "Connect" }] });
                },
              },
            ]);
          }}
        >
          <Text style={styles.secondaryButtonText}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f", padding: 16 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 8 },
  subtitle: { color: "#a1a1aa", marginTop: 6, marginBottom: 14 },
  card: {
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#e5e7eb", fontWeight: "700" },
});

