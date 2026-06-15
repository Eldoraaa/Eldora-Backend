import { Request, Response } from "express";
import { sendSuccess } from "@/utils/response.utils";
import {
  addEmergencyContact,
  changeHomeMemberRole,
  createInviteForHome,
  createHome,
  deleteHomeMember,
  getEmergencyContacts,
  getHomeSettings,
  getHomeSummary,
  getHomes,
  getSafetySummary,
  getWellnessSummary,
  removeEmergencyContact,
  joinHomeWithInviteCode,
  updateHomeSettings,
} from "./home.service";
import {
  createEmergencyContactSchema,
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

export async function getSafetySummaryController(
  req: Request,
  res: Response
): Promise<void> {
  const homeId = typeof req.query.homeId === "string" ? req.query.homeId : undefined;
  const summary = await getSafetySummary(req.user!.id, homeId);
  sendSuccess(res, summary);
}

export async function getWellnessSummaryController(
  req: Request,
  res: Response
): Promise<void> {
  const homeId = typeof req.query.homeId === "string" ? req.query.homeId : undefined;
  const startDate = typeof req.query.startDate === "string" ? new Date(req.query.startDate) : undefined;
  const endDate = typeof req.query.endDate === "string" ? new Date(req.query.endDate) : undefined;
  const summary = await getWellnessSummary(req.user!.id, homeId, startDate, endDate);
  sendSuccess(res, summary);
}

export async function listEmergencyContactsController(
  req: Request,
  res: Response
): Promise<void> {
  const homeId = typeof req.query.homeId === "string" ? req.query.homeId : undefined;
  const contacts = await getEmergencyContacts(req.user!.id, homeId);
  sendSuccess(res, contacts);
}

export async function createEmergencyContactController(
  req: Request,
  res: Response
): Promise<void> {
  const body = createEmergencyContactSchema.parse(req.body);
  const contact = await addEmergencyContact(req.user!.id, body);
  sendSuccess(res, contact, "Emergency contact created", 201);
}

export async function deleteEmergencyContactController(
  req: Request,
  res: Response
): Promise<void> {
  await removeEmergencyContact(req.user!.id, req.params.contactId as string);
  sendSuccess(res, null, "Emergency contact removed");
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
