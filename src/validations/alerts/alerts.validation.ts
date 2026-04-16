import { z } from "zod";

export const listQuerySchema = z.object({
  status: z.enum(["active", "acknowledged", "resolved"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
