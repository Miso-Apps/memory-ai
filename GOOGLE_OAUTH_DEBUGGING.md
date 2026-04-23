# Google OAuth 404 Debugging Guide

## Issue
When attempting to login with Gmail on iOS, users may see a Google sign-in failure in-app (often `Invalid or expired Google token` from backend).

## Root Cause
The app now uses native Google Sign-In and sends `id_token` to `/auth/google/login`.
The most common failure is audience mismatch: backend verifies the token against
`GOOGLE_IOS_CLIENT_ID` / `GOOGLE_CLIENT_ID`, but the token was minted for a different iOS OAuth client.

## How to Debug

### Step 1: Run the Mobile App and Attempt Google Login

1. Start the mobile app (Expo Go or standalone build)
2. On the login screen, press "Continue with Google"
3. Check the **Console logs** (Metro console, not mobile device logs)

### Step 2: Verify mobile Google client configuration

Check these values in app config (`mobile/app.config.ts`):
- `GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_IOS_URL_SCHEME`

Also ensure `EXPO_PUBLIC_API_BASE_URL` points to the backend that has matching
`GOOGLE_IOS_CLIENT_ID` configured.

### Step 3: Verify Google Cloud Console configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Find the project for this app
3. Go to **APIs & Services** → **Credentials**
4. Find the OAuth 2.0 credential labeled as **iOS** (not Web)
5. Ensure the iOS OAuth credential used by the app matches:
  - iOS bundle ID `com.dukiai.app`
  - the client ID value shipped in your build profile

### Step 4: Sync backend audiences

Set backend env:

```
GOOGLE_IOS_CLIENT_ID=<ios-client-id>
```

For multi-env (dev + prod) use CSV:

```
GOOGLE_IOS_CLIENT_ID=<dev-ios-client-id>,<prod-ios-client-id>
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Invalid or expired Google token` | Backend audience mismatch | Set `GOOGLE_IOS_CLIENT_ID` to matching iOS client ID (or CSV list) |
| Works in dev build, fails in TestFlight | Different iOS client IDs per profile | Configure EAS secrets per profile and backend CSV audiences |
| Works on simulator, fails on phone | Phone cannot reach localhost backend | Use LAN IP / tunnel in `EXPO_PUBLIC_API_BASE_URL` |
| Works after rebuild only | Stale app config/env in build cache | Rebuild with fresh EAS profile env values |

## Runtime Validation Checklist

1. Confirm the app build includes the expected values from `mobile/app.config.ts`.
2. Confirm backend `.env` contains matching `GOOGLE_IOS_CLIENT_ID`.
3. Call `POST /auth/google/login` from the app and verify status is 200.
4. If status is 401, inspect backend logs for audience verification errors.

## References

- [Google OAuth 2.0 for Mobile & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
