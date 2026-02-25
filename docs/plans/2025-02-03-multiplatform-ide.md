# Multiplatform IDE Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deck IDEをWeb PWA、React Nativeモバイル、Tauriデスクトップの3プラットフォーム対応に移行する

**Architecture:**
- **共通レイヤー**: `packages/ui`（Web/モバイル共有UI）、`packages/native`（React Native固有コンポーネント）
- **プラットフォーム**: `apps/web`（PWA対応）、`apps/mobile`（React Native新規）、`apps/desktop`（Electron→Tauri移行）
- **サーバー**: 既存のローカルNode.jsサーバーを維持

**Tech Stack:**
- Web: React + Vite + PWA (vite-plugin-pwa)
- Mobile: React Native + Expo
- Desktop: Tauri 2.0 + Rust
- Shared: React components (Web/Native)

---

## Phase 1: 共通UIコンポーネントパッケージ作成

### Task 1: packages/ui パッケージ作成

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/Button.tsx`
- Create: `packages/ui/src/Modal.tsx`
- Create: `packages/ui/src/Input.tsx`
- Create: `packages/ui/src/Select.tsx`
- Create: `packages/ui/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@deck-ide/ui",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "peerDependencies": {
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "typescript": "^5.6.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create Button.tsx**

```tsx
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'bg-transparent text-gray-300 hover:bg-gray-800 focus:ring-gray-500'
  };
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
```

**Step 4: Create Modal.tsx**

```tsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = ''
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      const modal = modalRef.current;
      if (modal) {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        if (firstElement) firstElement.focus();
      }
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className={`bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 id="modal-title" className="text-xl font-semibold text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
};
```

**Step 5: Create Input.tsx**

```tsx
import React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  size = 'md',
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-3 text-lg'
  };

  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={inputId} className="mb-1 text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${sizeClasses[size]} ${className}`}
        {...props}
      />
      {error && <span className="mt-1 text-sm text-red-400">{error}</span>}
    </div>
  );
};
```

**Step 6: Create Select.tsx**

```tsx
import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  options: SelectOption[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  size = 'md',
  options,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-4 py-3 text-lg'
  };

  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={selectId} className="mb-1 text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 text-sm text-red-400">{error}</span>}
    </div>
  );
};
```

**Step 7: Create index.ts**

```tsx
export { Button } from './Button';
export type { ButtonProps } from './Button';
export { Modal } from './Modal';
export type { ModalProps } from './Modal';
export { Input } from './Input';
export type { InputProps } from './Input';
export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';
```

**Step 8: Build and commit**

```bash
cd packages/ui
pnpm install
pnpm run build
cd ../..
git add packages/ui
git commit -m "feat: add shared UI components package"
```

---

## Phase 2: PWA化

### Task 2: WebアプリをPWA対応

**Files:**
- Create: `apps/web/public/sw.js`
- Create: `apps/web/public/manifest.json`
- Modify: `apps/web/index.html`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/package.json`

**Step 1: Create manifest.json**

Create: `apps/web/public/manifest.json`

```json
{
  "name": "Deck IDE",
  "short_name": "DeckIDE",
  "description": "A modern IDE for development",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#2563eb",
  "orientation": "any",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Step 2: Create Service Worker**

Create: `apps/web/public/sw.js`

```javascript
const CACHE_NAME = 'deck-ide-v1';
const urlsToCache = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
```

**Step 3: Update index.html**

Modify: `apps/web/index.html`

Add to `<head>`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#2563eb" />
```

Add before `</body>`:
```html
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}
</script>
```

**Step 4: Update vite.config.ts**

Modify: `apps/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  }
});
```

**Step 5: Add PWA plugin to package.json**

Modify: `apps/web/package.json`

```json
{
  "devDependencies": {
    "vite-plugin-pwa": "^0.20.0"
  }
}
```

**Step 6: Update vite.config.ts with PWA plugin**

