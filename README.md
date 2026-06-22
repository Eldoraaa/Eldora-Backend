<div align="center">

# ☁️ Eldora-Backend — ELDORA API Server

### *Protect. Respond. Recover.*

[![Runtime](https://img.shields.io/badge/Runtime-Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Framework](https://img.shields.io/badge/Framework-Express%205-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Language](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ORM](https://img.shields.io/badge/ORM-Prisma%207-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![DB](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-10B981?style=flat-square)](LICENSE)
[![Hackathon](https://img.shields.io/badge/Passage%20to%20ASEAN-2026%20Semi--Finalist-FFD21E?style=flat-square)](https://github.com/)

<br/>

**The central API server for the ELDORA ecosystem — handling caregiver authentication, multi-home management, IoT device heartbeats and commands, voice intent processing, FCM push notifications, scene automation, and elder analytics.**

[🌐 ELDORA Ecosystem](https://github.com/eldora-bm) · [🤖 DoraBot](https://github.com/eldora-bm/dorabot) · [🛡️ DoraShield](https://github.com/eldora-bm/dorashield) · [📱 Mobile App](https://github.com/eldora-bm/eldora-mobile)

</div>

---

## 📌 Overview

Eldora-Backend is the **central orchestration layer** of the ELDORA eldercare ecosystem. It connects DoraBot hardware, the caregiver mobile app, and the AI voice pipeline into a single cohesive system — managing device registration, real-time event dispatch, command queuing, and all persistent data.

> **Eldora-Backend's role in the ELDORA ecosystem:**
> *"The brain — receiving signals from every device and person, deciding what matters, and making sure the right response reaches the right place at the right time."*

| | |
|---|---|
| **Runtime** | Node.js (CommonJS) |
| **Framework** | Express 5 |
| **Language** | TypeScript 6 |
| **ORM** | Prisma 7 |
| **Database** | PostgreSQL |
| **Auth** | Firebase Auth token verification + JWT session tokens |
| **Push** | Firebase Admin SDK (FCM) |
| **Validation** | Zod v4 |
| **API Docs** | Swagger UI (`/docs`) |
| **Deployment** | Railway (production) |

---

## 🌐 ELDORA Ecosystem

Eldora-Backend is the **central hub** that all other components connect to:

```
ELDORA Ecosystem
├── 🛡️  DoraShield     — Fall detection wearable (ESP32) → IoT events
├── 🤖  DoraBot         — AI voice companion (ESP32-S3)   → IoT heartbeat, voice audio, commands
├── ☁️   Eldora-Backend  — API server (this repo)           → orchestration layer
├── 🧠  Eldora-AI-Pipeline — Voice STT + AI + TTS service  → called by backend
└── 📱  Eldora-Mobile   — Caregiver app                    → REST API + FCM
```

<img src="./images/eldora-backend-flowchart.png"/>

---

## ✨ API Modules

- 🔐 **Auth** — Firebase ID token verification, email/password login, Google Sign-In, JWT session issuance, account deletion
- 🏠 **Home** — Multi-home CRUD, role-based membership (home owner / administrator / common member), invite-code invitations, emergency contacts, safety and wellness summaries, home location (latitude/longitude)
- 📡 **IoT** — Device self-registration on first heartbeat, telemetry intake (battery, Wi-Fi RSSI, local IP, firmware version), pending command delivery, command acknowledgment, fall event ingestion, stale device offline detection
- 🔌 **Devices** — Device listing, standard pairing, local token-based pairing with approval flow, pairing request management (approve/reject), room category management, Wi-Fi config command queuing, device visibility and sort management, per-device voice configuration
- 🔔 **Notifications** — FCM push via Firebase Admin SDK, per-user notification history, per-category notification preferences with Do Not Disturb scheduling, notification response recording, scheduled follow-up processor
- 🎬 **Scenes** — Full scene CRUD with five trigger types (tap-to-run, device status change, scheduled, weather change, family going home), enabled/disabled toggle, scheduled scene background executor
- 🎙️ **Voice** — Raw audio ingestion from DoraBot, forwarding to the AI pipeline, eleven-intent local classifier (emergency, fall, call family, comfort, etc.) with wake-phrase gating, TTS response command creation, emotion state logging (six states), voice test-speak endpoint
- 📈 **Analytics** — Voice interaction analytics by day and hour, emotion state breakdown per period, intent distribution, notification event analytics

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js | JavaScript server runtime |
| **Framework** | Express 5 | HTTP routing, middleware pipeline |
| **Language** | TypeScript 6 | Type-safe server-side development |
| **ORM** | Prisma 7 + `@prisma/adapter-pg` | Schema, migrations, type-safe queries |
| **Database** | PostgreSQL (`pg`) | Primary data store |
| **Authentication** | Firebase Admin + `jsonwebtoken` | Token verification + JWT session issuance |
| **Push Notifications** | Firebase Admin SDK (FCM) | Real-time push to caregiver app |
| **Validation** | Zod v4 | Request body and param validation |
| **Password Hashing** | bcryptjs | Secure credential storage |
| **API Documentation** | swagger-jsdoc + swagger-ui-express | Auto-generated OpenAPI spec at `/docs` |
| **Security** | Helmet | HTTP security headers |
| **HTTP Client** | Axios | Outbound calls to voice AI pipeline |
| **Logging** | Morgan | HTTP request logging |
| **Dev Server** | Nodemon + ts-node + tsconfig-paths | Hot-reload TypeScript development |

---

## 📁 Project Structure

```
Eldora-Backend/
│
├── 📁 prisma/
│   ├── schema.prisma               # Full database schema — all models and enums
│   ├── seed.ts                     # Database seed script
│   └── migrations/                 # Prisma migration history
│
├── 📁 src/
│   ├── index.ts                    # Server bootstrap — Express app, middleware, routes, background jobs
│   │
│   ├── 📁 config/
│   │   ├── database.ts             # Prisma client singleton
│   │   ├── env.ts                  # Environment variable loading and validation
│   │   ├── firebase.ts             # Firebase Admin SDK initialization
│   │   └── swagger.ts              # OpenAPI / Swagger spec configuration
│   │
│   ├── 📁 middlewares/
│   │   ├── auth.middleware.ts      # JWT bearer auth (caregiver routes)
│   │   ├── device.middleware.ts    # Device key auth (IoT routes)
│   │   ├── error.middleware.ts     # Global Express error handler
│   │   └── logger.middleware.ts    # Morgan request logger
│   │
│   ├── 📁 modules/                 # Feature modules — each follows the same layered pattern
│   │   ├── 📁 auth/                # auth.routes → auth.controller → auth.service → auth.repository
│   │   ├── 📁 home/                # home.routes → home.controller → home.service → home.repository
│   │   ├── 📁 devices/             # devices + rooms + voice-config sub-controllers
│   │   ├── 📁 iot/                 # iot.routes → iot.controller → iot.service → iot.repository
│   │   ├── 📁 notifications/       # notifications + follow-up processor
│   │   ├── 📁 scenes/              # scenes + scheduled executor + scene templates
│   │   ├── 📁 voice/               # audio ingestion, intent detection, emotion logging
│   │   └── 📁 analytics/           # voice and notification analytics aggregation
│   │
│   ├── 📁 shared/
│   │   ├── errors/                 # AppError class and typed error helpers
│   │   ├── security/               # Local pairing token utilities
│   │   └── validations/            # Shared Zod validation schemas
│   │
│   ├── 📁 types/
│   │   ├── express.d.ts            # Express Request type augmentation
│   │   └── iot.types.ts            # IoT-specific type definitions
│   │
│   └── 📁 utils/
│       ├── jwt.utils.ts            # JWT sign / verify helpers
│       └── response.utils.ts       # Standardized API response shape
│
└── 📄 .env.example                 # Required environment variables template
```

<details>
<summary><b>Module layer pattern</b></summary>

<br/>

Every module follows the same four-layer structure so the codebase is predictable:

| File | Role |
|---|---|
| `*.routes.ts` | Registers Express routes, applies auth middleware, maps to controller functions. Swagger JSDoc annotations live here. |
| `*.controller.ts` | Parses and validates the HTTP request (via Zod), calls the service, and returns the response. No business logic. |
| `*.service.ts` | Business logic — orchestrates repository calls, applies rules, fires side effects (FCM, command creation, etc.). |
| `*.repository.ts` | Direct Prisma queries. No logic beyond data access. |

</details>

---

## 🗄️ Database Schema

The schema uses a `Ms` (master) / `Tr` (transaction) naming convention for table clarity.

```
MsUser                    — Caregivers and family members (roles: family / caregiver / admin)
MsEmergencyContact        — Emergency contacts scoped to a user or home
MsNotificationPreference  — Per-user, per-category notification toggles + DnD schedule
MsNotificationDeviceToken — FCM device tokens (multi-device per user)
MsHome                    — Elder home (name, address, lat/lng)
TrHomeMember              — User ↔ Home membership (roles: home_owner / administrator / common_member)
TrHomeInvitation          — Invite-code based home invitations with expiry
MsElderProfile            — Elder identity linked to one or more caregivers
MsDevice                  — IoT device (DoraBot / DoraShield) with telemetry fields
TrDeviceCommand           — Command queue (configure_wifi / activate_local_alarm / speak_on_dorabot)
TrDevicePairingRequest    — Multi-caregiver pairing approval flow
MsRoomCategory            — Room labels per home for device grouping
MsScene                   — Automation scenes with five trigger types
MsDeviceVoiceConfig       — Per-device TTS voice, language, and speech rate
TrVoiceEmotionLog         — Emotion state per voice interaction (neutral / calm / happy / sad / anxious / distressed)
TrNotification            — Notification records (types: alarm / home / device)
TrNotificationUserState   — Per-user read/unread state for multi-member homes
TrNotificationResponse    — Caregiver responses to alarm notifications
```

---

## ⚙️ How Eldora-Backend Works

<img src="./images/eldora-backend-sequence.png"/>

**In plain English:**
```
Server starts → connects to PostgreSQL → initializes Firebase Admin
    → mounts routes: /auth /home /iot /devices /notifications /scenes /voice /analytics
    → starts three 60-second background intervals:
        follow-up notification processor
        scheduled scene executor
        stale device offline event detector
    → handles requests:
        DoraBot heartbeat → upsert device telemetry → return pending commands
        DoraBot audio    → forward to AI pipeline → intent classify → queue TTS command → push notification if alarm
        Caregiver login  → verify Firebase token → issue JWT
        Caregiver app    → full CRUD over homes, devices, scenes, alerts, analytics
```

---

## 🔬 Voice Intent Classification

The backend includes a **local intent classifier** in `voice.service.ts` that runs after the AI pipeline returns a transcript. This layer provides immediate intent routing without an additional LLM call.

| Intent | Trigger Keywords | Severity | Action |
|---|---|---|---|
| `fall_emergency` | "i fell", "fell down", "fallen" | 🔴 critical | FCM alarm + queue TTS response |
| `emergency_help` | "help", "emergency" | 🔴 critical | FCM alarm + queue TTS response |
| `call_family` | "call my family", "call my caregiver", "call someone" | 🔴 critical | FCM alarm + queue TTS response |
| `request_water` | "water", "drink" | 🔴 critical | FCM alarm + queue TTS response |
| `request_medicine` | "medicine", "medication", "pill" | 🔴 critical | FCM alarm + queue TTS response |
| `check_in` | "are you there", "can you hear me", "eldora" | — | Queue TTS response only |
| `comfort` | "lonely", "scared", "stay with me" | — | Queue TTS response only |
| `conversation` | (catch-all) | — | Queue TTS response only |
| `ignored` | No wake phrase detected | — | Optionally queue clarification |

**Wake phrase gate:** utterances must contain `"eldora"` or `"el dora"` unless they contain a direct emergency keyword — this prevents DoraBot from reacting to background conversation.

**Emotion logging:** every voice interaction logs one of six emotion states (`neutral`, `calm`, `happy`, `sad`, `anxious`, `distressed`) and a confidence score from the AI pipeline into `TrVoiceEmotionLog`, powering the analytics dashboard.

---

## 🔑 API Reference

All routes are documented in Swagger at `/docs` when the server is running.

| Prefix | Auth | Description |
|---|---|---|
| `GET /health` | None | Liveness check — returns `{ status: "ok", timestamp }` |
| `GET /docs` | None | Swagger UI — full interactive API documentation |
| `/auth/*` | Firebase token → JWT | Login, register, Google login, delete account |
| `/home/*` | JWT | Homes, members, invitations, summaries, emergency contacts |
| `/iot/*` | Device key | Heartbeat, fall/offline events, commands, command ACK |
| `/devices/*` | JWT | Device list, pair, local-pair, pairing requests, rooms, Wi-Fi queue, voice config |
| `/notifications/*` | JWT | Notification history, preferences, responses |
| `/scenes/*` | JWT | Scene CRUD, tap-to-run execution |
| `/voice/*` | Device key / JWT | Audio processing (device), test-speak (caregiver) |
| `/analytics/*` | JWT | Voice interaction and notification analytics |

---

## ⚙️ Configuration

Create a `.env` file in the project root (copy from `.env.example`):

```env
NODE_ENV=development
PORT=3000

# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/eldora"

# JWT session tokens
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=7d

# IoT device authentication
IOT_DEVICE_PROVISIONING_SECRET=your-iot-provisioning-secret

# Firebase Admin SDK — inline JSON or file path (uncomment one)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
# FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# Voice AI Pipeline (Eldora-AI-Pipeline service)
VOICE_AUDIO_PROCESSOR_URL=http://localhost:8000/api/process-audio
VOICE_AUDIO_BASE_URL=http://localhost:8000
```

> ⚠️ **Never commit `.env` or `firebase-service-account.json` to version control.** The `IOT_DEVICE_PROVISIONING_SECRET` authenticates all IoT devices — treat it as a high-value secret.

---

## 🚀 Build & Run

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/) (local or hosted)
- A Firebase project with Admin SDK credentials

### Development

```bash
# 1. Clone the repository
git clone https://github.com/eldora-bm/eldora-backend.git
cd eldora-backend

# 2. Install dependencies
npm install

# 3. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your database URL, JWT secret, Firebase credentials, and voice service URL

# 4. Run database migrations
npm run migrate:deploy

# 5. (Optional) Seed the database
npm run seed

# 6. Start the development server (hot-reload via nodemon)
npm run dev
```

The server starts at `http://localhost:3000`.
Swagger UI is available at `http://localhost:3000/docs`.

### Production Build

```bash
# Compile TypeScript → dist/
npm run build

# Run compiled output
npm start
```

`npm run build` runs `tsc` followed by `tsc-alias` to resolve path aliases in the compiled output.

<details>
<summary><b>Database migrations</b></summary>

<br/>

```bash
# Apply all pending migrations (development + production)
npm run migrate:deploy

# Generate Prisma client after schema changes
npm run prisma:generate
```

The migration history is in `prisma/migrations/`. Each migration file is timestamped and describes its purpose in the filename (e.g., `20260601013000_add_scenes`).

</details>

---

## 👥 Team

<div align="center">

**ELDORA — BINUS BM Team**
*Passage to ASEAN Hackathon 2026*

| Name | Role |
|---|---|
| **Stanley Nathanael Wijaya** | Team Lead |
| **Lutfi Alvaro Pratama** | IoT Engineer |
| **Andrian Pratama** | Mobile Developer |
| **Khalisa Amanda Sifa Ghaizani** | Backend Developer |
| **Devon Nicholas** | AI Engineer |

</div>

---

## 📧 Contact

Have questions, want to collaborate, or interested in ELDORA?

| Channel | Details |
|---|---|
| 📧 Email | [stanley.n.wijaya7@gmail.com](mailto:stanley.n.wijaya7@gmail.com) |
| ✈️ Telegram | [@xstynwx](https://t.me/xstynwx) |
| 💬 Discord | `stynw7` |

---

<div align="center">

[![Hackathon](https://img.shields.io/badge/Passage%20to%20ASEAN%202026-Semi--Finalist-FFD21E?style=for-the-badge)](https://github.com/)
[![BINUS](https://img.shields.io/badge/BINUS%20University-BM%20Team-E7352C?style=for-the-badge)](https://binus.ac.id/)

<br/>
Made with 🤍 by BINUS BM Team 🔥

</div>
