import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("ACCOUNTING_SYNC_KEY") || Deno.env.get("ACCOUNTING_GRANT_SYNC_SECRET");
  const providedSecret = request.headers.get("x-sync-key") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase service configuration missing" }, 500);
  }

  const payload = await request.json();
  const ownerEmail = `${payload?.owner_email ?? ""}`.trim().toLowerCase();
  if (ownerEmail !== "switchthemc@gmail.com") {
    return json({ error: "Grant sync is restricted to switchthemc" }, 403);
  }

  const externalApplicationId = `${payload?.external_application_id ?? ""}`.trim();
  if (!externalApplicationId) {
    return json({ error: "external_application_id is required" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  if (`${payload?.action ?? ""}` === "get") {
    const { data, error } = await supabase
      .from("grant_funding_projects")
      .select("*")
      .eq("external_source", `${payload?.source_app ?? "release_manager"}`)
      .eq("external_application_id", externalApplicationId)
      .eq("owner_email", ownerEmail)
      .maybeSingle();

    if (error) {
      return json({ error: error.message }, 500);
    }

    if (!data) {
      return json({ error: "Grant project not found" }, 404);
    }

    return json({
      success: true,
      grant_project: data,
      accounting: {
        status: data.status,
        project_budget: data.project_budget,
        requested_amount: data.requested_amount,
        expected_amount_low: data.expected_amount_low,
        expected_amount_high: data.expected_amount_high,
        pricing_decision: data.pricing_decision,
        accounting_notes: data.accounting_notes,
        accounting_locked_fields: data.accounting_locked_fields ?? [],
        accounting_updated_at: data.accounting_updated_at,
      },
    });
  }

  const { data, error } = await supabase.rpc("sync_release_manager_grant_project", {
    payload,
  });

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ success: true, grant_project: data });
});
