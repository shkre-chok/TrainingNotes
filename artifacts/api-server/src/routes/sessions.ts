import { Router, type IRouter, type Request, type Response } from "express";
import { db, sessionsTable, clientsTable, notesTable, goalsTable } from "@workspace/db";
import { eq, desc, sql, and, type SQL } from "drizzle-orm";
import {
  CreateSessionBody,
  UpdateSessionBody,
  GetSessionParams,
  UpdateSessionParams,
  DeleteSessionParams,
  ListSessionsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

type SessRow = typeof sessionsTable.$inferSelect;
function serialize(s: SessRow, clientName: string, noteCount: number) {
  return {
    id: s.id,
    clientId: s.clientId,
    clientName,
    title: s.title,
    sessionDate: s.sessionDate.toISOString(),
    durationMinutes: s.durationMinutes,
    focusArea: s.focusArea,
    painLevel: s.painLevel,
    energyLevel: s.energyLevel,
    summary: s.summary,
    noteCount,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/sessions", async (req, res) => {
  const params = ListSessionsQueryParams.parse(req.query);
  const conditions: SQL[] = [];
  if (params.clientId) conditions.push(eq(sessionsTable.clientId, params.clientId));
  const rows = await db
    .select({
      session: sessionsTable,
      clientName: clientsTable.name,
      noteCount: sql<number>`coalesce((select count(*)::int from ${notesTable} where ${notesTable.sessionId} = ${sessionsTable.id}), 0)`,
    })
    .from(sessionsTable)
    .innerJoin(clientsTable, eq(clientsTable.id, sessionsTable.clientId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sessionsTable.sessionDate));
  res.json(rows.map((r) => serialize(r.session, r.clientName, Number(r.noteCount))));
});

router.post("/sessions", async (req: Request, res: Response) => {
  const body = CreateSessionBody.parse(req.body);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, body.clientId));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  const [row] = await db.insert(sessionsTable).values({
    clientId: body.clientId,
    title: body.title ?? null,
    sessionDate: body.sessionDate,
    durationMinutes: body.durationMinutes ?? null,
    focusArea: body.focusArea ?? null,
    painLevel: body.painLevel ?? null,
    energyLevel: body.energyLevel ?? null,
    summary: body.summary ?? null,
  }).returning();
  res.status(201).json(serialize(row, client.name, 0));
});

router.get("/sessions/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = GetSessionParams.parse(req.params);
  const [row] = await db
    .select({ session: sessionsTable, clientName: clientsTable.name })
    .from(sessionsTable)
    .innerJoin(clientsTable, eq(clientsTable.id, sessionsTable.clientId))
    .where(eq(sessionsTable.id, sessionId));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const noteRows = await db.select().from(notesTable).where(eq(notesTable.sessionId, sessionId)).orderBy(desc(notesTable.createdAt));
  const goalRows = await db.select().from(goalsTable).where(eq(goalsTable.clientId, row.session.clientId)).orderBy(desc(goalsTable.createdAt));
  const base = serialize(row.session, row.clientName, noteRows.length);
  res.json({
    ...base,
    notes: noteRows.map((n) => ({
      id: n.id,
      sessionId: n.sessionId,
      goalId: n.goalId,
      content: n.content,
      kind: n.kind as "observation" | "win" | "concern" | "action" | "measurement",
      important: n.important,
      createdAt: n.createdAt.toISOString(),
    })),
    goals: goalRows.map((g) => ({
      id: g.id,
      clientId: g.clientId,
      clientName: row.clientName,
      title: g.title,
      description: g.description,
      category: g.category,
      status: g.status as "active" | "achieved" | "paused" | "archived",
      progress: g.progress,
      targetDate: g.targetDate,
      createdAt: g.createdAt.toISOString(),
    })),
  });
});

router.patch("/sessions/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = UpdateSessionParams.parse(req.params);
  const body = UpdateSessionBody.parse(req.body);
  const [updated] = await db.update(sessionsTable).set({
    ...(body.title !== undefined && { title: body.title }),
    ...(body.sessionDate !== undefined && { sessionDate: body.sessionDate }),
    ...(body.durationMinutes !== undefined && { durationMinutes: body.durationMinutes }),
    ...(body.focusArea !== undefined && { focusArea: body.focusArea }),
    ...(body.painLevel !== undefined && { painLevel: body.painLevel }),
    ...(body.energyLevel !== undefined && { energyLevel: body.energyLevel }),
    ...(body.summary !== undefined && { summary: body.summary }),
  }).where(eq(sessionsTable.id, sessionId)).returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, updated.clientId));
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(notesTable).where(eq(notesTable.sessionId, sessionId));
  res.json(serialize(updated, client?.name ?? "", Number(count)));
});

router.delete("/sessions/:sessionId", async (req, res) => {
  const { sessionId } = DeleteSessionParams.parse(req.params);
  await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
  res.status(204).send();
});

export default router;
