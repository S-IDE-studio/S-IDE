import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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

export interface TerminalScreenProps {
  terminalId: string;
  title: string;
}

const MAX_BUFFER_CHARS = 80_000;

export const TerminalScreen: React.FC<TerminalScreenProps> = ({ terminalId, title }) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [buffer, setBuffer] = useState("");
  const [input, setInput] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const statusText = useMemo(() => {
    if (connecting) return "Connecting";
    return connected ? "Connected" : "Disconnected";
  }, [connecting, connected]);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setConnecting(true);
      setConnected(false);

      try {
        const client = getClient();
        const token = await client.getWsToken();
        if (cancelled) return;

        const ws = client.connectTerminalWebSocket(terminalId, token);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnecting(false);
          setConnected(true);
        };

        ws.onmessage = (event) => {
          const data = typeof event.data === "string" ? event.data : "";
          if (!data) return;
          setBuffer((prev) => {
            const next = prev + data;
            if (next.length <= MAX_BUFFER_CHARS) return next;
            return next.slice(next.length - MAX_BUFFER_CHARS);
          });
          requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
        };

        ws.onerror = () => {
          setConnecting(false);
          setConnected(false);
        };

        ws.onclose = () => {
          setConnecting(false);
          setConnected(false);
        };
      } catch {
        setConnecting(false);
        setConnected(false);
      }
    }

    connect();
    return () => {
      cancelled = true;
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    };
  }, [terminalId]);

  const send = (text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(text);
  };

  const handleSubmit = () => {
    const text = input;
    if (!text) return;
    setInput("");
    // Basic: send the line then Enter. (This is not a full terminal emulator.)
    send(text);
    send("\r");
  };

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
          <Text style={styles.subTitle}>{statusText}</Text>
        </View>
        {connecting ? <ActivityIndicator size="small" color="#fff" /> : null}
        <View style={[styles.statusPill, connected ? styles.connected : styles.disconnected]}>
          <Text style={styles.statusPillText}>{connected ? "LIVE" : "OFF"}</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.output} contentContainerStyle={styles.outputInner}>
        <Text selectable style={styles.outputText}>
          {buffer || (connecting ? "Connecting..." : "No output")}
        </Text>
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={connected ? "Type command..." : "Not connected"}
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
          editable={connected}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, !connected || !input ? styles.buttonDisabled : null]}
          disabled={!connected || !input}
          onPress={handleSubmit}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0c",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#202024",
    backgroundColor: "#121214",
  },
  title: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  subTitle: {
    color: "#a1a1aa",
    marginTop: 2,
    fontSize: 12,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  connected: {
    backgroundColor: "#16a34a",
  },
  disconnected: {
    backgroundColor: "#ef4444",
  },
  statusPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  output: {
    flex: 1,
  },
  outputInner: {
    padding: 12,
  },
  outputText: {
    color: "#e5e7eb",
    fontSize: 12,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#202024",
    backgroundColor: "#121214",
  },
  input: {
    flex: 1,
    backgroundColor: "#0f0f12",
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#23232a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

