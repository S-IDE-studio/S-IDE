import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ServerConfig } from "../api/client";

const KEY = "side-mobile:server-config";

export async function saveServerConfig(config: ServerConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(config));
}

export async function loadServerConfig(): Promise<ServerConfig | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as ServerConfig;
    if (!data?.serverUrl || !data?.username || !data?.password) return null;
    return data;
  } catch {
    return null;
  }
}

export async function clearServerConfig(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
