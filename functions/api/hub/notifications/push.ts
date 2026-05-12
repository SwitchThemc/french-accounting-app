import {
  APP_ID,
  APP_ICON_URL,
  cleanText,
  findUserEmailById,
  getSupabaseAdminClient,
  json,
  pushHubNotification,
  readBearerToken,
} from "../_shared";

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  HUB_NOTIFICATION_PUSH_URL?: string;
  HUB_NOTIFICATION_SIGNING_SECRET?: string;
};

type PushInput = {
  event_type?: string;
  approval_id?: string;
  company_id?: string;
  source_label?: string;
  source_href?: string;
  source_text?: string;
  entity_type?: string;
  entity_id?: string;
  source_event_id?: string;
};

type ApprovalRow = {
  id: string;
  company_id: string;
  kind: string;
  title: string;
  details: string | null;
  target_table: string | null;
  target_id: string | null;
  requested_by: string | null;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  role: string;
  custom_role_id: string | null;
};

type RoleRow = {
  id: string;
  can_approve: boolean;
};

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function canMemberApprove(member: MemberRow, rolesById: Map<string, RoleRow>) {
  if (member.role === "owner" || member.role === "admin") return true;
  return Boolean(member.custom_role_id && rolesById.get(member.custom_role_id)?.can_approve);
}

function normalizeHandle(value: string) {
  return value.trim().toLowerCase().replace(/^@/, "");
}

