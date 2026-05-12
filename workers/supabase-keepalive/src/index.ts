type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

async function pingSupabase(env: Env, source = "cloudflare-cron") {
  const url = `${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/rpc/keepalive_ping`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ source }),
  });
  const body = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method !== "GET" && request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const result = await pingSupabase(env, "manual-worker-check");
    return json({
      ok: result.ok,
      status: result.status,
      supabase_response: result.body ? JSON.parse(result.body) : null,
    }, result.ok ? 200 : 502);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(pingSupabase(env, "cloudflare-cron"));
  },
};
