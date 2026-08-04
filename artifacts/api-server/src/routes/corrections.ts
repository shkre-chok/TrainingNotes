import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { correctionsTable } from "@workspace/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { CreateCorrectionBody, UpdateCorrectionBody } from "@workspace/api-zod";

const router = Router();

const DEFAULT_CORRECTIONS = [
  // ── Shoulder ──
  { raw: "rotator cup", corrected: "rotator cuff" },
  { raw: "rotor cuff", corrected: "rotator cuff" },
  { raw: "rotary cuff", corrected: "rotator cuff" },
  { raw: "supra spin atus", corrected: "supraspinatus" },
  { raw: "infra spin atus", corrected: "infraspinatus" },
  { raw: "glen humeral", corrected: "glenohumeral" },
  { raw: "subscapular is", corrected: "subscapularis" },
  { raw: "trap easy us", corrected: "trapezius" },
  { raw: "tra peezius", corrected: "trapezius" },
  { raw: "rom boids", corrected: "rhomboids" },
  { raw: "pec tor alis", corrected: "pectoralis" },
  { raw: "pec tor alice", corrected: "pectoralis" },
  // ── Knee ──
  { raw: "anterior crucial ligament", corrected: "anterior cruciate ligament" },
  { raw: "anterior crucial", corrected: "anterior cruciate" },
  { raw: "posterior crucial ligament", corrected: "posterior cruciate ligament" },
  { raw: "posterior crucial", corrected: "posterior cruciate" },
  { raw: "medial collar ligament", corrected: "medial collateral ligament" },
  { raw: "lateral collar ligament", corrected: "lateral collateral ligament" },
  { raw: "patella femoral", corrected: "patellofemoral" },
  { raw: "ilio tibial band", corrected: "iliotibial band" },
  { raw: "il io tibial band", corrected: "iliotibial band" },
  { raw: "pop lit eal", corrected: "popliteal" },
  // ── Lower leg / foot ──
  { raw: "gas rock nimbius", corrected: "gastrocnemius" },
  { raw: "gas track nimbius", corrected: "gastrocnemius" },
  { raw: "tibialis anti", corrected: "tibialis anterior" },
  { raw: "plantar fash itis", corrected: "plantar fasciitis" },
  { raw: "plantar fish itis", corrected: "plantar fasciitis" },
  { raw: "plantar fashitus", corrected: "plantar fasciitis" },
  { raw: "so lee us", corrected: "soleus" },
  { raw: "a kill ease tendon", corrected: "Achilles tendon" },
  { raw: "achilles tendon", corrected: "Achilles tendon" },
  // ── Spine / back ──
  { raw: "lumber spine", corrected: "lumbar spine" },
  { raw: "lumber", corrected: "lumbar" },
  { raw: "thorasic spine", corrected: "thoracic spine" },
  { raw: "thoraxic spine", corrected: "thoracic spine" },
  { raw: "service spine", corrected: "cervical spine" },
  { raw: "sack ro iliac", corrected: "sacroiliac" },
  { raw: "sac ro illiac", corrected: "sacroiliac" },
  { raw: "la tiss imus dor si", corrected: "latissimus dorsi" },
  { raw: "latissimus door si", corrected: "latissimus dorsi" },
  { raw: "pear a formis", corrected: "piriformis" },
  { raw: "piri formis", corrected: "piriformis" },
  // ── Nerve / pain ──
  { raw: "sy atic nerve", corrected: "sciatic nerve" },
  { raw: "sy atic", corrected: "sciatic" },
  { raw: "sy atica", corrected: "sciatica" },
  { raw: "par es theesia", corrected: "paresthesia" },
  { raw: "para thesis", corrected: "paresthesia" },
  { raw: "aloe din ia", corrected: "allodynia" },
  { raw: "hyper al geezia", corrected: "hyperalgesia" },
  { raw: "radiating pain", corrected: "radiating pain" },
  { raw: "rating pain", corrected: "radiating pain" },
  { raw: "ray eating pain", corrected: "radiating pain" },
  { raw: "dull eight", corrected: "dull ache" },
  // ── Neurological / biomechanics ──
  { raw: "proper reception", corrected: "proprioception" },
  { raw: "property option", corrected: "proprioception" },
  { raw: "proper receptive", corrected: "proprioceptive" },
  { raw: "soup nation", corrected: "supination" },
  { raw: "sue pine ation", corrected: "supination" },
  { raw: "pro nation", corrected: "pronation" },
  { raw: "by lateral", corrected: "bilateral" },
  { raw: "uni lateral", corrected: "unilateral" },
  { raw: "de celebration", corrected: "deceleration" },
  { raw: "ax eleration", corrected: "acceleration" },
  { raw: "per turbation", corrected: "perturbation" },
  { raw: "kin esthetic", corrected: "kinesthetic" },
  // ── Training concepts ──
  { raw: "plyo metrics", corrected: "plyometrics" },
  { raw: "plie metrics", corrected: "plyometrics" },
  { raw: "ex centric", corrected: "eccentric" },
  { raw: "con centric", corrected: "concentric" },
  { raw: "iso metric", corrected: "isometric" },
  { raw: "iso kinetic", corrected: "isokinetic" },
  { raw: "neuro muscular", corrected: "neuromuscular" },
  { raw: "hi per trophy", corrected: "hypertrophy" },
  { raw: "hyper trophy", corrected: "hypertrophy" },
  { raw: "an aerobic", corrected: "anaerobic" },
  { raw: "period ization", corrected: "periodization" },
  { raw: "per ceived ex ertion", corrected: "perceived exertion" },
  { raw: "sets and wraps", corrected: "sets and reps" },
  { raw: "one wrap max", corrected: "one rep max" },
  { raw: "a gility", corrected: "agility" },
  // ── Clinical / session language ──
  { raw: "tendon opathy", corrected: "tendinopathy" },
  { raw: "tendon itis", corrected: "tendinitis" },
  { raw: "burst itis", corrected: "bursitis" },
  { raw: "osteo arthritis", corrected: "osteoarthritis" },
  { raw: "gate analysis", corrected: "gait analysis" },
  { raw: "gate training", corrected: "gait training" },
  { raw: "am bulation", corrected: "ambulation" },
  { raw: "sub jectively", corrected: "subjectively" },
  { raw: "ob jectively", corrected: "objectively" },
  { raw: "range of lotion", corrected: "range of motion" },
  { raw: "range emotion", corrected: "range of motion" },
  { raw: "degrees deflection", corrected: "degrees of flexion" },
  { raw: "in gwine al", corrected: "inguinal" },
  // ── Fascia / tissue ──
  { raw: "fashia", corrected: "fascia" },
  { raw: "my oh fashia", corrected: "myofascia" },
  { raw: "my yo fashia", corrected: "myofascia" },
];

// GET /corrections — list all, seed any missing defaults
router.get("/corrections", async (req: Request, res: Response) => {
  const existing = await db
    .select()
    .from(correctionsTable)
    .orderBy(asc(correctionsTable.createdAt));

  const existingRaws = new Set(existing.map((r) => r.raw.toLowerCase()));
  const missing = DEFAULT_CORRECTIONS.filter(
    (d) => !existingRaws.has(d.raw.toLowerCase())
  );

  if (missing.length > 0) {
    await db
      .insert(correctionsTable)
      .values(missing.map((d) => ({ ...d, isDefault: true })));
    const updated = await db
      .select()
      .from(correctionsTable)
      .orderBy(asc(correctionsTable.createdAt));
    res.json(updated);
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