function extractMentionHandles(text: string) {
  const handles = new Set<string>();
  for (const match of text.matchAll(/(^|[\s([{"'])@([A-Z0-9._%+-]+(?:@[A-Z0-9.-]+\.[A-Z]{2,})?)/gi)) {
    const handle = normalizeHandle(match[2] || "");
    if (handle) handles.add(handle);
  }
  return [...handles];
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

async function loadActorName(env: Env, userId: string | null) {
  if (!userId) return "A teammate";
  return (await findUserEmailById(env, userId)) || "A teammate";
}

async function notifyApprovalRequested(env: Env, approvalId: string, actorUserId: string) {
  const admin = getSupabaseAdminClient(env);
  const approvalResult = await admin
    .from("approval_requests")
    .select("id, company_id, kind, title, details, target_table, target_id, requested_by, created_at")
    .eq("id", approvalId)
    .maybeSingle();
  if (approvalResult.error) throw new Error(approvalResult.error.message);
  const approval = approvalResult.data as ApprovalRow | null;
  if (!approval) throw new Error("Approval request not found.");
  if (approval.requested_by !== actorUserId) {
    throw new Error("Only the approval requester can push this notification event.");
  }

  const [membersResult, rolesResult, companyResult] = await Promise.all([
    admin.from("company_members").select("user_id, role, custom_role_id").eq("company_id", approval.company_id),
    admin.from("company_roles").select("id, can_approve").eq("company_id", approval.company_id),
    admin.from("companies").select("name").eq("id", approval.company_id).maybeSingle(),
  ]);

  if (membersResult.error) throw new Error(membersResult.error.message);
  if (rolesResult.error) throw new Error(rolesResult.error.message);
  if (companyResult.error) throw new Error(companyResult.error.message);

  const rolesById = new Map((rolesResult.data || []).map((role) => [String(role.id), role as RoleRow]));
  const approvers = ((membersResult.data || []) as MemberRow[])
    .filter((member) => canMemberApprove(member, rolesById))
    .filter((member) => member.user_id !== approval.requested_by);

  const actorName = await loadActorName(env, approval.requested_by);
  const companyName = cleanText((companyResult.data as { name?: string } | null)?.name, "Compta Solo");
  const results = [];

  for (const member of approvers) {
    const email = await findUserEmailById(env, member.user_id);
    if (!email) continue;
    results.push(
      await pushHubNotification(env, {
        app_id: APP_ID,
        event_id: `${APP_ID}-approval-requested-${approval.id}-${member.user_id}`,
        user_email: email,
        type: "approval_requested",
        title: "Approval requested",
        body: `${approval.title} needs approval in ${companyName}.`,
        href: approval.kind === "contract" ? "/contracts" : approval.kind === "invoice" ? "/invoices" : "/settings",
        created_at: approval.created_at || new Date().toISOString(),
        priority: "high",
        actor: { name: actorName },
        icon_url: APP_ICON_URL,
        meta: {
          entity_id: approval.id,
          entity_type: "approval_request",
          approval_kind: approval.kind,
          target_table: approval.target_table,
          target_id: approval.target_id,
          company_id: approval.company_id,
        },
      }),
    );
  }

  return {
    event_type: "approval_requested",
    recipients: approvers.length,
    delivered: results.filter((result) => result.delivered).length,
    results,
  };
}

async function notifyMentionedUsers(env: Env, body: PushInput, actorUserId: string) {
  const companyId = cleanText(body.company_id);
  const sourceText = cleanText(body.source_text);
  if (!isUuid(companyId)) throw new Error("company_id is required.");
  if (!sourceText) throw new Error("source_text is required.");
  if (!(await isCompanyMember(env, companyId, actorUserId))) {
    throw new Error("Only company members can push mention notifications.");
  }

  const admin = getSupabaseAdminClient(env);
  const [membersResult, companyResult] = await Promise.all([
    admin.from("company_members").select("user_id, role, custom_role_id").eq("company_id", companyId),
    admin.from("companies").select("name").eq("id", companyId).maybeSingle(),
  ]);
  if (membersResult.error) throw new Error(membersResult.error.message);
  if (companyResult.error) throw new Error(companyResult.error.message);

  const handles = extractMentionHandles(sourceText);
  if (!handles.length) {
    return { event_type: "mention", recipients: 0, delivered: 0, results: [] };
  }

  const members = (membersResult.data || []) as MemberRow[];
  const actorEmail = await findUserEmailById(env, actorUserId);
  const memberEmails = await Promise.all(
    members.map(async (member) => ({
      member,
      email: await findUserEmailById(env, member.user_id),
    })),
  );
  const recipientsById = new Map<string, { member: MemberRow; email: string }>();
  const roleHandles = new Set(["owner", "admin", "bookkeeper", "viewer"]);

  for (const handle of handles) {
    if (handle === "all" || handle === "team") {
      for (const entry of memberEmails) {
        if (entry.email) recipientsById.set(entry.member.user_id, { member: entry.member, email: entry.email });
      }
      continue;
    }
    if (roleHandles.has(handle)) {
      for (const entry of memberEmails) {
        if (entry.email && entry.member.role === handle) {
          recipientsById.set(entry.member.user_id, { member: entry.member, email: entry.email });
        }
      }
      continue;
    }
    for (const entry of memberEmails) {
      if (!entry.email) continue;
      const localPart = entry.email.split("@")[0];
      if (entry.email === handle || localPart === handle) {
        recipientsById.set(entry.member.user_id, { member: entry.member, email: entry.email });
      }
    }
  }

  recipientsById.delete(actorUserId);
  const sourceLabel = cleanText(body.source_label, "Compta Solo");
  const href = cleanText(body.source_href, "/dashboard").startsWith("/") ? cleanText(body.source_href, "/dashboard") : "/dashboard";
  const companyName = cleanText((companyResult.data as { name?: string } | null)?.name, "Compta Solo");
  const actorName = actorEmail || "A teammate";
  const entityType = cleanText(body.entity_type, "mention");
  const entityId = cleanText(body.entity_id, companyId);
  const sourceEventId = cleanText(body.source_event_id, `${entityType}-${entityId}-${sourceText.slice(0, 64)}`);
  const results = [];

  for (const [userId, recipient] of recipientsById) {
    results.push(
      await pushHubNotification(env, {
        app_id: APP_ID,
        event_id: `${APP_ID}-mention-${sourceEventId}-${userId}`.replace(/[^a-zA-Z0-9._:-]/g, "-").slice(0, 180),
        user_email: recipient.email,
        type: "mention",
        title: "You were mentioned in Compta Solo",
        body: `${actorName} mentioned you in ${sourceLabel} for ${companyName}.`,
        href,
        created_at: new Date().toISOString(),
        priority: "high",
        actor: { name: actorName },
        icon_url: APP_ICON_URL,
        meta: {
          entity_id: entityId,
          entity_type: entityType,
          company_id: companyId,
          source_label: sourceLabel,
          handles,
        },
      }),
    );
  }

  return {
    event_type: "mention",
    recipients: recipientsById.size,
    delivered: results.filter((result) => result.delivered).length,
    results,
  };
}

export const onRequestOptions: PagesFunction<Env> = async () => new Response(null, { status: 204 });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const jwt = readBearerToken(request);
  if (!jwt) return json({ error: "Authentication required." }, 401);

  const admin = getSupabaseAdminClient(env);
  const userResult = await admin.auth.getUser(jwt);
  if (userResult.error || !userResult.data.user?.id) {
    return json({ error: "Invalid user token." }, 401);
  }

  let body: PushInput = {};
  try {
    body = (await request.json()) as PushInput;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  try {
    if (body.event_type === "approval_requested" && isUuid(body.approval_id)) {
      return json(await notifyApprovalRequested(env, body.approval_id, userResult.data.user.id), 202);
    }
    if (body.event_type === "mention") {
      return json(await notifyMentionedUsers(env, body, userResult.data.user.id), 202);
    }
    return json({ error: "Unsupported notification event." }, 400);
  } catch (error) {
    return json({ error: "Notification push failed.", details: error instanceof Error ? error.message : String(error) }, 502);
  }
};
