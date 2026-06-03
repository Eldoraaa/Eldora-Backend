import { z } from "zod";

export const processVoiceTextSchema = z.object({
  transcript: z.string().trim().min(1).max(1000),
  deviceId: z.string().trim().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ProcessVoiceTextInput = z.infer<typeof processVoiceTextSchema>;
