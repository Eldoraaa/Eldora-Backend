import * as fs from "fs";
import * as admin from "firebase-admin";
import { config } from "@/config/env";

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

function normalizeServiceAccount(serviceAccount: RawServiceAccount): RawServiceAccount {
  return {
    ...serviceAccount,
    private_key: serviceAccount.private_key.replace(/\\n/g, "\n"),
  };
}

function readServiceAccount(): { serviceAccount: RawServiceAccount; source: string } | null {
  if (config.firebaseServiceAccountJson) {
    const parsed = JSON.parse(config.firebaseServiceAccountJson);
    if (!isServiceAccount(parsed)) {
      console.warn(
        "[Firebase] Invalid service account JSON in FIREBASE_SERVICE_ACCOUNT_JSON - expected project_id, client_email, and private_key."
      );
      return null;
    }

    return {
      serviceAccount: normalizeServiceAccount(parsed),
      source: "FIREBASE_SERVICE_ACCOUNT_JSON",
    };
  }

  const path = config.firebaseServiceAccountPath;
  if (!fs.existsSync(path)) {
    console.warn("[Firebase] Service account file not found - FCM disabled:", path);
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(path, "utf-8"));
  if (!isServiceAccount(parsed)) {
    console.warn(
      "[Firebase] Invalid service account JSON - expected Admin SDK key with project_id, client_email, and private_key. google-services.json will not work:",
      path
    );
    return null;
  }

  return {
    serviceAccount: normalizeServiceAccount(parsed),
    source: path,
  };
}

export function initFirebase(): void {
  try {
    const credential = readServiceAccount();
    if (!credential) return;

    const { serviceAccount, source } = credential;

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });
    initialized = true;
    console.log("[Firebase] Admin SDK initialized from", source);
    return;
  } catch (err) {
    console.warn("[Firebase] Failed to initialize - FCM disabled:", err);
    return;
  }

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
