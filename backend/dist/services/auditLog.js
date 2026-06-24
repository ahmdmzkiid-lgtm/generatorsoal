"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const db_1 = __importDefault(require("../db"));
const client_1 = require("@prisma/client");
async function logAudit(params) {
    await db_1.default.auditLog.create({
        data: {
            actorId: params.actorId ?? null,
            action: params.action,
            targetId: params.targetId ?? null,
            metadata: (params.metadata ?? client_1.Prisma.JsonNull),
        },
    });
}
//# sourceMappingURL=auditLog.js.map