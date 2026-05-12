import {
  APP_ID,
  APP_ICON_URL,
  cleanEmail,
  cleanText,
  findUserEmailById,
  getSupabaseAdminClient,
  json,
  pushHubNotification,
  readBearerToken,
} from "../hub/_shared";

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  HUB_NOTIFICATION_PUSH_URL?: string;
  HUB_NOTIFICATION_SIGNING_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
};

type MeetingInviteInput = {
  company_id?: string;
  title?: string;
  description?: string;
  location?: string;
  starts_at?: string;
  ends_at?: string;
  attendee_emails?: string[];
};

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toIcsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function normalizeAttendeeEmails(value: unknown) {
  const emails = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      emails
        .map((item) => cleanEmail(item))
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)),
    ),
  ).slice(0, 25);
}

async function isCompanyMember(env: Env, companyId: string, userId: string) {
  const admin = getSupabaseAdminClient(env);
  const result = await admin
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return Boolean(result.data?.user_id);
}

function buildIcs({
  uid,
  organizerEmail,
  attendeeEmails,
  title,
  description,
  location,
  startsAt,
  endsAt,
}: {
  uid: string;
  organizerEmail: string;
  attendeeEmails: string[];
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Compta Solo//Meeting Invite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(startsAt)}`,
    `DTEND:${toIcsDate(endsAt)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `ORGANIZER;CN=Compta Solo:mailto:${organizerEmail}`,
    ...attendeeEmails.map((email) => `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export const onRequestOptions: PagesFunction<Env> = async () => new Response(null, { status: 204 });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const jwt = readBearerToken(request);
  if (!jwt) return json({ error: "Authentication required." }, 401);

  const admin = getSupabaseAdminClient(env);
  const userResult = await admin.auth.getUser(jwt);
  const actorUser = userResult.data.user;
  if (userResult.error || !actorUser?.id) {
    return json({ error: "Invalid user token." }, 401);
  }

  let body: MeetingInviteInput = {};
  try {
    body = (await request.json()) as MeetingInviteInput;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const companyId = cleanText(body.company_id);
  if (!isUuid(companyId)) return json({ error: "company_id is required." }, 400);
  if (!(await isCompanyMember(env, companyId, actorUser.id))) {
    return json({ error: "Only company members can send meeting invites." }, 403);
  }

  const attendeeEmails = normalizeAttendeeEmails(body.attendee_emails);
  if (!attendeeEmails.length) return json({ error: "At least one attendee email is required." }, 400);

  const title = cleanText(body.title, "Compta Solo meeting").slice(0, 180);
  const description = cleanText(body.description, "Meeting invite from Compta Solo.").slice(0, 4000);
  const location = cleanText(body.location, "Online").slice(0, 300);
  const startsAt = cleanText(body.starts_at);
  const endsAt = cleanText(body.ends_at);
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    return json({ error: "Valid start and end times are required." }, 400);
  }

  const resendApiKey = cleanText(env.RESEND_API_KEY);
  if (!resendApiKey) return json({ error: "RESEND_API_KEY is not configured." }, 500);

  const actorEmail = cleanEmail(actorUser.email) || (await findUserEmailById(env, actorUser.id)) || "no-reply@accounts.hinnoumusic.com";
  const uid = `${APP_ID}-meeting-${crypto.randomUUID()}@accounts.hinnoumusic.com`;
  const ics = buildIcs({
    uid,
    organizerEmail: actorEmail,
    attendeeEmails,
    title,
    description,
    location,
    startsAt: startDate.toISOString(),
    endsAt: endDate.toISOString(),
  });

  const from = cleanText(env.RESEND_FROM, "Compta Solo <onboarding@resend.dev>");
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: attendeeEmails,
      subject: title,
      text: [
        title,
        "",
        description,
        "",
        `When: ${startDate.toLocaleString("fr-FR")} - ${endDate.toLocaleString("fr-FR")}`,
        `Where: ${location}`,
        "",
        "A calendar invite is attached.",
      ].join("\n"),
      html: `<p><strong>${escapeHtml(title)}</strong></p><p>${escapeHtml(description).replace(/\n/g, "<br>")}</p><p><strong>When:</strong> ${escapeHtml(startDate.toLocaleString("fr-FR"))} - ${escapeHtml(endDate.toLocaleString("fr-FR"))}</p><p><strong>Where:</strong> ${escapeHtml(location)}</p><p>A calendar invite is attached.</p>`,
      attachments: [
        {
          filename: "meeting.ics",
          content: base64Utf8(ics),
          content_type: "text/calendar; method=REQUEST; charset=UTF-8",
        },
      ],
      headers: {
        "Content-Class": "urn:content-classes:calendarmessage",
      },
    }),
  });
  const resendBody = (await resendResponse.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
  if (!resendResponse.ok) {
    return json({ error: resendBody.message || resendBody.error || "Resend rejected the meeting invite." }, 502);
  }

  const pushResults = await Promise.all(
    attendeeEmails.map((email) =>
      pushHubNotification(env, {
        app_id: APP_ID,
        event_id: `${APP_ID}-meeting-invite-${uid}-${email}`.replace(/[^a-zA-Z0-9._:-]/g, "-").slice(0, 180),
        user_email: email,
        type: "meeting_invite",
        title: "Meeting invite",
        body: `${actorEmail} invited you to ${title}.`,
        href: "/settings",
        created_at: new Date().toISOString(),
        priority: "high",
        actor: { name: actorEmail },
        icon_url: APP_ICON_URL,
        meta: {
          entity_id: uid,
          entity_type: "meeting_invite",
          company_id: companyId,
          starts_at: startDate.toISOString(),
          ends_at: endDate.toISOString(),
          location,
        },
      }),
    ),
  );

  return json({
    id: resendBody.id ?? null,
    attendee_count: attendeeEmails.length,
    hub_push_delivered: pushResults.filter((result) => result.delivered).length,
    hub_push_attempted: pushResults.length,
  });
};
