import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { correctionsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { CreateCorrectionBody, UpdateCorrectionBody } from "@workspace/api-zod";

const router = Router();

const DEFAULT_CORRECTIONS = [
  // Shoulder
  { raw: "rotator cup", corrected: "rotator cuff" },
  { raw: "rotor cuff", corrected: "rotator cuff" },
  { raw: "rotary cuff", corrected: "rotator cuff" },
  { raw: "supra spin atus", corrected: "supraspinatus" },
  { raw: "infra spin atus", corrected: "infraspinatus" },
  { raw: "glen humeral", corrected: "glenohumeral" },
  { raw: "subscapular is", corrected: "subscapularis" },
  // Knee
  { raw: "anterior crucial ligament", corrected: "anterior cruciate ligament" },
  { raw: "anterior crucial", corrected: "anterior cruciate" },
  { raw: "posterior crucial ligament", corrected: "posterior cruciate ligament" },
  { raw: "posterior crucial", corrected: "posterior cruciate" },
  { raw: "medial collar ligament", corrected: "medial collateral ligament" },
  { raw: "lateral collar ligament", corrected: "lateral collateral ligament" },
  { raw: "patella femoral", corrected: "patellofemoral" },
  { raw: "ilio tibial band", corrected: "iliotibial band" },
  { raw: "il io tibial band", corrected: "iliotibial band" },
  { raw: "meniscal tear", corrected: "meniscal tear" },
  // Lower leg / foot
  { raw: "gas rock nimbius", corrected: "gastrocnemius" },
  { raw: "gas track nimbius", corrected: "gastrocnemius" },
  { raw: "tibialis anti", corrected: "tibialis anterior" },
  { raw: "plantar fash itis", corrected: "plantar fasciitis" },
  { raw: "plantar fish itis", corrected: "plantar fasciitis" },
  { raw: "plantar fashitus", corrected: "plantar fasciitis" },
  // Neurological / biomechanics
  { raw: "proper reception", corrected: "proprioception" },
  { raw: "property option", corrected: "proprioception" },
  { raw: "proper receptive", corrected: "proprioceptive" },
  { raw: "soup nation", corrected: "supination" },
  { raw: "sue pine ation", corrected: "supination" },
  { raw: "pro nation", corrected: "pronation" },
  // Training concepts
  { raw: "plyo metrics", corrected: "plyometrics" },
  { raw: "plie metrics", corrected: "plyometrics" },
  { raw: "ex centric", corrected: "eccentric" },
  { raw: "con centric", corrected: "concentric" },
  { raw: "iso metric", corrected: "isometric" },
  { raw: "iso kinetic", corrected: "isokinetic" },
  { raw: "neuro muscular", corrected: "neuromuscular" },
  { raw: "tendon opathy", corrected: "tendinopathy" },
  { raw: "tendon itis", corrected: "tendinitis" },
  { raw: "burst itis", corrected: "bursitis" },
  { raw: "osteo arthritis", corrected: "osteoarthritis" },
  // Fascia / tissue
  { raw: "fashia", corrected: "fascia" },
  { raw: "my oh fashia", corrected: "myofascia" },
  { raw: "my yo fashia", corrected: "myofascia" },
];

// GET /corrections — list all, seed defaults on first call
router.get("/corrections", async (req: Request, res: Response) => {
  const existing = await db
    .select()
    .from(correctionsTable)
    .orderBy(asc(correctionsTable.createdAt));

  if (existing.length === 0) {
    // Seed defaults
    const rows = await db
      .insert(correctionsTable)
      .values(DEFAULT_CORRECTIONS.map((d) => ({ ...d, isDefault: true })))
      .returning();
    res.json(rows);
    return;
  }

  res.json(existing);
});

// POST /corrections
router.post("/corrections", async (req: Request, res: Response) => {
  const body = CreateCorrectionBody.parse(req.body);
  const [row] = await db
    .insert(correctionsTable)
    .values({
      raw: body.raw.trim(),
      corrected: body.corrected.trim(),
      isDefault: body.isDefault ?? false,
    })
    .returning();
  res.status(201).json(row);
});

// PUT /corrections/:correctionId
router.put("/corrections/:correctionId", async (req: Request, res: Response) => {
  const correctionId = req.params.correctionId as string;
  const body = UpdateCorrectionBody.parse(req.body);
  const updates: Partial<typeof correctionsTable.$inferInsert> = {};
  if (body.raw !== undefined) updates.raw = body.raw.trim();
  if (body.corrected !== undefined) updates.corrected = body.corrected.trim();

  const [row] = await db
    .update(correctionsTable)
    .set(updates)
    .where(eq(correctionsTable.id, correctionId))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

// DELETE /corrections/:correctionId
router.delete("/corrections/:correctionId", async (req: Request, res: Response) => {
  const correctionId = req.params.correctionId as string;
  await db.delete(correctionsTable).where(eq(correctionsTable.id, correctionId));
  res.status(204).send();
});

export default router;
