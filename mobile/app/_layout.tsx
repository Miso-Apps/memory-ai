import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { ThemeProvider, useTheme } from '../constants/ThemeContext';
import '../i18n'; // initialize i18n
import { agentApi } from '../services/api';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await agentApi.registerPushToken(tokenData.data);
  } catch (e) {
    console.warn('Push token registration failed:', e);
  }
}

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

  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotifications();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const insightId = response.notification.request.content.data?.agent_insight_id as string | undefined;
      if (insightId) {
        router.push(`/chat?agent_insight_id=${insightId}`);
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

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
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  if (!fontsLoaded) return null;

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
