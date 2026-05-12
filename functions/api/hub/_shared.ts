import { createClient } from "@supabase/supabase-js";

export const APP_ID = "compta-solo";
export const APP_PERMISSION = "launch:compta-solo";
export const PUBLIC_APP_ORIGIN = "https://accounts.hinnoumusic.com";
export const APP_DISPLAY_NAME = "Compta Solo";
export const APP_ICON_URL = `${PUBLIC_APP_ORIGIN}/icon.svg?v=20260509`;
const SUPABASE_URL = "https://zwcqecszstcmwpknyrqy.supabase.co";
const HUB_PROOF_INTROSPECTION_URL = "https://hub.hinnoumusic.com/api/auth/proof/introspect";
const HUB_NOTIFICATION_PUSH_URL = "https://hub.hinnoumusic.com/api/notifications/push";

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  HUB_PROOF_INTROSPECTION_URL?: string;
  HUB_NOTIFICATION_PUSH_URL?: string;
  HUB_NOTIFICATION_SIGNING_SECRET?: string;
};

type HubProofPayload = {
  aud?: string;
  email?: string;
  permissions?: string[];
  sub?: string;
};

type HubLaunchContext = {
  hub: boolean;
  hub_return_url: string | null;
  launch_target: string;
  permissions: string[];
  session_bootstrap: Record<string, unknown>;
  handoff_payload: Record<string, unknown>;
  hub_state: string | null;
  proof_token: string | null;
  created_at: string;
  expires_at: string;
};

type HubBootstrapInput = {
  proof_token?: string;
  hub_return_url?: string;
  launch_target?: string;
  permissions?: string[];
  session_bootstrap?: Record<string, unknown>;
  handoff_payload?: Record<string, unknown>;
  hub_state?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};

let cachedSupabaseAdminClient: ReturnType<typeof createClient> | null = null;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...headers,
    },
  });
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export function cleanText(value: unknown, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const nextValue = String(value).trim();
  return nextValue || fallback;
}

export function cleanEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

export function normalizeHubPermissions(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export function normalizeHubReturnUrl(value: unknown) {
  const nextValue = cleanText(value);
  if (!nextValue) {
    return null;
  }

  try {
    return new URL(nextValue).toString();
  } catch (_error) {
    return null;
  }
}

export function normalizeHubLaunchTarget(value: unknown) {
  const nextValue = cleanText(value);
  const fallback = "/dashboard";
  if (!nextValue.startsWith("/")) {
    return fallback;
  }

  const normalized = nextValue.toLowerCase();
  const allowedTargets = new Set([
    "/dashboard",
    "/invoices",
    "/expenses",
    "/contracts",
    "/grants",
    "/bank",
    "/taxes",
    "/reports",
    "/einvoicing",
    "/settings",
  ]);

  return allowedTargets.has(normalized) ? normalized : fallback;
}

export function normalizeHubLaunchContext(input: HubBootstrapInput): HubLaunchContext {
  const sessionBootstrap =
    input.session_bootstrap && typeof input.session_bootstrap === "object" ? input.session_bootstrap : {};
  const handoffPayload =
    input.handoff_payload && typeof input.handoff_payload === "object" ? input.handoff_payload : {};

  return {
    hub: true,
    hub_return_url: normalizeHubReturnUrl(input.hub_return_url || handoffPayload.return_url),
    launch_target: normalizeHubLaunchTarget(input.launch_target || handoffPayload.launch_target),
    permissions: normalizeHubPermissions(input.permissions),
    session_bootstrap: sessionBootstrap,
    handoff_payload: handoffPayload,
    hub_state: cleanText(input.hub_state) || null,
    proof_token:
      cleanText(input.proof_token) ||
      cleanText((sessionBootstrap as Record<string, unknown>).proof_token) ||
      null,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

export function getSupabaseAdminClient(env: Env) {
  if (cachedSupabaseAdminClient) {
    return cachedSupabaseAdminClient;
  }

  const serviceRoleKey = cleanText(env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for hub bootstrap.");
  }

  cachedSupabaseAdminClient = createClient(cleanText(env.SUPABASE_URL, SUPABASE_URL), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedSupabaseAdminClient;
}

export async function verifyHubProof(proofToken: string, env: Env) {
  const token = cleanText(proofToken);
  if (!token) {
    throw new Error("Missing proof token.");
  }

  const response = await fetch(cleanText(env.HUB_PROOF_INTROSPECTION_URL, HUB_PROOF_INTROSPECTION_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    active?: boolean;
    error?: string;
    payload?: HubProofPayload;
  };

  if (!response.ok || payload.active !== true || !payload.payload) {
    throw new Error(payload.error || "Hub proof could not be validated.");
  }

  if (cleanText(payload.payload.aud) !== APP_ID) {
    throw new Error("Hub proof audience is invalid.");
  }

  if (!normalizeHubPermissions(payload.payload.permissions).includes(APP_PERMISSION)) {
    throw new Error("Hub proof is missing accounting launch permission.");
  }

  const email = cleanEmail(payload.payload.email);
  if (!email) {
    throw new Error("Hub proof is missing an email address.");
  }

  return {
    email,
    permissions: normalizeHubPermissions(payload.payload.permissions),
    subject: cleanText(payload.payload.sub) || null,
  };
}

export async function issueHubSession(
  env: Env,
  {
    email,
    name,
    picture,
  }: {
    email: string;
    name?: unknown;
    picture?: unknown;
  },
) {
  const admin = getSupabaseAdminClient(env);
  const redirectTo = `${PUBLIC_APP_ORIGIN}/hublaunch`;
  const metadata = {
    full_name: cleanText(name) || email,
    picture: cleanText(picture) || null,
  };

  const generateMagicLink = async () =>
    admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo,
      },
    });

  let generated = await generateMagicLink();
  if (generated.error) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
    });
    const creationErrorMessage = cleanText(created.error?.message).toLowerCase();
    if (
      created.error &&
      !creationErrorMessage.includes("already") &&
      !creationErrorMessage.includes("exists")
    ) {
      throw new Error(created.error.message || "Compta Solo could not create the bootstrap user.");
    }

    generated = await generateMagicLink();
  }

  if (generated.error) {
    throw new Error(generated.error.message || "Compta Solo could not create the bootstrap sign-in.");
  }

  const tokenHash = cleanText(generated.data?.properties?.hashed_token);
  const candidateTypes = Array.from(
    new Set([
      cleanText(generated.data?.properties?.verification_type, "email"),
      "email",
      "magiclink",
      "signup",
    ]),
  );

  let session:
    | {
        access_token: string;
        refresh_token: string;
        expires_at: number | null;
        expires_in: number | null;
        token_type: string;
        user: unknown;
      }
    | null = null;
  let verificationType = cleanText(generated.data?.properties?.verification_type, "email");
  let lastError: Error | null = null;

  if (tokenHash) {
    for (const candidateType of candidateTypes) {
      const result = await admin.auth.verifyOtp({
        token_hash: tokenHash,
        type: candidateType as "email" | "magiclink" | "signup",
      });

      if (!result.error && result.data?.session?.access_token && result.data?.session?.refresh_token) {
        session = {
          access_token: result.data.session.access_token,
          refresh_token: result.data.session.refresh_token,
          expires_at: result.data.session.expires_at || null,
          expires_in: result.data.session.expires_in || null,
          token_type: result.data.session.token_type || "bearer",
          user: result.data.session.user || null,
        };
        verificationType = candidateType;
        break;
      }

      lastError = result.error || null;
    }
  }

  if (!session && lastError) {
    throw new Error(lastError.message || "Compta Solo could not verify the hub bootstrap token.");
  }

  return {
    action_link: cleanText(generated.data?.properties?.action_link) || null,
    token_hash: tokenHash || null,
    type: verificationType,
    redirect_to: cleanText(generated.data?.properties?.redirect_to) || redirectTo,
    session,
  };
}

