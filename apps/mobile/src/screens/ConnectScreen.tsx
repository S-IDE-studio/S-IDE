import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { getClient, setClient, type ServerConfig } from "../api/client";
import { loadServerConfig, saveServerConfig } from "../storage/session";

type Props = {
  navigation: any;
};

function normalizeUrlInput(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

export const ConnectScreen: React.FC<Props> = ({ navigation }) => {
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canConnect = useMemo(() => {
    return Boolean(serverUrl.trim()) && Boolean(username.trim()) && Boolean(password);
  }, [serverUrl, username, password]);

  useEffect(() => {
    loadServerConfig()
      .then((cfg) => {
        if (!cfg) return;
        setServerUrl(cfg.serverUrl);
        setUsername(cfg.username);
        setPassword(cfg.password);
      })
      .catch(() => {});
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const config: ServerConfig = {
        serverUrl: normalizeUrlInput(serverUrl),
        username: username.trim(),
        password,
      };
      setClient(config);

      // Validate credentials by calling a protected endpoint.
      const client = getClient();
      await client.get("/workspaces");

      await saveServerConfig(config);
      navigation.replace("Workspaces");
    } catch (e: any) {
      const status = (e as any)?.status;
      if (status === 401) {
        Alert.alert("Auth failed", "ユーザー名/パスワードが違う可能性があります。");
      } else {
        Alert.alert(
          "Connection failed",
          "URLとTailscaleの接続状態を確認してください。DNSが引けない場合は、Tailscaleアプリ設定の「Use Tailscale DNS」を有効にしてください。"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>S-IDE Mobile</Text>
        <Text style={styles.subtitle}>Tailscale経由で自宅PCのIDEに接続</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Tailscale</Text>
        <Text style={styles.hint}>
          スマホにTailscaleアプリをインストールしてログインし、この端末がConnectedになっていることを確認してください。
        </Text>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => Linking.openURL("https://tailscale.com/download").catch(() => {})}
        >
          <Text style={styles.secondaryButtonText}>Tailscaleを開く</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>2. Server URL</Text>
        <Text style={styles.hint}>
          DesktopのRemote AccessでStartするとURLが表示されます。そのURLをここに貼り付けてください。
        </Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://uuu.tailxxxx.ts.net"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={async () => {
            try {
              const txt = await Clipboard.getStringAsync();
              if (txt) setServerUrl(normalizeUrlInput(txt));
            } catch {
              // ignore
            }
          }}
        >
          <Text style={styles.secondaryButtonText}>Paste URL</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>3. Basic Auth</Text>
        <Text style={styles.hint}>
          Remote AccessはBasic Authで保護されています。Desktop側の設定と同じユーザー名/パスワードを入力してください。
        </Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="username"
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="password"
          placeholderTextColor="#6b7280"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.primaryButton, !canConnect || loading ? styles.buttonDisabled : null]}
          onPress={handleConnect}
          disabled={!canConnect || loading}
        >
          {loading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.primaryButtonText}>Connecting...</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>Connect</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          つながらない場合: 1) スマホのTailscaleがConnectedか 2) URLが末尾に「.」付きになっていないか 3)
          Tailscale DNS有効化 4) Desktop側でRemote AccessがStart中か を確認してください。
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: "#0f0f0f",
  },
  header: {
    marginTop: 12,
    marginBottom: 18,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#a1a1aa",
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#111113",
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 6,
  },
  hint: {
    color: "#a1a1aa",
    fontSize: 13,
    lineHeight: 18,
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
    marginTop: 6,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#e5e7eb",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  footer: {
    marginTop: 14,
  },
  footerText: {
    color: "#71717a",
    fontSize: 12,
    lineHeight: 16,
  },
});

