export type AuditAction = "CREATE_SKILL" | "UPDATE_SKILL" | "DELETE_SKILL" | "TOGGLE_SKILL" | "GENERATE_QUESTIONS" | "AI_REVIEW" | "HUMAN_REVIEW" | "DELETE_QUESTION" | "PUBLISH_QUESTION" | "EXPORT_QUESTIONS" | "CREATE_TEMPLATE" | "LOGIN";
export declare function logAudit(params: {
    actorId?: string | null;
    action: AuditAction;
    targetId?: string | null;
    metadata?: Record<string, unknown> | null;
}): Promise<void>;
//# sourceMappingURL=auditLog.d.ts.map