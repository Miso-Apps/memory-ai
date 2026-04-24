import type { ExpoConfig } from 'expo/config';

declare const process: {
  env: Record<string, string | undefined>;
};

const DEFAULT_GOOGLE_IOS_CLIENT_ID =
  '382213094350-ov6lakaq0vnqhloli563js2683di0caf.apps.googleusercontent.com';

function getIosUrlScheme(clientId: string): string {
  const prefix = '.apps.googleusercontent.com';
  const trimmed = clientId.trim();
  if (!trimmed.endsWith(prefix)) {
    return `com.googleusercontent.apps.${trimmed}`;
  }
  const raw = trimmed.slice(0, -prefix.length);
  return `com.googleusercontent.apps.${raw}`;
}

const googleIosClientId =
  process.env.GOOGLE_IOS_CLIENT_ID?.trim() || DEFAULT_GOOGLE_IOS_CLIENT_ID;
const googleIosUrlScheme =
  process.env.GOOGLE_IOS_URL_SCHEME?.trim() || getIosUrlScheme(googleIosClientId);

const config: ExpoConfig = {
  name: 'DukiAI Memory',
  slug: 'memory-ai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: 'memoryai',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#121212',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.dukiai.app',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#121212',
    },
    package: 'com.dukiai.app',
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: googleIosUrlScheme,
      },
    ],
    'expo-router',
    'expo-localization',
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow DukiAI Memory to access your camera to capture memories.',
      },
    ],
    [
      'expo-av',
      {
        microphonePermission:
          'Allow DukiAI Memory to access your microphone to record voice memories.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow DukiAI Memory to access your photo library to save image memories.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || '',
    googleIosClientId,
  },
};

export default config;
