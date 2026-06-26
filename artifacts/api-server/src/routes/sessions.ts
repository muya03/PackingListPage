import { Router, type IRouter } from "express";
import { db, packingSessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const insertSessionSchema = z.object({
  name: z.string().min(1),
  meta: z.record(z.unknown()),
  rows: z.array(z.record(z.unknown())),
});

router.get("/sessions", async (_req, res) => {
  try {
    const sessions = await db
      .select({
        id: packingSessionsTable.id,
        name: packingSessionsTable.name,
        created_at: packingSessionsTable.created_at,
        updated_at: packingSessionsTable.updated_at,
      })
      .from(packingSessionsTable)
      .orderBy(desc(packingSessionsTable.updated_at));
    res.json(sessions);
  } catch {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.get("/sessions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }
  try {
    const [session] = await db
      .select()
      .from(packingSessionsTable)
      .where(eq(packingSessionsTable.id, id));
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(session);
  } catch {
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

router.post("/sessions", async (req, res) => {
  const parsed = insertSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid session data", details: parsed.error.flatten() });
    return;
  }
  try {
    const [created] = await db
      .insert(packingSessionsTable)
      .values({
        name: parsed.data.name,
        meta: parsed.data.meta,
        rows: parsed.data.rows,
      })
      .returning();
    res.status(201).json(created);
  } catch {
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.delete("/sessions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }
  try {
    await db.delete(packingSessionsTable).where(eq(packingSessionsTable.id, id));
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete session" });
  }
});

export default router;
