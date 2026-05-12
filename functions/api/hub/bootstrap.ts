import {
  APP_ID,
  issueHubSession,
  json,
  normalizeHubLaunchContext,
  verifyHubProof,
} from "./_shared";

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  HUB_PROOF_INTROSPECTION_URL?: string;
};

export const onRequestOptions: PagesFunction<Env> = async () => new Response(null, { status: 204 });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const launchContext = normalizeHubLaunchContext({
    proof_token: body.proof_token as string | undefined,
    hub_return_url: body.hub_return_url as string | undefined,
    launch_target: body.launch_target as string | undefined,
    permissions: body.permissions as string[] | undefined,
    session_bootstrap: body.session_bootstrap as Record<string, unknown> | undefined,
    handoff_payload: body.handoff_payload as Record<string, unknown> | undefined,
    hub_state: body.hub_state as string | undefined,
  });

  try {
    const proof = await verifyHubProof(launchContext.proof_token || "", env);
    const bootstrap = await issueHubSession(env, {
      email: proof.email,
      name: launchContext.session_bootstrap.name,
      picture: launchContext.session_bootstrap.picture,
    });

    return json({
      success: true,
      app_id: APP_ID,
      action_link: bootstrap.action_link,
      token_hash: bootstrap.token_hash,
      type: bootstrap.type,
      redirect_to: bootstrap.redirect_to,
      session: bootstrap.session,
      launch_context: launchContext,
    });
  } catch (error) {
    return json(
      {
        error: "Compta Solo hub bootstrap failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      401,
    );
  }
};
