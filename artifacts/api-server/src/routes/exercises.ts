import { Router, type Request, type Response, type IRouter } from "express";
import { db } from "@workspace/db";
import { exercisesTable, sessionsTable, type ExerciseSet } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  ListSessionExercisesParams,
  CreateSessionExerciseParams,
  CreateSessionExerciseBody,
  UpdateExerciseParams,
  UpdateExerciseBody,
  DeleteExerciseParams,
  GetClientExerciseProgressParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

type ExerciseRow = typeof exercisesTable.$inferSelect;
function serialize(e: ExerciseRow) {
  return {
    id: e.id,
    sessionId: e.sessionId,
    name: e.name,
    unit: e.unit as "kg" | "lb",
    sets: (e.sets ?? []) as ExerciseSet[],
    notes: e.notes,
    position: e.position,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/sessions/:sessionId/exercises", async (req: Request, res: Response) => {
  const { sessionId } = ListSessionExercisesParams.parse(req.params);
  const rows = await db
    .select()
    .from(exercisesTable)
    .where(eq(exercisesTable.sessionId, sessionId))
    .orderBy(asc(exercisesTable.position), asc(exercisesTable.createdAt));
  res.json(rows.map(serialize));
});

router.post("/sessions/:sessionId/exercises", async (req: Request, res: Response) => {
  const { sessionId } = CreateSessionExerciseParams.parse(req.params);
  const body = CreateSessionExerciseBody.parse(req.body);

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const [row] = await db
    .insert(exercisesTable)
    .values({
      sessionId,
      name: body.name,
      unit: body.unit ?? "kg",
      sets: (body.sets ?? []) as ExerciseSet[],
      notes: body.notes ?? null,
      position: body.position ?? 0,
    })
    .returning();
  res.status(201).json(serialize(row));
});

router.patch("/exercises/:exerciseId", async (req: Request, res: Response) => {
  const { exerciseId } = UpdateExerciseParams.parse(req.params);
  const body = UpdateExerciseBody.parse(req.body);

  const [row] = await db
    .update(exercisesTable)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.unit !== undefined && { unit: body.unit }),
      ...(body.sets !== undefined && { sets: body.sets as ExerciseSet[] }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.position !== undefined && { position: body.position }),
    })
    .where(eq(exercisesTable.id, exerciseId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serialize(row));
});

router.delete("/exercises/:exerciseId", async (req: Request, res: Response) => {
  const { exerciseId } = DeleteExerciseParams.parse(req.params);
  await db.delete(exercisesTable).where(eq(exercisesTable.id, exerciseId));
  res.status(204).end();
});

router.get("/clients/:clientId/exercise-progress", async (req: Request, res: Response) => {
  const { clientId } = GetClientExerciseProgressParams.parse(req.params);

  const rows = await db
    .select({
      exId: exercisesTable.id,
      sessionId: exercisesTable.sessionId,
      name: exercisesTable.name,
      unit: exercisesTable.unit,
      sets: exercisesTable.sets,
      sessionDate: sessionsTable.sessionDate,
    })
    .from(exercisesTable)
    .innerJoin(sessionsTable, eq(exercisesTable.sessionId, sessionsTable.id))
    .where(eq(sessionsTable.clientId, clientId))
    .orderBy(asc(sessionsTable.sessionDate));

  const grouped = new Map<
    string,
    { name: string; unit: string; points: any[] }
  >();

  for (const r of rows) {
    const sets = (r.sets ?? []) as ExerciseSet[];
    if (sets.length === 0) continue;

    let maxWeight = 0;
    let topSetReps = 0;
    let totalReps = 0;
    let totalVolume = 0;
    for (const s of sets) {
      const w = Number(s.weight) || 0;
      const reps = Number(s.reps) || 0;
      totalReps += reps;
      totalVolume += w * reps;
      if (w > maxWeight) {
        maxWeight = w;
        topSetReps = reps;
      } else if (w === maxWeight && reps > topSetReps) {
        topSetReps = reps;
      }
    }

    const key = r.name.trim().toLowerCase();
    let entry = grouped.get(key);
    if (!entry) {
      entry = { name: r.name, unit: r.unit, points: [] };
      grouped.set(key, entry);
    }
    entry.points.push({
      sessionId: r.sessionId,
      sessionDate: r.sessionDate.toISOString(),
      maxWeight,
      topSetReps,
      totalReps,
      totalVolume,
    });
  }

  const result = Array.from(grouped.values()).sort((a, b) => b.points.length - a.points.length);
  res.json(result);
});

export default router;
