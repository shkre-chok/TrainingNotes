import { and, eq, isNull, lt, or } from "drizzle-orm";
import {
  db,
  clientsTable,
  homeworkExercisesTable,
  homeworkProgramsTable,
  magicLinkTokensTable,
} from "@workspace/db";
import { randomBytes } from "crypto";
import { sendHomeworkReminderEmail } from "./email";
import { logger } from "./logger";

const REMINDER_SCHEDULE_PATTERN = /^weekly:([0-6]):([01]\d|2[0-3]):([0-5]\d)$/;
const REMINDER_CLAIM_TTL_IN_MS = 5 * 60 * 1000;
const DAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type ReminderSchedule = {
  dayOfWeek: number;
  time: string;
};

export function parseReminderSchedule(value: string | null | undefined): ReminderSchedule | null {
  if (!value) return null;
  const match = REMINDER_SCHEDULE_PATTERN.exec(value);
  if (!match) return null;
  return {
    dayOfWeek: Number(match[1]),
    time: `${match[2]}:${match[3]}`,
  };
}

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
};

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values["year"]),
    month: Number(values["month"]),
    day: Number(values["day"]),
    hour: Number(values["hour"]),
    minute: Number(values["minute"]),
    dayOfWeek: DAY_INDEX[values["weekday"]],
  };
}

function shiftCalendarDate(year: number, month: number, day: number, days: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function zonedDateTimeToUtc(
  date: { year: number; month: number; day: number },
  time: string,
  timeZone: string,
): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const wallClockUtc = Date.UTC(date.year, date.month - 1, date.day, hours, minutes);
  let timestamp = wallClockUtc;
  for (let index = 0; index < 2; index += 1) {
    const parts = getZonedDateParts(new Date(timestamp), timeZone);
    const interpretedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    timestamp = wallClockUtc - (interpretedAsUtc - timestamp);
  }
  return new Date(timestamp);
}

function getThisWeekScheduledOccurrence(schedule: ReminderSchedule, now: Date, timeZone: string): Date {
  const nowParts = getZonedDateParts(now, timeZone);
  const date = shiftCalendarDate(
    nowParts.year,
    nowParts.month,
    nowParts.day,
    schedule.dayOfWeek - nowParts.dayOfWeek,
  );
  return zonedDateTimeToUtc(date, schedule.time, timeZone);
}

function getMostRecentScheduledOccurrence(schedule: ReminderSchedule, now: Date, timeZone: string): Date {
  const thisWeekOccurrence = getThisWeekScheduledOccurrence(schedule, now, timeZone);
  if (now >= thisWeekOccurrence) return thisWeekOccurrence;
  const parts = getZonedDateParts(thisWeekOccurrence, timeZone);
  const previousWeek = shiftCalendarDate(parts.year, parts.month, parts.day, -7);
  return zonedDateTimeToUtc(previousWeek, schedule.time, timeZone);
}

export function isReminderDue(
  scheduleValue: string | null | undefined,
  lastSentAt: Date | null | undefined,
  now = new Date(),
  timeZone = "UTC",
): boolean {
  const schedule = parseReminderSchedule(scheduleValue);
  if (!schedule) return false;
  const thisWeekOccurrence = getThisWeekScheduledOccurrence(schedule, now, timeZone);
  if (!lastSentAt) {
    return now >= thisWeekOccurrence;
  }
  const mostRecentOccurrence = getMostRecentScheduledOccurrence(schedule, now, timeZone);
  return lastSentAt < mostRecentOccurrence;
}

async function getOrCreateMagicLink(clientId: string) {
  let [tokenRow] = await db.select().from(magicLinkTokensTable)
    .where(eq(magicLinkTokensTable.clientId, clientId));

  if (!tokenRow) {
    const token = randomBytes(32).toString("hex");
    [tokenRow] = await db.insert(magicLinkTokensTable).values({
      clientId,
      token,
    }).returning();
  }

  const appUrl = process.env["APP_URL"] ?? `https://${process.env["REPLIT_DEV_DOMAIN"]}`;
  return `${appUrl}/homework/${tokenRow.token}`;
}