Modify: `apps/web/vite.config.ts` (add PWA plugin)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Deck IDE',
        short_name: 'DeckIDE',
        description: 'A modern IDE for development',
        theme_color: '#2563eb',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  // ... rest of config
});
```

**Step 7: Commit**

```bash
git add apps/web
git commit -m "feat: add PWA support to web app"
```

---

## Phase 3: React Nativeモバイルアプリ

### Task 3: React Nativeプロジェクト作成

**Files:**
- Create: `apps/mobile/App.tsx`
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/src/screens/HomeScreen.tsx`
- Create: `apps/mobile/src/screens/TerminalScreen.tsx`
- Create: `apps/mobile/src/screens/VibesScreen.tsx`
- Create: `apps/mobile/src/navigation/AppNavigator.tsx`
- Create: `apps/mobile/src/components/TerminalCard.tsx`
- Create: `apps/mobile/src/components/VibesInput.tsx`
- Create: `apps/mobile/src/api/client.ts`

**Step 1: Create package.json**

Create: `apps/mobile/package.json`

```json
{
  "name": "deck-ide-mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "build": "expo build"
  },
  "dependencies": {
    "@deck-ide/shared": "file:../../packages/shared",
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "expo-status-bar": "~1.12.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "react-native-safe-area-context": "4.10.0",
    "react-native-screens": "~3.31.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@types/react": "~18.2.45",
    "typescript": "^5.1.3"
  },
  "private": true
}
```

**Step 2: Create app.json**

Create: `apps/mobile/app.json`

```json
{
  "expo": {
    "name": "Deck IDE",
    "slug": "deck-ide",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1a1a1a"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.deck.ide"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1a1a"
      },
      "package": "com.deck.ide"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router"
    ]
  }
}
```

**Step 3: Create tsconfig.json**

Create: `apps/mobile/tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
```

**Step 4: Create babel.config.js**

Create: `apps/mobile/babel.config.js`

```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['expo-router/babel'],
  };
};
```

**Step 5: Create API client**

Create: `apps/mobile/src/api/client.ts`

```typescript
export class DeckIDEClient {
  private baseUrl: string;
  private wsUrl: string;

  constructor(serverUrl: string) {
    this.baseUrl = `${serverUrl}/api`;
    this.wsUrl = `${serverUrl.replace('http', 'ws')}/ws`;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as T;
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as T;
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json() as T;
  }

  connectWebSocket(token: string, callbacks: {
    onMessage: (data: string) => void;
    onError: (error: Event) => void;
    onClose: () => void;
  }): WebSocket {
    const ws = new WebSocket(`${this.wsUrl}?token=${token}`);

    ws.onmessage = (event) => {
      callbacks.onMessage(event.data);
    };

    ws.onerror = (error) => {
      callbacks.onError(error);
    };

    ws.onclose = () => {
      callbacks.onClose();
    };

    return ws;
  }

  async getWsToken(terminalId: string): Promise<string> {
    return this.post<{ token: string }>('/ws/token', { terminalId })
      .then(r => r.token);
  }
}

let clientInstance: DeckIDEClient | null = null;

export function getClient(serverUrl?: string): DeckIDEClient {
  if (!clientInstance && serverUrl) {
    clientInstance = new DeckIDEClient(serverUrl);
  }
  if (!clientInstance) {
    throw new Error('Client not initialized. Provide serverUrl on first call.');
  }
  return clientInstance;
}

export function setServerUrl(serverUrl: string): void {
  clientInstance = new DeckIDEClient(serverUrl);
}
```

**Step 6: Create TerminalCard component**

Create: `apps/mobile/src/components/TerminalCard.tsx`

```tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export interface TerminalCardProps {
  id: string;
  title: string;
  status: 'running' | 'stopped';
  onPress: () => void;
}

export const TerminalCard: React.FC<TerminalCardProps> = ({
  id,
  title,
  status,
  onPress
}) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={[
          styles.statusDot,
          status === 'running' ? styles.statusRunning : styles.statusStopped
        ]} />
      </View>
      <Text style={styles.id}>ID: {id.slice(0, 8)}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusRunning: {
    backgroundColor: '#22c55e'
  },
  statusStopped: {
    backgroundColor: '#ef4444'
  },
  id: {
    color: '#9ca3af',
    fontSize: 12
  }
});
```

**Step 7: Create VibesInput component**

Create: `apps/mobile/src/components/VibesInput.tsx`

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';

export interface VibesInputProps {
  onSend: (prompt: string) => void;
  placeholder?: string;
}

