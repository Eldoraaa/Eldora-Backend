import * as fs from "fs";
import * as admin from "firebase-admin";
import { config } from "./env";

let initialized = false;

export function initFirebase(): void {
  const path = config.firebaseServiceAccountPath;
  if (!fs.existsSync(path)) {
    console.warn("[Firebase] Service account file not found — FCM disabled:", path);
    return;
  }
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(path, "utf-8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    console.log("[Firebase] Admin SDK initialized");
  } catch (err) {
    console.warn("[Firebase] Failed to initialize — FCM disabled:", err);
  }
}

export function getMessaging(): admin.messaging.Messaging | null {
  if (!initialized) return null;
  return admin.messaging();
}
