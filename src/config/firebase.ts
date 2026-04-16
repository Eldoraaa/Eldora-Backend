import * as fs from "fs";
import * as admin from "firebase-admin";
import { config } from "./env";

let initialized = false;

type RawServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function isServiceAccount(value: unknown): value is RawServiceAccount {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.project_id === "string" &&
    typeof candidate.client_email === "string" &&
    typeof candidate.private_key === "string"
  );
}

export function initFirebase(): void {
  const path = config.firebaseServiceAccountPath;
  if (!fs.existsSync(path)) {
    console.warn("[Firebase] Service account file not found — FCM disabled:", path);
    return;
  }
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(path, "utf-8"));
    if (!isServiceAccount(serviceAccount)) {
      console.warn(
        "[Firebase] Invalid service account JSON - expected Admin SDK key with project_id, client_email, and private_key. google-services.json will not work:",
        path
      );
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
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

export function getAuth(): admin.auth.Auth | null {
  if (!initialized) return null;
  return admin.auth();
}
