import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

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
  appLink?: string;
  programTitle: string;
  exercises: HomeworkExerciseEmail[];
  idempotencyKey?: string;
}) {
  const { toEmail, clientName, magicLink, appLink, programTitle, exercises, idempotencyKey } = opts;
  const safeClientName = escapeHtml(clientName);
  const safeProgramTitle = escapeHtml(programTitle);

  const exerciseRows = exercises
    .map(
      (ex) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <strong style="font-size:15px;color:#1a1a1a;">${escapeHtml(ex.name)}</strong><br/>
          <span style="font-size:13px;color:#666;">${formatFrequency(ex)}${formatSets(ex) ? " · " + formatSets(ex) : ""}</span>
          ${ex.instructions ? `<br/><span style="font-size:13px;color:#888;font-style:italic;">${escapeHtml(ex.instructions)}</span>` : ""}
          ${ex.videoUrl ? `<br/><a href="${escapeHtml(ex.videoUrl)}" style="font-size:13px;color:#2d7a4f;">▶ Watch video</a>` : ""}
        </td>
      </tr>`
    )
    .join("");
  const plainText = [
    `Hi ${clientName},`,
    "",
    `Here's your homework program: ${programTitle}`,
    ...exercises.map((ex) => `- ${ex.name}: ${formatFrequency(ex)}${formatSets(ex) ? ` · ${formatSets(ex)}` : ""}`),
    "",
    `View the full program: ${magicLink}`,
    ...(appLink ? [`Open in the Homework Companion: ${appLink}`] : []),
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9f9f9;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
    <h1 style="font-size:22px;color:#1a1a1a;margin:0 0 4px 0;">Hi ${safeClientName} 👋</h1>
    <p style="color:#555;margin:0 0 24px 0;">Here's your homework program: <strong>${safeProgramTitle}</strong></p>

    <table style="width:100%;border-collapse:collapse;">
      ${exerciseRows}
    </table>

    <div style="margin-top:28px;text-align:center;">
      <a href="${magicLink}"
         style="display:inline-block;background:#2d7a4f;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
        View Full Program
      </a>
      ${appLink ? `<p style="margin:14px 0 0;font-size:13px;"><a href="${appLink}" style="color:#2d7a4f;">Open in the Homework Companion app</a></p>` : ""}
    </div>
    <p style="margin-top:20px;font-size:12px;color:#aaa;text-align:center;">
      Sent by your practitioner via Training Tracker
    </p>
  </div>
</body>
</html>`;

  const profileResponse = await connectors.proxy(
    "google-mail",
    "/gmail/v1/users/me/profile",
  );
  if (!profileResponse.ok) {
    throw new Error(`Gmail profile lookup failed (${profileResponse.status})`);
  }
  const profile = await profileResponse.json() as { emailAddress?: string };
  if (!profile.emailAddress) {
    throw new Error("Gmail profile did not include an email address");
  }

  const message = [
    `From: ${profile.emailAddress}`,
    `To: ${toEmail}`,
    `Subject: Your homework: ${programTitle}`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="homework-tracker-boundary"',
    "",
    "--homework-tracker-boundary",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    plainText,
    "",
    "--homework-tracker-boundary",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    "--homework-tracker-boundary--",
  ].join("\r\n");

  const response = await connectors.proxy(
    "google-mail",
    "/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      body: { raw: encodeBase64Url(message) },
    },
  );
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail rejected the reminder (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  return await response.json() as { id?: string; threadId?: string };
}
