# iOS App Store Submission Plan

> **Status:** Code changes applied — ready for Xcode Archive workflow.

**Goal:** Package and submit DukiAI Memory (v1.0.0) to the iOS App Store using Apple's official Xcode Archive workflow.

**Architecture:** React Native 0.74.5 + Expo SDK 51 bare workflow. Local Xcode build → Archive → Xcode Organizer upload → App Store Connect review.

**Tech Stack:** Xcode 15+, CocoaPods 1.16.2, React Native 0.74.5, Hermes JS engine, Bundle ID `com.dukiai.app`, Team ID `8U8QGH4S2W`

---

## Code Changes Already Applied

These changes have been committed to `main`:

| File | Change |
|------|--------|
| `mobile/ios/DukiAIMemory.xcodeproj/project.pbxproj` | `DEVELOPMENT_TEAM = 8U8QGH4S2W` added (Debug + Release) |
| `mobile/ios/DukiAIMemory.xcodeproj/project.pbxproj` | `CODE_SIGN_STYLE = Automatic` added (Debug + Release) |
| `mobile/ios/DukiAIMemory.xcodeproj/project.pbxproj` | `MARKETING_VERSION` corrected from `1.0` → `1.0.0` |
| `mobile/eas.json` | `appleTeamId` set to `8U8QGH4S2W` |

---

## Pre-Flight Checklist (Already Verified)

- [x] i18n parity: EN and VI keys aligned (`npm run i18n:check`)
- [x] TypeScript: zero errors (`npm run type-check`)
- [x] Git: clean, up-to-date with `origin/main`
- [x] `ITSAppUsesNonExemptEncryption = false` in Info.plist
- [x] `NSAppTransportSecurity`: no arbitrary loads allowed; local networking OK
- [x] APNs environment: `production` in entitlements
- [x] API base URL in production: `https://api.dukiai.com`
- [x] App icon: 1024×1024 PNG (universal, App Store ready)
- [x] Privacy descriptions: camera, microphone, photo library all set
- [x] CocoaPods: 1.16.2, React Native 0.74.5 installed
- [x] No database migrations needed (no model changes)
- [x] Deployment config: backend at `api.dukiai.com`, no changes required

---

## Phase 1: Create App in App Store Connect

**Time:** ~20 minutes | **Where:** https://appstoreconnect.apple.com

### Step 1: Log in and create new app

- [ ] Go to https://appstoreconnect.apple.com
- [ ] Click **My Apps** → **+** → **New App**
- [ ] Fill in:
  - **Platforms:** iOS
  - **Name:** `DukiAI Memory`
  - **Primary Language:** English (U.S.)
  - **Bundle ID:** `com.dukiai.app` (select from dropdown; must first be registered — see below)
  - **SKU:** `dukiai-memory-001` (internal use only, any unique string)
  - **User Access:** Full Access

### Step 1a: Register Bundle ID first (if not already done)

- [ ] Go to https://developer.apple.com/account/resources/identifiers/list
- [ ] Click **+** → **App IDs** → **App** → Continue
- [ ] **Description:** `DukiAI Memory`
- [ ] **Bundle ID:** Explicit → `com.dukiai.app`
- [ ] **Capabilities:** Enable:
  - **Push Notifications** (required — entitlements already set to `production`)
  - **Associated Domains** (if using universal links, otherwise skip)
- [ ] Click **Register**

### Step 1b: Note your App Store Connect App ID

After creating the app in App Store Connect, go to **App Information** → copy the **Apple ID** (numeric, e.g., `1234567890`). This is the `ascAppId` value needed in `eas.json`.

---

## Phase 2: Set Up Xcode for Archive

**Time:** ~10 minutes | **Where:** Xcode on your Mac

### Step 2: Install dependencies

```bash
cd mobile
npm install          # ensure node_modules are up to date

cd ios
pod install          # reinstall pods (needed after any dependency change)
```

### Step 3: Open workspace in Xcode

```bash
open mobile/ios/DukiAIMemory.xcworkspace
```

> ⚠️ **Always open the `.xcworkspace` file — NOT the `.xcodeproj`.**

### Step 4: Verify signing in Xcode

- [ ] In Xcode, select the **DukiAIMemory** project in the navigator (top-left)
- [ ] Select the **DukiAIMemory** TARGET (not the project)
- [ ] Go to **Signing & Capabilities** tab
- [ ] Confirm:
  - **Automatically manage signing** ✓ (checked — we set this in pbxproj)
  - **Team:** should auto-populate as your team (`8U8QGH4S2W`)
  - **Bundle Identifier:** `com.dukiai.app`
- [ ] If Xcode shows a signing error, click **"Fix Issue"** — Xcode will create a provisioning profile automatically
- [ ] Confirm **Provisioning Profile** shows `XC iOS: com.dukiai.app`

### Step 5: Verify build settings

- [ ] **General tab** → Version: `1.0.0`, Build: `1`
- [ ] **Build Settings** tab → search `MARKETING_VERSION` → should be `1.0.0`
- [ ] **Build Settings** → `SWIFT_VERSION` → `5.0`
- [ ] **Deployment Info** → Minimum iOS: `13.4`

---

## Phase 3: Archive the App

**Time:** 15–30 minutes (compilation)

### Step 6: Select correct build destination

- [ ] In Xcode toolbar, click the **device selector** (next to the scheme name `DukiAIMemory`)
- [ ] Select **"Any iOS Device (arm64)"** — NOT a simulator
  - Simulators use x86/arm64 sim slices; App Store requires device arm64
  
### Step 7: Set scheme to Release

