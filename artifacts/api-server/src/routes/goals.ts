import { Router, type IRouter, type Request, type Response } from "express";
import { db, goalsTable, clientsTable } from "@workspace/db";
import { eq, desc, and, type SQL } from "drizzle-orm";
import { CreateGoalBody, UpdateGoalBody, GetGoalParams, UpdateGoalParams, DeleteGoalParams, ListGoalsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function toDateStr(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d;
  return d.toISOString().slice(0, 10);
}

type GoalRow = typeof goalsTable.$inferSelect;
function serialize(g: GoalRow, clientName: string) {
  return {
    id: g.id,
    clientId: g.clientId,
    clientName,
    title: g.title,
    description: g.description,
    category: g.category,
    status: g.status as "active" | "achieved" | "paused" | "archived",
    progress: g.progress,
    targetDate: g.targetDate,
    createdAt: g.createdAt.toISOString(),
  };
}

router.get("/goals", async (req, res) => {
  const params = ListGoalsQueryParams.parse(req.query);
  const conditions: SQL[] = [];
  if (params.clientId) conditions.push(eq(goalsTable.clientId, params.clientId));
  if (params.status) conditions.push(eq(goalsTable.status, params.status));
  const rows = await db
    .select({ goal: goalsTable, clientName: clientsTable.name })
    .from(goalsTable)
    .innerJoin(clientsTable, eq(clientsTable.id, goalsTable.clientId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(goalsTable.createdAt));
  res.json(rows.map((r) => serialize(r.goal, r.clientName)));
});

router.post("/goals", async (req: Request, res: Response) => {
  const body = CreateGoalBody.parse(req.body);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, body.clientId));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  const [row] = await db.insert(goalsTable).values({
    clientId: body.clientId,
    title: body.title,
    description: body.description ?? null,
    category: body.category ?? null,
    status: body.status ?? "active",
    progress: body.progress ?? 0,
    targetDate: toDateStr(body.targetDate),
  }).returning();
  res.status(201).json(serialize(row, client.name));
});

router.get("/goals/:goalId", async (req: Request, res: Response) => {
  const { goalId } = GetGoalParams.parse(req.params);
  const [row] = await db
    .select({ goal: goalsTable, clientName: clientsTable.name })
    .from(goalsTable)
    .innerJoin(clientsTable, eq(clientsTable.id, goalsTable.clientId))
    .where(eq(goalsTable.id, goalId));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(row.goal, row.clientName));
});

router.patch("/goals/:goalId", async (req: Request, res: Response) => {
  const { goalId } = UpdateGoalParams.parse(req.params);
  const body = UpdateGoalBody.parse(req.body);
  const [updated] = await db.update(goalsTable).set({
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.category !== undefined && { category: body.category }),
    ...(body.status !== undefined && { status: body.status }),
    ...(body.progress !== undefined && { progress: body.progress }),
    ...(body.targetDate !== undefined && { targetDate: toDateStr(body.targetDate) }),
  }).where(eq(goalsTable.id, goalId)).returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, updated.clientId));
  res.json(serialize(updated, client?.name ?? ""));
});

router.delete("/goals/:goalId", async (req, res) => {
  const { goalId } = DeleteGoalParams.parse(req.params);
  await db.delete(goalsTable).where(eq(goalsTable.id, goalId));
  res.status(204).send();
});

export default router;
