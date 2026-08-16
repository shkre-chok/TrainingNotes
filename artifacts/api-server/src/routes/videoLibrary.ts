import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db, videoLibraryTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const NewVideoBody = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  url: z.string().url(),
  tags: z.array(z.string()).default([]),
});

const UpdateVideoBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  url: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});

function serialize(row: typeof videoLibraryTable.$inferSelect) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
}

// List all videos
router.get("/video-library", async (_req: Request, res: Response) => {
  const rows = await db.select().from(videoLibraryTable).orderBy(videoLibraryTable.createdAt);
  res.json(rows.map(serialize));
});

// Create
router.post("/video-library", async (req: Request, res: Response) => {
  const body = NewVideoBody.parse(req.body);
  const [row] = await db.insert(videoLibraryTable).values({
    title: body.title,
    description: body.description ?? null,
    url: body.url,
    tags: body.tags,
  }).returning();
  res.status(201).json(serialize(row));
});

// Update
router.patch("/video-library/:videoId", async (req: Request, res: Response) => {
  const { videoId } = z.object({ videoId: z.string() }).parse(req.params);
  const body = UpdateVideoBody.parse(req.body);
  const [row] = await db.update(videoLibraryTable).set({
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.url !== undefined && { url: body.url }),
    ...(body.tags !== undefined && { tags: body.tags }),
  }).where(eq(videoLibraryTable.id, videoId)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(row));
});

// Delete
router.delete("/video-library/:videoId", async (req: Request, res: Response) => {
  const { videoId } = z.object({ videoId: z.string() }).parse(req.params);
  await db.delete(videoLibraryTable).where(eq(videoLibraryTable.id, videoId));
  res.status(204).send();
});

export default router;
