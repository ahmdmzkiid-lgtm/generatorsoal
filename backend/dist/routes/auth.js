"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../services/auth");
const db_1 = __importDefault(require("../db"));
const auditLog_1 = require("../services/auditLog");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: "Email dan password diperlukan" });
            return;
        }
        const result = await (0, auth_1.authenticateUser)(email, password);
        if (!result) {
            res.status(401).json({ error: "Email atau password salah" });
            return;
        }
        (0, auditLog_1.logAudit)({
            actorId: result.user.id,
            action: "LOGIN",
            metadata: { email: result.user.email },
        }).catch(() => { });
        res.json(result);
    }
    catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Gagal login" });
    }
});
// GET /api/auth/me
router.get("/me", auth_2.authenticate, async (req, res) => {
    try {
        const user = await db_1.default.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, name: true, email: true, role: true },
        });
        if (!user) {
            res.status(404).json({ error: "User tidak ditemukan" });
            return;
        }
        res.json(user);
    }
    catch (err) {
        console.error("Error fetching user:", err);
        res.status(500).json({ error: "Gagal mengambil data user" });
    }
});
// GET /api/auth/users — list all users
router.get("/users", auth_2.authenticate, async (_req, res) => {
    try {
        const users = await db_1.default.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        });
        res.json(users);
    }
    catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Gagal mengambil data users" });
    }
});
// GET /api/auth/audit-logs — list audit logs (admin only)
router.get("/audit-logs", auth_2.authenticate, (0, auth_2.authorize)("ADMIN"), async (req, res) => {
    try {
        const actorId = req.query.actorId;
        const action = req.query.action;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const offset = Number(req.query.offset) || 0;
        const where = {};
        if (actorId)
            where.actorId = actorId;
        if (action)
            where.action = action;
        if (startDate || endDate) {
            const createdAt = {};
            if (startDate)
                createdAt.gte = new Date(startDate);
            if (endDate)
                createdAt.lte = new Date(endDate);
            where.createdAt = createdAt;
        }
        const [logs, total] = await Promise.all([
            db_1.default.auditLog.findMany({
                where,
                include: {
                    actor: { select: { id: true, name: true, email: true } },
                },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
            }),
            db_1.default.auditLog.count({ where }),
        ]);
        res.json({ logs, total });
    }
    catch (err) {
        console.error("Error fetching audit logs:", err);
        res.status(500).json({ error: "Gagal mengambil audit log" });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map