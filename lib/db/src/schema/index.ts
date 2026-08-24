import { pgTable, text, integer, timestamp, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const clientsTable = pgTable("clients", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  condition: text("condition"),
  startDate: date("start_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const goalsTable = pgTable("goals", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  status: text("status").notNull().default("active"),
  progress: integer("progress").notNull().default(0),
  targetDate: date("target_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  title: text("title"),
  sessionDate: timestamp("session_date", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes"),
  focusArea: text("focus_area"),
  painLevel: integer("pain_level"),
  energyLevel: integer("energy_level"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notesTable = pgTable("notes", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  goalId: text("goal_id").references(() => goalsTable.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  kind: text("kind").notNull().default("observation"),
  important: boolean("important").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExerciseSet = {
  weight: number;
  reps: number;
};

export const exercisesTable = pgTable("exercises", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("kg"),
  sets: jsonb("sets").$type<ExerciseSet[]>().notNull().default(sql`'[]'::jsonb`),
  notes: text("notes"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const correctionsTable = pgTable("corrections", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  raw: text("raw").notNull(),
  corrected: text("corrected").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const homeworkProgramsTable = pgTable("homework_programs", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  reminderSchedule: text("reminder_schedule"),
  reminderTimezone: text("reminder_timezone"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  reminderSendingAt: timestamp("reminder_sending_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const homeworkExercisesTable = pgTable("homework_exercises", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: text("program_id").notNull().references(() => homeworkProgramsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sets: integer("sets"),
  reps: integer("reps"),
  weight: integer("weight"),
  unit: text("unit").notNull().default("kg"),
  durationSeconds: integer("duration_seconds"), // how long each set/round lasts
  frequencyType: text("frequency_type").notNull().default("daily"), // daily | specific_days | times_per_week
  daysOfWeek: jsonb("days_of_week").$type<number[]>().notNull().default(sql`'[]'::jsonb`),
  timesPerDay: integer("times_per_day").notNull().default(1),
  videoUrl: text("video_url"),
  instructions: text("instructions"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const homeworkMessagesTable = pgTable("homework_messages", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: text("program_id").notNull().references(() => homeworkProgramsTable.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  senderRole: text("sender_role").notNull(), // client | practitioner
  content: text("content"),
  audioUrl: text("audio_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoLibraryTable = pgTable("video_library", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const magicLinkTokensTable = pgTable("magic_link_tokens", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: text("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Client = typeof clientsTable.$inferSelect;
export type Goal = typeof goalsTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
export type Note = typeof notesTable.$inferSelect;
export type Exercise = typeof exercisesTable.$inferSelect;
export type Correction = typeof correctionsTable.$inferSelect;
