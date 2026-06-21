# Backend Eldora

Express API for Eldora mobile, IoT devices, scenes, alerts, and home management.

## Stack
- Node.js + Express
- TypeScript
- Prisma 7
- PostgreSQL
- Firebase Admin for FCM push notifications
- Zod validation
- Swagger UI

## Main modules
- Auth and Google login
- Homes, members, invitations, emergency contacts
- Devices, room categories, pairing, WiFi commands
- IoT heartbeat, commands, fall/offline events
- Scenes and scheduled automation
- Notifications and alert responses
- Voice intent and emotion logs

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Required env
- `DATABASE_URL`
- `JWT_SECRET`
- `IOT_DEVICE_PROVISIONING_SECRET`
- Firebase service account config
- Voice service URLs for audio processing/TTS
