import { z } from "zod";

const rejectedTemplateTokens = new Set([                 
  "changeme",
  "change_me",
  "your_token",
]);

export const productionPairingTokenSchema = z
  .string()
  .trim()
  .min(16, "Pairing token must be at least 16 characters")
  .max(80)
  .refine((value) => !rejectedTemplateTokens.has(value.toLowerCase()), {
    message: "Pairing token must not use a template value",
  });