export async function sendProgramHomeworkReminder(
  programId: string,
  options: { scheduled?: boolean; idempotencyKey?: string } = {},
) {
  const [program] = await db.select().from(homeworkProgramsTable)
    .where(eq(homeworkProgramsTable.id, programId));
  if (!program) {
    throw new Error("Program not found");
  }
  if (options.scheduled && (
    !program.isActive ||
    !program.reminderEnabled ||
    !isReminderDue(program.reminderSchedule, program.lastSentAt, new Date(), program.reminderTimezone ?? "UTC")
  )) {
    throw new Error("Scheduled reminder is no longer due");
  }

  const [client] = await db.select().from(clientsTable)
    .where(eq(clientsTable.id, program.clientId));
  if (!client) {
    throw new Error("Client not found");
  }
  if (!client.email) {
    throw new Error("Client has no email address");
  }

  const exercises = await db.select().from(homeworkExercisesTable)
    .where(eq(homeworkExercisesTable.programId, programId))
    .orderBy(homeworkExercisesTable.position);
  const magicLink = await getOrCreateMagicLink(client.id);

  await sendHomeworkReminderEmail({
    toEmail: client.email,
    clientName: client.name,
    magicLink,
    programTitle: program.title,
    exercises: exercises.map((exercise) => ({
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      weight: exercise.weight,
      unit: exercise.unit,
      frequencyType: exercise.frequencyType,
      daysOfWeek: (exercise.daysOfWeek as number[]) ?? [],
      timesPerDay: exercise.timesPerDay,
      instructions: exercise.instructions,
      videoUrl: exercise.videoUrl,
    })),
    idempotencyKey: options.idempotencyKey,
  });

  await db.update(homeworkProgramsTable)
    .set({
      lastSentAt: new Date(),
      ...(options.scheduled && { reminderSendingAt: null }),
    })
    .where(eq(homeworkProgramsTable.id, programId));

  return { magicLink };
}

async function claimScheduledReminder(
  program: typeof homeworkProgramsTable.$inferSelect,
  now: Date,
) {
  if (!program.reminderSchedule) return null;
  const schedule = parseReminderSchedule(program.reminderSchedule);
  if (!schedule) return null;
  const occurrence = getMostRecentScheduledOccurrence(
    schedule,
    now,
    program.reminderTimezone ?? "UTC",
  );
  const [claimed] = await db.update(homeworkProgramsTable)
    .set({ reminderSendingAt: now })
    .where(and(
      eq(homeworkProgramsTable.id, program.id),
      eq(homeworkProgramsTable.isActive, true),
      eq(homeworkProgramsTable.reminderEnabled, true),
      eq(homeworkProgramsTable.reminderSchedule, program.reminderSchedule),
      program.reminderTimezone === null
        ? isNull(homeworkProgramsTable.reminderTimezone)
        : eq(homeworkProgramsTable.reminderTimezone, program.reminderTimezone),
      or(isNull(homeworkProgramsTable.lastSentAt), lt(homeworkProgramsTable.lastSentAt, occurrence)),
      or(
        isNull(homeworkProgramsTable.reminderSendingAt),
        lt(homeworkProgramsTable.reminderSendingAt, new Date(now.getTime() - REMINDER_CLAIM_TTL_IN_MS)),
      ),
    ))
    .returning({ id: homeworkProgramsTable.id });
  return claimed ? occurrence : null;
}

async function releaseScheduledReminderClaim(programId: string, claimedAt: Date) {
  await db.update(homeworkProgramsTable)
    .set({ reminderSendingAt: null })
    .where(and(
      eq(homeworkProgramsTable.id, programId),
      eq(homeworkProgramsTable.reminderSendingAt, claimedAt),
    ));
}

export async function runScheduledHomeworkReminders(now = new Date()) {
  const programs = await db.select().from(homeworkProgramsTable)
    .where(and(
      eq(homeworkProgramsTable.isActive, true),
      eq(homeworkProgramsTable.reminderEnabled, true),
    ));
  const duePrograms = programs.filter((program) =>
    isReminderDue(program.reminderSchedule, program.lastSentAt, now, program.reminderTimezone ?? "UTC")
  );

  let sent = 0;
  for (const program of duePrograms) {
    try {
      const occurrence = await claimScheduledReminder(program, now);
      if (!occurrence) continue;
      await sendProgramHomeworkReminder(program.id, {
        scheduled: true,
        idempotencyKey: `homework-reminder:${program.id}:${occurrence.toISOString()}`,
      });
      sent += 1;
      logger.info({ programId: program.id }, "Scheduled homework reminder sent");
    } catch (error) {
      await releaseScheduledReminderClaim(program.id, now);
      logger.error({ err: error, programId: program.id }, "Scheduled homework reminder failed");
    }
  }

  return { checked: programs.length, due: duePrograms.length, sent };
}

export function startHomeworkReminderScheduler() {
  const run = () => {
    void runScheduledHomeworkReminders().catch((error) => {
      logger.error({ err: error }, "Homework reminder scheduler failed");
    });
  };

  run();
  const interval = setInterval(run, 60_000);
  interval.unref();
  logger.info("Homework reminder scheduler started");
  return interval;
}