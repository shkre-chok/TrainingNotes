import { Router, type IRouter, type Request, type Response } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateClientBody, UpdateClientBody, GetClientParams, UpdateClientParams, DeleteClientParams } from "@workspace/api-zod";

const router: IRouter = Router();

function toDateStr(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d;
  return d.toISOString().slice(0, 10);
}

function serialize(c: typeof clientsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    condition: c.condition,
    startDate: c.startDate,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/clients", async (_req, res) => {
  const rows = await db.select().from(clientsTable).orderBy(clientsTable.name);
  res.json(rows.map(serialize));
});

router.post("/clients", async (req, res) => {
  const body = CreateClientBody.parse(req.body);
  const [row] = await db.insert(clientsTable).values({
    name: body.name,
    phone: body.phone ?? null,
    email: body.email ?? null,
    condition: body.condition ?? null,
    startDate: toDateStr(body.startDate),
    notes: body.notes ?? null,
  }).returning();
  res.status(201).json(serialize(row));
});

router.get("/clients/:clientId", async (req: Request, res: Response) => {
  const { clientId } = GetClientParams.parse(req.params);
  const [row] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(row));
});

router.patch("/clients/:clientId", async (req: Request, res: Response) => {
  const { clientId } = UpdateClientParams.parse(req.params);
  const body = UpdateClientBody.parse(req.body);
  const [row] = await db.update(clientsTable).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.phone !== undefined && { phone: body.phone }),
    ...(body.email !== undefined && { email: body.email }),
    ...(body.condition !== undefined && { condition: body.condition }),
    ...(body.startDate !== undefined && { startDate: toDateStr(body.startDate) }),
    ...(body.notes !== undefined && { notes: body.notes }),
  }).where(eq(clientsTable.id, clientId)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(row));
});

router.delete("/clients/:clientId", async (req, res) => {
  const { clientId } = DeleteClientParams.parse(req.params);
  await db.delete(clientsTable).where(eq(clientsTable.id, clientId));
  res.status(204).send();
});

export default router;
