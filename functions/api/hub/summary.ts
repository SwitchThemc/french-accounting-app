import {
  APP_ID,
  findUserByEmail,
  getSupabaseAdminClient,
  json,
  readBearerToken,
  verifyHubProof,
} from "./_shared";

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  HUB_PROOF_INTROSPECTION_URL?: string;
};

type SummaryRow = Record<string, unknown>;

function roundCurrency(value: number) {
  return Math.round(value);
}

async function buildAccountingSummary(env: Env, email: string) {
  const admin = getSupabaseAdminClient(env);
  const user = await findUserByEmail(env, email);
  if (!user?.id) {
    throw new Error("Compta Solo user not found for this hub identity.");
  }

  const memberResult = await admin
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id);
  if (memberResult.error) {
    throw new Error(memberResult.error.message || "Compta Solo could not load memberships.");
  }

  const companyIds = Array.from(
    new Set((memberResult.data || []).map((item) => String(item.company_id || "")).filter(Boolean)),
  );

  if (!companyIds.length) {
    return {
      app_id: APP_ID,
      generated_at: new Date().toISOString(),
      status: "attention",
      counts: {
        active_companies: 0,
        open_invoices: 0,
        overdue_invoices: 0,
        pending_approvals: 0,
      },
      highlights: [
        {
          id: "no-membership",
          title: "No accounting workspace linked",
          detail: "This hub user does not belong to a Compta Solo company yet.",
        },
      ],
      actions: [
        { label: "Open settings", href: "/settings" },
      ],
    };
  }

  const [companiesResult, invoicesResult, expensesResult, approvalsResult, bankTransactionsResult] = await Promise.all([
    admin.from("companies").select("id, name").in("id", companyIds),
    admin.from("invoices").select("company_id, status, total_inc_vat, vat_total, due_date, paid_at").in("company_id", companyIds),
    admin.from("expenses").select("company_id, status, total_inc_vat, vat_total, payment_date").in("company_id", companyIds),
    admin.from("approval_requests").select("id, company_id, status, kind, target_table, target_id, title, details, created_at").in("company_id", companyIds).order("created_at", { ascending: false }),
    admin.from("bank_transactions").select("company_id, amount, direction").in("company_id", companyIds),
  ]);

  for (const result of [
    companiesResult,
    invoicesResult,
    expensesResult,
    approvalsResult,
    bankTransactionsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message || "Compta Solo could not load summary data.");
    }
  }

  const companies = (companiesResult.data || []) as SummaryRow[];
  const invoices = (invoicesResult.data || []) as SummaryRow[];
  const expenses = (expensesResult.data || []) as SummaryRow[];
  const approvals = (approvalsResult.data || []) as SummaryRow[];
  const bankTransactions = (bankTransactionsResult.data || []) as SummaryRow[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openInvoices = invoices.filter((invoice) => {
    const status = String(invoice.status || "").toLowerCase();
    return status !== "cancelled" && status !== "paid" && !invoice.paid_at;
  });
  const overdueInvoices = openInvoices.filter((invoice) => {
    const dueDate = String(invoice.due_date || "");
    if (!dueDate) {
      return false;
    }
    const parsed = new Date(dueDate);
    return !Number.isNaN(parsed.getTime()) && parsed < today;
  });
  const pendingApprovals = approvals.filter((approval) => {
    const status = String(approval.status || "").toLowerCase();
    return status !== "approved" && status !== "rejected" && status !== "cancelled" && status !== "resolved";
  });
  const recentNotifications = pendingApprovals.slice(0, 8).map((approval) => ({
    app_id: APP_ID,
    event_id: `${APP_ID}-summary-approval-${String(approval.id || "")}`,
    user_email: email,
    type: "approval_requested",
    title: String(approval.title || "Approval requested"),
    body: String(approval.details || "An approval request is waiting in Compta Solo."),
    href: String(approval.kind || "") === "contract" ? "/contracts" : String(approval.kind || "") === "invoice" ? "/invoices" : "/settings",
    created_at: String(approval.created_at || new Date().toISOString()),
    priority: "high",
    meta: {
      entity_id: String(approval.id || ""),
      entity_type: "approval_request",
      approval_kind: String(approval.kind || ""),
      target_table: approval.target_table || null,
      target_id: approval.target_id || null,
    },
  }));

  const vatDue = invoices.reduce((sum, invoice) => sum + Number(invoice.vat_total || 0), 0)
    - expenses.reduce((sum, expense) => sum + Number(expense.vat_total || 0), 0);
  const cashNet = bankTransactions.reduce((sum, transaction) => {
    const amount = Number(transaction.amount || 0);
    return String(transaction.direction || "").toLowerCase() === "out" ? sum - amount : sum + amount;
  }, 0);

  const companyNames = companies.map((company) => String(company.name || "")).filter(Boolean);
  const busiestCompanyName =
    companyNames[0] ||
    "your workspace";

  return {
    app_id: APP_ID,
    generated_at: new Date().toISOString(),
    status: overdueInvoices.length || pendingApprovals.length ? "attention" : "ready",
    counts: {
      active_companies: companyIds.length,
      open_invoices: openInvoices.length,
      overdue_invoices: overdueInvoices.length,
      pending_approvals: pendingApprovals.length,
      vat_due_eur: roundCurrency(vatDue),
      cash_net_eur: roundCurrency(cashNet),
    },
    highlights: [
      {
        id: "company-scope",
        title: `${companyIds.length} accounting workspace${companyIds.length === 1 ? "" : "s"} connected`,
        detail: companyNames.length ? companyNames.slice(0, 3).join(", ") : "No named company loaded yet.",
      },
      {
        id: "receivables",
        title: overdueInvoices.length
          ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"}`
          : "Receivables are under control",
        detail: `Open invoices are currently centered on ${busiestCompanyName}.`,
      },
      {
        id: "vat-position",
        title: `Estimated VAT position: €${roundCurrency(vatDue)}`,
        detail: "This uses posted invoice and expense VAT totals across the connected workspaces.",
      },
    ],
    actions: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Invoices", href: "/invoices" },
      { label: "Expenses", href: "/expenses" },
      { label: "Taxes", href: "/taxes" },
      { label: "Reports", href: "/reports" },
    ],
    recent_notifications: recentNotifications,
  };
}

async function handleSummaryRequest(request: Request, env: Env) {
  let proofToken = readBearerToken(request);

  if (request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { proof_token?: string };
    if (typeof body?.proof_token === "string" && body.proof_token.trim()) {
      proofToken = body.proof_token.trim();
    }
  } else {
    const url = new URL(request.url);
    proofToken = url.searchParams.get("proof_token") || proofToken;
  }

  const proof = await verifyHubProof(proofToken, env);
  return buildAccountingSummary(env, proof.email);
}

export const onRequestOptions: PagesFunction<Env> = async () => new Response(null, { status: 204 });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    return json(await handleSummaryRequest(request, env), 200, {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
    });
  } catch (error) {
    return json(
      {
        error: "Unauthorized",
        details: error instanceof Error ? error.message : String(error),
      },
      401,
    );
  }
};

export const onRequestPost: PagesFunction<Env> = onRequestGet;
