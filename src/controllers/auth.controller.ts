import { Request, Response } from "express";
import { prisma } from "@/config/database";
import { signToken } from "@/utils/jwt.utils";
import { sendSuccess, sendError } from "@/utils/response.utils";
import { getAuth } from "@/config/firebase";
import {
  loginSchema,
  registerSchema,
  googleLoginSchema,
  registerFcmSchema,
} from "@/validations/auth/auth.validation";

function maskToken(token: string): string {
  if (token.length <= 10) return "***";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);
  console.log("[Auth/Login] Verifying Firebase password login token...");

  const firebaseAuth = getAuth();
  if (!firebaseAuth) {
    sendError(res, "Firebase is not initialized", 500);
    return;
  }

  const decoded = await firebaseAuth.verifyIdToken(body.idToken);
  const firebaseUid = decoded.uid;
  const email = decoded.email;

  if (!firebaseUid || !email) {
    sendError(res, "Firebase token does not include a valid email", 400);
    return;
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ googleId: firebaseUid }, { email }] },
  });
  if (!user) {
    sendError(res, "Invalid email or password", 401);
    return;
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  console.log("[Auth/Login] Login successful", {
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  sendSuccess(
    res,
    {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
    "Login successful",
  );
}

export async function register(req: Request, res: Response): Promise<void> {
  const body = registerSchema.parse(req.body);
  console.log("[Auth/Register] Registration attempt", { email: body.email });

  const firebaseAuth = getAuth();
  if (!firebaseAuth) {
    sendError(res, "Firebase is not initialized", 500);
    return;
  }

  const decoded = await firebaseAuth.verifyIdToken(body.idToken);
  const firebaseUid = decoded.uid;
  const tokenEmail = decoded.email;

  if (!firebaseUid || !tokenEmail) {
    sendError(res, "Firebase token does not include a valid email", 400);
    return;
  }

  if (tokenEmail.toLowerCase() !== body.email.toLowerCase()) {
    sendError(res, "Firebase token email must match registration email", 400);
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email: body.email },
  });
  if (existing) {
    console.warn("[Auth/Register] Email already in use", { email: body.email });
    sendError(res, "An account with this email already exists.", 409);
    return;
  }

  const newUser = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      googleId: firebaseUid,
    },
  });

  console.log("[Auth/Register] Registration successful", {
    userId: newUser.id,
    email: newUser.email,
  });
  sendSuccess(res, null, "Registration successful", 201);
}

export async function googleLogin(req: Request, res: Response): Promise<void> {
  console.log("[Auth/Google] ← Received Google login request");
  const body = googleLoginSchema.parse(req.body);
  console.log("[Auth/Google] Incoming token", {
    idTokenLength: body.idToken.length,
  });
  console.log("[Auth/Google] idToken length:", body.idToken.length);

  try {
    console.log("[Auth/Google] Verifying Firebase ID token...");
    const firebaseAuth = getAuth();
    if (!firebaseAuth) {
      sendError(res, "Firebase is not initialized", 500);
      return;
    }
    const decoded = await firebaseAuth.verifyIdToken(body.idToken);

    const googleUid = decoded.uid;
    const googleEmail = decoded.email;
    const googleName = decoded.name;
    const googlePicture = decoded.picture;

    console.log("[Auth/Google] Token verified", {
      sub: googleUid,
      email: googleEmail,
    });

    if (!googleUid || !googleEmail) {
      console.error("[Auth/Google] Missing sub or email in Google account");
      sendError(
        res,
        "The Google account does not have a valid subject or email address",
        400,
      );
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
          data: {
            googleId: googleUid,
            avatarUrl: googlePicture ?? googleUser.avatarUrl,
          },
        });
        console.log("[Auth/Google] Google account linked", {
          userId: googleUser.id,
          email: googleUser.email,
        });
      }
    } else {
      console.log(
        "[Auth/Google] No existing user found - creating new user...",
      );
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
      "Login successful",
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
}

export async function registerFcmToken(
  req: Request,
  res: Response,
): Promise<void> {
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

  console.log("[Auth/FCM] FCM token registered", {
    userId,
    platform: body.platform,
  });
  sendSuccess(res, null, "FCM token registered successfully");
}
