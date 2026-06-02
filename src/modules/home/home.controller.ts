import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import {
  changeHomeMemberRole,
  createInviteForHome,
  createHome,
  deleteHomeMember,
  getHomeSettings,
  getHomeSummary,
  getHomes,
  joinHomeWithInviteCode,
  updateHomeSettings,
} from "./home.service";
import {
  createHomeInvitationSchema,
  createHomeSchema,
  joinHomeSchema,
  updateHomeMemberRoleSchema,
  updateHomeSchema,
} from "./home.validation";

export async function getSummary(req: Request, res: Response): Promise<void> {
  const summary = await getHomeSummary(req.user!.id);
  sendSuccess(res, summary);
}

export async function listHomes(req: Request, res: Response): Promise<void> {
  const homes = await getHomes(req.user!.id);
  sendSuccess(res, homes);
}

export async function createHomeController(
  req: Request,
  res: Response
): Promise<void> {
  const body = createHomeSchema.parse(req.body);
  const home = await createHome(req.user!.id, body);
  sendSuccess(res, home, "Home created", 201);
}

export async function joinHomeController(
  req: Request,
  res: Response
): Promise<void> {
  const body = joinHomeSchema.parse(req.body);
  const home = await joinHomeWithInviteCode(req.user!.id, body);
  sendSuccess(res, home, "Home joined");
}

export async function createHomeInvitationController(
  req: Request,
  res: Response
): Promise<void> {
  const body = createHomeInvitationSchema.parse(req.body);
  const invitation = await createInviteForHome(
    req.user!.id,
    req.params.id as string,
    body
  );
  sendSuccess(res, invitation, "Invitation created", 201);
}

export async function getHomeSettingsController(
  req: Request,
  res: Response
): Promise<void> {
  const settings = await getHomeSettings(req.user!.id, req.params.id as string);
  sendSuccess(res, settings);
}

export async function updateHomeSettingsController(
  req: Request,
  res: Response
): Promise<void> {
  const body = updateHomeSchema.parse(req.body);
  const home = await updateHomeSettings(
    req.user!.id,
    req.params.id as string,
    body
  );
  sendSuccess(res, home, "Home updated");
}

export async function updateHomeMemberRoleController(
  req: Request,
  res: Response
): Promise<void> {
  const body = updateHomeMemberRoleSchema.parse(req.body);
  await changeHomeMemberRole(
    req.user!.id,
    req.params.id as string,
    req.params.memberId as string,
    body.role
  );
  sendSuccess(res, null, "Member role updated");
}

export async function removeHomeMemberController(
  req: Request,
  res: Response
): Promise<void> {
  await deleteHomeMember(
    req.user!.id,
    req.params.id as string,
    req.params.memberId as string
  );
  sendSuccess(res, null, "Member removed");
}
