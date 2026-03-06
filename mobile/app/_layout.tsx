import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { ThemeProvider, useTheme } from '../constants/ThemeContext';
import '../i18n'; // initialize i18n

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loadStoredAuth } = useAuthStore();
  const { loadSettings, loadPreferences } = useSettingsStore();
  const [checking, setChecking] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    Promise.all([
      loadStoredAuth(),
      loadSettings(),
    ]).then(async () => {
      // Only load server preferences when we have a valid authenticated session.
      // Calling it unauthenticated causes a 403 → refresh attempt → spurious logout.
      if (useAuthStore.getState().isAuthenticated) {
        try {
          await loadPreferences();
        } catch {
          // non-blocking — offline or token unexpectedly expired
        }
      }
    }).finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!checking && !isAuthenticated) {
      router.replace('/login');
    }
  }, [checking, isAuthenticated]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function ThemedStack() {
  const { colors, isDark } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="memory/[id]"
        options={{
          headerShown: false,
          presentation: 'modal',
          title: 'Memory Detail',
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <Stack.Screen
        name="capture"
        options={{
          headerShown: false,
          presentation: 'card',
          title: 'Quick Capture',
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <Stack.Screen
        name="dismissed"
        options={{ headerShown: false, presentation: 'modal', title: 'Dismissed' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedStatusBar />
          <AuthGate>
            <ThemedStack />
          </AuthGate>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
