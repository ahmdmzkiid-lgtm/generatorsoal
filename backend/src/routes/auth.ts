import { Router, type Request, type Response } from "express";
import { authenticateUser, signToken, verifyToken } from "../services/auth";
import prisma from "../db";
import { logAudit } from "../services/auditLog";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email dan password diperlukan" });
      return;
    }

    const result = await authenticateUser(email, password);
    if (!result) {
      res.status(401).json({ error: "Email atau password salah" });
      return;
    }

    logAudit({
      actorId: result.user.id,
      action: "LOGIN",
      metadata: { email: result.user.email },
    }).catch(() => {});

    res.json(result);
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Gagal login" });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      res.status(404).json({ error: "User tidak ditemukan" });
      return;
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Gagal mengambil data user" });
  }
});

// GET /api/auth/users — list all users
router.get("/users", authenticate, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Gagal mengambil data users" });
  }
});

// GET /api/auth/audit-logs — list audit logs (admin only)
router.get("/audit-logs", authenticate, authorize("ADMIN"), async (req: Request, res: Response) => {
  try {
    const actorId = req.query.actorId as string | undefined;
    const action = req.query.action as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const where: Record<string, unknown> = {};

    if (actorId) where.actorId = actorId;
    if (action) where.action = action;

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    res.status(500).json({ error: "Gagal mengambil audit log" });
  }
});

export default router;
