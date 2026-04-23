import { Router, type IRouter } from "express";
import { db, clientsTable, sessionsTable, goalsTable, notesTable } from "@workspace/db";
import { eq, desc, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res) => {
  const [{ totalClients }] = await db.select({ totalClients: sql<number>`count(*)::int` }).from(clientsTable);
  const [{ totalSessions }] = await db.select({ totalSessions: sql<number>`count(*)::int` }).from(sessionsTable);
  const [{ activeGoals }] = await db.select({ activeGoals: sql<number>`count(*)::int` }).from(goalsTable).where(eq(goalsTable.status, "active"));
  const [{ achievedGoals }] = await db.select({ achievedGoals: sql<number>`count(*)::int` }).from(goalsTable).where(eq(goalsTable.status, "achieved"));
  const [{ importantNotes }] = await db.select({ importantNotes: sql<number>`count(*)::int` }).from(notesTable).where(eq(notesTable.important, true));

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [{ sessionsThisWeek }] = await db.select({ sessionsThisWeek: sql<number>`count(*)::int` }).from(sessionsTable).where(gte(sessionsTable.sessionDate, weekAgo));

  const [{ avgPainLevel, avgEnergyLevel }] = await db.select({
    avgPainLevel: sql<string | null>`avg(${sessionsTable.painLevel})`,
    avgEnergyLevel: sql<string | null>`avg(${sessionsTable.energyLevel})`,
  }).from(sessionsTable);

  res.json({
    totalClients: Number(totalClients),
    totalSessions: Number(totalSessions),
    activeGoals: Number(activeGoals),
    achievedGoals: Number(achievedGoals),
    importantNotes: Number(importantNotes),
    sessionsThisWeek: Number(sessionsThisWeek),
    avgPainLevel: avgPainLevel != null ? Number(avgPainLevel) : null,
    avgEnergyLevel: avgEnergyLevel != null ? Number(avgEnergyLevel) : null,
  });
});

router.get("/dashboard/recent-activity", async (_req, res) => {
  const recentSessions = await db
    .select({ session: sessionsTable, clientName: clientsTable.name })
    .from(sessionsTable)
    .innerJoin(clientsTable, eq(clientsTable.id, sessionsTable.clientId))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(8);

  const recentNotes = await db
    .select({ note: notesTable, session: sessionsTable, clientName: clientsTable.name })
    .from(notesTable)
    .innerJoin(sessionsTable, eq(sessionsTable.id, notesTable.sessionId))
    .innerJoin(clientsTable, eq(clientsTable.id, sessionsTable.clientId))
    .orderBy(desc(notesTable.createdAt))
    .limit(8);

  const recentGoals = await db
    .select({ goal: goalsTable, clientName: clientsTable.name })
    .from(goalsTable)
    .innerJoin(clientsTable, eq(clientsTable.id, goalsTable.clientId))
    .orderBy(desc(goalsTable.createdAt))
    .limit(8);

  const items = [
    ...recentSessions.map((r) => ({
      id: `session-${r.session.id}`,
      kind: "session" as const,
      title: r.session.title || `Session with ${r.clientName}`,
      subtitle: r.session.focusArea,
      clientName: r.clientName,
      timestamp: r.session.createdAt.toISOString(),
    })),
    ...recentNotes.map((r) => ({
      id: `note-${r.note.id}`,
      kind: "note" as const,
      title: r.note.content.slice(0, 100),
      subtitle: r.note.kind,
      clientName: r.clientName,
      timestamp: r.note.createdAt.toISOString(),
    })),
    ...recentGoals.map((r) => ({
      id: `goal-${r.goal.id}`,
      kind: "goal" as const,
      title: r.goal.title,
      subtitle: r.goal.status,
      clientName: r.clientName,
      timestamp: r.goal.createdAt.toISOString(),
    })),
  ];

  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json(items.slice(0, 15));
});

router.get("/dashboard/upcoming-sessions", async (_req, res) => {
  const now = new Date();
  const rows = await db
    .select({
      session: sessionsTable,
      clientName: clientsTable.name,
      noteCount: sql<number>`coalesce((select count(*)::int from ${notesTable} where ${notesTable.sessionId} = ${sessionsTable.id}), 0)`,
    })
    .from(sessionsTable)
    .innerJoin(clientsTable, eq(clientsTable.id, sessionsTable.clientId))
    .where(gte(sessionsTable.sessionDate, now))
    .orderBy(sessionsTable.sessionDate)
    .limit(10);

  res.json(rows.map((r) => ({
    id: r.session.id,
    clientId: r.session.clientId,
    clientName: r.clientName,
    title: r.session.title,
    sessionDate: r.session.sessionDate.toISOString(),
    durationMinutes: r.session.durationMinutes,
    focusArea: r.session.focusArea,
    painLevel: r.session.painLevel,
    energyLevel: r.session.energyLevel,
    summary: r.session.summary,
    noteCount: Number(r.noteCount),
    createdAt: r.session.createdAt.toISOString(),
  })));
});

export default router;