- [ ] Click the scheme selector → **Edit Scheme...**
- [ ] Go to **Run** → **Build Configuration**: `Debug` (leave for dev)
- [ ] The **Archive** action automatically uses `Release` configuration — no change needed

### Step 8: Archive

- [ ] Menu: **Product → Archive**
- [ ] Xcode will compile in Release mode with Hermes engine (~15–25 min)
- [ ] When done, **Organizer** window opens automatically

---

## Phase 4: Upload to App Store Connect

**Time:** 5–15 minutes (upload speed depends on connection)

### Step 9: Distribute via Xcode Organizer

- [ ] In **Organizer** (Window → Organizer), select the archive just created
- [ ] Click **Distribute App**
- [ ] Choose: **App Store Connect** → **Upload**
- [ ] Leave all checkboxes selected:
  - [x] Include bitcode for iOS content (if available)
  - [x] Upload app symbols to receive symbolicated crash logs
  - [x] Manage Version and Build Number (Xcode sets build number automatically)
- [ ] Click **Next** → Xcode validates the binary
- [ ] Click **Upload** — wait for upload confirmation

### Step 10: Verify in App Store Connect

- [ ] Go to https://appstoreconnect.apple.com → Your App → **TestFlight**
- [ ] Wait 5–30 minutes for "Processing" status to change to build available
- [ ] Once processing completes, the build appears under **iOS Builds**

---

## Phase 5: Complete App Store Listing

**Time:** 30–60 minutes | **Where:** App Store Connect → App Information

### Step 11: Fill in required metadata

- [ ] **App Information**:
  - Name: `DukiAI Memory`
  - Subtitle: `Your personal memory companion` (max 30 chars)
  - Primary category: **Productivity**
  - Secondary category: **Utilities** (optional)
  - Age Rating: complete the questionnaire (should be 4+)

- [ ] **Version Information** (iOS 1.0.0):
  - **Description** (max 4000 chars): explain what the app does
  - **Keywords**: `memory, notes, recall, AI, productivity, journal` (max 100 chars)
  - **Support URL**: `https://dukiai.com` or landing page URL
  - **Marketing URL**: (optional)
  - **Privacy Policy URL**: `https://dukiai.com/privacy` (required)
  - **What's New**: (for v1.0 initial release, write "Initial release.")

### Step 12: App screenshots (required)

Apple requires screenshots for at least **one iPhone size** and one **iPad size** (if `supportsTablet: true`).

Required sizes:
| Device | Resolution | Notes |
|--------|------------|-------|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320×2868 px | **Required** |
| iPhone 6.7" (iPhone 14 Plus) | 1284×2778 px | Recommended |
| iPad Pro 13" (M4) | 2064×2752 px | Required (your app supports tablet) |

**How to capture screenshots:**
```bash
# In mobile directory
npm run ios   # Launch iOS simulator

# In Simulator:
# 1. Select device: iPhone 16 Pro Max (in Xcode → Simulator → Device menu)
# 2. Navigate to each key screen
# 3. Cmd+S = save screenshot  OR  Cmd+Shift+4 (system screenshot)
```

Take screenshots for at least these screens:
- [ ] Home/Recall screen
- [ ] Capture memory flow
- [ ] Memories list/library
- [ ] AI chat/insights view
- [ ] Profile screen

Upload screenshots in App Store Connect → Version → **iPhone Screenshots** + **iPad Screenshots**.

### Step 13: App Review information

- [ ] **Sign-in required:** Yes
- [ ] Demo account credentials: create a test account and fill in email/password
- [ ] **Notes for reviewer**: 
  ```
  DukiAI Memory is a personal memory companion app. 
  Users can sign up with email/password or Google OAuth.
  The app uses OpenAI APIs to generate memory summaries and enable AI recall.
  Voice memories require microphone permission.
  Photo memories require camera/photo library permission.
  Push notifications are used for proactive recall suggestions.
  ```

### Step 14: Pricing and availability

- [ ] **Price:** Free (or select your pricing tier)
- [ ] **Availability:** All territories (or select specific countries)

---

## Phase 6: Submit for Review

### Step 15: Select the uploaded build

- [ ] In App Store Connect → Version → **Build** section → click **+**
- [ ] Select the build uploaded in Step 9

### Step 16: Final submission

- [ ] Click **Add for Review** → **Submit for Review**
- [ ] Apple's review takes 1–3 business days (typically faster)
- [ ] You'll receive an email when the app is approved or if there are issues

---

## After Approval

- [ ] Set **Release Method**: Automatic or Manual
- [ ] App goes live on the App Store within minutes of approval confirmation

---

## Appendix: Troubleshooting Common Issues

### "No signing certificate found"
Xcode → Preferences → Accounts → Add your Apple ID → Download Manual Profiles

### "Missing push notification entitlement"
The entitlements file already has `aps-environment = production`. If Apple rejects, verify the App ID in Developer Portal has Push Notifications capability enabled.

### "ITMS-90562: Invalid bundle — no architectures"
Always archive with destination **"Any iOS Device (arm64)"** — never a simulator.

### "Missing required icon" 
The App Icon is a single 1024×1024 PNG. Verify `App-Icon-1024x1024@1x.png` exists in `mobile/ios/DukiAIMemory/Images.xcassets/AppIcon.appiconset/`.

### "NSLocalizedDescription not found" warnings
Not a blocker for App Store submission.

### Build number must increment
Each App Store Connect upload requires a unique build number. The current `CURRENT_PROJECT_VERSION = 1` is correct for the first upload. For subsequent uploads, increment to `2`, `3`, etc. (Update in Xcode → General → Build, or in the pbxproj).
