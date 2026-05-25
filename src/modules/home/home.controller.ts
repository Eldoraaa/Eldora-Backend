import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import { getHomeSummary } from "./home.service";

export async function getSummary(req: Request, res: Response): Promise<void> {
  const summary = await getHomeSummary(req.user!.id);
  sendSuccess(res, summary);
}
