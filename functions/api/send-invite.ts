type Env = {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
};

const supabaseUrl = "https://zwcqecszstcmwpknyrqy.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3Y3FlY3N6c3RjbXdwa255cnF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjMxMzAsImV4cCI6MjA5MjU5OTEzMH0.UvIgV6C48Wma0v_4O0JDVfWuTs_LHmpRHIGewl7dmu4";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function supabaseRest<T>(path: string, jwt: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${jwt}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.RESEND_API_KEY) {
    return json({ error: "Resend is not configured." }, 500);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Authentication required." }, 401);

  let inviteId = "";
  try {
    const body = (await request.json()) as { inviteId?: string };
    inviteId = body.inviteId ?? "";
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (!/^[0-9a-f-]{36}$/i.test(inviteId)) {
    return json({ error: "Invalid invite id." }, 400);
  }

  const invites = await supabaseRest<
    Array<{ id: string; email: string; role: string; token: string; company_id: string }>
  >(`company_invites?id=eq.${encodeURIComponent(inviteId)}&select=id,email,role,token,company_id&limit=1`, jwt);
  const invite = invites[0];
  if (!invite) return json({ error: "Invite not found." }, 404);

  const companies = await supabaseRest<Array<{ id: string; name: string }>>(
    `companies?id=eq.${encodeURIComponent(invite.company_id)}&select=id,name&limit=1`,
    jwt,
  );
  const company = companies[0];
  if (!company) return json({ error: "Company not found." }, 404);

  const origin = new URL(request.url).origin;
  const inviteUrl = `${origin}?invite=${invite.token}`;
  const from = env.RESEND_FROM || "Compta Solo <onboarding@resend.dev>";
  const subject = `Invitation to ${company.name}`;
  const text = [
    `You have been invited to collaborate on ${company.name} in Compta Solo.`,
    "",
    `Role: ${invite.role}`,
    "",
    "Open this invite link after signing in:",
    inviteUrl,
  ].join("\n");

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: invite.email,
      subject,
      text,
      html: `<p>You have been invited to collaborate on <strong>${company.name}</strong> in Compta Solo.</p><p>Role: ${invite.role}</p><p><a href="${inviteUrl}">Accept invite</a></p>`,
    }),
  });

  const resendBody = (await resendResponse.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
  if (!resendResponse.ok) {
    return json({ error: resendBody.message || resendBody.error || "Resend rejected the email." }, 502);
  }

  return json({ id: resendBody.id ?? null });
};
