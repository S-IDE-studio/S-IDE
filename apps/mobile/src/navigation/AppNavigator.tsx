import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type React from "react";
import { ConnectScreen } from "../screens/ConnectScreen";
import { DecksScreen } from "../screens/DecksScreen";
import { EditorScreen } from "../screens/EditorScreen";
import { FilesScreen } from "../screens/FilesScreen";
import { TerminalScreen } from "../screens/TerminalScreen";
import { TerminalsScreen } from "../screens/TerminalsScreen";
import { WorkspaceScreen } from "../screens/WorkspaceScreen";
import { WorkspacesScreen } from "../screens/WorkspacesScreen";

export type RootStackParamList = {
  Connect: undefined;
  Workspaces: undefined;
  Workspace: { workspaceId: string; workspaceName?: string };
  Files: { workspaceId: string; path?: string };
  Editor: { workspaceId: string; path: string };
  Decks: { workspaceId: string };
  Terminals: { deckId: string; deckName?: string };
  Terminal: { terminalId: string; title: string };
};

// Keep stack typing loose for now: screens are implemented with pragmatic `any` props.
const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Connect"
        screenOptions={{
          headerStyle: { backgroundColor: "#1a1a1a" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { color: "#ffffff" },
        }}
      >
        <Stack.Screen
          name="Connect"
          component={ConnectScreen as any}
          options={{ title: "Connect" }}
        />
        <Stack.Screen
          name="Workspaces"
          component={WorkspacesScreen as any}
          options={{ title: "Workspaces" }}
        />
        <Stack.Screen
          name="Workspace"
          component={WorkspaceScreen as any}
          options={({ route }: { route: any }) => ({
            title: route.params.workspaceName || "Workspace",
          })}
        />
        <Stack.Screen name="Files" component={FilesScreen as any} options={{ title: "Files" }} />
        <Stack.Screen
          name="Editor"
          component={EditorScreen as any}
          options={({ route }: { route: any }) => ({
            title: route.params.path.split("/").pop() || "Editor",
          })}
        />
        <Stack.Screen name="Decks" component={DecksScreen as any} options={{ title: "Decks" }} />
        <Stack.Screen
          name="Terminals"
          component={TerminalsScreen as any}
          options={({ route }: { route: any }) => ({ title: route.params.deckName || "Terminals" })}
        />
        <Stack.Screen
          name="Terminal"
          component={TerminalScreen as any}
          options={({ route }: { route: any }) => ({ title: route.params.title })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