export async function findUserByEmail(env: Env, email: string) {
  const admin = getSupabaseAdminClient(env);
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (result.error) {
      throw new Error(result.error.message || "Compta Solo could not load users.");
    }

    const matchedUser = result.data.users.find((user) => cleanEmail(user.email) === cleanEmail(email));
    if (matchedUser) {
      return matchedUser;
    }

    if ((result.data.users || []).length < 200) {
      break;
    }
  }

  return null;
}

export async function findUserEmailById(env: Env, userId: string) {
  const admin = getSupabaseAdminClient(env);
  const result = await admin.auth.admin.getUserById(userId);
  if (result.error) {
    return null;
  }
  return cleanEmail(result.data.user?.email);
}

function arrayBufferToHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signHubNotification(payloadText: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadText));
  return arrayBufferToHex(signature);
}

export type HubNotificationEvent = {
  app_id: string;
  event_id: string;
  user_email: string;
  type: string;
  title: string;
  body: string;
  href: string;
  created_at: string;
  priority?: "low" | "normal" | "high";
  actor?: { name?: string };
  meta?: Record<string, unknown>;
  icon_url?: string;
  display_name?: string;
};

export async function pushHubNotification(env: Env, event: HubNotificationEvent) {
  const pushUrl = cleanText(env.HUB_NOTIFICATION_PUSH_URL, HUB_NOTIFICATION_PUSH_URL);
  if (!pushUrl) {
    return { delivered: false, skipped: true, reason: "Missing HUB_NOTIFICATION_PUSH_URL." };
  }

  const payload = {
    icon_url: APP_ICON_URL,
    display_name: APP_DISPLAY_NAME,
    ...event,
    app_id: APP_ID,
  };
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Hub-App-Id": APP_ID,
  };
  const secret = cleanText(env.HUB_NOTIFICATION_SIGNING_SECRET);
  if (secret) {
    headers["X-Hub-Signature"] = `sha256=${await signHubNotification(body, secret)}`;
  }

  const response = await fetch(pushUrl, {
    method: "POST",
    headers,
    body,
  });
  const responseBody = await response.text().catch(() => "");

  return {
    delivered: response.ok,
    status: response.status,
    response: responseBody.slice(0, 500),
  };
}
