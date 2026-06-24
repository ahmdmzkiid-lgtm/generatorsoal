import prisma from "../db";
import { Prisma } from "@prisma/client";

export type AuditAction =
  | "CREATE_SKILL"
  | "UPDATE_SKILL"
  | "DELETE_SKILL"
  | "TOGGLE_SKILL"
  | "GENERATE_QUESTIONS"
  | "AI_REVIEW"
  | "HUMAN_REVIEW"
  | "DELETE_QUESTION"
  | "PUBLISH_QUESTION"
  | "EXPORT_QUESTIONS"
  | "CREATE_TEMPLATE"
  | "LOGIN";

export async function logAudit(params: {
  actorId?: string | null;
  action: AuditAction;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      targetId: params.targetId ?? null,
      metadata: (params.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });
}