export const VibesInput: React.FC<VibesInputProps> = ({
  onSend,
  placeholder = 'Enter vibe coding prompt...'
}) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) {
      Alert.alert('Error', 'Please enter a prompt');
      return;
    }
    onSend(text.trim());
    setText('');
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        multiline
        maxLength={500}
      />
      <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#3a3a3a',
    padding: 16
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    minHeight: 100,
    textAlignVertical: 'top'
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center'
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  }
});
```

**Step 8: Create HomeScreen**

Create: `apps/mobile/src/screens/HomeScreen.tsx`

```tsx
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
```

**Step 9: Create TerminalScreen**

Create: `apps/mobile/src/screens/TerminalScreen.tsx`

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { getClient } from '../api/client';

export interface TerminalScreenProps {
  terminalId: string;
  title: string;
}

export const TerminalScreen: React.FC<TerminalScreenProps> = ({ terminalId, title }) => {
  const [output, setOutput] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [terminalId]);

  const connectWebSocket = async () => {
    try {
      const client = getClient();
      const token = await client.getWsToken(terminalId);

      const ws = client.connectWebSocket(token, {
        onMessage: (data) => {
          setOutput((prev) => [...prev, data]);
        },
        onError: (error) => {
          console.error('WebSocket error:', error);
          setConnected(false);
        },
        onClose: () => {
          setConnected(false);
        }
      });

      ws.onopen = () => {
        setConnected(true);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={[
          styles.statusIndicator,
          connected ? styles.connected : styles.disconnected
        ]}>
          <Text style={styles.statusText}>
            {connected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>
      <ScrollView style={styles.output}>
        {output.map((line, index) => (
          <Text key={index} style={styles.outputLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a'
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600'
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  connected: {
    backgroundColor: '#22c55e'
  },
  disconnected: {
    backgroundColor: '#ef4444'
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12
  },
  output: {
    flex: 1,
    padding: 8
  },
  outputLine: {
    color: '#e5e7eb',
    fontFamily: 'monospace',
    fontSize: 12
  }
});
```

**Step 10: Create VibesScreen**

Create: `apps/mobile/src/screens/VibesScreen.tsx`

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { VibesInput } from '../components/VibesInput';
import { getClient } from '../api/client';

export interface VibesScreenProps {
  terminalId: string;
}

export const VibesScreen: React.FC<VibesScreenProps> = ({ terminalId }) => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const handleSend = async (prompt: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);

    try {
      const client = getClient();
      // Send vibe coding prompt to terminal
      // API endpoint to be implemented
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Vibe coding sent to terminal!'
      }]);
    } catch (error) {
      Alert.alert('Error', 'Failed to send vibe coding prompt');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.messages}>
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage
            ]}
          >
            <Text style={[
              styles.messageText,
              message.role === 'user' ? styles.userMessageText : styles.assistantMessageText
            ]}>
              {message.content}
            </Text>
          </View>
        ))}
      </ScrollView>
      <VibesInput onSend={handleSend} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a'
  },
  messages: {
    flex: 1,
    padding: 16
  },
  messageBubble: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  userMessage: {
    backgroundColor: '#2563eb',
    alignSelf: 'flex-end'
  },
  assistantMessage: {
    backgroundColor: '#3a3a3a',
    alignSelf: 'flex-start'
  },
  messageText: {
    fontSize: 14
  },
  userMessageText: {
    color: '#ffffff'
  },
  assistantMessageText: {
    color: '#e5e7eb'
  }
});
```

**Step 11: Create AppNavigator**

Create: `apps/mobile/src/navigation/AppNavigator.tsx`

```tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { TerminalScreen } from '../screens/TerminalScreen';
import { VibesScreen } from '../screens/VibesScreen';

