import { z } from "zod";

export const productionPairingTokenSchema = z
  .string()
  .trim()
  .min(4, "Pairing token is required")
  .max(32, "Pairing token is too long");
