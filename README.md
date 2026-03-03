# 🚨 ResQ Me — Personal Emergency Safety App

**ResQ Me** is an AI-powered personal safety application that enables hands-free emergency alerts with intelligent audio analysis, real-time location sharing, and automated notifications to emergency contacts.

> Built for the **HBCU Innovation Challenge**

---

## ✨ Features

### 🔴 One-Tap SOS
- Large, accessible SOS button with a **5-second cancel countdown** to prevent accidental triggers
- Instantly captures location and begins audio recording

### 🎙️ Smart Audio Recording
- **Silence detection** — auto-stops recording after 30 seconds of silence
- **5-minute max duration** with real-time progress tracking
- Noise suppression and echo cancellation for clear recordings

### 🤖 AI-Powered Emergency Summaries
- Recorded audio is transcribed via **OpenAI Whisper**
- AI generates a concise emergency summary describing the situation
- Users can **review and edit** the summary before it's sent to contacts

### 📲 Emergency Contact Notifications
- Automated **email alerts** sent to all enabled emergency contacts
- Includes AI summary, **Google Maps location link**, and reverse-geocoded address
- Contact management with enable/disable toggles

### 🗣️ Hands-Free Activation
- **"Rescue Me" wake word** detection using Porcupine — works in the background
- **Volume button trigger** — press volume buttons to activate SOS without unlocking your phone
- App automatically comes to foreground and initiates the SOS sequence

### 📍 Location Services
- Real-time GPS location capture on SOS trigger
- **Reverse geocoding** for human-readable addresses
- Location shared with emergency contacts via Google Maps link

### 📶 Offline Support
- **Offline alert queue** — alerts are saved locally and sent when connectivity is restored
- Offline data caching for contacts and alert history

### 📊 Alert History & Dashboard
- Full history of past alerts with status tracking
- Detailed alert view with audio playback, AI summary, location, and notification status

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI** | Tailwind CSS, shadcn/ui (Radix), Lucide Icons |
| **Backend** | Supabase (Auth, Database, Edge Functions) |
| **AI** | OpenAI Whisper (transcription), Claude / GPT (summarization) |
| **Mobile** | Capacitor (native Android deployment) |
| **Wake Word** | Picovoice Porcupine |
| **State** | TanStack React Query, React Hook Form, Zod |

---

## 📁 Project Structure

```
src/
├── components/          # UI components (SOS button, alerts, contacts, etc.)
├── hooks/               # Custom hooks
│   ├── useSmartRecording.ts       # Audio recording with silence detection
│   ├── useEmergencyAlert.ts       # Emergency processing pipeline
│   ├── useWakeWordTrigger.ts      # "Rescue Me" wake word detection
│   ├── useVoiceCommand.ts         # Voice command handling
│   ├── useReverseGeocode.ts       # Coordinates → address
│   ├── useOfflineAlertQueue.ts    # Offline-first alert queue
│   └── ...
├── pages/               # App pages (Dashboard, Contacts, Settings)
├── plugins/             # Capacitor native plugins (SMS, Wake Word, Volume)
├── integrations/        # Supabase client & types
supabase/
├── functions/
│   ├── analyze-emergency/    # AI audio analysis edge function
│   ├── send-emergency-sms/   # Email/SMS notification edge function
│   └── reverse-geocode/      # Geocoding edge function
├── migrations/               # Database schema migrations
android/                      # Native Android project (Capacitor)
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or bun
- Supabase CLI (for edge functions)
- Android Studio (for native builds)

### Installation

```bash
# Clone the repository
git clone https://github.com/devtobi16/ResQme--Hbcu-innovative.git
cd ResQme--Hbcu-innovative

# Install dependencies
npm install

# Start the dev server
npm run dev
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Android Build

```bash
npm run android:build   # Build + sync with Capacitor
npm run android:run     # Deploy to connected device
```

---

## 📱 How It Works

```
  User triggers SOS (button / wake word / volume button)
           │
           ▼
  5-second cancel countdown
           │
           ▼
  Audio recording begins (with silence detection)
           │
           ▼
  Recording stops → audio uploaded
           │
           ▼
  AI transcribes & generates emergency summary
           │
           ▼
  User reviews / edits summary
           │
           ▼
  Notifications sent to emergency contacts
  (email with AI summary + location link)
```

---

## 👨‍💻 Author

**Oluwatobiloba Sokoya**

---

## 📄 License

This project was built for the HBCU Innovation Challenge.
