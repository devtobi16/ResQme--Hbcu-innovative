# ResQMe - AI-Powered Emergency Alert System

<div align="center">
  <h3>🆘 Personal Safety App with Intelligent Audio Analysis</h3>
  <p>A hybrid offline-first emergency response system that captures audio, analyzes context with AI, and delivers critical alerts via SMS.</p>
</div>

---

## Overview

ResQMe is a comprehensive personal safety application designed to send emergency alerts to trusted contacts when users are in distress. The app captures ambient audio during emergencies, processes it through AI to extract context, and delivers actionable SMS messages with real-time GPS location.

### Key Features

- **One-Tap SOS Activation** - Large, accessible emergency button with countdown cancellation
- **Smart Audio Recording** - Automatic silence detection stops recording after 10 seconds of quiet
- **AI-Powered Analysis** - OpenAI processes audio to generate emergency context summaries
- **Offline-First Architecture** - Queues alerts locally when offline, auto-syncs when connected
- **Multi-Modal Triggers** - Voice activation, hardware volume buttons, and in-app controls
- **Real-Time Location Tracking** - Continuous GPS updates during active alerts
- **Native SMS Delivery** - Twilio integration for reliable message delivery

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework with hooks-based state management |
| TypeScript | Type-safe development |
| Vite | Build tooling and dev server |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Accessible component library |
| TanStack Query | Server state management and caching |
| Capacitor | Native Android integration |

### Backend (Supabase)
| Service | Purpose |
|---------|---------|
| PostgreSQL | Alert storage, user profiles, contact management |
| Edge Functions | AI analysis, SMS dispatch, reverse geocoding |
| Row Level Security | Data isolation per user |
| Storage | Audio file persistence |
| Auth | Email-based authentication |

### External Services
| Service | Purpose |
|---------|---------|
| OpenAI API | Audio transcription and emergency context analysis |
| Twilio | SMS message delivery |
| OpenCage | Reverse geocoding for human-readable addresses |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ResQMe Mobile App                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  SOS Button │  │ Voice Cmd   │  │  Volume Button Trigger  │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              useHybridAlert (Core State Machine)            ││
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌───────────────┐  ││
│  │  │ Pending │→ │Recording │→ │Uploading│→ │Sending SMS    │  ││
│  │  └─────────┘  └──────────┘  └─────────┘  └───────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │           Offline Queue (IndexedDB)                         ││
│  │           - Stores audio blobs when offline                 ││
│  │           - Auto-syncs on reconnection                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Backend                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   Database   │  │   Storage    │  │    Edge Functions      │ │
│  │  - alerts    │  │  - audio/    │  │  - analyze-emergency   │ │
│  │  - contacts  │  │              │  │  - send-emergency-sms  │ │
│  │  - profiles  │  │              │  │  - reverse-geocode     │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              ▼                               ▼
     ┌─────────────────┐             ┌─────────────────┐
     │   OpenAI API    │             │   Twilio API    │
     │  Audio → Text   │             │   SMS Delivery  │
     │  Context Analysis│             │                 │
     └─────────────────┘             └─────────────────┘
```

---

## Database Schema

```sql
-- Core tables with RLS policies for user isolation

profiles          -- User profile data (name, phone)
emergency_contacts -- Trusted contacts per user
alerts            -- Emergency events with status tracking
alert_locations   -- GPS breadcrumb trail during active alerts
notification_logs -- SMS delivery audit trail
```

---

## Local Development

### Prerequisites
- Node.js 18+
- npm or bun

### Setup

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd resqme

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

The app requires the following secrets configured in your backend:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for audio analysis |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio authentication token |
| `TWILIO_PHONE_NUMBER` | Twilio sender phone number |
| `OPENCAGE_API_KEY` | OpenCage geocoding API key |

---

## Android Build (Capacitor)

```bash
# Sync web assets to native project
npx cap sync android

# Open in Android Studio
npx cap open android

# Build APK
./gradlew assembleDebug
```

### Native Plugins

The app includes custom Capacitor plugins for:
- **NativeSmsPlugin** - Direct SMS sending (bypasses web limitations)
- **VolumeButtonPlugin** - Hardware button detection via Foreground Service
- **WakeWordPlugin** - Voice activation in background

---

## Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `analyze-emergency` | HTTP POST | Transcribes audio, generates AI summary |
| `send-emergency-sms` | HTTP POST | Dispatches SMS via Twilio to all contacts |
| `reverse-geocode` | HTTP POST | Converts GPS coords to street address |

---

## Security

- **Row Level Security (RLS)** - All tables protected; users can only access their own data
- **Authenticated endpoints** - Edge functions validate JWT tokens
- **No client-side secrets** - API keys stored server-side only

---

## Roadmap

- [ ] iOS Capacitor build
- [ ] Push notifications for alert status updates
- [ ] Two-way SMS responses from contacts
- [ ] Integration with local emergency services (911)
- [ ] Wearable device triggers (smartwatch)

---

## License

MIT

---

<div align="center">
  <sub>Built with ❤️ for personal safety</sub>
</div>
