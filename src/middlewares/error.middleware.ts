import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors";

function isRequestAbortedError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const error = err as { type?: unknown; code?: unknown };
  return error.type === "request.aborted" || error.code === "ECONNABORTED";
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isRequestAbortedError(err)) {
    res.status(400).json({
      success: false,
      message: "Audio upload was interrupted before the full file was received.",
    });
    return;
  }

  if (err instanceof ZodError) {
    const fields = err.issues.map((e) => ({
      path: (e.path as (string | number)[]).join("."),
      message: e.message,
    }));
    res.status(422).json({ success: false, message: "Validasi gagal", errors: fields });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  console.error("[Error]", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ success: false, message });
}