export type RootStackParamList = {
  Home: undefined;
  Terminal: { terminalId: string; title: string };
  Vibes: { terminalId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a1a' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { color: '#ffffff' }
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Deck IDE' }}
        />
        <Stack.Screen
          name="Terminal"
          component={TerminalScreen}
          options={({ route }) => ({ title: route.params.title })}
        />
        <Stack.Screen
          name="Vibes"
          component={VibesScreen}
          options={{ title: 'Vibe Coding' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

**Step 12: Create App.tsx entry point**

Create: `apps/mobile/App.tsx`

```tsx
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}
```

**Step 13: Create assets directory structure**

```bash
mkdir -p apps/mobile/assets
# Placeholder for icons - user needs to add actual icon files
```

**Step 14: Install dependencies and test**

```bash
cd apps/mobile
pnpm install
```

**Step 15: Commit**

```bash
git add apps/mobile
git commit -m "feat: add React Native mobile app"
```

---

## Phase 4: Electron→Tauri移行

### Task 4: Tauriプロジェクトセットアップ

**Files:**
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/src/commands.rs`
- Create: `apps/desktop/src-tauri/src/server.rs`
- Create: `apps/desktop/src-tauri/src/window.rs`
- Modify: `apps/desktop/package.json`
- Delete: `apps/desktop/src/main.cjs`
- Delete: `apps/desktop/src/preload.cjs`
- Delete: `apps/desktop/src/server-manager.cjs`
- Delete: `apps/desktop/src/window-manager.cjs`
- Delete: `apps/desktop/src/auto-updater.cjs`
- Delete: `apps/desktop/src/config-manager.cjs`
- Delete: `apps/desktop/src/log-manager.cjs`
- Delete: `apps/desktop/scripts/prepare.cjs`

**Step 1: Delete Electron files**

```bash
# Remove Electron-specific files
rm -rf apps/desktop/src/*.cjs
rm -rf apps/desktop/scripts
```

**Step 2: Create Cargo.toml**

Create: `apps/desktop/src-tauri/Cargo.toml`

```toml
[package]
name = "deck-ide-desktop"
version = "2.0.0"
description = "Deck IDE Desktop"
authors = ["Deck IDE"]
license = "MIT"
repository = ""
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = ["shell-open"] }
tauri-plugin-shell = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
sysinfo = "0.30"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

**Step 3: Create tauri.conf.json**

Create: `apps/desktop/src-tauri/tauri.conf.json`

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Deck IDE",
  "version": "2.0.0",
  "identifier": "com.deck.ide",
  "build": {
    "beforeDevCommand": "pnpm run dev:web",
    "beforeBuildCommand": "pnpm run build:web",
    "frontendDist": "../../web/dist",
    "devUrl": "http://localhost:3000"
  },
  "app": {
    "windows": [
      {
        "title": "Deck IDE",
        "width": 1400,
        "height": 900,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": ["icons/icon.ico"]
  },
  "plugins": {}
}
```

**Step 4: Create main.rs**

Create: `apps/desktop/src-tauri/src/main.rs`

```rust
// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod server;
mod window;

use tauri::Manager;
use std::sync::Mutex;

struct ServerState(std::Mutex<Option<server::ServerHandle>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ServerState(std::Mutex::new(None)))
        .setup(|app| {
            // Initialize window state
            window::setup(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_server,
            commands::stop_server,
            commands::get_server_status,
            commands::get_server_logs,
            commands::open_file_dialog,
            commands::open_folder_dialog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 5: Create commands.rs**

Create: `apps/desktop/src-tauri/src/commands.rs`

```rust
use crate::server::{self, ServerHandle};
use crate::ServerState;
use tauri::{AppHandle, State, Window};
use std::fs;

#[tauri::command]
pub async fn start_server(
    state: State<'_, ServerState>,
    port: u16,
) -> Result<String, String> {
    let mut server_state = state.0.lock().unwrap();
    if server_state.is_some() {
        return Err("Server is already running".to_string());
    }

    let handle = server::start(port).await.map_err(|e| e.to_string())?;
    *server_state = Some(handle);
    Ok(format!("Server started on port {}", port))
}

#[tauri::command]
pub async fn stop_server(state: State<'_, ServerState>) -> Result<String, String> {
    let mut server_state = state.0.lock().unwrap();
    if server_state.is_none() {
        return Err("Server is not running".to_string());
    }

    let handle = server_state.take().unwrap();
    server::stop(handle).await.map_err(|e| e.to_string())?;
    Ok("Server stopped".to_string())
}

#[tauri::command]
pub async fn get_server_status(state: State<'_, ServerState>) -> Result<ServerStatus, String> {
    let server_state = state.0.lock().unwrap();
    Ok(ServerStatus {
        running: server_state.is_some(),
        port: 8080,
    })
}

#[tauri::command]
pub async fn get_server_logs() -> Result<Vec<String>, String> {
    // Return logs from log file
    Ok(vec!["Log line 1".to_string(), "Log line 2".to_string()])
}

#[tauri::command]
pub async fn open_file_dialog(window: Window) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = window
        .dialog()
        .file()
        .pick_file()
        .await
        .map_err(|e| e.to_string())?;
    Ok(file_path.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn open_folder_dialog(window: Window) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder_path = window
        .dialog()
        .file()
        .pick_folder()
        .await
        .map_err(|e| e.to_string())?;
    Ok(folder_path.map(|p| p.to_string_lossy().to_string()))
}

#[derive(serde::Serialize)]
pub struct ServerStatus {
    running: bool,
    port: u16,
}
```

**Step 6: Create server.rs**

Create: `apps/desktop/src-tauri/src/server.rs`

```rust
use tokio::process::{Command, Child};
use std::path::PathBuf;

pub struct ServerHandle {
    child: Child,
}

pub async fn start(port: u16) -> Result<ServerHandle, String> {
    let server_path = get_server_executable_path().await?;

    let child = Command::new(&server_path)
        .arg("--port")
        .arg(port.to_string())
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    Ok(ServerHandle { child })
}

pub async fn stop(handle: ServerHandle) -> Result<(), String> {
    let _ = handle.child.kill().await;
    Ok(())
}

async fn get_server_executable_path() -> Result<PathBuf, String> {
    // In development, use the local server
    // In production, use the bundled server
    let mut exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get exe path: {}", e))?;

    exe_path.pop(); // Remove exe name
    exe_path.push("server");

    #[cfg(windows)]
    {
        exe_path.set_extension("exe");
    }

    Ok(exe_path)
}
```

**Step 7: Create window.rs**

Create: `apps/desktop/src-tauri/src/window.rs`

```rust
use tauri::{AppHandle, Manager};

const WINDOW_LABEL: &str = "main";

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Get the main window
    let window = app.get_webview_window(WINDOW_LABEL)
        .ok_or("Main window not found")?;

    // Setup window behavior
    window.on_window_event(|event| match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            // Prevent window from closing, hide to tray instead
            api.prevent_close();
            // TODO: Implement tray icon
        }
        _ => {}
    });

    Ok(())
}
```

**Step 8: Create build.rs**

Create: `apps/desktop/src-tauri/build.rs`

```rust
fn main() {
    tauri_build::build()
}
```

**Step 9: Update package.json**

Modify: `apps/desktop/package.json`

```json
{
  "name": "deck-ide-desktop",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@deck-ide/shared": "file:../../packages/shared"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

**Step 10: Install dependencies and test**

```bash
cd apps/desktop
npm install
cargo install tauri-cli --version "^2.0.0"
```

**Step 11: Commit**

```bash
git add apps/desktop
git commit -m "feat: migrate from Electron to Tauri"
```

---

## Phase 5: ルートpackage.json更新

### Task 5: ルートスクリプト更新

**Files:**
- Modify: `package.json`

**Step 1: Update root package.json**

Modify: `package.json`

```json
{
  "name": "deck-ide",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev:web",
    "dev:web": "npm --workspace apps/web run dev",
    "dev:server": "npm --workspace apps/server run dev",
    "dev:desktop": "npm --workspace apps/desktop run dev",
    "dev:mobile": "npm --workspace apps/mobile run start",
    "build": "npm run build:web && npm run build:server && npm run build:desktop",
    "build:web": "npm --workspace apps/web run build",
    "build:server": "npm --workspace apps/server run build",
    "build:desktop": "npm --workspace apps/desktop run build",
    "build:ui": "npm --workspace @deck-ide/ui run build",
    "build:mobile": "npm --workspace apps/mobile run build"
  }
}
```

**Step 2: Install all dependencies**

```bash
pnpm install
```

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: update root scripts for multiplatform support"
```

---

## Summary

This implementation plan transforms Deck IDE from an Electron-only desktop app to a multiplatform IDE:

1. **Phase 1**: Creates shared UI components package (`@deck-ide/ui`)
2. **Phase 2**: Adds PWA support to the web app
3. **Phase 3**: Creates React Native mobile app for terminal management
4. **Phase 4**: Migrates from Electron to Tauri for desktop
5. **Phase 5**: Updates root scripts for all platforms

### Testing Checklist

After implementation:

- [ ] Web PWA installs and works offline
- [ ] Mobile app connects to local server via WebSocket
- [ ] Tauri desktop starts server and displays web UI
- [ ] Shared UI components work across Web/Mobile
- [ ] All platforms can connect to the same local server

### Migration Notes

- **Server**: No changes needed - continues as Node.js local server
- **Data**: All data remains local to user's machine
- **Electron users**: Will need to install new Tauri-based desktop app
