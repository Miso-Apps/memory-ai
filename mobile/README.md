# Memory AI - Mobile App

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

Environment variables are configured in `app.json` and loaded through Expo's constants.

For local development, the API URL is set to `http://localhost:8000`.

## Building for Production

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

See [Expo EAS Build](https://docs.expo.dev/build/introduction/) for more details.
