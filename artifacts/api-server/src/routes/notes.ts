import { Router, type IRouter, type Request, type Response } from "express";
import { db, notesTable, sessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateSessionNoteBody, CreateSessionNoteParams, ListSessionNotesParams, UpdateNoteBody, UpdateNoteParams, DeleteNoteParams } from "@workspace/api-zod";

const router: IRouter = Router();

type NoteRow = typeof notesTable.$inferSelect;
function serialize(n: NoteRow) {
  return {
    id: n.id,
    sessionId: n.sessionId,
    goalId: n.goalId,
    content: n.content,
    kind: n.kind as "observation" | "win" | "concern" | "action" | "measurement",
    important: n.important,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/sessions/:sessionId/notes", async (req, res) => {
  const { sessionId } = ListSessionNotesParams.parse(req.params);
  const rows = await db.select().from(notesTable).where(eq(notesTable.sessionId, sessionId)).orderBy(desc(notesTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/sessions/:sessionId/notes", async (req: Request, res: Response) => {
  const { sessionId } = CreateSessionNoteParams.parse(req.params);
  const body = CreateSessionNoteBody.parse(req.body);
  const [sess] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!sess) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const [row] = await db.insert(notesTable).values({
    sessionId,
    content: body.content,
    kind: body.kind,
    important: body.important ?? false,
    goalId: body.goalId ?? null,
  }).returning();
  res.status(201).json(serialize(row));
});

router.patch("/notes/:noteId", async (req: Request, res: Response) => {
  const { noteId } = UpdateNoteParams.parse(req.params);
  const body = UpdateNoteBody.parse(req.body);
  const [row] = await db.update(notesTable).set({
    ...(body.content !== undefined && { content: body.content }),
    ...(body.kind !== undefined && { kind: body.kind }),
    ...(body.important !== undefined && { important: body.important }),
    ...(body.goalId !== undefined && { goalId: body.goalId }),
  }).where(eq(notesTable.id, noteId)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(row));
});

router.delete("/notes/:noteId", async (req, res) => {
  const { noteId } = DeleteNoteParams.parse(req.params);
  await db.delete(notesTable).where(eq(notesTable.id, noteId));
  res.status(204).send();
});

export default router;
