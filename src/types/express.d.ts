import { UserRole } from "../../generated/prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: UserRole;
      };
      device?: {
        id: string;
        deviceId: string;
        elderProfileId: string;
      };
    }
  }
}
