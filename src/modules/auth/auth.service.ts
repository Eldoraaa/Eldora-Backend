import { getAuth } from "@/config/firebase";
import { UserRole } from "../../../generated/prisma/client";
import { signToken } from "@/utils/jwt.utils";
import { AppError } from "@/shared/errors";
import {
  createUser,
  findUserByEmail,
  findUserByFirebaseUidOrEmail,
  linkGoogleAccount,
} from "./auth.repository";

type AuthResult = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
};

function requireFirebaseAuth() {
  const firebaseAuth = getAuth();
  if (!firebaseAuth) {
    throw new AppError("Firebase is not initialized", 500);
  }
  return firebaseAuth;
}

function buildAuthResult(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}): AuthResult {
  return {
    token: signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function loginWithFirebasePassword(idToken: string): Promise<AuthResult> {
  const decoded = await requireFirebaseAuth().verifyIdToken(idToken);
  const firebaseUid = decoded.uid;
  const email = decoded.email;

  if (!firebaseUid || !email) {
    throw new AppError("Firebase token does not include a valid email", 400);
  }

  const user = await findUserByFirebaseUidOrEmail(firebaseUid, email);
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  return buildAuthResult(user);
}

export async function registerWithFirebase(data: {
  name: string;
  email: string;
  idToken: string;
}): Promise<void> {
  const decoded = await requireFirebaseAuth().verifyIdToken(data.idToken);
  const firebaseUid = decoded.uid;
  const tokenEmail = decoded.email;

  if (!firebaseUid || !tokenEmail) {
    throw new AppError("Firebase token does not include a valid email", 400);
  }

  if (tokenEmail.toLowerCase() !== data.email.toLowerCase()) {
    throw new AppError("Firebase token email must match registration email", 400);
  }

  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new AppError("An account with this email already exists.", 409);
  }

  await createUser({
    name: data.name,
    email: data.email,
    googleId: firebaseUid,
  });
}

export async function loginWithGoogle(idToken: string): Promise<AuthResult> {
  try {
    const decoded = await requireFirebaseAuth().verifyIdToken(idToken);
    const googleUid = decoded.uid;
    const googleEmail = decoded.email;
    const googleName = decoded.name;
    const googlePicture = decoded.picture;

    if (!googleUid || !googleEmail) {
      throw new AppError(
        "The Google account does not have a valid subject or email address",
        400
      );
    }

    let user = await findUserByFirebaseUidOrEmail(googleUid, googleEmail);

    if (user && !user.googleId) {
      user = await linkGoogleAccount(user.id, {
        googleId: googleUid,
        avatarUrl: googlePicture ?? user.avatarUrl,
      });
    }

    if (!user) {
      user = await createUser({
        email: googleEmail,
        name: googleName ?? googleEmail.split("@")[0],
        googleId: googleUid,
        avatarUrl: googlePicture ?? null,
      });
    }

    return buildAuthResult(user);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Google token is invalid or has expired", 401);
  }
}
