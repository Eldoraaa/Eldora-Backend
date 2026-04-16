import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { prisma } from "@/config/database";
import { config } from "@/config/env";
import { signToken } from "@/utils/jwt.utils";
import { sendSuccess, sendError } from "@/utils/response.utils";
import { getAuth } from "@/config/firebase";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const registerFcmSchema = z.object({
  fcmToken: z.string().min(1, "FCM token is required"),
  platform: z.enum(["ios", "android", "web"]),
});

const googleLoginSchema = z.object({
  idToken: z.string().min(1, "ID token is required"),
});

const googleClient = new OAuth2Client(config.googleWebClientId);

function maskToken(token: string): string {
  if (token.length <= 10) return "***";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);
  console.log("[Auth/Login] Login attempt", { email: body.email });

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) {
    console.warn("[Auth/Login] Invalid credentials", { email: body.email });
    sendError(res, "Invalid email or password", 401);
    return;
  }

  if (!user.password) {
    console.warn("[Auth/Login] Password login rejected for Google account", {
      userId: user.id,
      email: user.email,
    });
    sendError(res, "This account is registered with Google. Please sign in with Google.", 401);
    return;
  }

  const valid = await bcrypt.compare(body.password, user.password);
  if (!valid) {
    console.warn("[Auth/Login] Invalid credentials", { userId: user.id, email: user.email });
    sendError(res, "Invalid email or password", 401);
    return;
  }

  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  console.log("[Auth/Login] Login successful", {
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  sendSuccess(res, { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }, "Login successful");
}

export async function googleLogin(req: Request, res: Response): Promise<void> {
  console.log("[Auth/Google] ← Received Google login request");
  const body = googleLoginSchema.parse(req.body);
  console.log("[Auth/Google] Incoming token", { idTokenLength: body.idToken.length });
  console.log("[Auth/Google] idToken length:", body.idToken.length);

  try {
    console.log("[Auth/Google] Verifying idToken with Google OAuth...");
    const ticket = await googleClient.verifyIdToken({
      idToken: body.idToken,
      audience: config.googleWebClientId,
    });
    const payload = ticket.getPayload();

    const googleUid = payload?.sub;
    const googleEmail = payload?.email;
    const googleName = payload?.name;
    const googlePicture = payload?.picture;

    console.log("[Auth/Google] Token verified", {
      sub: googleUid,
      email: googleEmail,
    });

    if (!googleUid || !googleEmail) {
      console.error("[Auth/Google] Missing sub or email in Google account");
      sendError(res, "The Google account does not have a valid subject or email address", 400);
      return;
    }

    let googleUser = await prisma.user.findFirst({
      where: { OR: [{ googleId: googleUid }, { email: googleEmail }] },
    });

    if (googleUser) {
      console.log("[Auth/Google] Found existing user", {
        userId: googleUser.id,
        email: googleUser.email,
      });

      if (!googleUser.googleId) {
        console.log("[Auth/Google] Linking Google account to existing user...");
        googleUser = await prisma.user.update({
          where: { id: googleUser.id },
          data: { googleId: googleUid, avatarUrl: googlePicture ?? googleUser.avatarUrl },
        });
        console.log("[Auth/Google] Google account linked", {
          userId: googleUser.id,
          email: googleUser.email,
        });
      }
    } else {
      console.log("[Auth/Google] No existing user found - creating new user...");
      googleUser = await prisma.user.create({
        data: {
          email: googleEmail,
          name: googleName ?? googleEmail.split("@")[0],
          googleId: googleUid,
          avatarUrl: googlePicture ?? null,
        },
      });
      console.log("[Auth/Google] New user created", {
        userId: googleUser.id,
        email: googleUser.email,
      });
    }

    const appToken = signToken({
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      role: googleUser.role,
    });

    console.log("[Auth/Google] Login successful", {
      userId: googleUser.id,
      email: googleUser.email,
      role: googleUser.role,
    });

    sendSuccess(
      res,
      {
        token: appToken,
        user: {
          id: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          role: googleUser.role,
        },
      },
      "Login successful"
    );
    return;
  } catch (err) {
    console.error("[Auth/Google] Token verification failed:", err);
    if (typeof err === "object" && err !== null && "code" in err) {
      throw err;
    }
    sendError(res, "Google token is invalid or has expired", 401);
    return;
  }

  /* Legacy Firebase ID-token verification path disabled.
  const firebaseAuth = getAuth();
  if (!firebaseAuth) {
    console.error("[Auth/Google] Firebase Auth not initialized - service account missing?");
    console.error("[Auth/Google] ✗ Firebase Auth not initialized — service account missing?");
    sendError(res, "Firebase is not configured. Google login is unavailable.", 503);
    return;
  }

  let decodedToken;
  try {
    console.log("[Auth/Google] Verifying idToken with Firebase Admin...");
    decodedToken = await firebaseAuth.verifyIdToken(body.idToken);
    console.log("[Auth/Google] Token verified", {
      uid: decodedToken.uid,
      email: decodedToken.email,
    });
    console.log("[Auth/Google] ✓ Token verified — uid:", decodedToken.uid, "email:", decodedToken.email);
  } catch (err) {
    console.error("[Auth/Google] Token verification failed:", err);
    console.error("[Auth/Google] ✗ Token verification failed:", err);
    sendError(res, "Google token is invalid or has expired", 401);
    return;
  }

  const { uid, email, name, picture } = decodedToken;
  if (!email) {
    console.error("[Auth/Google] No email in Google account");
    console.error("[Auth/Google] ✗ No email in Google account");
    sendError(res, "The Google account does not have an email address", 400);
    return;
  }

  // Try to find user by googleId first, then by email
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: uid }, { email }] },
  });

  if (user) {
    console.log("[Auth/Google] Found existing user", { userId: user.id, email: user.email });
    console.log("[Auth/Google] Found existing user:", user.id, user.email);
    // Link Google account if not already linked
    if (!user.googleId) {
      console.log("[Auth/Google] Linking Google account to existing user...");
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: uid, avatarUrl: picture ?? user.avatarUrl },
      });
      console.log("[Auth/Google] Google account linked", { userId: user.id, email: user.email });
      console.log("[Auth/Google] ✓ Google account linked");
    }
  } else {
    console.log("[Auth/Google] No existing user found - creating new user...");
    console.log("[Auth/Google] No existing user found — creating new user...");
    // Create new user from Google account
    user = await prisma.user.create({
      data: {
        email,
        name: name ?? email.split("@")[0],
        googleId: uid,
        avatarUrl: picture ?? null,
      },
    });
    console.log("[Auth/Google] New user created", { userId: user.id, email: user.email });
    console.log("[Auth/Google] ✓ New user created:", user.id, user.email);
  }

  const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  console.log("[Auth/Google] Login successful", {
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  console.log("[Auth/Google] ✓ JWT issued — login successful for", user.email);
  sendSuccess(res, { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }, "Login successful");
  */
}

export async function registerFcmToken(req: Request, res: Response): Promise<void> {
  const body = registerFcmSchema.parse(req.body);
  const userId = req.user!.id;
  console.log("[Auth/FCM] Registering FCM token", {
    userId,
    platform: body.platform,
    fcmToken: maskToken(body.fcmToken),
  });

  await prisma.notificationToken.upsert({
    where: { fcmToken: body.fcmToken },
    update: { userId, platform: body.platform },
    create: { fcmToken: body.fcmToken, platform: body.platform, userId },
  });

  console.log("[Auth/FCM] FCM token registered", { userId, platform: body.platform });
  sendSuccess(res, null, "FCM token registered successfully");
}
