import { Router, type IRouter, type Request, type Response } from "express";
import { db, homeworkProgramsTable, homeworkExercisesTable, magicLinkTokensTable, clientsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendHomeworkReminderEmail } from "../lib/email";

const router: IRouter = Router();

// ── Zod schemas ────────────────────────────────────────────────────────────────

const NewProgramBody = z.object({
  clientId: z.string(),
  title: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const UpdateProgramBody = z.object({
  title: z.string().optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const NewExerciseBody = z.object({
  name: z.string().min(1),
  sets: z.number().int().optional().nullable(),
  reps: z.number().int().optional().nullable(),
  weight: z.number().int().optional().nullable(),
  unit: z.string().optional().default("kg"),
  durationSeconds: z.number().int().optional().nullable(),
  frequencyType: z.enum(["daily", "specific_days", "times_per_week"]).default("daily"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([]),
  timesPerWeek: z.number().int().optional().nullable(),
  timesPerDay: z.number().int().optional().default(1),
  videoUrl: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  position: z.number().int().optional().default(0),
});

const UpdateExerciseBody = NewExerciseBody.partial();

// ── Serialize helpers ─────────────────────────────────────────────────────────

function serializeProgram(p: typeof homeworkProgramsTable.$inferSelect) {
  return {
    id: p.id,
    clientId: p.clientId,
    title: p.title,
    notes: p.notes,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
}

function serializeExercise(e: typeof homeworkExercisesTable.$inferSelect) {
  return {
    id: e.id,
    programId: e.programId,
    name: e.name,
    sets: e.sets,
    reps: e.reps,
    weight: e.weight,
    unit: e.unit,
    durationSeconds: e.durationSeconds,
    frequencyType: e.frequencyType,
    daysOfWeek: (e.daysOfWeek as number[]) ?? [],
    timesPerDay: e.timesPerDay,
    videoUrl: e.videoUrl,
    instructions: e.instructions,
    position: e.position,
    createdAt: e.createdAt.toISOString(),
  };
}

// ── Programs ──────────────────────────────────────────────────────────────────

router.get("/homework/programs", async (req: Request, res: Response) => {
  const clientId = String(req.query["clientId"] ?? "");
  if (!clientId) { res.status(400).json({ error: "clientId required" }); return; }
  const rows = await db.select().from(homeworkProgramsTable)
    .where(eq(homeworkProgramsTable.clientId, clientId))
    .orderBy(homeworkProgramsTable.createdAt);
  res.json(rows.map(serializeProgram));
});

router.post("/homework/programs", async (req: Request, res: Response) => {
  const body = NewProgramBody.parse(req.body);
  const [row] = await db.insert(homeworkProgramsTable).values({
    clientId: body.clientId,
    title: body.title,
    notes: body.notes ?? null,
  }).returning();
  res.status(201).json(serializeProgram(row));
});

router.get("/homework/programs/:programId", async (req: Request, res: Response) => {
  const programId = String(req.params["programId"]);
  const [row] = await db.select().from(homeworkProgramsTable).where(eq(homeworkProgramsTable.id, programId));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeProgram(row));
});

router.patch("/homework/programs/:programId", async (req: Request, res: Response) => {
  const programId = String(req.params["programId"]);
  const body = UpdateProgramBody.parse(req.body);
  const [row] = await db.update(homeworkProgramsTable).set({
    ...(body.title !== undefined && { title: body.title }),
    ...(body.notes !== undefined && { notes: body.notes }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
  }).where(eq(homeworkProgramsTable.id, programId)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeProgram(row));
});

router.delete("/homework/programs/:programId", async (req: Request, res: Response) => {
  const programId = String(req.params["programId"]);
  await db.delete(homeworkProgramsTable).where(eq(homeworkProgramsTable.id, programId));
  res.status(204).send();
});

// ── Exercises ─────────────────────────────────────────────────────────────────

router.get("/homework/programs/:programId/exercises", async (req: Request, res: Response) => {
  const programId = String(req.params["programId"]);
  const rows = await db.select().from(homeworkExercisesTable)
    .where(eq(homeworkExercisesTable.programId, programId))
    .orderBy(homeworkExercisesTable.position, homeworkExercisesTable.createdAt);
  res.json(rows.map(serializeExercise));
});

router.post("/homework/programs/:programId/exercises", async (req: Request, res: Response) => {
  const programId = String(req.params["programId"]);
  const body = NewExerciseBody.parse(req.body);
  const [row] = await db.insert(homeworkExercisesTable).values({
    programId,
    name: body.name,
    sets: body.sets ?? null,
    reps: body.reps ?? null,
    weight: body.weight ?? null,
    unit: body.unit ?? "kg",
    frequencyType: body.frequencyType,
    daysOfWeek: body.daysOfWeek ?? [],
    timesPerDay: body.timesPerDay ?? 1,
    videoUrl: body.videoUrl ?? null,
    instructions: body.instructions ?? null,
    position: body.position ?? 0,
  }).returning();
  res.status(201).json(serializeExercise(row));
});

router.patch("/homework/exercises/:exerciseId", async (req: Request, res: Response) => {
  const exerciseId = String(req.params["exerciseId"]);
  const body = UpdateExerciseBody.parse(req.body);
  const [row] = await db.update(homeworkExercisesTable).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.sets !== undefined && { sets: body.sets }),
    ...(body.reps !== undefined && { reps: body.reps }),
    ...(body.weight !== undefined && { weight: body.weight }),
    ...(body.unit !== undefined && { unit: body.unit }),
    ...(body.frequencyType !== undefined && { frequencyType: body.frequencyType }),
    ...(body.daysOfWeek !== undefined && { daysOfWeek: body.daysOfWeek }),
    ...(body.timesPerDay !== undefined && { timesPerDay: body.timesPerDay }),
    ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl }),
    ...(body.instructions !== undefined && { instructions: body.instructions }),
    ...(body.position !== undefined && { position: body.position }),
  }).where(eq(homeworkExercisesTable.id, exerciseId)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeExercise(row));
});

router.delete("/homework/exercises/:exerciseId", async (req: Request, res: Response) => {
  const exerciseId = String(req.params["exerciseId"]);
  await db.delete(homeworkExercisesTable).where(eq(homeworkExercisesTable.id, exerciseId));
  res.status(204).send();
});

// ── Send reminder ─────────────────────────────────────────────────────────────

router.post("/homework/programs/:programId/send-reminder", async (req: Request, res: Response) => {
  const programId = String(req.params["programId"]);

  const [program] = await db.select().from(homeworkProgramsTable).where(eq(homeworkProgramsTable.id, programId));
  if (!program) { res.status(404).json({ error: "Program not found" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, program.clientId));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  if (!client.email) { res.status(400).json({ error: "Client has no email address" }); return; }

  const exercises = await db.select().from(homeworkExercisesTable)
    .where(eq(homeworkExercisesTable.programId, programId))
    .orderBy(homeworkExercisesTable.position);

  // Upsert magic link token (one per client, re-use if exists)
  let [tokenRow] = await db.select().from(magicLinkTokensTable)
    .where(eq(magicLinkTokensTable.clientId, client.id));

  if (!tokenRow) {
    const token = randomBytes(32).toString("hex");
    [tokenRow] = await db.insert(magicLinkTokensTable).values({
      clientId: client.id,
      token,
    }).returning();
  }

  const appUrl = process.env["APP_URL"] ?? `https://${process.env["REPLIT_DEV_DOMAIN"]}`;
  const magicLink = `${appUrl}/homework/${tokenRow.token}`;

  await sendHomeworkReminderEmail({
    toEmail: client.email,
    clientName: client.name,
    magicLink,
    programTitle: program.title,
    exercises: exercises.map((e) => ({
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      weight: e.weight,
      unit: e.unit,
      frequencyType: e.frequencyType,
      daysOfWeek: (e.daysOfWeek as number[]) ?? [],
      timesPerDay: e.timesPerDay,
      instructions: e.instructions,
      videoUrl: e.videoUrl,
    })),
  });

  res.json({ ok: true, magicLink });
});

// ── Public magic-link view ────────────────────────────────────────────────────

router.get("/homework/view/:token", async (req: Request, res: Response) => {
  const token = String(req.params["token"]);

  const [tokenRow] = await db.select().from(magicLinkTokensTable)
    .where(eq(magicLinkTokensTable.token, token));
  if (!tokenRow) { res.status(404).json({ error: "Not found" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, tokenRow.clientId));
  if (!client) { res.status(404).json({ error: "Not found" }); return; }

  const programs = await db.select().from(homeworkProgramsTable)
    .where(and(eq(homeworkProgramsTable.clientId, client.id), eq(homeworkProgramsTable.isActive, true)));

  const programsWithExercises = await Promise.all(
    programs.map(async (p) => {
      const exercises = await db.select().from(homeworkExercisesTable)
        .where(eq(homeworkExercisesTable.programId, p.id))
        .orderBy(homeworkExercisesTable.position);
      return {
        id: p.id,
        title: p.title,
        notes: p.notes,
        exercises: exercises.map(serializeExercise),
      };
    })
  );

  res.json({ clientName: client.name, programs: programsWithExercises });
});

export default router;
