import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  homeworkProgramsTable,
  homeworkExercisesTable,
  homeworkMessagesTable,
  magicLinkTokensTable,
  homeworkPushTokensTable,
  clientsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { sendProgramHomeworkReminder } from "../lib/homeworkReminders";

const router: IRouter = Router();

// ── Zod schemas ────────────────────────────────────────────────────────────────

const ReminderSchedule = z.string().regex(/^weekly:[0-6]:([01]\d|2[0-3]):[0-5]\d$/);
const ReminderTimezone = z.string().min(1).refine((value) => {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Invalid reminder timezone");

const NewProgramBody = z.object({
  clientId: z.string(),
  title: z.string().min(1),
  notes: z.string().optional().nullable(),
  reminderSchedule: ReminderSchedule.optional().nullable(),
  reminderTimezone: ReminderTimezone.optional().nullable(),
  reminderEnabled: z.boolean().optional().default(false),
}).refine(
  (body) => !body.reminderEnabled || Boolean(body.reminderSchedule && body.reminderTimezone),
  "An enabled reminder requires a schedule and timezone",
);

const UpdateProgramBody = z.object({
  title: z.string().optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  reminderSchedule: ReminderSchedule.optional().nullable(),
  reminderTimezone: ReminderTimezone.optional().nullable(),
  reminderEnabled: z.boolean().optional(),
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

const NewMessageBody = z.object({
  content: z.string().max(5000).optional().nullable(),
  audioUrl: z.string().max(2048).optional().nullable(),
}).refine(
  (body) => Boolean(body.audioUrl) || Boolean(body.content?.trim()),
  "A message must include text or a voice note",
);

const HomeworkPushTokenBody = z.object({
  token: z.string().min(1).max(512),
  platform: z.enum(["ios", "android", "web", "unknown"]).optional().default("unknown"),
});

// ── Serialize helpers ─────────────────────────────────────────────────────────

function serializeProgram(p: typeof homeworkProgramsTable.$inferSelect) {
  return {
    id: p.id,
    clientId: p.clientId,
    title: p.title,
    notes: p.notes,
    isActive: p.isActive,
    reminderSchedule: p.reminderSchedule,
    reminderTimezone: p.reminderTimezone,
    reminderEnabled: p.reminderEnabled,
    lastSentAt: p.lastSentAt?.toISOString() ?? null,
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

function serializeMessage(m: typeof homeworkMessagesTable.$inferSelect) {
  return {
    id: m.id,
    programId: m.programId,
    clientId: m.clientId,
    senderRole: m.senderRole,
    content: m.content,
    audioUrl: m.audioUrl,
    createdAt: m.createdAt.toISOString(),
  };
}

async function getProgram(programId: string) {
  const [program] = await db.select().from(homeworkProgramsTable)
    .where(eq(homeworkProgramsTable.id, programId));
  return program;
}

async function createMessage(
  programId: string,
  senderRole: "client" | "practitioner",
  body: z.infer<typeof NewMessageBody>,
) {
  const program = await getProgram(programId);
  if (!program) return null;

  const [message] = await db.insert(homeworkMessagesTable).values({
    programId,
    clientId: program.clientId,
    senderRole,
    content: body.content?.trim() || null,
    audioUrl: body.audioUrl || null,
  }).returning();
  return message;
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
    reminderSchedule: body.reminderSchedule ?? null,
    reminderTimezone: body.reminderTimezone ?? null,
    reminderEnabled: body.reminderEnabled,
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
  const existing = await getProgram(programId);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const reminderEnabled = body.reminderEnabled ?? existing.reminderEnabled;
  const reminderSchedule = body.reminderSchedule === undefined
    ? existing.reminderSchedule
    : body.reminderSchedule;
  const reminderTimezone = body.reminderTimezone === undefined
    ? existing.reminderTimezone
    : body.reminderTimezone;
  if (reminderEnabled && (!reminderSchedule || !reminderTimezone)) {
    res.status(400).json({ error: "An enabled reminder requires a schedule and timezone" });
    return;
  }
  const [row] = await db.update(homeworkProgramsTable).set({
    ...(body.title !== undefined && { title: body.title }),
    ...(body.notes !== undefined && { notes: body.notes }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
    ...(body.reminderSchedule !== undefined && { reminderSchedule: body.reminderSchedule }),
    ...(body.reminderTimezone !== undefined && { reminderTimezone: body.reminderTimezone }),
    ...(body.reminderEnabled !== undefined && { reminderEnabled: body.reminderEnabled }),
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
    durationSeconds: body.durationSeconds ?? null,
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
    ...(body.durationSeconds !== undefined && { durationSeconds: body.durationSeconds }),
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

// ── Messages ──────────────────────────────────────────────────────────────────

router.get("/homework/programs/:programId/messages", async (req: Request, res: Response) => {
  const programId = String(req.params["programId"]);
  const program = await getProgram(programId);
  if (!program) { res.status(404).json({ error: "Program not found" }); return; }

  const rows = await db.select().from(homeworkMessagesTable)
    .where(eq(homeworkMessagesTable.programId, programId))
    .orderBy(homeworkMessagesTable.createdAt);
  res.json(rows.map(serializeMessage));
});

router.post("/homework/programs/:programId/messages", async (req: Request, res: Response) => {
  const programId = String(req.params["programId"]);
  const parsed = NewMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const row = await createMessage(programId, "practitioner", parsed.data);
  if (!row) { res.status(404).json({ error: "Program not found" }); return; }
  res.status(201).json(serializeMessage(row));
});

// ── Send reminder ─────────────────────────────────────────────────────────────

router.post("/homework/programs/:programId/send-reminder", async (req: Request, res: Response) => {
  const programId = String(req.params["programId"]);
  const [program] = await db.select().from(homeworkProgramsTable)
    .where(eq(homeworkProgramsTable.id, programId));
  if (!program) { res.status(404).json({ error: "Program not found" }); return; }

  try {
    const result = await sendProgramHomeworkReminder(programId);
    res.json({ ok: true, magicLink: result.magicLink });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send reminder";
    if (message === "Client has no email address or app notifications enabled") {
      res.status(400).json({ error: message });
      return;
    }
    if (message === "Program not found" || message === "Client not found") {
      res.status(404).json({ error: message });
      return;
    }
    req.log.error({ err: error, programId }, "Homework reminder failed");
    res.status(500).json({ error: "Unable to send reminder" });
  }
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
        reminderEnabled: p.reminderEnabled,
        reminderSchedule: p.reminderSchedule,
        exercises: exercises.map(serializeExercise),
        messages: (await db.select().from(homeworkMessagesTable)
          .where(eq(homeworkMessagesTable.programId, p.id))
          .orderBy(homeworkMessagesTable.createdAt)).map(serializeMessage),
      };
    })
  );

  res.json({ clientName: client.name, programs: programsWithExercises });
});

router.post("/homework/view/:token/programs/:programId/messages", async (req: Request, res: Response) => {
  const token = String(req.params["token"]);
  const programId = String(req.params["programId"]);

  const parsed = NewMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [tokenRow] = await db.select().from(magicLinkTokensTable)
    .where(eq(magicLinkTokensTable.token, token));
  if (!tokenRow) { res.status(404).json({ error: "Not found" }); return; }

  const [program] = await db.select().from(homeworkProgramsTable)
    .where(and(
      eq(homeworkProgramsTable.id, programId),
      eq(homeworkProgramsTable.clientId, tokenRow.clientId),
      eq(homeworkProgramsTable.isActive, true),
    ));
  if (!program) { res.status(404).json({ error: "Program not found" }); return; }

  const row = await createMessage(programId, "client", parsed.data);
  if (!row) { res.status(404).json({ error: "Program not found" }); return; }
  res.status(201).json(serializeMessage(row));
});

router.post("/homework/view/:token/push-token", async (req: Request, res: Response) => {
  const token = String(req.params["token"]);
  const parsed = HomeworkPushTokenBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [tokenRow] = await db.select().from(magicLinkTokensTable)
    .where(eq(magicLinkTokensTable.token, token));
  if (!tokenRow) { res.status(404).json({ error: "Not found" }); return; }

  await db.insert(homeworkPushTokensTable).values({
    clientId: tokenRow.clientId,
    token: parsed.data.token,
    platform: parsed.data.platform,
  }).onConflictDoUpdate({
    target: homeworkPushTokensTable.token,
    set: {
      clientId: tokenRow.clientId,
      platform: parsed.data.platform,
      updatedAt: new Date(),
    },
  });

  res.json({ ok: true });
});

export default router;
