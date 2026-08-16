import { Resend } from "resend";

const resend = new Resend(process.env["RESEND_API_KEY"]);
const FROM = process.env["RESEND_FROM_EMAIL"] ?? "onboarding@resend.dev";
const APP_URL = process.env["APP_URL"] ?? `https://${process.env["REPLIT_DEV_DOMAIN"]}`;

export interface HomeworkExerciseEmail {
  name: string;
  sets?: number | null;
  reps?: number | null;
  weight?: number | null;
  unit?: string;
  frequencyType: string;
  daysOfWeek?: number[];
  timesPerDay?: number;
  instructions?: string | null;
  videoUrl?: string | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatFrequency(ex: HomeworkExerciseEmail): string {
  if (ex.frequencyType === "daily") {
    return ex.timesPerDay && ex.timesPerDay > 1
      ? `${ex.timesPerDay}× daily`
      : "Every day";
  }
  if (ex.frequencyType === "specific_days" && ex.daysOfWeek?.length) {
    return ex.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ");
  }
  return ex.frequencyType;
}

function formatSets(ex: HomeworkExerciseEmail): string {
  const parts: string[] = [];
  if (ex.sets) parts.push(`${ex.sets} sets`);
  if (ex.reps) parts.push(`${ex.reps} reps`);
  if (ex.weight) parts.push(`${ex.weight} ${ex.unit ?? "kg"}`);
  return parts.join(" · ");
}

export async function sendHomeworkReminderEmail(opts: {
  toEmail: string;
  clientName: string;
  magicLink: string;
  programTitle: string;
  exercises: HomeworkExerciseEmail[];
}) {
  const { toEmail, clientName, magicLink, programTitle, exercises } = opts;

  const exerciseRows = exercises
    .map(
      (ex) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <strong style="font-size:15px;color:#1a1a1a;">${ex.name}</strong><br/>
          <span style="font-size:13px;color:#666;">${formatFrequency(ex)}${formatSets(ex) ? " · " + formatSets(ex) : ""}</span>
          ${ex.instructions ? `<br/><span style="font-size:13px;color:#888;font-style:italic;">${ex.instructions}</span>` : ""}
          ${ex.videoUrl ? `<br/><a href="${ex.videoUrl}" style="font-size:13px;color:#2d7a4f;">▶ Watch video</a>` : ""}
        </td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f9f9;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
    <h1 style="font-size:22px;color:#1a1a1a;margin:0 0 4px 0;">Hi ${clientName} 👋</h1>
    <p style="color:#555;margin:0 0 24px 0;">Here's your homework program: <strong>${programTitle}</strong></p>

    <table style="width:100%;border-collapse:collapse;">
      ${exerciseRows}
    </table>

    <div style="margin-top:28px;text-align:center;">
      <a href="${magicLink}"
         style="display:inline-block;background:#2d7a4f;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
        View Full Program
      </a>
    </div>
    <p style="margin-top:20px;font-size:12px;color:#aaa;text-align:center;">
      Sent by your practitioner via Training Tracker
    </p>
  </div>
</body>
</html>`;

  return resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Your homework: ${programTitle}`,
    html,
  });
}
