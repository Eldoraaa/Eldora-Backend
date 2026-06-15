import type { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import { AppError } from "@/shared/errors";
import { getElderAnalytics } from "./analytics.service";

export async function getElderAnalyticsController(req: Request, res: Response) {
  const { from, to, homeId } = req.query as Record<string, string | undefined>;

  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new AppError("Invalid date range", 400);
  }

  toDate.setHours(23, 59, 59, 999);
  fromDate.setHours(0, 0, 0, 0);

  const result = await getElderAnalytics(req.user!.id, fromDate, toDate, homeId ?? null);
  sendSuccess(res, result, "Analytics retrieved");
}
