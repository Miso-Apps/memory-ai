# DukiAI Memory - Mobile App

React Native mobile application built with Expo.

## Getting Started

### Prerequisites
- Node.js 18+
- iOS Simulator (Xcode) or Android Studio
- Expo CLI

### Installation

```bash
npm install
```

### Development

```bash
# Start Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

### Project Structure

```
mobile/
├── app/                    # Expo Router (file-based routing)
│   ├── (tabs)/            # Bottom tab navigation
│   │   ├── recall.tsx     # HomeRecall screen
│   │   ├── archive.tsx    # Search/Archive
│   │   └── profile.tsx    # Profile
│   ├── memory/
│   │   └── [id].tsx       # Memory detail (dynamic)
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
├── services/              # API client
├── store/                 # Zustand state management
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript types
```

## Tech Stack

- **Framework:** React Native + Expo
- **Navigation:** Expo Router (file-based)
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **HTTP Client:** Axios
- **UI Components:** Custom components
- **Icons:** Lucide React Native

## Features

- ✅ Multi-modal memory capture (text, links, voice)
- ✅ AI-powered recall
- ✅ Semantic search
- ✅ Voice recording and playback
- ✅ Offline support
- ✅ JWT authentication

## Configuration

Environment variables are configured in `app.config.ts` and loaded through Expo constants / `process.env`.

For local development, the API URL is set to `http://localhost:8000`.

### Google Sign-In for iOS (React Native)

This app uses `@react-native-google-signin/google-signin` (native SDK), so no Swift app rewrite is needed.

Required env variables:

- `EXPO_PUBLIC_API_BASE_URL` — backend URL for the app (`http://localhost:8000` for iOS Simulator, LAN/tunnel URL for physical device)
- `GOOGLE_IOS_CLIENT_ID` — iOS OAuth client ID from Google Cloud Console
- `GOOGLE_IOS_URL_SCHEME` — reversed iOS client ID URL scheme (`com.googleusercontent.apps.<client-id-without-domain>`)

You can set these as EAS secrets per profile (`development`, `preview`, `production`) so TestFlight/App Store builds use production credentials while local dev uses development credentials.

Local development notes:

- Use a custom dev build (`npx expo run:ios` or EAS dev build)
- Expo Go does not support this native Google Sign-In module
- For physical iPhone testing, `localhost` will not reach your Mac backend; use LAN IP or HTTPS tunnel

Troubleshooting:

- Error `RNGoogleSignin could not be found` means the app binary does not include the native module.
- Fix by running `npm run ios` (or `./start-ios.sh`) to rebuild and launch the custom iOS dev client.
- Avoid using Expo Go for Google Sign-In flows.

## Building for Production

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

See [Expo EAS Build](https://docs.expo.dev/build/introduction/) for more details.
