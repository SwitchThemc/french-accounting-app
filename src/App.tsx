import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { jsPDF as PdfDocument } from "jspdf";
import {
  ArrowDownUp,
  Banknote,
  BarChart3,
  Building2,
  ClipboardList,
  FileDown,
  FileText,
  Landmark,
  Music,
  LogOut,
  Plus,
  Upload,
  ReceiptText,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Send,
  Settings,
  Users,
  XCircle,
  WalletCards,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { supabase } from "./supabase";
import {
  captureHubContextFromUrl,
  getHubLaunchTarget,
  getHubLoginRedirectUrl,
  getHubReturnUrl,
  pathForTab,
  readHubContext,
  tabFromPath,
  type HubTabId,
  wasLaunchedFromHub,
  writeHubContext,
} from "./hubSession";

type Locale = "en" | "fr";

type Tab = HubTabId;

type Company = {
  id: string;
  name: string;
  legal_form: string | null;
  country_code: string;
  base_currency: string;
  fiscal_regime: string;
  vat_liability_mode: string;
  invoice_prefix: string;
  siret: string | null;
  vat_number: string | null;
};

type Contact = {
  id: string;
  display_name: string;
  kind: string;
  email: string | null;
};

type Invoice = {
  id: string;
  number: string | null;
  issue_date: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  status: string;
  subtotal_ex_vat: number;
  total_inc_vat: number;
  vat_total: number;
  contact_id: string | null;
};

type InvoiceLine = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price_ex_vat: number;
  vat_rate: number;
  line_total_ex_vat: number;
  line_vat_total: number;
  line_total_inc_vat: number;
};

type Expense = {
  id: string;
  expense_date: string;
  supplier_name: string;
  description: string;
  status: string;
  payment_date: string | null;
  payment_method: string | null;
  total_ex_vat: number;
  total_inc_vat: number;
  vat_total: number;
};

type ExpenseDocument = {
  id: string;
  expense_id: string;
  storage_path: string;
  original_filename: string | null;
  content_type: string | null;
};

type InvoiceDocument = {
  id: string;
  invoice_id: string;
  storage_path: string;
  original_filename: string | null;
  content_type: string | null;
  ocr_payload: Record<string, unknown>;
};

type BankTransaction = {
  id: string;
  booking_date: string;
  amount: number;
  direction: "in" | "out";
  counterparty_name: string | null;
  label: string;
};

type VatCode = {
  id: string;
  code: string;
  label: string;
  rate: number;
  applies_to_sales: boolean;
  applies_to_purchases: boolean;
};

type BankAccount = {
  id: string;
  bank_name: string | null;
  provider: string;
};

type ProfitLossReport = {
  company_id: string;
  revenue: number;
  expenses: number;
  net_result: number;
};

type BalanceSheetReport = {
  company_id: string;
  assets: number;
  liabilities: number;
  equity: number;
  current_year_result: number;
  liabilities_equity: number;
  imbalance: number;
};

type AccountBalance = {
  company_id: string;
  account_code: string;
  label: string;
  account_class: string;
  debit_total: number;
  credit_total: number;
  balance: number;
};

type EInvoicingConnector = {
  id: string;
  company_id: string;
  kind: string;
  environment: string;
  display_name: string;
  provider_name: string | null;
  base_url: string | null;
  routing_identifier: string | null;
  is_default: boolean;
};

type EInvoiceDelivery = {
  id: string;
  company_id: string;
  connector_id: string | null;
  invoice_id: string;
  status: string;
  format: string;
  external_message_id: string | null;
  error_message: string | null;
  created_at: string;
};

type Contract = {
  id: string;
  company_id: string;
  contact_id: string | null;
  title: string;
  contract_type: string;
  status: string;
  country: string;
  language: string;
  party_a_name: string;
  party_a_address: string | null;
  party_a_email: string | null;
  party_b_name: string;
  party_b_address: string | null;
  party_b_email: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_amount: number;
  fee_currency: string;
  payment_terms: string | null;
  deliverables: string;
  special_terms: string | null;
  generated_content: string;
  compliance_status: string;
  compliance_notes: string | null;
  source_payload?: Record<string, unknown> | null;
  created_at: string;
};

type GrantFundingProject = {
  id: string;
  company_id: string;
  external_application_id: string;
  owner_email: string;
  artist_name: string | null;
  project_name: string;
  project_type: string;
  grant_program_name: string | null;
  grant_program_code: string | null;
  funding_body_name: string | null;
  official_url: string | null;
  project_budget: number;
  requested_amount: number | null;
  expected_amount_low: number | null;
  expected_amount_high: number | null;
  status: string;
  accounting_notes: string | null;
  pricing_decision: string | null;
  accounting_locked_fields?: string[] | null;
  accounting_updated_at?: string | null;
  source_url: string | null;
  synced_at: string;
};

type ContractDraftPayload = {
  title: string;
  contract_type: string;
  country: string;
  language: string;
  party_a_name: string;
  party_a_address: string;
  party_a_email: string;
  party_b_name: string;
  party_b_address: string;
  party_b_email: string;
  start_date: string;
  end_date: string;
  fee_amount: number;
  fee_currency: string;
  payment_terms: string;
  deliverables: string;
  special_terms: string;
};

type ContractAiSettings = {
  provider: "template" | "ollama";
  endpoint: string;
  model: string;
};

type ContractChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type ContractChatState = {
  messages: ContractChatMessage[];
  step: number;
  answers: Partial<ContractDraftPayload>;
};

type ContractPdfBranding = {
  title?: string;
  accentColor?: string;
  fontFamily?: "helvetica" | "times" | "courier";
  logoDataUrl?: string;
};

type ScanReview = {
  documentType: string;
  reference: string;
  email: string;
  siret: string;
  confidenceNotes: string[];
  rawText?: string;
};

type CompanyInvite = {
  id: string;
  company_id: string;
  email: string;
  role: CompanyRole;
  custom_role_id: string | null;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type CompanyRole = "owner" | "admin" | "bookkeeper" | "viewer";

type CompanyMember = {
  company_id: string;
  user_id: string;
  role: CompanyRole;
  custom_role_id: string | null;
  is_default_company: boolean;
  created_at: string;
};

type CompanyCustomRole = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  can_create_records: boolean;
  can_request_approval: boolean;
  can_approve: boolean;
  can_manage_members: boolean;
  can_manage_company: boolean;
  can_view_reports: boolean;
  created_at: string;
};

type CompanyAccess = {
  canCreateRecords: boolean;
  canRequestApproval: boolean;
  canApprove: boolean;
  canManageMembers: boolean;
  canManageCompany: boolean;
  canViewReports: boolean;
};

type ApprovalRequest = {
  id: string;
  company_id: string;
  kind: string;
  target_table: string | null;
  target_id: string | null;
  title: string;
  details: string | null;
  status: string;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  created_at: string;
};

function roleAccess(role: CompanyRole, customRole?: CompanyCustomRole | null): CompanyAccess {
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isBookkeeper = role === "bookkeeper";
  return {
    canCreateRecords: isOwner || isAdmin || isBookkeeper || Boolean(customRole?.can_create_records),
    canRequestApproval: isOwner || isAdmin || isBookkeeper || Boolean(customRole?.can_request_approval),
    canApprove: isOwner || isAdmin || Boolean(customRole?.can_approve),
    canManageMembers: isOwner || isAdmin || Boolean(customRole?.can_manage_members),
    canManageCompany: isOwner || isAdmin || Boolean(customRole?.can_manage_company),
    canViewReports: customRole?.can_view_reports ?? true,
  };
}

function canWrite(access: CompanyAccess) {
  return access.canCreateRecords;
}

function canRequestApproval(access: CompanyAccess) {
  return access.canRequestApproval;
}

function canApprove(access: CompanyAccess) {
  return access.canApprove;
}

function canManageMembers(access: CompanyAccess) {
  return access.canManageMembers;
}

function roleDisplayName(role: CompanyRole, customRole?: CompanyCustomRole | null) {
  return customRole ? `${customRole.name} (custom)` : role;
}

type HubNotificationEventInput =
  | { event_type: "approval_requested"; approval_id: string }
  | {
      event_type: "mention";
      company_id: string;
      source_label: string;
      source_href: string;
      source_text: string;
      entity_type: string;
      entity_id: string;
      source_event_id?: string;
    };

function hasMentionHandle(text: string) {
  return /(^|[\s([{"'])@[A-Z0-9._%+-]+(?:@[A-Z0-9.-]+\.[A-Z]{2,})?/i.test(text);
}

async function pushHubNotificationEvent(event: HubNotificationEventInput) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return;

  await fetch("/api/hub/notifications/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(event),
  }).catch(() => undefined);
}

async function pushMentionNotifications(event: Extract<HubNotificationEventInput, { event_type: "mention" }>) {
  if (!hasMentionHandle(event.source_text)) return;
  await pushHubNotificationEvent(event);
}

const tabs: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
  { id: "dashboard", label: "Results", icon: BarChart3 },
  { id: "invoices", label: "Get paid", icon: FileText },
  { id: "expenses", label: "Purchases", icon: ReceiptText },
  { id: "contracts", label: "Contracts", icon: Music },
  { id: "grants", label: "Grants", icon: Banknote },
  { id: "bank", label: "Bank", icon: Landmark },
  { id: "taxes", label: "Taxes", icon: ShieldCheck },
  { id: "reports", label: "Reports", icon: ClipboardList },
  { id: "einvoicing", label: "E-invoicing", icon: Send },
  { id: "settings", label: "Settings", icon: Settings },
];

const labels: Record<Locale, Record<string, string>> = {
  en: {
    setup: "setup",
    createWorkspace: "Create your accounting workspace",
    refreshing: "Refreshing workspace...",
    language: "Language",
    refresh: "Refresh",
    signOut: "Sign out",
    authTitle: "Daily bookkeeping for a French solo business.",
    authSubtitle: "Invoices, purchases, cash, VAT and exports in one working ledger.",
    continueGoogle: "Continue with Google",
    useEmail: "or use email",
    password: "Password",
    working: "Working...",
    signIn: "Sign in",
    createAccount: "Create account",
    needAccount: "Need an account?",
    alreadyAccount: "Already have one?",
    companyProfile: "Company profile",
    companyProfileHelp: "Regime choices drive VAT, books and export behavior.",
    companyName: "Company name",
    invoicePrefix: "Invoice prefix",
    fiscalRegime: "Fiscal regime",
    vatMode: "VAT mode",
    vatNumber: "VAT number",
    creating: "Creating...",
    createWorkspaceButton: "Create workspace",
    revenue: "Revenue",
    purchases: "Purchases",
    cashMovement: "Cash movement",
    vatPosition: "VAT position",
    urssafEstimate: "URSSAF estimate",
    recentActivity: "Recent activity",
    recentActivityHelp: "Latest invoices and purchases from the ledger workspace.",
    newInvoice: "New invoice",
    newInvoiceHelp: "Create manually, attach a source file, or scan a photo to prefill the fields.",
    invoiceUploadScan: "Invoice upload and scan",
    invoiceUploadHelp: "Free local OCR for images. PDFs are stored as attachments.",
    scanUpload: "Scan upload",
    scanning: "Scanning...",
    existingClient: "Existing client",
    newClient: "New client",
    newClientName: "New client name",
    clientEmail: "Client email",
    description: "Description",
    amountExVat: "Amount ex VAT",
    issueDate: "Issue date",
    dueDate: "Due date",
    sourceScan: "Source invoice / scan",
    createInvoice: "Create invoice",
    detectedDocument: "Detected document",
    invoiceRegister: "Invoice register",
    invoiceRegisterHelp: "Rows feed the livre des recettes export view.",
    receiptScan: "Receipt scan",
    receiptScanHelp: "Capture a document from the PWA camera and prefill supplier, amount, VAT and category.",
    scanReceipt: "Scan receipt",
    detectedReceipt: "Detected receipt",
    logPurchase: "Log a purchase",
    logPurchaseHelp: "Tracks supplier, category, VAT and payment method.",
    supplier: "Supplier",
    category: "Category",
    paymentMethod: "Payment method",
    expenseDate: "Expense date",
    receipt: "Receipt",
    addPurchase: "Add purchase",
    purchaseRegister: "Purchase register",
    purchaseRegisterHelp: "Eligible micro-BIC purchases can export from this list.",
    generateContract: "Generate contract",
    generateContractHelp: "Use local templates or an open-source Ollama model for contract drafting.",
    aiProvider: "Open-source AI provider",
    aiProviderHelp: "Run Ollama locally or self-host it. The app falls back to local templates.",
    localTemplate: "Local template",
    noLinkedClient: "No linked client",
    english: "English",
    frenchGuidance: "French guidance",
    currency: "Currency",
    downloadPdf: "Download PDF",
    closePreview: "Close preview",
    contractTitle: "Contract title",
    contractType: "Contract type",
    countryJurisdiction: "Country / jurisdiction",
    feeAmount: "Fee amount",
    startDate: "Start date",
    endDate: "End date",
    yourLegalName: "Your legal name",
    yourAddress: "Your address",
    yourEmail: "Your email",
    counterpartyName: "Counterparty name",
    counterpartyAddress: "Counterparty address",
    counterpartyEmail: "Counterparty email",
    paymentTerms: "Payment terms",
    deliverables: "Deliverables / scope",
    specialTerms: "Special terms",
    generateWithOllama: "Generate with Ollama",
    generateContractButton: "Generate contract",
    generating: "Generating...",
    aiContractInterview: "AI contract interview",
    aiContractInterviewHelp: "Describe the contract. The assistant asks follow-up questions, then generates a draft.",
    yourAnswer: "Your answer",
    sendAnswer: "Send answer",
    generateFromChat: "Generate from chat",
    contractRegister: "Contract register",
    contractRegisterHelp: "Generated contracts are stored with the company and can be exported to PDF.",
    editDraft: "Edit draft",
    saveDraft: "Save draft",
    draftSaved: "Contract draft saved.",
    translationLanguage: "Translation language",
    generateOtherLanguage: "Generate other language",
    translationGenerated: "Translation generated.",
    bilingualPdf: "Bilingual PDF",
    secondLanguageDraft: "Second-language draft",
    useOllamaForLanguage: "Use Ollama to generate this language.",
    originalLanguage: "Original language",
    contractDesign: "PDF design",
    contractDesignHelp: "Customize the exported PDF title, accent color, font and logo.",
    contractDisplayName: "Contract name",
    accentColor: "Accent color",
    font: "Font",
    logo: "Logo",
    saveDesign: "Save design",
    designSaved: "PDF design saved.",
    legalReview: "Legal review",
    legalReviewHelp: "Confirm the draft is complete before approval or signature.",
    grantFunding: "Grant funding",
    grantFundingHelp: "Release Manager syncs Switch The MC grant applications here for pricing, expected funding, and follow-up.",
    grantBudgetPipeline: "Grant budget pipeline",
    grantBudgetPipelineHelp: "Projected eligible budgets and requested funding from Release Manager.",
    grantReadbackHint: "Accounting edits are saved here and become visible to Release Manager only when Release Manager pulls this project through the signed sync endpoint.",
    expectedFunding: "Expected funding",
    requestedFunding: "Requested funding",
    synced: "Synced",
    openReleaseManager: "Open Release Manager",
    accountingNotes: "Accounting notes",
    pricingDecision: "Pricing decision",
    save: "Save",
    companyInformation: "Company information",
    companyInformationHelp: "Edit the legal and accounting defaults used across invoices, exports and contracts.",
    legalForm: "Legal form",
    baseCurrency: "Base currency",
    saveCompany: "Save company",
    inviteLinks: "Invite links",
    inviteLinksHelp: "Create a secure invite link for collaborators, bookkeepers or reviewers.",
    teamMembers: "Team members",
    teamMembersHelp: "Roles control who can edit, request approvals, approve work and manage access.",
    customRoles: "Custom roles",
    customRolesHelp: "Create reusable access profiles for collaborators who need more precise permissions.",
    roleName: "Role name",
    roleDescription: "Role description",
    createCustomRole: "Create custom role",
    permissions: "Permissions",
    createRecordsPermission: "Create and edit records",
    requestApprovalPermission: "Request approvals",
    approvePermission: "Approve or reject",
    manageMembersPermission: "Manage members and invites",
    manageCompanyPermission: "Edit company settings",
    viewReportsPermission: "View reports",
    presetRole: "Preset role",
    currentRole: "Current role",
    userId: "User ID",
    defaultCompany: "Default company",
    approvalDecisionRestricted: "Only owners and admins can approve or reject.",
    approvalRequestRestricted: "Your current role cannot request approvals.",
    writeRestricted: "Your current role is read-only for this action.",
    manageMembersRestricted: "Only owners and admins can invite or manage collaborators.",
    manageCompanyRestricted: "Your current role cannot edit company settings.",
    reportsRestricted: "Your current role cannot view financial reports.",
    allowedRoles: "Owner/Admin approve. Bookkeeper prepares. Viewer reads. Custom roles can override specific permissions.",
    role: "Role",
    createInviteLink: "Create invite link",
    copyLink: "Copy link",
    sendEmail: "Send email",
    mentionsHelp: "Use @email, @name before the email domain, or @all in notes, descriptions, approval details, contracts, grants and bank labels to notify teammates through the hub.",
    meetingInvites: "Meeting invites",
    meetingInvitesHelp: "Send a calendar-ready email invite and hub notification to teammates or external guests.",
    attendees: "Attendees",
    meetingTitle: "Meeting title",
    meetingDescription: "Meeting description",
    meetingLocation: "Location or video link",
    startsAt: "Starts",
    endsAt: "Ends",
    sendMeetingInvite: "Send meeting invite",
    meetingInviteSent: "Meeting invite sent.",
    approvalFlows: "Approval flows",
    approvalFlowsHelp: "Track decisions for contracts, invoices, expenses and company changes.",
    title: "Title",
    details: "Details",
    requestApproval: "Request approval",
    created: "Created",
    type: "Type",
    actions: "Actions",
    number: "Number",
    total: "Total",
    upload: "Upload",
    approval: "Approval",
    fee: "Fee",
    link: "Link",
    expires: "Expires",
    manualBankLine: "Manual bank line",
    manualBankLineHelp: "PSD2 connectors can later write into the same table.",
    direction: "Direction",
    amount: "Amount",
    counterparty: "Counterparty",
    label: "Label",
    bookingDate: "Booking date",
    addBankLine: "Add bank line",
    bankFeed: "Bank feed",
    bankFeedHelp: "Lines are ready for reconciliation matches and rules.",
    moneyIn: "Money in",
    moneyOut: "Money out",
    livreRecettes: "Livre des recettes",
    registreAchats: "Purchase register",
    vatDue: "VAT due",
    exportStatus: "Export status",
    exportStatusHelp: "FEC is modeled in the database and should be generated by a server-side job.",
    livreRecettesCsv: "Revenue book CSV",
    registreAchatsCsv: "Purchase register CSV",
    taxAnalyticsPdf: "Tax analytics PDF",
    finalRateRules: "Needs final rate rules before filing",
    readyNow: "Ready now",
    source: "Source",
    yes: "Yes",
    partial: "Partial",
    schemaReady: "Schema ready",
    payloadReady: "Payload field ready",
    reportsRevenueHelp: "Posted revenue accounts",
    reportsExpensesHelp: "Posted expense accounts",
    netResult: "Net result",
    balanceCheck: "Balance check",
    balanceCheckHelp: "Assets minus liabilities/equity/result",
    profitAndLoss: "Profit and loss",
    profitAndLossHelp: "Generated from posted journal lines.",
    financialReportsPdf: "Financial reports PDF",
    balanceSheet: "Balance sheet",
    balanceSheetHelp: "Assets, liabilities and equity from the ledger.",
    assets: "Assets",
    liabilities: "Liabilities",
    equity: "Equity",
    currentYearResult: "Current year result",
    liabilitiesEquityResult: "Liabilities + equity + result",
    imbalance: "Imbalance",
    accountBalances: "Account balances",
    accountBalancesHelp: "Detailed account balance by French account class.",
    account: "Account",
    class: "Class",
    debit: "Debit",
    credit: "Credit",
    balance: "Balance",
    pdpConnector: "PDP / PPF connector",
    pdpConnectorHelp: "Queue e-invoices for an accredited PDP or manual export workflow.",
    connectorType: "Connector type",
    environment: "Environment",
    displayName: "Display name",
    provider: "Provider",
    baseUrl: "Base URL",
    routingId: "Routing ID",
    saveConnector: "Save connector",
    queueInvoice: "Queue invoice",
    queueInvoiceHelp: "Creates a delivery record for future PDP API processing.",
    invoice: "Invoice",
    connector: "Connector",
    format: "Format",
    queueDelivery: "Queue delivery",
    reformReadiness: "Reform readiness",
    reformReadinessHelp: "Tracks the current French e-invoicing architecture assumptions.",
    area: "Area",
    status: "Status",
    receivingSupplierInvoices: "Receiving invoices from suppliers",
    issuingEInvoices: "Issuing e-invoices for PME/micro",
    exchangeRoute: "Exchange route",
    supportedPayloadRecords: "Supported payload records",
    nextIntegrationStep: "Next integration step",
    requiredAll2026: "Required for all businesses from 2026-09-01",
    requiredPme2027: "Required from 2027-09-01",
    accreditedPdp: "Accredited PDP; PPF is not the direct business portal",
    facturxQueue: "Factur-X, UBL, CII queue metadata",
    addPdpAdapter: "Add a real PDP API adapter and credentials vault reference",
    noRows: "No rows yet.",
  },
  fr: {
    setup: "configuration",
    createWorkspace: "Creer votre espace comptable",
    refreshing: "Actualisation de l'espace...",
    language: "Langue",
    refresh: "Actualiser",
    signOut: "Se deconnecter",
    authTitle: "Comptabilite quotidienne pour une petite activite francaise.",
    authSubtitle: "Factures, achats, tresorerie, TVA et exports dans un vrai livre comptable.",
    continueGoogle: "Continuer avec Google",
    useEmail: "ou utiliser l'email",
    password: "Mot de passe",
    working: "Traitement...",
    signIn: "Se connecter",
    createAccount: "Creer un compte",
    needAccount: "Besoin d'un compte ?",
    alreadyAccount: "Deja un compte ?",
    companyProfile: "Profil de l'entreprise",
    companyProfileHelp: "Le regime pilote la TVA, les livres et les exports.",
    companyName: "Nom de l'entreprise",
    invoicePrefix: "Prefixe facture",
    fiscalRegime: "Regime fiscal",
    vatMode: "Mode TVA",
    vatNumber: "Numero TVA",
    creating: "Creation...",
    createWorkspaceButton: "Creer l'espace",
    revenue: "Chiffre d'affaires",
    purchases: "Achats",
    cashMovement: "Mouvements bancaires",
    vatPosition: "Position TVA",
    urssafEstimate: "Estimation URSSAF",
    recentActivity: "Activite recente",
    recentActivityHelp: "Dernieres factures et depenses du livre comptable.",
    newInvoice: "Nouvelle facture",
    newInvoiceHelp: "Creer manuellement, joindre un fichier ou scanner une photo pour pre-remplir.",
    invoiceUploadScan: "Import et scan de facture",
    invoiceUploadHelp: "OCR local gratuit pour les images. Les PDF sont conserves en pieces jointes.",
    scanUpload: "Scanner",
    scanning: "Scan...",
    existingClient: "Client existant",
    newClient: "Nouveau client",
    newClientName: "Nom du nouveau client",
    clientEmail: "Email client",
    description: "Description",
    amountExVat: "Montant HT",
    issueDate: "Date d'emission",
    dueDate: "Echeance",
    sourceScan: "Facture source / scan",
    createInvoice: "Creer la facture",
    detectedDocument: "Document detecte",
    invoiceRegister: "Registre des factures",
    invoiceRegisterHelp: "Ces lignes alimentent l'export livre des recettes.",
    receiptScan: "Scan de justificatif",
    receiptScanHelp: "Capture depuis la PWA et pre-remplissage fournisseur, montant, TVA et categorie.",
    scanReceipt: "Scanner le justificatif",
    detectedReceipt: "Justificatif detecte",
    logPurchase: "Saisir un achat",
    logPurchaseHelp: "Suit fournisseur, categorie, TVA et moyen de paiement.",
    supplier: "Fournisseur",
    category: "Categorie",
    paymentMethod: "Moyen de paiement",
    expenseDate: "Date de depense",
    receipt: "Justificatif",
    addPurchase: "Ajouter l'achat",
    purchaseRegister: "Registre des achats",
    purchaseRegisterHelp: "Les achats micro-BIC eligibles peuvent etre exportes depuis cette liste.",
    generateContract: "Generer un contrat",
    generateContractHelp: "Utiliser des modeles locaux ou un modele open-source Ollama.",
    aiProvider: "Fournisseur IA open-source",
    aiProviderHelp: "Lancez Ollama localement ou auto-hebergez-le. Sinon l'app utilise les modeles locaux.",
    localTemplate: "Modele local",
    noLinkedClient: "Aucun client lie",
    english: "Anglais",
    frenchGuidance: "Guidage francais",
    currency: "Devise",
    downloadPdf: "Telecharger PDF",
    closePreview: "Fermer l'apercu",
    contractTitle: "Titre du contrat",
    contractType: "Type de contrat",
    countryJurisdiction: "Pays / juridiction",
    feeAmount: "Montant",
    startDate: "Date de debut",
    endDate: "Date de fin",
    yourLegalName: "Votre nom legal",
    yourAddress: "Votre adresse",
    yourEmail: "Votre email",
    counterpartyName: "Nom du cocontractant",
    counterpartyAddress: "Adresse du cocontractant",
    counterpartyEmail: "Email du cocontractant",
    paymentTerms: "Conditions de paiement",
    deliverables: "Livrables / perimetre",
    specialTerms: "Conditions particulieres",
    generateWithOllama: "Generer avec Ollama",
    generateContractButton: "Generer le contrat",
    generating: "Generation...",
    aiContractInterview: "Entretien IA contrat",
    aiContractInterviewHelp: "Decrivez le contrat. L'assistant pose des questions puis genere un brouillon.",
    yourAnswer: "Votre reponse",
    sendAnswer: "Envoyer",
    generateFromChat: "Generer depuis le chat",
    contractRegister: "Registre des contrats",
    contractRegisterHelp: "Les contrats generes sont stockes et exportables en PDF.",
    editDraft: "Modifier le brouillon",
    saveDraft: "Enregistrer le brouillon",
    draftSaved: "Brouillon de contrat enregistré.",
    translationLanguage: "Langue de traduction",
    generateOtherLanguage: "Générer l'autre langue",
    translationGenerated: "Traduction générée.",
    bilingualPdf: "PDF bilingue",
    secondLanguageDraft: "Brouillon dans la deuxième langue",
    useOllamaForLanguage: "Utilisez Ollama pour générer cette langue.",
    originalLanguage: "Langue originale",
    contractDesign: "Design PDF",
    contractDesignHelp: "Personnalisez le titre exporté, la couleur, la police et le logo.",
    contractDisplayName: "Nom du contrat",
    accentColor: "Couleur",
    font: "Police",
    logo: "Logo",
    saveDesign: "Enregistrer le design",
    designSaved: "Design PDF enregistré.",
    legalReview: "Relecture juridique",
    legalReviewHelp: "Verifiez que le brouillon est complet avant approbation ou signature.",
    grantFunding: "Financements",
    grantFundingHelp: "Release Manager synchronise ici les dossiers Switch The MC pour suivre prix, budgets et subventions attendues.",
    grantBudgetPipeline: "Pipeline budgets subventions",
    grantBudgetPipelineHelp: "Budgets eligibles et montants demandes depuis Release Manager.",
    grantReadbackHint: "Les edits comptables sont enregistres ici et deviennent visibles dans Release Manager seulement quand Release Manager relit ce dossier via le endpoint sync signe.",
    expectedFunding: "Financement attendu",
    requestedFunding: "Financement demande",
    synced: "Synchronise",
    openReleaseManager: "Ouvrir Release Manager",
    accountingNotes: "Notes comptables",
    pricingDecision: "Decision tarifaire",
    save: "Enregistrer",
    companyInformation: "Informations entreprise",
    companyInformationHelp: "Modifier les informations legales et comptables utilisees partout.",
    legalForm: "Forme juridique",
    baseCurrency: "Devise",
    saveCompany: "Enregistrer",
    inviteLinks: "Liens d'invitation",
    inviteLinksHelp: "Creer un lien securise pour collaborateurs, comptables ou relecteurs.",
    teamMembers: "Membres de l'équipe",
    teamMembersHelp: "Les rôles définissent qui peut modifier, demander une approbation, approuver et gérer les accès.",
    customRoles: "Rôles personnalisés",
    customRolesHelp: "Créez des profils d'accès réutilisables pour les collaborateurs qui ont besoin de permissions précises.",
    roleName: "Nom du rôle",
    roleDescription: "Description du rôle",
    createCustomRole: "Créer un rôle personnalisé",
    permissions: "Permissions",
    createRecordsPermission: "Créer et modifier les données",
    requestApprovalPermission: "Demander des approbations",
    approvePermission: "Approuver ou refuser",
    manageMembersPermission: "Gérer membres et invitations",
    manageCompanyPermission: "Modifier l'entreprise",
    viewReportsPermission: "Voir les rapports",
    presetRole: "Rôle prédéfini",
    currentRole: "Rôle actuel",
    userId: "ID utilisateur",
    defaultCompany: "Entreprise par défaut",
    approvalDecisionRestricted: "Seuls les propriétaires et admins peuvent approuver ou refuser.",
    approvalRequestRestricted: "Votre rôle actuel ne permet pas de demander une approbation.",
    writeRestricted: "Votre rôle actuel ne permet pas cette action.",
    manageMembersRestricted: "Seuls les propriétaires et admins peuvent inviter ou gérer les collaborateurs.",
    manageCompanyRestricted: "Votre rôle actuel ne permet pas de modifier l'entreprise.",
    reportsRestricted: "Votre rôle actuel ne permet pas de voir les rapports financiers.",
    allowedRoles: "Propriétaire/Admin approuvent. Comptable prépare. Lecteur consulte. Les rôles personnalisés peuvent ajuster les permissions.",
    role: "Role",
    createInviteLink: "Creer le lien",
    copyLink: "Copier",
    sendEmail: "Envoyer email",
    mentionsHelp: "Utilisez @email, @nom avant le domaine email, ou @all dans les notes, descriptions, details d'approbation, contrats, subventions et libelles bancaires pour notifier l'equipe via le hub.",
    meetingInvites: "Invitations reunion",
    meetingInvitesHelp: "Envoyer une invitation email compatible calendrier et une notification hub aux collaborateurs ou invites externes.",
    attendees: "Participants",
    meetingTitle: "Titre de reunion",
    meetingDescription: "Description",
    meetingLocation: "Lieu ou lien video",
    startsAt: "Debut",
    endsAt: "Fin",
    sendMeetingInvite: "Envoyer invitation",
    meetingInviteSent: "Invitation envoyee.",
    approvalFlows: "Circuits d'approbation",
    approvalFlowsHelp: "Suivre les decisions sur contrats, factures, depenses et changements.",
    title: "Titre",
    details: "Details",
    requestApproval: "Demander approbation",
    created: "Cree le",
    type: "Type",
    actions: "Actions",
    number: "Numero",
    total: "Total",
    upload: "Piece jointe",
    approval: "Approbation",
    fee: "Montant",
    link: "Lien",
    expires: "Expire",
    manualBankLine: "Ligne bancaire manuelle",
    manualBankLineHelp: "Les connecteurs PSD2 ecriront ensuite dans cette meme table.",
    direction: "Sens",
    amount: "Montant",
    counterparty: "Tiers",
    label: "Libelle",
    bookingDate: "Date d'operation",
    addBankLine: "Ajouter la ligne",
    bankFeed: "Flux bancaire",
    bankFeedHelp: "Les lignes sont pretes pour rapprochement et regles.",
    moneyIn: "Entree",
    moneyOut: "Sortie",
    livreRecettes: "Livre des recettes",
    registreAchats: "Registre des achats",
    vatDue: "TVA due",
    exportStatus: "Etat des exports",
    exportStatusHelp: "Le FEC est modele en base et doit etre genere par un traitement serveur.",
    livreRecettesCsv: "Livre recettes CSV",
    registreAchatsCsv: "Registre achats CSV",
    taxAnalyticsPdf: "Analytics fiscales PDF",
    finalRateRules: "Necessite les taux definitifs avant declaration",
    readyNow: "Pret maintenant",
    source: "Source",
    yes: "Oui",
    partial: "Partiel",
    schemaReady: "Schema pret",
    payloadReady: "Champ payload pret",
    reportsRevenueHelp: "Comptes de produits postes",
    reportsExpensesHelp: "Comptes de charges postes",
    netResult: "Resultat net",
    balanceCheck: "Controle balance",
    balanceCheckHelp: "Actif moins passif/capitaux/resultat",
    profitAndLoss: "Compte de resultat",
    profitAndLossHelp: "Genere depuis les ecritures comptables postees.",
    financialReportsPdf: "Rapports financiers PDF",
    balanceSheet: "Bilan",
    balanceSheetHelp: "Actif, passif et capitaux issus du grand livre.",
    assets: "Actif",
    liabilities: "Passif",
    equity: "Capitaux propres",
    currentYearResult: "Resultat de l'exercice",
    liabilitiesEquityResult: "Passif + capitaux + resultat",
    imbalance: "Ecart",
    accountBalances: "Balances des comptes",
    accountBalancesHelp: "Solde detaille par classe du plan comptable francais.",
    account: "Compte",
    class: "Classe",
    debit: "Debit",
    credit: "Credit",
    balance: "Solde",
    pdpConnector: "Connecteur PDP / PPF",
    pdpConnectorHelp: "Mettre en file les e-factures pour un PDP accredite ou un export manuel.",
    connectorType: "Type de connecteur",
    environment: "Environnement",
    displayName: "Nom affiche",
    provider: "Fournisseur",
    baseUrl: "URL de base",
    routingId: "ID de routage",
    saveConnector: "Enregistrer le connecteur",
    queueInvoice: "Mettre une facture en file",
    queueInvoiceHelp: "Cree un enregistrement d'envoi pour un futur traitement PDP.",
    invoice: "Facture",
    connector: "Connecteur",
    format: "Format",
    queueDelivery: "Mettre en file",
    reformReadiness: "Preparation reforme",
    reformReadinessHelp: "Suit les hypotheses de l'architecture francaise d'e-facturation.",
    area: "Zone",
    status: "Statut",
    receivingSupplierInvoices: "Reception des factures fournisseurs",
    issuingEInvoices: "Emission e-factures PME/micro",
    exchangeRoute: "Canal d'echange",
    supportedPayloadRecords: "Formats suivis",
    nextIntegrationStep: "Prochaine integration",
    requiredAll2026: "Obligatoire pour toutes les entreprises le 2026-09-01",
    requiredPme2027: "Obligatoire a partir du 2027-09-01",
    accreditedPdp: "PDP accredite ; le PPF n'est pas le portail direct entreprise",
    facturxQueue: "Metadonnees de file Factur-X, UBL, CII",
    addPdpAdapter: "Ajouter un adaptateur API PDP et une reference coffre credentials",
    noRows: "Aucune ligne pour le moment.",
  },
};

const tabLabels: Record<Locale, Record<Tab, string>> = {
  en: {
    dashboard: "Results",
    invoices: "Get paid",
    expenses: "Purchases",
    contracts: "Contracts",
    grants: "Grants",
    bank: "Bank",
    taxes: "Taxes",
    reports: "Reports",
    einvoicing: "E-invoicing",
    settings: "Settings",
  },
  fr: {
    dashboard: "Resultats",
    invoices: "Encaisser",
    expenses: "Achats",
    contracts: "Contrats",
    grants: "Financements",
    bank: "Banque",
    taxes: "Impots",
    reports: "Rapports",
    einvoicing: "E-facturation",
    settings: "Parametres",
  },
};

const currency = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const today = new Date().toISOString().slice(0, 10);

function eur(value: number | null | undefined) {
  return currency.format(Number(value ?? 0));
}

function plusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadCsv(filename: string, columns: string[], rows: Array<Array<string | number | null | undefined>>) {
  const content = [columns, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "") || "export";
}

function savePdf(pdf: PdfDocument, filename: string) {
  pdf.save(`${sanitizeFilename(filename)}.pdf`);
}

const pdfLayout = {
  margin: 12,
  topMargin: 12,
  bottomMargin: 12,
  pageWidth: 210,
  pageHeight: 297,
  headerHeight: 34,
  accent: "#223128",
};

function pdfContentWidth(pdf = { internal: { pageSize: { getWidth: () => pdfLayout.pageWidth } } } as PdfDocument) {
  return pdf.internal.pageSize.getWidth() - pdfLayout.margin * 2;
}

function pdfText(pdf: PdfDocument, text: string, x: number, y: number, maxWidth: number, lineHeight = 5) {
  const lines = pdf.splitTextToSize(text || "-", maxWidth) as string[];
  pdf.text(lines, x, y);
  return y + Math.max(lines.length, 1) * lineHeight;
}

function pdfRight(pdf: PdfDocument, text: string, x: number, y: number) {
  pdf.text(text, x - pdf.getTextWidth(text), y);
}

function ensurePdfSpace(pdf: PdfDocument, y: number, neededHeight: number, margin = pdfLayout.margin) {
  const pageBottom = pdf.internal.pageSize.getHeight() - pdfLayout.bottomMargin;
  if (y + neededHeight <= pageBottom) return y;
  pdf.addPage();
  return margin;
}

function pdfSectionTitle(pdf: PdfDocument, title: string, y: number) {
  const left = pdfLayout.margin;
  const right = pdf.internal.pageSize.getWidth() - pdfLayout.margin;
  y = ensurePdfSpace(pdf, y, 16);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(title, left, y);
  pdf.setDrawColor(199, 216, 107);
  pdf.setLineWidth(0.7);
  pdf.line(left, y + 3, right, y + 3);
  return y + 11;
}

function pdfKeyValueRows(pdf: PdfDocument, rows: Array<[string, string]>, y: number) {
  const left = pdfLayout.margin;
  const right = pdf.internal.pageSize.getWidth() - pdfLayout.margin;
  const labelWidth = 62;
  const valueWidth = right - left - labelWidth - 8;
  const lineHeight = 5;
  pdf.setFontSize(10);
  rows.forEach(([label, value]) => {
    const valueLines = pdf.splitTextToSize(value || "-", valueWidth) as string[];
    const rowHeight = Math.max(valueLines.length, 1) * lineHeight + 3;
    y = ensurePdfSpace(pdf, y, rowHeight);
    pdf.setFont("helvetica", "bold");
    pdf.text(pdf.splitTextToSize(label || "-", labelWidth) as string[], left, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(valueLines, left + labelWidth + 8, y);
    y += rowHeight;
  });
  return y + 4;
}

function pdfTable(
  pdf: PdfDocument,
  headers: string[],
  rows: string[][],
  widths: number[],
  y: number,
  options: { numeric?: number[] } = {},
) {
  const left = pdfLayout.margin;
  const tableWidth = pdfContentWidth(pdf);
  const normalizedWidths = widths.map((width) => (width / widths.reduce((sum, item) => sum + item, 0)) * tableWidth);
  const rowGap = 5;
  const lineHeight = 5;
  const numeric = new Set(options.numeric ?? []);

  function drawHeader(nextY: number) {
    pdf.setFillColor(34, 49, 40);
    pdf.rect(left, nextY - 5, tableWidth, 9, "F");
    pdf.setTextColor(248, 250, 246);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.8);
    let x = left;
    headers.forEach((header, index) => {
      const width = normalizedWidths[index];
      if (numeric.has(index)) pdfRight(pdf, header, x + width - 2, nextY);
      else pdf.text(pdf.splitTextToSize(header, width - 4) as string[], x + 2, nextY);
      x += width;
    });
    pdf.setTextColor(29, 37, 32);
    return nextY + 10;
  }

  y = drawHeader(ensurePdfSpace(pdf, y, 13));
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);

  rows.forEach((row) => {
    const wrapped = row.map((cell, index) => pdf.splitTextToSize(cell || "-", Math.max(normalizedWidths[index] - 4, 10)) as string[]);
    const rowHeight = Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + rowGap;
    y = ensurePdfSpace(pdf, y, rowHeight + 4);
    if (y === pdfLayout.margin) y = drawHeader(y);

    let x = left;
    wrapped.forEach((lines, index) => {
      const width = normalizedWidths[index];
      if (numeric.has(index)) {
        lines.forEach((line, lineIndex) => pdfRight(pdf, line, x + width - 2, y + lineIndex * lineHeight));
      } else {
        pdf.text(lines, x + 2, y);
      }
      x += width;
    });
    pdf.setDrawColor(226, 234, 219);
    pdf.line(left, y + rowHeight - 2, left + tableWidth, y + rowHeight - 2);
    y += rowHeight;
  });

  return y + 4;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return { r: 34, g: 49, b: 40 };
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function pdfDocumentHeader(
  pdf: PdfDocument,
  title: string,
  subtitle: string,
  company: Company,
  branding: ContractPdfBranding = {},
) {
  const accent = hexToRgb(branding.accentColor || "#223128");
  const font = branding.fontFamily || "helvetica";
  const pageWidth = pdf.internal.pageSize.getWidth();
  const left = pdfLayout.margin;
  const right = pageWidth - pdfLayout.margin;
  const textX = branding.logoDataUrl ? left + 24 : left;
  const titleWidth = right - textX - 45;
  pdf.setFillColor(accent.r, accent.g, accent.b);
  pdf.rect(0, 0, pageWidth, pdfLayout.headerHeight, "F");
  pdf.setTextColor(248, 250, 246);
  pdf.setFont(font, "bold");
  pdf.setFontSize(17);
  pdf.text(pdf.splitTextToSize(title, titleWidth).slice(0, 2) as string[], textX, 16);
  pdf.setFont(font, "normal");
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(company.name, right - textX - 8).slice(0, 1) as string[], textX, 28);
  pdfRight(pdf, subtitle, right, 16);
  if (branding.logoDataUrl) {
    try {
      pdf.addImage(branding.logoDataUrl, "PNG", left, 7, 16, 16, undefined, "FAST");
    } catch {
      try {
        pdf.addImage(branding.logoDataUrl, "JPEG", left, 7, 16, 16, undefined, "FAST");
      } catch {
        // Ignore invalid logo data; text export should still work.
      }
    }
  }
  pdf.setTextColor(29, 37, 32);
  return pdfLayout.headerHeight + 12;
}

function parseLocalizedNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  return Number.parseFloat(normalized);
}

function normalizeScannedDate(value: string) {
  const parts = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!parts) return "";
  const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
  return `${year}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
}

function parseInvoiceScan(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const amountPattern = /(\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})|\d+[,.]\d{2})\s*(?:eur|euro|€)?/gi;
  const amountMatches = [...text.matchAll(amountPattern)];
  const amounts = amountMatches.map((match) => parseLocalizedNumber(match[1])).filter((value) => Number.isFinite(value));
  const totalTtcMatch = text.match(/(?:total\s*(?:ttc)?|net\s*a\s*payer|amount\s*due)[^\d]{0,24}(\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})|\d+[,.]\d{2})/i);
  const totalHtMatch = text.match(/(?:total\s*ht|subtotal|hors\s*taxe)[^\d]{0,24}(\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})|\d+[,.]\d{2})/i);
  const dateMatch = text.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/);
  const vatMatch = text.match(/tva\s*(?:a|@|:)?\s*(\d{1,2}(?:[,.]\d{1,2})?)\s*%/i);
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const siretMatch = text.match(/\b(?:siret\s*)?(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/i);
  const referenceMatch = text.match(/\b(?:facture|invoice|ref(?:erence)?|numero|n[°o])\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i);
  const documentType = /devis|quote/i.test(text) ? "quote" : /recu|receipt|ticket/i.test(text) ? "receipt" : "invoice";
  const firstBusinessLine = lines.find((line) => !/facture|invoice|date|total|tva|siret|email|tel/i.test(line)) ?? lines[0] ?? "";
  const totalTtc = totalTtcMatch ? parseLocalizedNumber(totalTtcMatch[1]) : amounts.length ? Math.max(...amounts) : null;
  const totalHt = totalHtMatch ? parseLocalizedNumber(totalHtMatch[1]) : null;

  return {
    clientName: firstBusinessLine,
    description: lines.find((line) => /prestation|service|development|developpement|conseil|invoice|facture/i.test(line)) ?? "",
    amount: totalHt !== null ? totalHt.toFixed(2) : totalTtc !== null ? totalTtc.toFixed(2) : "",
    issueDate: dateMatch ? normalizeScannedDate(dateMatch[1]) : "",
    vatRate: vatMatch ? parseLocalizedNumber(vatMatch[1]) : null,
    email: emailMatch?.[0] ?? "",
    siret: siretMatch?.[1]?.replace(/\s/g, "") ?? "",
    reference: referenceMatch?.[1] ?? "",
    documentType,
    confidenceNotes: [
      totalTtc !== null ? `TTC ${totalTtc.toFixed(2)}` : "",
      totalHt !== null ? `HT ${totalHt.toFixed(2)}` : "",
      emailMatch ? "email" : "",
      siretMatch ? "siret" : "",
      referenceMatch ? "reference" : "",
    ].filter(Boolean),
    rawText: text,
  };
}

function invoiceLegalMention(company: Company) {
  if (company.vat_liability_mode === "exempt") return "TVA non applicable, art. 293 B du CGI";
  return "TVA exigible selon les regles applicables a la date de facturation.";
}

async function downloadInvoicePdf(invoice: Invoice, contact: Contact | undefined, lines: InvoiceLine[], company: Company) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const invoiceNumber = invoice.number ?? "draft";
  let y = pdfDocumentHeader(pdf, "Facture", invoiceNumber, company);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  const left = pdfLayout.margin;
  const columnGap = 10;
  const partyColumnWidth = (pdfContentWidth(pdf) - columnGap) / 2;
  const clientX = left + partyColumnWidth + columnGap;
  pdf.text("Emetteur", left, y);
  pdf.text("Client", clientX, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  const issuerBottom = pdfText(pdf, company.name, left, y, partyColumnWidth);
  const clientBottom = pdfText(pdf, [contact?.display_name ?? "Client", contact?.email ?? ""].filter(Boolean).join("\n"), clientX, y, partyColumnWidth);
  y = Math.max(issuerBottom, clientBottom);
  y += 8;

  y = pdfKeyValueRows(
    pdf,
    [
      ["Date", invoice.issue_date],
      ["Echeance", invoice.due_date ?? "-"],
      ["Statut", invoice.status],
    ],
    y,
  );

  y = pdfSectionTitle(pdf, "Lignes de facture", y);
  y = pdfTable(
    pdf,
    ["Description", "HT", "TVA", "TTC"],
    lines.map((line) => [
      line.description,
      eur(line.line_total_ex_vat),
      `${Number(line.vat_rate).toFixed(1)}%`,
      eur(line.line_total_inc_vat),
    ]),
    [94, 32, 20, 31],
    y,
    { numeric: [1, 2, 3] },
  );

  y = pdfSectionTitle(pdf, "Totaux", y);
  y = pdfKeyValueRows(
    pdf,
    [
      ["Total HT", eur(invoice.total_inc_vat - invoice.vat_total)],
      ["TVA", eur(invoice.vat_total)],
      ["Total TTC", eur(invoice.total_inc_vat)],
    ],
    y,
  );

  y = pdfSectionTitle(pdf, "Mentions", y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  y = pdfText(pdf, invoiceLegalMention(company), pdfLayout.margin, y, pdfContentWidth(pdf));
  y += 3;
  pdfText(pdf, "Paiement a reception sauf conditions convenues. Penalites de retard selon conditions legales applicables.", pdfLayout.margin, y, pdfContentWidth(pdf));

  savePdf(pdf, invoiceNumber);
}

async function downloadTaxAnalyticsPdf({
  company,
  revenue,
  expenseTotal,
  vatCollected,
  vatDeductible,
  urssafEstimate,
  invoices,
  expenses,
}: {
  company: Company;
  revenue: number;
  expenseTotal: number;
  vatCollected: number;
  vatDeductible: number;
  urssafEstimate: number;
  invoices: Invoice[];
  expenses: Expense[];
}) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  let y = pdfDocumentHeader(pdf, "Analytics fiscales", `Genere le ${today}`, company);

  y = pdfSectionTitle(pdf, "Synthese", y);
  y = pdfKeyValueRows(
    pdf,
    [
      ["Chiffre d'affaires", eur(revenue)],
      ["Achats / depenses", eur(expenseTotal)],
      ["TVA collectee", eur(vatCollected)],
      ["TVA deductible", eur(vatDeductible)],
      ["TVA nette", eur(vatCollected - vatDeductible)],
      ["Estimation URSSAF", eur(urssafEstimate)],
    ],
    y,
  );

  y = pdfSectionTitle(pdf, "Factures recentes", y);
  y = pdfTable(
    pdf,
    ["Date", "Reference", "Statut", "TTC"],
    invoices.slice(0, 24).map((invoice) => [
      invoice.issue_date,
      invoice.number ?? "Draft",
      invoice.status,
      eur(invoice.total_inc_vat),
    ]),
    [34, 60, 36, 47],
    y,
    { numeric: [3] },
  );

  y = pdfSectionTitle(pdf, "Achats recents", y);
  y = pdfTable(
    pdf,
    ["Date", "Fournisseur", "Nature", "TTC"],
    expenses.slice(0, 24).map((expense) => [
      expense.expense_date,
      expense.supplier_name,
      expense.description,
      eur(expense.total_inc_vat),
    ]),
    [28, 50, 64, 35],
    y,
    { numeric: [3] },
  );

  savePdf(pdf, `${company.name}-analytics-fiscales-${today}`);
}

async function downloadReportsPdf({
  company,
  profitLoss,
  balanceSheet,
  accountBalances,
}: {
  company: Company;
  profitLoss: ProfitLossReport | null;
  balanceSheet: BalanceSheetReport | null;
  accountBalances: AccountBalance[];
}) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  let y = pdfDocumentHeader(pdf, "Rapports financiers", `Genere le ${today}`, company);

  y = pdfSectionTitle(pdf, "Profit and loss", y);
  y = pdfKeyValueRows(
    pdf,
    [
      ["Revenue", eur(profitLoss?.revenue)],
      ["Expenses", eur(profitLoss?.expenses)],
      ["Net result", eur(profitLoss?.net_result)],
    ],
    y,
  );

  y = pdfSectionTitle(pdf, "Balance sheet", y);
  y = pdfKeyValueRows(
    pdf,
    [
      ["Assets", eur(balanceSheet?.assets)],
      ["Liabilities", eur(balanceSheet?.liabilities)],
      ["Equity", eur(balanceSheet?.equity)],
      ["Current year result", eur(balanceSheet?.current_year_result)],
      ["Liabilities + equity + result", eur(balanceSheet?.liabilities_equity)],
      ["Imbalance", eur(balanceSheet?.imbalance)],
    ],
    y,
  );

  y = pdfSectionTitle(pdf, "Account balances", y);
  y = pdfTable(
    pdf,
    ["Account", "Class", "Debit", "Credit", "Balance"],
    accountBalances
      .filter((account) => Math.abs(Number(account.balance)) > 0.001)
      .map((account) => [
        `${account.account_code} ${account.label}`,
        account.account_class,
        eur(account.debit_total),
        eur(account.credit_total),
        eur(account.balance),
      ]),
    [58, 28, 30, 30, 31],
    y,
    { numeric: [2, 3, 4] },
  );

  savePdf(pdf, `${company.name}-rapports-financiers-${today}`);
}

const contractTypeLabels: Record<string, string> = {
  artist_booking: "Artist booking",
  video_production_assistant: "Video production assistant",
  event_organizing: "Event organizing",
  venue_rental: "Venue rental",
  equipment_rental: "Equipment rental",
  service_agreement: "Service agreement",
  nda: "Non-disclosure agreement",
  consulting_agreement: "Consulting agreement",
  licensing_agreement: "Licensing agreement",
  sponsorship_agreement: "Sponsorship agreement",
  partnership_agreement: "Partnership agreement",
  influencer_agreement: "Influencer agreement",
  work_for_hire: "Work-for-hire agreement",
  commission_agreement: "Commission agreement",
  distribution_agreement: "Distribution agreement",
  custom_agreement: "Custom agreement",
};

const contractLanguageLabels: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
};

function contractLanguageName(language: string) {
  return contractLanguageLabels[language] ?? language.toUpperCase();
}

function contractTypeDraftingFocus(contractType: string) {
  const focus: Record<string, string> = {
    artist_booking: "artist availability, performance obligations, set length, technical rider, cancellation, promotion, recording rights, and settlement.",
    video_production_assistant: "production schedule, duties, call times, expenses, confidentiality, credits, safety rules, and deliverable handover.",
    event_organizing: "event scope, supplier coordination, permits, cancellation, venue rules, health and safety, insurance, and attendee-facing responsibilities.",
    venue_rental: "venue access, rental period, deposits, house rules, capacity, damage, insurance, cancellation, and return condition.",
    equipment_rental: "equipment inventory, condition, deposit, loss or damage, maintenance, return deadline, permitted use, and insurance.",
    service_agreement: "scope, milestones, acceptance criteria, payment, change requests, IP ownership, confidentiality, and termination.",
    nda: "definition of confidential information, permitted use, exclusions, duration, return or destruction, compelled disclosure, and injunctive relief.",
    consulting_agreement: "advisory scope, milestones, client cooperation, fees, expenses, IP, non-solicitation where appropriate, confidentiality, and termination.",
    licensing_agreement: "licensed rights, territory, term, media, exclusivity, royalties or fees, usage restrictions, reporting, audit rights, and termination.",
    sponsorship_agreement: "sponsorship benefits, brand placement, deliverables, approval rights, exclusivity, payment schedule, cancellation, and metrics.",
    partnership_agreement: "roles, contributions, decision-making, revenue split, expenses, ownership, exit rights, deadlock, confidentiality, and dispute resolution.",
    influencer_agreement: "content deliverables, platforms, posting schedule, usage rights, approvals, disclosures, exclusivity, metrics, and takedown rules.",
    work_for_hire: "deliverables, acceptance, IP assignment, moral rights waiver where enforceable, source files, payment milestones, and portfolio rights.",
    commission_agreement: "commissioned work scope, acceptance, revisions, delivery, ownership or license, deposits, cancellation, and usage limits.",
    distribution_agreement: "territory, channels, exclusivity, supply obligations, pricing, reporting, returns, marketing, compliance, and termination.",
    custom_agreement: "the exact commercial context provided by the user, with practical clauses tailored to the facts.",
  };
  return focus[contractType] ?? focus.service_agreement;
}

function contractTypeLabelForLanguage(contractType: string, language: string) {
  const english = contractTypeLabels[contractType] ?? "Service agreement";
  if (language !== "fr") return english;
  const frenchLabels: Record<string, string> = {
    artist_booking: "contrat d'engagement artistique",
    video_production_assistant: "contrat d'assistance de production vidéo",
    event_organizing: "contrat d'organisation d'événement",
    venue_rental: "contrat de location de lieu",
    equipment_rental: "contrat de location de matériel",
    service_agreement: "contrat de prestation de services",
    nda: "accord de confidentialité",
    consulting_agreement: "contrat de conseil",
    licensing_agreement: "contrat de licence",
    sponsorship_agreement: "contrat de sponsoring",
    partnership_agreement: "contrat de partenariat",
    influencer_agreement: "contrat d'influence",
    work_for_hire: "contrat de commande avec cession de droits",
    commission_agreement: "contrat de commande",
    distribution_agreement: "contrat de distribution",
    custom_agreement: "contrat personnalisé",
  };
  return frenchLabels[contractType] ?? english;
}

function normalizeFrenchText(text: string) {
  const mojibakeFixes: Array<[RegExp, string]> = [
    [/Ã©/g, "é"],
    [/Ã¨/g, "è"],
    [/Ãª/g, "ê"],
    [/Ã«/g, "ë"],
    [/Ã /g, "à"],
    [/Ã¢/g, "â"],
    [/Ã§/g, "ç"],
    [/Ã®/g, "î"],
    [/Ã¯/g, "ï"],
    [/Ã´/g, "ô"],
    [/Ã¹/g, "ù"],
    [/Ã»/g, "û"],
    [/Ã¼/g, "ü"],
    [/Å“/g, "œ"],
    [/â€™/g, "'"],
    [/â€œ|â€/g, '"'],
    [/â€“|â€”/g, "-"],
    [/Â«/g, "«"],
    [/Â»/g, "»"],
    [/Â /g, " "],
  ];
  return mojibakeFixes.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text).normalize("NFC");
}

function normalizeContractTextForLanguage(text: string, language: string) {
  return language === "fr" ? normalizeFrenchText(text) : text.normalize("NFC");
}

function generateContractContent(contract: {
  title: string;
  contract_type: string;
  country: string;
  language: string;
  party_a_name: string;
  party_a_address: string;
  party_a_email: string;
  party_b_name: string;
  party_b_address: string;
  party_b_email: string;
  start_date: string;
  end_date: string;
  fee_amount: number;
  fee_currency: string;
  payment_terms: string;
  deliverables: string;
  special_terms: string;
}) {
  const typeLabel = contractTypeLabelForLanguage(contract.contract_type, contract.language);
  const compensationText = buildCompensationText(contract);
  if (contract.language === "fr") {
    const endDate = contract.end_date || "la réalisation complète des prestations";
    return normalizeFrenchText([
      `${contract.title}`,
      "",
      "1. Parties",
      `Le présent contrat de type ${typeLabel} est conclu entre ${contract.party_a_name}, situé(e) à ${contract.party_a_address || "[adresse à compléter]"} (${contract.party_a_email || "email à compléter"}), et ${contract.party_b_name}, situé(e) à ${contract.party_b_address || "[adresse à compléter]"} (${contract.party_b_email || "email à compléter"}).`,
      "",
      "2. Objet et périmètre",
      `Les parties conviennent que les prestations, livrables et responsabilités sont les suivants : ${contract.deliverables || "[périmètre à compléter]"}.`,
      "",
      "3. Durée",
      `Le contrat commence le ${contract.start_date || "[date de début]"} et se poursuit jusqu'à ${endDate}, sauf résiliation anticipée selon les conditions ci-dessous.`,
      "",
      "4. Prix, facturation et paiement",
      compensationText.fr,
      "",
      "5. Propriété intellectuelle et portfolio",
      "Chaque partie conserve ses droits sur ses éléments préexistants. Les livrables créés spécifiquement pour le client sont cédés ou licenciés uniquement après paiement complet, selon le périmètre convenu. Le prestataire peut citer la mission dans son portfolio sauf clause de confidentialité contraire.",
      "",
      "6. Confidentialité et données personnelles",
      "Chaque partie protège les informations confidentielles reçues et les utilise uniquement pour l'exécution du contrat. En cas de traitement de données personnelles, les parties respectent le RGPD et les obligations applicables.",
      "",
      "7. Responsabilité et assurances",
      "Chaque partie reste responsable de ses fautes, manquements intentionnels, fraudes et violations de la loi. La responsabilité pour pertes indirectes est exclue dans les limites permises par le droit applicable. Les attestations d'assurance nécessaires doivent être communiquées avant exécution.",
      "",
      "8. Annulation, force majeure et résiliation",
      "Chaque partie peut résilier en cas de manquement substantiel après notification écrite et délai raisonnable de correction. Aucune partie n'est responsable d'un retard dû à un événement hors de son contrôle raisonnable, notamment panne majeure, intempérie, restriction administrative, maladie ou force majeure.",
      "",
      "9. Statut indépendant et obligations administratives",
      "Les parties agissent comme contractants indépendants. Rien ne crée de relation salariale, agence, société de fait ou coentreprise. Chaque partie gère ses obligations fiscales, sociales, autorisations et obligations réglementaires.",
      "",
      "10. Droit applicable et litiges",
      `Le contrat est destiné à être utilisé en ${contract.country || "France"}. Les parties recherchent une résolution amiable avant toute procédure. Le droit applicable et la juridiction compétente doivent être validés avant signature pour les contrats sensibles.`,
      "",
      "11. Conditions particulières",
      contract.special_terms || "Aucune condition particulière ajoutée.",
      "",
      "12. Signatures",
      `Signé pour ${contract.party_a_name} :`,
      "",
      "Nom : ____________________  Date : ____________________  Signature : ____________________",
      "",
      `Signé pour ${contract.party_b_name} :`,
      "",
      "Nom : ____________________  Date : ____________________  Signature : ____________________",
      "",
      "Note de conformité",
      "Ce brouillon est un modèle commercial, pas un avis juridique. Les contrats à fort enjeu ou risque spécifique doivent être relus par un professionnel qualifié.",
    ].join("\n"));
  }

  const endDate = contract.end_date || "completion of the services";
  const languageNote = "This template is generated in English and should be reviewed before signature.";

  return [
    `${contract.title}`,
    "",
    `1. Parties`,
    `This ${typeLabel} agreement is entered into between ${contract.party_a_name}, located at ${contract.party_a_address || "[address to complete]"} (${contract.party_a_email || "email to complete"}), and ${contract.party_b_name}, located at ${contract.party_b_address || "[address to complete]"} (${contract.party_b_email || "email to complete"}).`,
    "",
    `2. Purpose and Scope`,
    `The parties agree that the services, deliverables, and responsibilities are as follows: ${contract.deliverables || "[scope to complete]"}.`,
    "",
    `3. Term`,
    `The agreement starts on ${contract.start_date || "[start date]"} and continues until ${endDate}, unless terminated earlier under this agreement.`,
    "",
    `4. Compensation and Payment`,
    compensationText.en,
    "",
    `5. Intellectual Property and Portfolio Rights`,
    `Unless otherwise stated, each party keeps ownership of pre-existing materials. Deliverables created specifically for the client are assigned or licensed only after full payment. The service provider may reference the work in a portfolio unless confidentiality restrictions prohibit it.`,
    "",
    `6. Confidentiality and Data Protection`,
    `Each party must protect confidential information received from the other party and use it only for this agreement. If personal data is processed, the parties must comply with applicable data protection rules, including GDPR where relevant.`,
    "",
    `7. Liability, Insurance, and Indemnity`,
    `Each party is responsible for its own negligence, fraud, willful misconduct, and breach of law. Liability for indirect loss is excluded to the fullest extent permitted by law. Any required insurance certificates should be exchanged before performance begins.`,
    "",
    `8. Cancellation, Force Majeure, and Termination`,
    `Either party may terminate for material breach after written notice and a reasonable cure period. Neither party is liable for delay caused by events beyond reasonable control, including major technical failure, severe weather, public authority restrictions, illness, or force majeure events.`,
    "",
    `9. Compliance and Independent Contractor Status`,
    `The parties act as independent contractors. Nothing creates an employment, agency, partnership, or joint venture relationship. Each party is responsible for its own tax, social security, permits, and regulatory obligations.`,
    "",
    `10. Governing Law and Dispute Resolution`,
    `This agreement is intended for use in ${contract.country || "France"}. The parties should attempt good-faith negotiation before litigation. Venue and governing law should be confirmed by a qualified legal professional before signature.`,
    "",
    `11. Special Terms`,
    contract.special_terms || "No special terms added.",
    "",
    `12. Signatures`,
    `Signed for ${contract.party_a_name}:`,
    "",
    `Name: ____________________  Date: ____________________  Signature: ____________________`,
    "",
    `Signed for ${contract.party_b_name}:`,
    "",
    `Name: ____________________  Date: ____________________  Signature: ____________________`,
    "",
    `Compliance note`,
    `${languageNote} This generated draft is a business template, not legal advice. High-value or risky contracts should be reviewed by a qualified lawyer.`,
  ].join("\n");
}

function hasRevenueShareTerms(text: string) {
  return /%|percent|pour\s?cent|revenue|revenu|recette|chiffre d'affaires|profit|bénéfice|benefice|royalt|commission|split|partage/i.test(text);
}

function buildCompensationText(contract: ContractDraftPayload) {
  const terms = contract.payment_terms.trim();
  if (hasRevenueShareTerms(terms)) {
    return {
      en: `Compensation is governed by the following revenue-share or variable-payment terms and must not be treated as a fixed euro fee: ${terms}. If the terms mention percentages, those percentages apply to the defined revenue base, subject to the floors, reductions, costs, employee costs, and adjustment rules stated by the parties.`,
      fr: `La rémunération est régie par les conditions de partage de revenus ou de paiement variable suivantes et ne doit pas être traitée comme un prix fixe en euros : ${terms}. Lorsque des pourcentages sont mentionnés, ils s'appliquent à l'assiette de revenus définie, sous réserve des planchers, réductions, coûts, coûts liés aux employés et règles d'ajustement convenus entre les parties.`,
    };
  }
  return {
    en: `The total fee is ${contract.fee_amount.toFixed(2)} ${contract.fee_currency}. Payment terms: ${terms || "payment due within 30 days of valid invoice receipt"}. Late payment may trigger statutory late-payment penalties and recovery costs where applicable.`,
    fr: `Le prix total est de ${contract.fee_amount.toFixed(2)} ${contract.fee_currency}. Conditions de paiement : ${terms || "paiement à 30 jours après réception d'une facture conforme"}. Les retards de paiement peuvent entraîner les pénalités et indemnités légales applicables.`,
  };
}

function buildContractPrompt(contract: ContractDraftPayload) {
  const languageName = contractLanguageName(contract.language);
  const variableCompensation = hasRevenueShareTerms(contract.payment_terms);
  const languageGuard =
    contract.language === "fr"
      ? "- Strict language rule: write every heading, clause, placeholder, signature block, and legal note in French only. Do not use English headings such as Purpose, Term, Compensation, Confidentiality, Governing Law, or Signatures.\n- Use correct French accents and legal drafting style. Do not output mojibake or ASCII-only French."
      : `- Strict language rule: write every heading, clause, placeholder, signature block, and legal note in ${languageName} only.`;
  const compensationInstruction = variableCompensation
    ? `- Compensation type: variable revenue share / percentage terms, not a fixed fee.
- Do not convert percentages into euros. If the user says "50%", "20%", "50 percent", or "50 pour cent", preserve it as a percentage.
- Draft a dedicated "Revenue Share and Adjustment" clause. If facts say the person receives 50% of all revenue and the share may decrease when costs or employees increase but never below 20%, state exactly that: initial share 50% of the defined revenue base; adjustment allowed for increased costs, employees, or operating burden; minimum floor 20%; calculation method, reporting cadence, payment timing, and audit/right-to-information must be included.
- If the revenue base is unclear, use a bracketed placeholder such as [gross revenue before taxes] or [net revenue after approved direct costs], but do not invent a euro amount.`
    : `- Compensation type: fixed fee.
- Fee: ${contract.fee_amount.toFixed(2)} ${contract.fee_currency}`;
  return `You are an expert legal contract drafter for small businesses, freelancers, artists, music, events, and production work.

Generate a complete, practical, plain-language contract draft. Use numbered clauses. Do not include commentary outside the contract. Include signature blocks.

Important constraints:
- Jurisdiction: ${contract.country || "France"}
- Draft language: ${languageName}. Draft the full contract in ${languageName}.
- Output must be internally consistent with the facts. Never reinterpret percentages as currency amounts.
${languageGuard}
- This is a draft for business use, not legal advice.
- Include: parties, definitions, scope, deliverables, dates, payment, late payment, expenses, IP, portfolio rights, confidentiality, GDPR/data protection where relevant, cancellation, force majeure, liability, independent contractor status, dispute resolution, notices, entire agreement, signatures.
- For this contract type, pay special attention to: ${contractTypeDraftingFocus(contract.contract_type)}
- Be specific and use the facts provided. If a field is missing, write a bracketed placeholder.
${compensationInstruction}

Contract facts:
- Title: ${contract.title}
- Type: ${contractTypeLabels[contract.contract_type] ?? contract.contract_type}
- Party A: ${contract.party_a_name}, ${contract.party_a_address || "[address missing]"}, ${contract.party_a_email || "[email missing]"}
- Party B: ${contract.party_b_name}, ${contract.party_b_address || "[address missing]"}, ${contract.party_b_email || "[email missing]"}
- Start date: ${contract.start_date || "[start date missing]"}
- End date: ${contract.end_date || "[end date / completion condition missing]"}
- Payment terms: ${contract.payment_terms || "[payment terms missing]"}
- Deliverables / scope: ${contract.deliverables || "[scope missing]"}
- Special terms: ${contract.special_terms || "[none]"}

Return only the contract text.`;
}

const contractChatQuestions = [
  "What kind of contract do you need, and what language should it use? For example: service agreement, NDA, consulting, licensing, sponsorship, partnership, influencer, work-for-hire, artist booking, venue rental, equipment rental, or event organizing.",
  "Who are the parties? Tell me your business name and the counterparty name.",
  "What is the scope of work or deliverables?",
  "What are the dates, location, and important deadlines?",
  "What is the compensation? Say if it is a fixed fee, percentage, revenue share, commission, floor/minimum, cost adjustment, employee-cost adjustment, deposit, and payment schedule.",
  "Any special terms: cancellation, travel, exclusivity, IP, portfolio, confidentiality, insurance, or approval requirements?",
];

function inferContractType(text: string) {
  if (/nda|non.?disclosure|confidential/i.test(text)) return "nda";
  if (/consult|advisor|advisory|strategy/i.test(text)) return "consulting_agreement";
  if (/licen[sc]|royalt|usage rights|intellectual property|ip rights/i.test(text)) return "licensing_agreement";
  if (/sponsor|brand placement|brand deal/i.test(text)) return "sponsorship_agreement";
  if (/partner|collaboration|joint project|revenue split/i.test(text)) return "partnership_agreement";
  if (/influencer|creator|social media|instagram|tiktok|youtube|content post/i.test(text)) return "influencer_agreement";
  if (/work.?for.?hire|assignment|commissioned work/i.test(text)) return "work_for_hire";
  if (/commission|custom artwork|custom music|bespoke/i.test(text)) return "commission_agreement";
  if (/distribution|distributor|reseller|wholesale|retail/i.test(text)) return "distribution_agreement";
  if (/artist|music|dj|perform|booking|show|concert/i.test(text)) return "artist_booking";
  if (/video|production|assistant|crew|shoot/i.test(text)) return "video_production_assistant";
  if (/venue|space|room|hall/i.test(text)) return "venue_rental";
  if (/equipment|gear|rental|audio|camera|light/i.test(text)) return "equipment_rental";
  if (/event|organ/i.test(text)) return "event_organizing";
  return "service_agreement";
}

function inferContractLanguage(text: string) {
  if (/francais|français|french|\bfr\b/i.test(text)) return "fr";
  if (/spanish|espanol|español|\bes\b/i.test(text)) return "es";
  if (/german|deutsch|\bde\b/i.test(text)) return "de";
  if (/italian|italiano|\bit\b/i.test(text)) return "it";
  if (/english|anglais|\ben\b/i.test(text)) return "en";
  return "";
}

function parseChatAmount(text: string) {
  if (hasRevenueShareTerms(text)) return 0;
  const match = text.match(/(\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})|\d+)(?:\s*)(eur|euro|€|usd|gbp)?/i);
  return match ? parseLocalizedNumber(match[1]) : 0;
}

function appendUniqueLines(...values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values
    .flatMap((value) => (value || "").split("\n"))
    .map((line) => line.trim())
    .filter((line) => {
      const key = line.toLowerCase();
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

function extractNamedParty(text: string, marker: RegExp) {
  const match = text.match(marker);
  return match?.[1]?.replace(/[.;,\n].*$/, "").trim() || "";
}

function inferContractFactsFromText(text: string, company: Company, current: Partial<ContractDraftPayload>) {
  const next: Partial<ContractDraftPayload> = { ...current };
  const language = inferContractLanguage(text);
  if (language) next.language = language;

  const contractType = inferContractType(text);
  if (contractType && (!next.contract_type || next.contract_type === "service_agreement")) {
    next.contract_type = contractType;
    next.title = next.title || `${contractTypeLabels[contractType]} contract`;
  }

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const partyA = extractNamedParty(text, /(?:my company|our company|party a|provider|contractor|business)\s*(?:is|:|-)\s*([^\n.;]+)/i);
  const partyB = extractNamedParty(text, /(?:counterparty|party b|client|customer|person|artist|partner)\s*(?:is|:|-)\s*([^\n.;]+)/i);
  if (partyA) next.party_a_name = partyA;
  if (partyB) next.party_b_name = partyB;
  if (email && !next.party_b_email && !email.toLowerCase().includes(company.name.toLowerCase())) next.party_b_email = email;

  const currency = /usd|\$/i.test(text) ? "USD" : /gbp|£/i.test(text) ? "GBP" : /eur|euro|€/i.test(text) ? "EUR" : "";
  if (currency) next.fee_currency = currency;
  const fixedAmount = parseChatAmount(text);
  if (fixedAmount > 0 && !hasRevenueShareTerms(text)) next.fee_amount = fixedAmount;

  const percentages = extractPercentageValues(text);
  const hasFloor = /(?:no less than|not below|minimum|floor|au moins|pas moins de|plancher|min(?:imum)?)/i.test(text);
  if (hasRevenueShareTerms(text) || percentages.length) {
    const revenueTerms = [
      text,
      percentages.length ? `Preserve percentage values exactly: ${percentages.map((value) => `${value}%`).join(", ")}.` : "",
      hasFloor ? "If a minimum/floor is described, keep it as a percentage floor and never convert it into euros." : "",
    ].filter(Boolean).join(" ");
    next.payment_terms = appendUniqueLines(next.payment_terms, revenueTerms);
    next.fee_amount = 0;
  }

  if (/deliver|scope|service|work|responsib|task|prestation|livrable/i.test(text)) {
    next.deliverables = appendUniqueLines(next.deliverables, text);
  } else if (text.length > 40 && !next.deliverables) {
    next.deliverables = text;
  }

  if (/cancel|exclusiv|confidential|ip|intellectual|approval|insurance|travel|expense|employee|cost|lower|reduce|adjust|minimum|floor|plancher|cout|coût/i.test(text)) {
    next.special_terms = appendUniqueLines(next.special_terms, text);
  }

  return next;
}

function extractPercentageValues(text: string) {
  return [...text.matchAll(/(\d{1,3}(?:[,.]\d+)?)\s*(?:%|percent|pour\s?cent)/gi)]
    .map((match) => match[1].replace(",", "."))
    .filter(Boolean);
}

function percentageRegex(value: string, unitPattern = "%|percent|pour\\s?cent") {
  const escaped = value.replace(".", "[,.]");
  return new RegExp(`\\b${escaped}\\s*(?:${unitPattern})`, "i");
}

function frenchEnglishLeakPattern() {
  return /(?:^|\n)\s*(?:\d+\.?\s*)?(Purpose|Scope|Term|Compensation|Payment|Confidentiality|Data Protection|Liability|Termination|Governing Law|Dispute Resolution|Signatures|Special Terms|Compliance note|Entire Agreement|Notices)\b|This agreement|This contract|Signed for\b|Name:\s*_{3,}/i;
}

function hasFrenchEnglishLeak(text: string) {
  return frenchEnglishLeakPattern().test(text);
}

function contractQualityIssues(contract: ContractDraftPayload, text: string) {
  const issues: string[] = [];
  const factText = [contract.payment_terms, contract.special_terms, contract.deliverables].filter(Boolean).join("\n");
  const percentages = extractPercentageValues(factText);

  if (hasRevenueShareTerms(factText)) {
    if (!/revenue share|profit share|partage de revenus|partage des revenus|rémunération variable|remuneration variable|pourcentage|%/i.test(text)) {
      issues.push("The draft does not clearly create a revenue-share / percentage compensation clause.");
    }
    percentages.forEach((percentage) => {
      if (!percentageRegex(percentage).test(text)) {
        issues.push(`The draft does not preserve the percentage ${percentage}%.`);
      }
      if (percentageRegex(percentage, "€|eur|euros?").test(text)) {
        issues.push(`The draft incorrectly converted ${percentage}% into a euro amount.`);
      }
    });
  }

  if (contract.language === "fr") {
    if (hasFrenchEnglishLeak(text)) {
      issues.push("The French draft contains English headings or English boilerplate.");
    }
  }

  return issues;
}

function buildContractRepairPrompt(contract: ContractDraftPayload, draft: string, issues: string[]) {
  const languageName = contractLanguageName(contract.language);
  return `You are repairing a contract draft that failed quality checks.

Repair requirements:
${issues.map((issue) => `- ${issue}`).join("\n")}

Hard rules:
- Return only the repaired contract.
- Keep the same parties, business facts, dates, scope, and legal structure.
- Preserve all percentages as percentages. Never convert percentages into euros or fixed fees.
- If the compensation terms say 50% of revenue with possible reduction for costs/employees but never below 20%, the repaired contract must say exactly that in a dedicated compensation clause.
- The entire repaired contract must be in ${languageName}. ${contract.language === "fr" ? "Use French only with correct accents; no English headings or boilerplate." : ""}

Structured facts:
${buildContractPrompt(contract)}

Draft to repair:
${draft}`;
}

function buildPayloadFromChat(company: Company, answers: Partial<ContractDraftPayload>): ContractDraftPayload {
  const counterparty = answers.party_b_name || "Counterparty";
  const contractType = answers.contract_type || "service_agreement";
  return {
    title: answers.title || `${contractTypeLabels[contractType]} - ${counterparty}`,
    contract_type: contractType,
    country: answers.country || "France",
    language: answers.language || "en",
    party_a_name: answers.party_a_name || company.name,
    party_a_address: answers.party_a_address || "",
    party_a_email: answers.party_a_email || "",
    party_b_name: counterparty,
    party_b_address: answers.party_b_address || "",
    party_b_email: answers.party_b_email || "",
    start_date: answers.start_date || today,
    end_date: answers.end_date || "",
    fee_amount: Number(answers.fee_amount || 0),
    fee_currency: answers.fee_currency || "EUR",
    payment_terms: answers.payment_terms || "",
    deliverables: answers.deliverables || "",
    special_terms: answers.special_terms || "",
  };
}

async function generateContractWithOllama(contract: ContractDraftPayload, settings: ContractAiSettings) {
  const endpoint = settings.endpoint.replace(/\/+$/, "");
  async function generate(prompt: string, temperature = 0.2) {
    const response = await fetch(`${endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_ctx: 8192,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { response?: string; error?: string };
    if (data.error) throw new Error(data.error);
    if (!data.response?.trim()) throw new Error("Ollama returned an empty contract.");
    return data.response.trim();
  }

  const firstDraft = await generate(buildContractPrompt(contract));
  const issues = contractQualityIssues(contract, firstDraft);
  if (!issues.length) return firstDraft;
  const repairedDraft = await generate(buildContractRepairPrompt(contract, firstDraft, issues), 0.05);
  const remainingIssues = contractQualityIssues(contract, repairedDraft);
  if (remainingIssues.length) {
    throw new Error(`Contract quality check failed after repair: ${remainingIssues.join(" ")}`);
  }
  return repairedDraft;
}

function translationQualityIssues(targetLanguage: string, sourceText: string, translatedText: string) {
  const issues: string[] = [];
  const percentages = extractPercentageValues(sourceText);
  percentages.forEach((percentage) => {
    if (!percentageRegex(percentage).test(translatedText)) {
      issues.push(`The translation does not preserve the percentage ${percentage}%.`);
    }
    if (percentageRegex(percentage, "€|eur|euros?").test(translatedText)) {
      issues.push(`The translation incorrectly converted ${percentage}% into a euro amount.`);
    }
  });
  if (targetLanguage === "fr") {
    if (hasFrenchEnglishLeak(translatedText)) {
      issues.push("The French translation contains English headings or English boilerplate.");
    }
  }
  return issues;
}

function buildTranslationRepairPrompt(targetLanguage: string, sourceText: string, translatedText: string, issues: string[]) {
  const targetLanguageName = contractLanguageName(targetLanguage);
  return `You are repairing a legal contract translation that failed quality checks.

Repair requirements:
${issues.map((issue) => `- ${issue}`).join("\n")}

Hard rules:
- Return only the repaired translation.
- Preserve clause numbering, parties, dates, signature blocks, percentages, and currency amounts exactly as legal concepts.
- Never convert percentages into euros.
- The entire translation must be in ${targetLanguageName}. ${targetLanguage === "fr" ? "Use French only with correct accents; no English headings or boilerplate." : ""}

Source contract:
${sourceText}

Translation to repair:
${translatedText}`;
}

async function fetchOllamaText(endpoint: string, model: string, prompt: string, temperature = 0.1) {
  const response = await fetch(`${endpoint}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature,
        num_ctx: 8192,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { response?: string; error?: string };
  if (data.error) throw new Error(data.error);
  if (!data.response?.trim()) throw new Error("Ollama returned an empty response.");
  return data.response.trim();
}

function buildContractTranslationPrompt(contract: Contract, targetLanguage: string, sourceText: string) {
  const sourceLanguage = contractLanguageName(contract.language);
  const targetLanguageName = contractLanguageName(targetLanguage);
  const targetLanguageGuard =
    targetLanguage === "fr"
      ? "- The entire translation must be French only, including headings, signature blocks, notes, placeholders, and boilerplate. Do not leave English fragments.\n- Use correct French accents and professional legal wording."
      : `- The entire translation must be ${targetLanguageName} only, including headings, signature blocks, notes, placeholders, and boilerplate.`;
  return `You are a professional legal translator for small business contracts.

Translate the contract from ${sourceLanguage} to ${targetLanguageName}.

Rules:
- Preserve the same structure, clause numbering, headings, placeholders, party names, dates, amounts, signature blocks, and legal meaning.
- Do not summarize.
- Do not add commentary outside the translated contract.
- Use natural, professional legal language in ${targetLanguageName}.
- If the target language is French, use correct accents, apostrophes, and UTF-8 characters.
- Preserve percentages as percentages and currency amounts as currency amounts. Never convert a percentage such as 50% into 50 euros.
${targetLanguageGuard}

Contract:
${sourceText}

Return only the translated contract.`;
}

async function generateContractTranslationWithOllama(
  contract: Contract,
  targetLanguage: string,
  sourceText: string,
  settings: ContractAiSettings,
) {
  const endpoint = settings.endpoint.replace(/\/+$/, "");
  const firstTranslation = await fetchOllamaText(
    endpoint,
    settings.model,
    buildContractTranslationPrompt(contract, targetLanguage, sourceText),
    0.1,
  );
  const issues = translationQualityIssues(targetLanguage, sourceText, firstTranslation);
  if (!issues.length) return firstTranslation;
  const repairedTranslation = await fetchOllamaText(
    endpoint,
    settings.model,
    buildTranslationRepairPrompt(targetLanguage, sourceText, firstTranslation, issues),
    0.03,
  );
  const remainingIssues = translationQualityIssues(targetLanguage, sourceText, repairedTranslation);
  if (remainingIssues.length) {
    throw new Error(`Translation quality check failed after repair: ${remainingIssues.join(" ")}`);
  }
  return repairedTranslation;
}

async function generateContractFollowUpWithOllama(
  messages: ContractChatMessage[],
  answers: Partial<ContractDraftPayload>,
  settings: ContractAiSettings,
) {
  const endpoint = settings.endpoint.replace(/\/+$/, "");
  const transcript = messages.map((message) => `${message.role}: ${message.content}`).join("\n");
  const response = await fetch(`${endpoint}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.model,
      stream: false,
      prompt: `You are interviewing a small business owner to draft a contract. Ask exactly one concise follow-up question that gathers the most important missing detail. Do not draft the contract yet.

Known structured answers:
${JSON.stringify(answers, null, 2)}

Conversation:
${transcript}

Return only the next question.`,
      options: {
        temperature: 0.15,
        num_ctx: 4096,
      },
    }),
  });

  if (!response.ok) throw new Error(`Ollama follow-up failed: ${response.status} ${response.statusText}`);
  const data = (await response.json()) as { response?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data.response?.trim() || "";
}

function readContractAiSettings(): ContractAiSettings {
  try {
    const stored = localStorage.getItem("contract_ai_settings");
    if (stored) return JSON.parse(stored) as ContractAiSettings;
  } catch {
    localStorage.removeItem("contract_ai_settings");
  }

  return {
    provider: "template",
    endpoint: "http://localhost:11434",
    model: "llama3.1:8b",
  };
}

function getContractTranslations(contract: Contract) {
  const translations = contract.source_payload?.translations;
  if (!translations || typeof translations !== "object" || Array.isArray(translations)) return {};
  return translations as Record<string, string>;
}

function getContractTranslation(contract: Contract, language: string) {
  return getContractTranslations(contract)[language] ?? "";
}

function buildContractSourcePayloadWithTranslation(contract: Contract, language: string, content: string) {
  return {
    ...(contract.source_payload ?? {}),
    translations: {
      ...getContractTranslations(contract),
      [language]: normalizeContractTextForLanguage(content, language),
    },
  };
}

function getContractBranding(contract: Contract): ContractPdfBranding {
  const branding = contract.source_payload?.pdf_branding;
  if (!branding || typeof branding !== "object" || Array.isArray(branding)) {
    return {
      title: contract.title,
      accentColor: "#223128",
      fontFamily: "helvetica",
    };
  }
  const value = branding as ContractPdfBranding;
  return {
    title: value.title || contract.title,
    accentColor: value.accentColor || "#223128",
    fontFamily: value.fontFamily || "helvetica",
    logoDataUrl: value.logoDataUrl,
  };
}

function buildContractSourcePayloadWithBranding(contract: Contract, branding: ContractPdfBranding) {
  return {
    ...(contract.source_payload ?? {}),
    pdf_branding: branding,
  };
}

function contractTextForPdf(text: string) {
  const blocks: string[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(paragraph.join(" ").replace(/\s+/g, " ").trim());
    paragraph = [];
  }

  text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line) {
        flushParagraph();
        return;
      }
      if (/^(?:\d+\.|[A-Z][A-Z\s]{4,}|[-*]\s+)/.test(line)) {
        flushParagraph();
        blocks.push(line);
        return;
      }
      paragraph.push(line);
    });

  flushParagraph();
  return blocks.join("\n\n");
}

function contractBlocksForPdf(text: string) {
  return contractTextForPdf(text)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

async function downloadContractPdf(contract: Contract, company: Company) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const branding = getContractBranding(contract);
  const contractContent = contractTextForPdf(normalizeContractTextForLanguage(contract.generated_content, contract.language));
  const title = branding.title || contract.title;
  let y = pdfDocumentHeader(pdf, "Contract", title, company, branding);

  y = pdfKeyValueRows(
    pdf,
    [
      ["Type", contractTypeLabels[contract.contract_type] ?? contract.contract_type],
      ["Status", contract.status],
      ["Jurisdiction", contract.country],
      ["Language", contractLanguageName(contract.language)],
      ["Fee", `${eur(contract.fee_amount)} ${contract.fee_currency}`],
      ["Parties", `${contract.party_a_name} / ${contract.party_b_name}`],
    ],
    y,
  );

  pdf.setFont(branding.fontFamily || "helvetica", "normal");
  if (contract.language !== "en") {
    y = pdfSectionTitle(pdf, "Bilingual draft", y);
    const englishDraft = contractTextForPdf(generateContractContent(contractToPayload(contract, "en")));
    y = pdfTwoColumnText(
      pdf,
      "English",
      contractLanguageName(contract.language),
      englishDraft,
      contractContent,
      y,
      branding,
    );
    savePdf(pdf, `${title}-${today}`);
    return;
  }

  y = pdfSectionTitle(pdf, "Generated draft", y);
  pdf.setFont(branding.fontFamily || "helvetica", "normal");
  pdf.setFontSize(9);
  const paragraphs = contractContent.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  paragraphs.forEach((paragraph) => {
    const lines = pdf.splitTextToSize(paragraph, pdfContentWidth(pdf)) as string[];
    const height = Math.max(lines.length, 1) * 5 + 4;
    y = ensurePdfSpace(pdf, y, height);
    pdf.text(lines, pdfLayout.margin, y);
    y += height;
  });

  savePdf(pdf, `${title}-${today}`);
}

async function downloadBilingualContractPdf(
  contract: Contract,
  company: Company,
  targetLanguage: string,
  targetContent: string,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const branding = getContractBranding(contract);
  const sourceContent = contractTextForPdf(normalizeContractTextForLanguage(contract.generated_content, contract.language));
  const normalizedTargetContent = contractTextForPdf(normalizeContractTextForLanguage(targetContent, targetLanguage));
  const title = branding.title || contract.title;
  let y = pdfDocumentHeader(pdf, "Bilingual contract", title, company, branding);

  y = pdfKeyValueRows(
    pdf,
    [
      ["Type", contractTypeLabels[contract.contract_type] ?? contract.contract_type],
      ["Status", contract.status],
      ["Jurisdiction", contract.country],
      ["Languages", `${contractLanguageName(contract.language)} / ${contractLanguageName(targetLanguage)}`],
      ["Fee", `${eur(contract.fee_amount)} ${contract.fee_currency}`],
      ["Parties", `${contract.party_a_name} / ${contract.party_b_name}`],
    ],
    y,
  );

  pdf.setFont(branding.fontFamily || "helvetica", "normal");
  y = pdfSectionTitle(pdf, "Bilingual draft", y);
  y = pdfTwoColumnText(
    pdf,
    contractLanguageName(contract.language),
    contractLanguageName(targetLanguage),
    sourceContent,
    normalizedTargetContent,
    y,
    branding,
  );

  savePdf(pdf, `${title}-${contract.language}-${targetLanguage}-${today}`);
}

function contractToPayload(contract: Contract, language = contract.language): ContractDraftPayload {
  return {
    title: contract.title,
    contract_type: contract.contract_type,
    country: contract.country,
    language,
    party_a_name: contract.party_a_name,
    party_a_address: contract.party_a_address ?? "",
    party_a_email: contract.party_a_email ?? "",
    party_b_name: contract.party_b_name,
    party_b_address: contract.party_b_address ?? "",
    party_b_email: contract.party_b_email ?? "",
    start_date: contract.start_date ?? "",
    end_date: contract.end_date ?? "",
    fee_amount: Number(contract.fee_amount || 0),
    fee_currency: contract.fee_currency,
    payment_terms: contract.payment_terms ?? "",
    deliverables: contract.deliverables,
    special_terms: contract.special_terms ?? "",
  };
}

function pdfTwoColumnText(
  pdf: PdfDocument,
  leftTitle: string,
  rightTitle: string,
  leftText: string,
  rightText: string,
  startY: number,
  branding: ContractPdfBranding = {},
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const leftX = 6;
  const gutter = 4;
  const columnWidth = (pageWidth - leftX * 2 - gutter) / 2;
  const rightX = leftX + columnWidth + gutter;
  const lineHeight = 4.15;
  const pageBottom = pageHeight - 8;
  const font = branding.fontFamily || "helvetica";
  let y = startY;
  const leftBlocks = contractBlocksForPdf(leftText || "-");
  const rightBlocks = contractBlocksForPdf(rightText || "-");
  const maxBlocks = Math.max(leftBlocks.length, rightBlocks.length);

  function drawColumnHeader(currentY: number) {
    const accent = hexToRgb(branding.accentColor || "#223128");
    pdf.setFont(font, "bold");
    pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize(leftTitle, columnWidth) as string[], leftX, currentY);
    pdf.text(pdf.splitTextToSize(rightTitle, columnWidth) as string[], rightX, currentY);
    pdf.setDrawColor(accent.r, accent.g, accent.b);
    pdf.line(leftX + columnWidth + gutter / 2, currentY - 4, leftX + columnWidth + gutter / 2, pageBottom);
    return currentY + 6;
  }

  y = drawColumnHeader(ensurePdfSpace(pdf, y, 12));
  pdf.setFont(font, "normal");
  pdf.setFontSize(8);

  for (let index = 0; index < maxBlocks; index += 1) {
    const leftBlock = leftBlocks[index] || "";
    const rightBlock = rightBlocks[index] || "";
    const leftLines = pdf.splitTextToSize(leftBlock || " ", columnWidth - 1) as string[];
    const rightLines = pdf.splitTextToSize(rightBlock || " ", columnWidth - 1) as string[];
    const blockLines = Math.max(leftLines.length, rightLines.length, 1);
    const blockHeight = blockLines * lineHeight + 3;

    if (y + blockHeight > pageBottom) {
      pdf.addPage();
      y = drawColumnHeader(8);
      pdf.setFont(font, "normal");
      pdf.setFontSize(8);
    }
    if (/^\d+\.?\s+/.test(leftBlock)) pdf.setFont(font, "bold");
    pdf.text(leftLines, leftX, y);
    pdf.setFont(font, /^\d+\.?\s+/.test(rightBlock) ? "bold" : "normal");
    pdf.text(rightLines, rightX, y);
    pdf.setFont(font, "normal");
    y += blockHeight;
  }

  return y + 6;
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(() => tabFromPath(window.location.pathname));
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("app_locale") as Locale) || "en");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [invoiceDocuments, setInvoiceDocuments] = useState<InvoiceDocument[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseDocuments, setExpenseDocuments] = useState<ExpenseDocument[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [grantFundingProjects, setGrantFundingProjects] = useState<GrantFundingProject[]>([]);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [companyCustomRoles, setCompanyCustomRoles] = useState<CompanyCustomRole[]>([]);
  const [companyInvites, setCompanyInvites] = useState<CompanyInvite[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [vatCodes, setVatCodes] = useState<VatCode[]>([]);
  const [profitLoss, setProfitLoss] = useState<ProfitLossReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [eInvoicingConnectors, setEInvoicingConnectors] = useState<EInvoicingConnector[]>([]);
  const [eInvoiceDeliveries, setEInvoiceDeliveries] = useState<EInvoiceDelivery[]>([]);
  const [message, setMessage] = useState("");
  const [hubLaunchState, setHubLaunchState] = useState<{
    status: string;
    error: string;
  }>({
    status: "Preparing hub launch…",
    error: "",
  });
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
  const isHubLaunchPath = currentPath.replace(/\/+$/, "") === "/hublaunch";

  async function refresh(targetCompany = company) {
    if (!targetCompany) return;
    setLoading(true);
    setMessage("");

    try {
      const [
        contactsResult,
        invoicesResult,
        expensesResult,
        invoiceLinesResult,
        invoiceDocumentsResult,
        expenseDocumentsResult,
        contractsResult,
        grantFundingProjectsResult,
        companyMembersResult,
        companyCustomRolesResult,
        companyInvitesResult,
        approvalRequestsResult,
        bankAccountsResult,
        bankTransactionsResult,
        vatCodesResult,
        profitLossResult,
        balanceSheetResult,
        accountBalancesResult,
        eInvoicingConnectorsResult,
        eInvoiceDeliveriesResult,
      ] = await Promise.all([
        supabase.from("contacts").select("*").eq("company_id", targetCompany.id).order("display_name"),
        supabase.from("invoices").select("*").eq("company_id", targetCompany.id).order("issue_date", { ascending: false }),
        supabase.from("expenses").select("*").eq("company_id", targetCompany.id).order("expense_date", { ascending: false }),
        supabase.from("invoice_lines").select("*").eq("company_id", targetCompany.id).order("sort_order"),
        supabase.from("invoice_documents").select("*").eq("company_id", targetCompany.id).order("created_at", { ascending: false }),
        supabase.from("expense_documents").select("*").eq("company_id", targetCompany.id).order("created_at", { ascending: false }),
        supabase.from("contracts").select("*").eq("company_id", targetCompany.id).order("created_at", { ascending: false }),
        supabase.from("grant_funding_projects").select("*").eq("company_id", targetCompany.id).order("synced_at", { ascending: false }),
        supabase.from("company_members").select("*").eq("company_id", targetCompany.id).order("created_at", { ascending: true }),
        supabase.from("company_roles").select("*").eq("company_id", targetCompany.id).order("name", { ascending: true }),
        supabase.from("company_invites").select("*").eq("company_id", targetCompany.id).order("created_at", { ascending: false }),
        supabase.from("approval_requests").select("*").eq("company_id", targetCompany.id).order("created_at", { ascending: false }),
        supabase.from("bank_accounts").select("*").eq("company_id", targetCompany.id).order("created_at", { ascending: false }),
        supabase.from("bank_transactions").select("*").eq("company_id", targetCompany.id).order("booking_date", { ascending: false }),
        supabase.from("vat_codes").select("*").eq("company_id", targetCompany.id).order("rate", { ascending: false }),
        supabase.from("profit_loss_report").select("*").eq("company_id", targetCompany.id).maybeSingle(),
        supabase.from("balance_sheet_report").select("*").eq("company_id", targetCompany.id).maybeSingle(),
        supabase.from("account_balances_report").select("*").eq("company_id", targetCompany.id).order("account_code"),
        supabase.from("e_invoicing_connectors").select("*").eq("company_id", targetCompany.id).order("created_at", { ascending: false }),
        supabase.from("e_invoice_deliveries").select("*").eq("company_id", targetCompany.id).order("created_at", { ascending: false }),
      ]);

      for (const result of [
        contactsResult,
        invoicesResult,
        expensesResult,
        invoiceLinesResult,
        invoiceDocumentsResult,
        expenseDocumentsResult,
        contractsResult,
        grantFundingProjectsResult,
        companyMembersResult,
        companyCustomRolesResult,
        companyInvitesResult,
        approvalRequestsResult,
        bankAccountsResult,
        bankTransactionsResult,
        vatCodesResult,
        profitLossResult,
        balanceSheetResult,
        accountBalancesResult,
        eInvoicingConnectorsResult,
        eInvoiceDeliveriesResult,
      ]) {
        if (result.error) throw result.error;
      }

      setContacts((contactsResult.data ?? []) as Contact[]);
      setInvoices((invoicesResult.data ?? []) as Invoice[]);
      setInvoiceLines((invoiceLinesResult.data ?? []) as InvoiceLine[]);
      setInvoiceDocuments((invoiceDocumentsResult.data ?? []) as InvoiceDocument[]);
      setExpenses((expensesResult.data ?? []) as Expense[]);
      setExpenseDocuments((expenseDocumentsResult.data ?? []) as ExpenseDocument[]);
      setContracts((contractsResult.data ?? []) as Contract[]);
      setGrantFundingProjects((grantFundingProjectsResult.data ?? []) as GrantFundingProject[]);
      setCompanyMembers((companyMembersResult.data ?? []) as CompanyMember[]);
      setCompanyCustomRoles((companyCustomRolesResult.data ?? []) as CompanyCustomRole[]);
      setCompanyInvites((companyInvitesResult.data ?? []) as CompanyInvite[]);
      setApprovalRequests((approvalRequestsResult.data ?? []) as ApprovalRequest[]);
      setBankAccounts((bankAccountsResult.data ?? []) as BankAccount[]);
      setBankTransactions((bankTransactionsResult.data ?? []) as BankTransaction[]);
      setVatCodes((vatCodesResult.data ?? []) as VatCode[]);
      setProfitLoss((profitLossResult.data ?? null) as ProfitLossReport | null);
      setBalanceSheet((balanceSheetResult.data ?? null) as BalanceSheetReport | null);
      setAccountBalances((accountBalancesResult.data ?? []) as AccountBalance[]);
      setEInvoicingConnectors((eInvoicingConnectorsResult.data ?? []) as EInvoicingConnector[]);
      setEInvoiceDeliveries((eInvoiceDeliveriesResult.data ?? []) as EInvoiceDelivery[]);
    } catch (error) {
      setMessage(getMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("companies").select("*").order("created_at");
      if (error) throw error;
      const loadedCompanies = (data ?? []) as Company[];
      setCompanies(loadedCompanies);
      setCompany(loadedCompanies[0] ?? null);
      if (loadedCompanies[0]) await refresh(loadedCompanies[0]);
    } catch (error) {
      setMessage(getMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    captureHubContextFromUrl();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setCompany(null);
        setCompanies([]);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) void loadCompanies();
  }, [session]);

  useEffect(() => {
    if (!session || isHubLaunchPath) {
      return;
    }

    const nextPath = pathForTab(activeTab);
    if (window.location.pathname !== nextPath) {
      window.history.replaceState({}, "", nextPath);
    }
  }, [activeTab, isHubLaunchPath, session]);

  useEffect(() => {
    localStorage.setItem("app_locale", locale);
  }, [locale]);

  useEffect(() => {
    const inviteToken = new URLSearchParams(window.location.search).get("invite");
    if (!session || !inviteToken) return;
    supabase
      .rpc("accept_company_invite", { invite_token: inviteToken })
      .then(({ error }) => {
        if (error) setMessage(error.message);
        else {
          window.history.replaceState({}, "", window.location.pathname);
          void loadCompanies();
        }
      });
  }, [session]);

  useEffect(() => {
    if (!isHubLaunchPath) {
      return;
    }

    let cancelled = false;

    const finishHubLaunch = async () => {
      const hubContext = captureHubContextFromUrl();
      const launchTarget = getHubLaunchTarget();

      if (session) {
        setActiveTab(tabFromPath(launchTarget));
        if (!cancelled) {
          window.history.replaceState({}, "", launchTarget);
        }
        return;
      }

      if (loading) {
        return;
      }

      if (!hubContext?.proofToken) {
        setHubLaunchState({
          status: "Hub proof missing",
          error: "Sign in to Compta Solo to finish this hub launch.",
        });
        return;
      }

      setHubLaunchState({
        status: "Validating hub launch…",
        error: "",
      });

      try {
        const response = await fetch("/api/hub/bootstrap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            proof_token: hubContext.proofToken,
            hub_return_url: hubContext.hubReturnUrl,
            launch_target: hubContext.launchTarget,
            permissions: hubContext.permissions,
            session_bootstrap: hubContext.sessionBootstrap,
            handoff_payload: hubContext.handoffPayload,
            hub_state: hubContext.hubState,
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

        if (!response.ok) {
          throw new Error(
            typeof payload?.details === "string"
              ? payload.details
              : typeof payload?.error === "string"
                ? payload.error
                : "Compta Solo could not validate the hub launch.",
          );
        }

        if (payload?.launch_context && typeof payload.launch_context === "object") {
          writeHubContext(payload.launch_context);
        }

        const sessionPayload =
          payload?.session &&
          typeof payload.session === "object" &&
          typeof (payload.session as Record<string, unknown>).access_token === "string" &&
          typeof (payload.session as Record<string, unknown>).refresh_token === "string"
            ? (payload.session as { access_token: string; refresh_token: string })
            : null;

        if (sessionPayload) {
          setHubLaunchState({
            status: "Restoring Compta Solo session…",
            error: "",
          });
          const { error } = await supabase.auth.setSession(sessionPayload);
          if (error) {
            throw error;
          }
          return;
        }

        const tokenHash = typeof payload?.token_hash === "string" ? payload.token_hash : "";
        const type = typeof payload?.type === "string" ? payload.type : "email";
        if (tokenHash) {
          setHubLaunchState({
            status: "Completing Compta Solo sign in…",
            error: "",
          });
          const candidateTypes = Array.from(
            new Set([type, type === "magiclink" ? "email" : null, type === "email" ? "magiclink" : null, "signup"].filter(Boolean)),
          );

          let lastError: Error | null = null;
          for (const candidateType of candidateTypes) {
            const result = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: candidateType as "email" | "magiclink" | "signup",
            });
            if (!result.error) {
              return;
            }
            lastError = result.error;
          }

          throw lastError || new Error("Compta Solo could not redeem the hub bootstrap token.");
        }

        throw new Error("Compta Solo did not receive a valid hub bootstrap session.");
      } catch (error) {
        if (!cancelled) {
          setHubLaunchState({
            status: "Hub launch needs sign in",
            error: getMessage(error),
          });
        }
      }
    };

    void finishHubLaunch();

    return () => {
      cancelled = true;
    };
  }, [isHubLaunchPath, loading, session]);

  const revenue = invoices
    .filter((invoice) => invoice.status !== "cancelled")
    .reduce((sum, invoice) => sum + Number(invoice.total_inc_vat), 0);
  const expenseTotal = expenses
    .filter((expense) => expense.status !== "cancelled")
    .reduce((sum, expense) => sum + Number(expense.total_inc_vat), 0);
  const vatCollected = invoices.reduce((sum, invoice) => sum + Number(invoice.vat_total), 0);
  const vatDeductible = expenses.reduce((sum, expense) => sum + Number(expense.vat_total), 0);
  const cashIn = bankTransactions.filter((tx) => tx.direction === "in").reduce((sum, tx) => sum + Number(tx.amount), 0);
  const cashOut = bankTransactions.filter((tx) => tx.direction === "out").reduce((sum, tx) => sum + Number(tx.amount), 0);
  const urssafEstimate = company?.fiscal_regime === "micro_bic" ? revenue * 0.128 : revenue * 0.246;
  const activeMember = companyMembers.find((member) => member.company_id === company?.id && member.user_id === session?.user.id);
  const activeRole: CompanyRole = activeMember?.role ?? "viewer";
  const activeCustomRole = companyCustomRoles.find((role) => role.id === activeMember?.custom_role_id) ?? null;
  const activeAccess = roleAccess(activeRole, activeCustomRole);

  if (loading && !session) {
    return <div className="boot">Loading accounting workspace...</div>;
  }

  if (!session) {
    return <AuthScreen hubLaunchState={isHubLaunchPath ? hubLaunchState : null} />;
  }

  if (!company) {
    return (
      <Shell
        email={session.user.email ?? ""}
        company={company}
        companies={companies}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        locale={locale}
        setLocale={setLocale}
        onCompanyChange={setCompany}
        onRefresh={() => void loadCompanies()}
        backToHubUrl={getHubReturnUrl()}
      >
        <Onboarding locale={locale} onCreated={() => void loadCompanies()} />
        {message && <p className="notice error">{message}</p>}
      </Shell>
    );
  }

  return (
    <Shell
      email={session.user.email ?? ""}
      company={company}
      companies={companies}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      locale={locale}
      setLocale={setLocale}
      onCompanyChange={(next) => {
        setCompany(next);
        void refresh(next);
      }}
      onRefresh={() => void refresh()}
      backToHubUrl={getHubReturnUrl()}
    >
      {message && <p className="notice error">{message}</p>}
      {loading && <p className="notice">{labels[locale].refreshing}</p>}
      {activeTab === "dashboard" && !activeAccess.canViewReports && <p className="notice error">{labels[locale].reportsRestricted}</p>}
      {activeTab === "dashboard" && activeAccess.canViewReports && (
        <Dashboard
          locale={locale}
          revenue={revenue}
          expenseTotal={expenseTotal}
          vatDue={vatCollected - vatDeductible}
          cashNet={cashIn - cashOut}
          urssafEstimate={urssafEstimate}
          invoices={invoices}
          expenses={expenses}
          bankTransactions={bankTransactions}
        />
      )}
      {activeTab === "invoices" && (
        <InvoicesView
          locale={locale}
          company={company}
          contacts={contacts}
          invoices={invoices}
          invoiceLines={invoiceLines}
          invoiceDocuments={invoiceDocuments}
          approvals={approvalRequests}
          currentAccess={activeAccess}
          currentUserId={session.user.id}
          vatCodes={vatCodes}
          onCreated={() => void refresh()}
          onChanged={() => void refresh()}
        />
      )}
      {activeTab === "expenses" && (
        <ExpensesView
          locale={locale}
          company={company}
          expenses={expenses}
          expenseDocuments={expenseDocuments}
          vatCodes={vatCodes}
          currentAccess={activeAccess}
          onCreated={() => void refresh()}
          onChanged={() => void refresh()}
        />
      )}
      {activeTab === "contracts" && (
        <ContractsView
          locale={locale}
          company={company}
          contacts={contacts}
          contracts={contracts}
          approvals={approvalRequests}
          currentAccess={activeAccess}
          currentUserId={session.user.id}
          onCreated={() => void refresh()}
          onChanged={() => void refresh()}
        />
      )}
      {activeTab === "grants" && (
        <GrantFundingView locale={locale} projects={grantFundingProjects} currentAccess={activeAccess} onChanged={() => void refresh()} />
      )}
      {activeTab === "bank" && (
        <BankView
          locale={locale}
          company={company}
          bankAccounts={bankAccounts}
          bankTransactions={bankTransactions}
          currentAccess={activeAccess}
          onCreated={() => void refresh()}
        />
      )}
      {activeTab === "taxes" && !activeAccess.canViewReports && <p className="notice error">{labels[locale].reportsRestricted}</p>}
      {activeTab === "taxes" && activeAccess.canViewReports && (
        <TaxesView
          locale={locale}
          company={company}
          revenue={revenue}
          expenseTotal={expenseTotal}
          vatCollected={vatCollected}
          vatDeductible={vatDeductible}
          urssafEstimate={urssafEstimate}
          invoices={invoices}
          invoiceLines={invoiceLines}
          expenses={expenses}
          contacts={contacts}
        />
      )}
      {activeTab === "reports" && !activeAccess.canViewReports && <p className="notice error">{labels[locale].reportsRestricted}</p>}
      {activeTab === "reports" && activeAccess.canViewReports && (
        <ReportsView locale={locale} company={company} profitLoss={profitLoss} balanceSheet={balanceSheet} accountBalances={accountBalances} />
      )}
      {activeTab === "einvoicing" && (
        <EInvoicingView
          locale={locale}
          company={company}
          invoices={invoices}
          connectors={eInvoicingConnectors}
          deliveries={eInvoiceDeliveries}
          currentAccess={activeAccess}
          onChanged={() => void refresh()}
        />
      )}
      {activeTab === "settings" && (
        <SettingsView
          locale={locale}
          company={company}
          members={companyMembers}
          customRoles={companyCustomRoles}
          invites={companyInvites}
          approvals={approvalRequests}
          currentRole={activeRole}
          currentCustomRole={activeCustomRole}
          currentAccess={activeAccess}
          currentUserId={session.user.id}
          onChanged={() => void loadCompanies()}
        />
      )}
    </Shell>
  );
}

function AuthScreen({
  hubLaunchState,
}: {
  hubLaunchState: { status: string; error: string } | null;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("app_locale") as Locale) || "en");
  const t = labels[locale];

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    localStorage.setItem("app_locale", nextLocale);
  }

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getHubLoginRedirectUrl(),
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) {
      setMessage(`Google sign-in is visible, but the Supabase Google provider is not configured yet: ${error.message}`);
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) setMessage(result.error.message);
    else setMessage(mode === "signup" ? "Account created. Check email if confirmation is enabled." : "");
    setBusy(false);
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Compta Solo</p>
          <h1>{t.authTitle}</h1>
          <p className="muted">{t.authSubtitle}</p>
        </div>
        {hubLaunchState ? (
          <p className={hubLaunchState.error ? "notice error" : "notice"}>
            <strong>{hubLaunchState.status}</strong>
            {hubLaunchState.error ? ` ${hubLaunchState.error}` : " Hub context is ready and Compta Solo will open your requested workspace after sign-in."}
          </p>
        ) : null}
        <form onSubmit={submit} className="form-grid">
          <label className="compact-label">
            {t.language}
            <select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}>
              <option value="en">EN</option>
              <option value="fr">FR</option>
            </select>
          </label>
          <button type="button" className="google-button" onClick={() => void signInWithGoogle()} disabled={busy}>
            <span className="google-mark">G</span>
            {t.continueGoogle}
          </button>
          <div className="auth-divider">
            <span>{t.useEmail}</span>
          </div>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            {t.password}
            <input name="password" type="password" required minLength={6} autoComplete="current-password" />
          </label>
          <div className="inline-actions">
            <button className="primary" disabled={busy}>
              {busy ? t.working : mode === "signin" ? t.signIn : t.createAccount}
            </button>
            <button type="button" className="ghost" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? t.needAccount : t.alreadyAccount}
            </button>
          </div>
          {message && <p className="notice">{message}</p>}
        </form>
      </section>
    </main>
  );
}

function Shell({
  children,
  email,
  company,
  companies,
  activeTab,
  setActiveTab,
  locale,
  setLocale,
  onCompanyChange,
  onRefresh,
  backToHubUrl,
}: {
  children: React.ReactNode;
  email: string;
  company: Company | null;
  companies: Company[];
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  onCompanyChange: (company: Company) => void;
  onRefresh: () => void;
  backToHubUrl: string | null;
}) {
  const t = labels[locale];
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  }

  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <WalletCards size={22} />
          </div>
          <div className="brand-copy">
            <strong>Compta Solo</strong>
            <span>France</span>
          </div>
        </div>
        <button
          className="collapse-button"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          <span>{sidebarCollapsed ? "Expand" : "Collapse"}</span>
        </button>
        <nav>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const label = tabLabels[locale][tab.id] ?? tab.label;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "nav-item active" : "nav-item"}
                onClick={() => setActiveTab(tab.id)}
                title={label}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span>{email}</span>
          <button className="icon-button" title={t.signOut} onClick={() => void supabase.auth.signOut()}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{company ? company.fiscal_regime.replaceAll("_", " ") : t.setup}</p>
            <h1>{company?.name ?? t.createWorkspace}</h1>
          </div>
          <div className="topbar-actions">
            {backToHubUrl ? (
              <a className="ghost" href={backToHubUrl}>
                Back to Hub
              </a>
            ) : null}
            <label className="compact-label">
              {t.language}
              <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
                <option value="en">EN</option>
                <option value="fr">FR</option>
              </select>
            </label>
            {companies.length > 1 && (
              <select
                value={company?.id ?? ""}
                onChange={(event) => {
                  const next = companies.find((item) => item.id === event.target.value);
                  if (next) onCompanyChange(next);
                }}
              >
                {companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
            <button className="icon-button" title={t.refresh} onClick={onRefresh}>
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Onboarding({ locale, onCreated }: { locale: Locale; onCreated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const t = labels[locale];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { error } = await supabase.from("companies").insert({
      name: String(form.get("name")),
      fiscal_regime: String(form.get("fiscal_regime")),
      vat_liability_mode: String(form.get("vat_liability_mode")),
      invoice_prefix: String(form.get("invoice_prefix") || "INV"),
      siret: String(form.get("siret") || "") || null,
      vat_number: String(form.get("vat_number") || "") || null,
      created_by: user.id,
    });

    if (error) setMessage(error.message);
    else onCreated();
    setBusy(false);
  }

  return (
    <section className="wide-panel">
      <div className="section-heading">
        <Building2 size={22} />
        <div>
          <h2>{t.companyProfile}</h2>
          <p>{t.companyProfileHelp}</p>
        </div>
      </div>
      <form className="form-grid two" onSubmit={submit}>
        <label>
          {t.companyName}
          <input name="name" required placeholder="Studio Dupont" />
        </label>
        <label>
          {t.invoicePrefix}
          <input name="invoice_prefix" defaultValue="FAC" required />
        </label>
        <label>
          {t.fiscalRegime}
          <select name="fiscal_regime" defaultValue="micro_bnc">
            <option value="micro_bnc">Micro-BNC</option>
            <option value="micro_bic">Micro-BIC</option>
            <option value="reel_simplifie">Reel simplifie</option>
            <option value="reel_normal">Reel normal</option>
            <option value="sasu_is">SASU IS</option>
          </select>
        </label>
        <label>
          {t.vatMode}
          <select name="vat_liability_mode" defaultValue="exempt">
            <option value="exempt">Franchise en base</option>
            <option value="vat_registered">VAT registered</option>
          </select>
        </label>
        <label>
          SIRET
          <input name="siret" />
        </label>
        <label>
          {t.vatNumber}
          <input name="vat_number" />
        </label>
        <button className="primary" disabled={busy}>
          <Plus size={17} />
          {busy ? t.creating : t.createWorkspaceButton}
        </button>
      </form>
      {message && <p className="notice error">{message}</p>}
    </section>
  );
}

function Dashboard({
  locale,
  revenue,
  expenseTotal,
  vatDue,
  cashNet,
  urssafEstimate,
  invoices,
  expenses,
  bankTransactions,
}: {
  locale: Locale;
  revenue: number;
  expenseTotal: number;
  vatDue: number;
  cashNet: number;
  urssafEstimate: number;
  invoices: Invoice[];
  expenses: Expense[];
  bankTransactions: BankTransaction[];
}) {
  const t = labels[locale];
  const metrics = [
    { label: t.revenue, value: eur(revenue), detail: `${invoices.length} invoices`, icon: FileText },
    { label: t.purchases, value: eur(expenseTotal), detail: `${expenses.length} expenses`, icon: ReceiptText },
    { label: t.cashMovement, value: eur(cashNet), detail: `${bankTransactions.length} bank lines`, icon: Banknote },
    { label: t.vatPosition, value: eur(vatDue), detail: "collected minus deductible", icon: ArrowDownUp },
    { label: t.urssafEstimate, value: eur(urssafEstimate), detail: "rough micro estimate", icon: ShieldCheck },
  ];

  return (
    <div className="dashboard-grid">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <section className="metric-panel" key={metric.label}>
            <Icon size={20} />
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </section>
        );
      })}
      <section className="wide-panel span-two">
        <div className="section-heading">
          <BarChart3 size={22} />
          <div>
            <h2>{t.recentActivity}</h2>
            <p>{t.recentActivityHelp}</p>
          </div>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={["Date", t.type, "Name", t.amount]}
          rows={[
            ...invoices.slice(0, 5).map((invoice) => [
              invoice.issue_date,
              "Invoice",
              invoice.number ?? "Draft",
              eur(invoice.total_inc_vat),
            ]),
            ...expenses.slice(0, 5).map((expense) => [
              expense.expense_date,
              "Purchase",
              expense.supplier_name,
              eur(expense.total_inc_vat),
            ]),
          ].slice(0, 8)}
        />
      </section>
    </div>
  );
}

function InvoicesView({
  locale,
  company,
  contacts,
  invoices,
  invoiceLines,
  invoiceDocuments,
  approvals,
  currentAccess,
  currentUserId,
  vatCodes,
  onCreated,
  onChanged,
}: {
  locale: Locale;
  company: Company;
  contacts: Contact[];
  invoices: Invoice[];
  invoiceLines: InvoiceLine[];
  invoiceDocuments: InvoiceDocument[];
  approvals: ApprovalRequest[];
  currentAccess: CompanyAccess;
  currentUserId: string;
  vatCodes: VatCode[];
  onCreated: () => void;
  onChanged: () => void;
}) {
  const t = labels[locale];
  const [message, setMessage] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [invoiceUpload, setInvoiceUpload] = useState<File | null>(null);
  const [ocrPayload, setOcrPayload] = useState<Record<string, unknown>>({});
  const [scanValues, setScanValues] = useState({
    clientName: "",
    email: "",
    description: "",
    amount: "",
    issueDate: today,
    vatCodeId: "",
  });
  const [scanReview, setScanReview] = useState<ScanReview | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const saleVatCodes = vatCodes.filter((code) => code.applies_to_sales);
  const defaultVatCodeId = scanValues.vatCodeId || saleVatCodes[0]?.id || "";

  async function scanInvoiceUpload() {
    setMessage("");
    setScanMessage("");
    setOcrPayload({});

    if (!invoiceUpload) {
      setScanMessage("Choose an invoice image first. PDFs can be attached, but OCR currently scans image files.");
      return;
    }

    if (!invoiceUpload.type.startsWith("image/")) {
      setScanMessage("PDF attached. For OCR prefill, upload or capture a JPG, PNG or WebP image.");
      return;
    }

    setScanBusy(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const result = await worker.recognize(invoiceUpload);
      await worker.terminate();
      const parsed = parseInvoiceScan(result.data.text);
      const matchedVatCode = saleVatCodes.find((code) => parsed.vatRate !== null && Math.abs(Number(code.rate) - parsed.vatRate) < 0.01);

      setScanValues({
        clientName: parsed.clientName || scanValues.clientName,
        email: parsed.email || scanValues.email,
        description: parsed.description || scanValues.description || "Scanned invoice",
        amount: parsed.amount || scanValues.amount,
        issueDate: parsed.issueDate || scanValues.issueDate,
        vatCodeId: matchedVatCode?.id || scanValues.vatCodeId,
      });
      setScanReview({
        documentType: parsed.documentType,
        reference: parsed.reference,
        email: parsed.email,
        siret: parsed.siret,
        confidenceNotes: parsed.confidenceNotes,
        rawText: parsed.rawText,
      });
      setOcrPayload({
        text: parsed.rawText,
        parsed: {
          clientName: parsed.clientName,
          description: parsed.description,
          amount: parsed.amount,
          issueDate: parsed.issueDate,
          vatRate: parsed.vatRate,
          email: parsed.email,
          siret: parsed.siret,
          reference: parsed.reference,
          documentType: parsed.documentType,
          confidenceNotes: parsed.confidenceNotes,
        },
      });
      setFormVersion((version) => version + 1);
      setScanMessage("Scan complete. Review the prefilled fields before creating the invoice.");
    } catch (error) {
      setScanMessage(getMessage(error));
    } finally {
      setScanBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);
    const clientName = String(form.get("client_name"));
    const selectedContact = String(form.get("contact_id"));
    const amount = Number(form.get("amount"));
    const description = String(form.get("description"));
    const vatCode = saleVatCodes.find((code) => code.id === String(form.get("vat_code_id")));

    try {
      let contactId = selectedContact || null;
      if (!contactId) {
        const { data, error } = await supabase
          .from("contacts")
          .insert({
            company_id: company.id,
            kind: "customer",
            display_name: clientName,
            email: String(form.get("email") || "") || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        contactId = data.id;
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          company_id: company.id,
          contact_id: contactId,
          kind: "invoice",
          status: "sent",
          issue_date: String(form.get("issue_date")),
          due_date: String(form.get("due_date")),
        })
        .select("id")
        .single();
      if (invoiceError) throw invoiceError;

      const { error: lineError } = await supabase.from("invoice_lines").insert({
        invoice_id: invoice.id,
        company_id: company.id,
        description,
        quantity: 1,
        unit_price_ex_vat: amount,
        account_code: "706000",
        vat_code_id: vatCode?.id ?? null,
        vat_rate: vatCode?.rate ?? 0,
      });
      if (lineError) throw lineError;

      const { error: postingError } = await supabase.rpc("post_invoice_journal", {
        target_invoice_id: invoice.id,
      });
      if (postingError) throw postingError;

      if (invoiceUpload && invoiceUpload.size > 0) {
        const safeName = sanitizeFilename(invoiceUpload.name.replace(/\.[^.]+$/, ""));
        const extension = invoiceUpload.name.includes(".") ? invoiceUpload.name.split(".").pop() : "bin";
        const storagePath = `${company.id}/${invoice.id}/${crypto.randomUUID()}-${safeName}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("invoice-documents").upload(storagePath, invoiceUpload, {
          contentType: invoiceUpload.type || "application/octet-stream",
          upsert: false,
        });
        if (uploadError) throw uploadError;

        const { error: documentError } = await supabase.rpc("create_invoice_document", {
          target_invoice_id: invoice.id,
          target_storage_path: storagePath,
          target_original_filename: invoiceUpload.name,
          target_content_type: invoiceUpload.type || null,
          target_ocr_payload: ocrPayload,
        });
        if (documentError) throw documentError;
      }

      event.currentTarget.reset();
      setInvoiceUpload(null);
      setOcrPayload({});
      setScanMessage("");
      setScanValues({
        clientName: "",
        email: "",
        description: "",
        amount: "",
        issueDate: today,
        vatCodeId: "",
      });
      setScanReview(null);
      setFormVersion((version) => version + 1);
      void pushMentionNotifications({
        event_type: "mention",
        company_id: company.id,
        source_label: `Invoice ${clientName}`,
        source_href: "/invoices",
        source_text: description,
        entity_type: "invoice",
        entity_id: invoice.id,
        source_event_id: `invoice-${invoice.id}-description`,
      });
      onCreated();
    } catch (error) {
      setMessage(getMessage(error));
    }
  }

  async function updateInvoice(id: string, status: string) {
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const patch =
      status === "paid"
        ? { status, paid_at: today, payment_method: "bank_transfer" }
        : { status, paid_at: null, payment_method: null };
    const { error } = await supabase.from("invoices").update(patch).eq("id", id);
    if (error) setMessage(error.message);
    else onChanged();
  }

  async function openInvoiceDocument(invoiceId: string) {
    const document = invoiceDocuments.find((item) => item.invoice_id === invoiceId);
    if (!document) return;
    const { data, error } = await supabase.storage.from("invoice-documents").createSignedUrl(document.storage_path, 60);
    if (error) setMessage(error.message);
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function requestInvoiceApproval(invoice: Invoice) {
    setMessage("");
    if (!canRequestApproval(currentAccess)) {
      setMessage(t.approvalRequestRestricted);
      return;
    }
    const existing = approvals.find(
      (approval) => approval.kind === "invoice" && approval.target_id === invoice.id && approval.status === "pending",
    );
    if (existing) {
      setMessage("Invoice approval is already pending.");
      return;
    }
    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        company_id: company.id,
        kind: "invoice",
        target_table: "invoices",
        target_id: invoice.id,
        title: `Approve invoice ${invoice.number ?? invoice.id.slice(0, 8)}`,
        details: `Total ${eur(invoice.total_inc_vat)}. Status ${invoice.status}.`,
        requested_by: currentUserId,
      })
      .select("id")
      .single();
    if (error) setMessage(error.message);
    else {
      if (data?.id) void pushHubNotificationEvent({ event_type: "approval_requested", approval_id: data.id });
      setMessage("Invoice approval requested.");
      onChanged();
    }
  }

  return (
    <div className="split-view">
      <section className="wide-panel">
        <div className="section-heading">
          <FileText size={22} />
          <div>
            <h2>{t.newInvoice}</h2>
            <p>{t.newInvoiceHelp}</p>
          </div>
        </div>
        {!canWrite(currentAccess) && <p className="notice">{t.writeRestricted}</p>}
        <div className="scan-card">
          <Upload size={18} />
          <div>
            <strong>{t.invoiceUploadScan}</strong>
            <span>{t.invoiceUploadHelp}</span>
          </div>
          <button type="button" className="ghost" disabled={scanBusy || !invoiceUpload || !canWrite(currentAccess)} onClick={() => void scanInvoiceUpload()}>
            {scanBusy ? t.scanning : t.scanUpload}
          </button>
        </div>
        <form key={formVersion} className="form-grid two" onSubmit={submit}>
          <label>
            {t.existingClient}
            <select name="contact_id" defaultValue="">
              <option value="">{t.newClient}</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.newClientName}
            <input name="client_name" placeholder="Client SAS" defaultValue={scanValues.clientName} />
          </label>
          <label>
            {t.clientEmail}
            <input name="email" type="email" defaultValue={scanValues.email} />
          </label>
          <label>
            {t.description}
            <input name="description" required placeholder="Development work" defaultValue={scanValues.description} />
          </label>
          <label>
            {t.amountExVat}
            <input name="amount" type="number" min="0" step="0.01" required defaultValue={scanValues.amount} />
          </label>
          <label>
            VAT
            <select name="vat_code_id" defaultValue={defaultVatCodeId}>
              {saleVatCodes.map((code) => (
                <option key={code.id} value={code.id}>
                  {code.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.issueDate}
            <input name="issue_date" type="date" defaultValue={scanValues.issueDate} required />
          </label>
          <label>
            {t.dueDate}
            <input name="due_date" type="date" defaultValue={plusDays(30)} required />
          </label>
          <label>
            {t.sourceScan}
            <input
              name="invoice_upload"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              capture="environment"
              onChange={(event) => setInvoiceUpload(event.currentTarget.files?.[0] ?? null)}
            />
          </label>
          <button className="primary" disabled={!canWrite(currentAccess)}>
            <Plus size={17} />
            {t.createInvoice}
          </button>
        </form>
        {scanReview && (
          <div className="scan-review">
            <strong>{t.detectedDocument}</strong>
            <span>{t.type}: {scanReview.documentType}</span>
            {scanReview.reference && <span>Reference: {scanReview.reference}</span>}
            {scanReview.email && <span>Email: {scanReview.email}</span>}
            {scanReview.siret && <span>SIRET: {scanReview.siret}</span>}
            <span>Confidence: {scanReview.confidenceNotes.length ? scanReview.confidenceNotes.join(", ") : "basic text detected"}</span>
          </div>
        )}
        {scanMessage && <p className="notice">{scanMessage}</p>}
        {message && <p className="notice error">{message}</p>}
      </section>
      <section className="wide-panel">
        <div className="section-heading">
          <FileDown size={22} />
          <div>
            <h2>{t.invoiceRegister}</h2>
            <p>{t.invoiceRegisterHelp}</p>
          </div>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={["Date", t.number, t.status, t.total, t.upload, t.actions]}
          rows={invoices.map((invoice) => [
            invoice.issue_date,
            invoice.number ?? "Draft",
            invoice.status,
            eur(invoice.total_inc_vat),
            String(invoiceDocuments.filter((document) => document.invoice_id === invoice.id).length),
            "",
          ])}
          renderCell={(rowIndex, cellIndex, value) => {
            const invoice = invoices[rowIndex];
            if (cellIndex === 4) {
              return value === "0" ? (
                "None"
              ) : (
                <button className="text-action" onClick={() => void openInvoiceDocument(invoice.id)}>
                  View
                </button>
              );
            }
            if (cellIndex !== 5) return value;
            return (
              <div className="row-actions">
                <button
                  className="small-action"
                  title={t.downloadPdf}
                  onClick={() =>
                    void downloadInvoicePdf(
                      invoice,
                      contacts.find((contact) => contact.id === invoice.contact_id),
                      invoiceLines.filter((line) => line.invoice_id === invoice.id),
                      company,
                    )
                  }
                >
                  <FileDown size={15} />
                </button>
                {canWrite(currentAccess) && (
                  <>
                    <button className="small-action" title="Mark paid" onClick={() => void updateInvoice(invoice.id, "paid")}>
                      <CheckCircle2 size={15} />
                    </button>
                    {canRequestApproval(currentAccess) && (
                      <button className="small-action" title="Request approval" onClick={() => void requestInvoiceApproval(invoice)}>
                        <ShieldCheck size={15} />
                      </button>
                    )}
                    <button className="small-action danger" title="Cancel" onClick={() => void updateInvoice(invoice.id, "cancelled")}>
                      <XCircle size={15} />
                    </button>
                  </>
                )}
              </div>
            );
          }}
        />
      </section>
    </div>
  );
}

function ExpensesView({
  locale,
  company,
  expenses,
  expenseDocuments,
  vatCodes,
  currentAccess,
  onCreated,
  onChanged,
}: {
  locale: Locale;
  company: Company;
  expenses: Expense[];
  expenseDocuments: ExpenseDocument[];
  vatCodes: VatCode[];
  currentAccess: CompanyAccess;
  onCreated: () => void;
  onChanged: () => void;
}) {
  const t = labels[locale];
  const [message, setMessage] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [receiptUpload, setReceiptUpload] = useState<File | null>(null);
  const [receiptOcrPayload, setReceiptOcrPayload] = useState<Record<string, unknown>>({});
  const [receiptScanReview, setReceiptScanReview] = useState<ScanReview | null>(null);
  const [expenseFormVersion, setExpenseFormVersion] = useState(0);
  const [expenseScanValues, setExpenseScanValues] = useState({
    supplierName: "",
    description: "",
    amount: "",
    expenseDate: today,
    vatCodeId: "",
    categoryAccountCode: "626000",
  });
  const purchaseVatCodes = vatCodes.filter((code) => code.applies_to_purchases);
  const defaultPurchaseVatCodeId = expenseScanValues.vatCodeId || purchaseVatCodes[0]?.id || "";

  async function scanReceiptUpload() {
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    setScanMessage("");
    setReceiptOcrPayload({});
    setReceiptScanReview(null);

    if (!receiptUpload) {
      setScanMessage("Choose or capture a receipt image first. PDFs are stored, but OCR scans image files.");
      return;
    }

    if (!receiptUpload.type.startsWith("image/")) {
      setScanMessage("PDF attached. For OCR prefill, upload or capture a JPG, PNG or WebP image.");
      return;
    }

    setScanBusy(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng+fra");
      const result = await worker.recognize(receiptUpload);
      await worker.terminate();
      const parsed = parseInvoiceScan(result.data.text);
      const matchedVatCode = purchaseVatCodes.find((code) => parsed.vatRate !== null && Math.abs(Number(code.rate) - parsed.vatRate) < 0.01);
      const suggestedCategory = /restaurant|cafe|brasserie|food|repas/i.test(result.data.text)
        ? "625700"
        : /train|sncf|ratp|uber|taxi|transport/i.test(result.data.text)
          ? "625100"
          : /software|cloud|hosting|saas|ovh|google|apple|microsoft/i.test(result.data.text)
            ? "626000"
            : "606300";

      setExpenseScanValues({
        supplierName: parsed.clientName || expenseScanValues.supplierName,
        description: parsed.description || expenseScanValues.description || `${parsed.documentType} scan`,
        amount: parsed.amount || expenseScanValues.amount,
        expenseDate: parsed.issueDate || expenseScanValues.expenseDate,
        vatCodeId: matchedVatCode?.id || expenseScanValues.vatCodeId,
        categoryAccountCode: suggestedCategory,
      });
      setReceiptScanReview({
        documentType: parsed.documentType,
        reference: parsed.reference,
        email: parsed.email,
        siret: parsed.siret,
        confidenceNotes: parsed.confidenceNotes,
        rawText: parsed.rawText,
      });
      setReceiptOcrPayload({
        text: parsed.rawText,
        parsed: {
          supplierName: parsed.clientName,
          description: parsed.description,
          amount: parsed.amount,
          expenseDate: parsed.issueDate,
          vatRate: parsed.vatRate,
          siret: parsed.siret,
          reference: parsed.reference,
          documentType: parsed.documentType,
          confidenceNotes: parsed.confidenceNotes,
          categoryAccountCode: suggestedCategory,
        },
      });
      setExpenseFormVersion((version) => version + 1);
      setScanMessage("Receipt scan complete. Review the prefilled purchase before saving.");
    } catch (error) {
      setScanMessage(getMessage(error));
    } finally {
      setScanBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);
    const totalExVat = Number(form.get("total_ex_vat"));
    const supplierName = String(form.get("supplier_name"));
    const description = String(form.get("description"));
    const vatCode = purchaseVatCodes.find((code) => code.id === String(form.get("vat_code_id")));
    const vatTotal = Math.round(totalExVat * Number(vatCode?.rate ?? 0)) / 100;

    try {
      const { data: expense, error } = await supabase
        .from("expenses")
        .insert({
          company_id: company.id,
          status: "issued",
          expense_date: String(form.get("expense_date")),
          supplier_name: supplierName,
          description,
          total_ex_vat: totalExVat,
          vat_total: vatTotal,
          total_inc_vat: totalExVat + vatTotal,
          deductible_amount: totalExVat + vatTotal,
          vat_code_id: vatCode?.id ?? null,
          category_account_code: String(form.get("category_account_code")),
          payment_method: String(form.get("payment_method")),
        })
        .select("id")
        .single();
      if (error) throw error;

      const receipt = receiptUpload ?? form.get("receipt");
      if (receipt instanceof File && receipt.size > 0) {
        const safeName = sanitizeFilename(receipt.name.replace(/\.[^.]+$/, ""));
        const extension = receipt.name.includes(".") ? receipt.name.split(".").pop() : "bin";
        const storagePath = `${company.id}/${expense.id}/${crypto.randomUUID()}-${safeName}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("expense-documents").upload(storagePath, receipt, {
          contentType: receipt.type || "application/octet-stream",
          upsert: false,
        });
        if (uploadError) throw uploadError;

        const { error: documentError } = await supabase.rpc("create_expense_document", {
          target_expense_id: expense.id,
          target_storage_path: storagePath,
          target_original_filename: receipt.name,
          target_content_type: receipt.type || null,
          target_ocr_payload: receiptOcrPayload,
        });
        if (documentError) throw documentError;
      }

      const { error: postingError } = await supabase.rpc("post_expense_journal", {
        target_expense_id: expense.id,
      });
      if (postingError) throw postingError;

      event.currentTarget.reset();
      setReceiptUpload(null);
      setReceiptOcrPayload({});
      setReceiptScanReview(null);
      setScanMessage("");
      setExpenseScanValues({
        supplierName: "",
        description: "",
        amount: "",
        expenseDate: today,
        vatCodeId: "",
        categoryAccountCode: "626000",
      });
      setExpenseFormVersion((version) => version + 1);
      void pushMentionNotifications({
        event_type: "mention",
        company_id: company.id,
        source_label: `Purchase ${supplierName}`,
        source_href: "/expenses",
        source_text: description,
        entity_type: "expense",
        entity_id: expense.id,
        source_event_id: `expense-${expense.id}-description`,
      });
      onCreated();
    } catch (error) {
      setMessage(getMessage(error));
    }
  }

  async function updateExpense(id: string, status: string) {
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const patch =
      status === "paid"
        ? { status, payment_date: today }
        : { status, payment_date: null };
    const { error } = await supabase.from("expenses").update(patch).eq("id", id);
    if (error) setMessage(error.message);
    else onChanged();
  }

  async function openReceipt(expenseId: string) {
    const document = expenseDocuments.find((item) => item.expense_id === expenseId);
    if (!document) return;
    const { data, error } = await supabase.storage
      .from("expense-documents")
      .createSignedUrl(document.storage_path, 60);
    if (error) setMessage(error.message);
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="split-view">
      <section className="wide-panel">
        <div className="section-heading">
          <ReceiptText size={22} />
          <div>
            <h2>{t.logPurchase}</h2>
            <p>{t.logPurchaseHelp}</p>
          </div>
        </div>
        {!canWrite(currentAccess) && <p className="notice">{t.writeRestricted}</p>}
        <div className="scan-card">
          <Upload size={18} />
          <div>
            <strong>{t.receiptScan}</strong>
            <span>{t.receiptScanHelp}</span>
          </div>
          <button type="button" className="ghost" disabled={scanBusy || !receiptUpload || !canWrite(currentAccess)} onClick={() => void scanReceiptUpload()}>
            {scanBusy ? t.scanning : t.scanReceipt}
          </button>
        </div>
        <form key={expenseFormVersion} className="form-grid two" onSubmit={submit}>
          <label>
            {t.supplier}
            <input name="supplier_name" required placeholder="OVH, SNCF, RATP" defaultValue={expenseScanValues.supplierName} />
          </label>
          <label>
            {t.description}
            <input name="description" required placeholder="Cloud hosting" defaultValue={expenseScanValues.description} />
          </label>
          <label>
            {t.amountExVat}
            <input name="total_ex_vat" type="number" min="0" step="0.01" required defaultValue={expenseScanValues.amount} />
          </label>
          <label>
            VAT
            <select name="vat_code_id" defaultValue={defaultPurchaseVatCodeId}>
              {purchaseVatCodes.map((code) => (
                <option key={code.id} value={code.id}>
                  {code.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.category}
            <select name="category_account_code" defaultValue={expenseScanValues.categoryAccountCode}>
              <option value="626000">Telecom / software</option>
              <option value="625100">Travel</option>
              <option value="625700">Restaurant</option>
              <option value="606300">Supplies</option>
              <option value="628100">Subscriptions</option>
            </select>
          </label>
          <label>
            {t.paymentMethod}
            <select name="payment_method" defaultValue="card">
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="direct_debit">Direct debit</option>
            </select>
          </label>
          <label>
            {t.expenseDate}
            <input name="expense_date" type="date" defaultValue={expenseScanValues.expenseDate} required />
          </label>
          <label>
            {t.receipt}
            <input
              name="receipt"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              capture="environment"
              onChange={(event) => setReceiptUpload(event.currentTarget.files?.[0] ?? null)}
            />
          </label>
          <button className="primary" disabled={!canWrite(currentAccess)}>
            <Plus size={17} />
            {t.addPurchase}
          </button>
        </form>
        {receiptScanReview && (
          <div className="scan-review">
            <strong>{t.detectedReceipt}</strong>
            <span>{t.type}: {receiptScanReview.documentType}</span>
            {receiptScanReview.reference && <span>Reference: {receiptScanReview.reference}</span>}
            {receiptScanReview.siret && <span>SIRET: {receiptScanReview.siret}</span>}
            <span>Confidence: {receiptScanReview.confidenceNotes.length ? receiptScanReview.confidenceNotes.join(", ") : "basic text detected"}</span>
          </div>
        )}
        {scanMessage && <p className="notice">{scanMessage}</p>}
        {message && <p className="notice error">{message}</p>}
      </section>
      <section className="wide-panel">
        <div className="section-heading">
          <FileDown size={22} />
          <div>
            <h2>{t.purchaseRegister}</h2>
            <p>{t.purchaseRegisterHelp}</p>
          </div>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={["Date", t.supplier, t.status, t.total, t.receipt, t.actions]}
          rows={expenses.map((expense) => [
            expense.expense_date,
            expense.supplier_name,
            expense.status,
            eur(expense.total_inc_vat),
            String(expenseDocuments.filter((document) => document.expense_id === expense.id).length),
            "",
          ])}
          renderCell={(rowIndex, cellIndex, value) => {
            const expense = expenses[rowIndex];
            if (cellIndex === 4) {
              return value === "0" ? (
                "None"
              ) : (
                <button className="text-action" onClick={() => void openReceipt(expense.id)}>
                  View
                </button>
              );
            }
            if (cellIndex !== 5) return value;
            return (
              <div className="row-actions">
                {canWrite(currentAccess) && (
                  <>
                    <button className="small-action" title="Mark paid" onClick={() => void updateExpense(expense.id, "paid")}>
                      <CheckCircle2 size={15} />
                    </button>
                    <button className="small-action danger" title="Cancel" onClick={() => void updateExpense(expense.id, "cancelled")}>
                      <XCircle size={15} />
                    </button>
                  </>
                )}
              </div>
            );
          }}
        />
      </section>
    </div>
  );
}

function ContractsView({
  locale,
  company,
  contacts,
  contracts,
  approvals,
  currentAccess,
  currentUserId,
  onCreated,
  onChanged,
}: {
  locale: Locale;
  company: Company;
  contacts: Contact[];
  contracts: Contract[];
  approvals: ApprovalRequest[];
  currentAccess: CompanyAccess;
  currentUserId: string;
  onCreated: () => void;
  onChanged: () => void;
}) {
  const t = labels[locale];
  const [message, setMessage] = useState("");
  const [previewContract, setPreviewContract] = useState<Contract | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [translationLanguage, setTranslationLanguage] = useState("fr");
  const [translationContent, setTranslationContent] = useState("");
  const [contractDisplayTitle, setContractDisplayTitle] = useState("");
  const [contractAccentColor, setContractAccentColor] = useState("#223128");
  const [contractFontFamily, setContractFontFamily] = useState<ContractPdfBranding["fontFamily"]>("helvetica");
  const [contractLogoDataUrl, setContractLogoDataUrl] = useState("");
  const [aiSettings, setAiSettings] = useState<ContractAiSettings>(readContractAiSettings);
  const [generating, setGenerating] = useState(false);
  const [generatingTranslation, setGeneratingTranslation] = useState(false);
  const [chatDraft, setChatDraft] = useState<ContractChatState>({
    step: 0,
    answers: {},
    messages: [{ role: "assistant", content: contractChatQuestions[0] }],
  });

  useEffect(() => {
    localStorage.setItem("contract_ai_settings", JSON.stringify(aiSettings));
  }, [aiSettings]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    setGenerating(true);
    const form = new FormData(event.currentTarget);
    const payload: ContractDraftPayload = {
      title: String(form.get("title")),
      contract_type: String(form.get("contract_type")),
      country: String(form.get("country") || "France"),
      language: String(form.get("language") || "en"),
      party_a_name: String(form.get("party_a_name") || company.name),
      party_a_address: String(form.get("party_a_address") || ""),
      party_a_email: String(form.get("party_a_email") || ""),
      party_b_name: String(form.get("party_b_name")),
      party_b_address: String(form.get("party_b_address") || ""),
      party_b_email: String(form.get("party_b_email") || ""),
      start_date: String(form.get("start_date") || today),
      end_date: String(form.get("end_date") || ""),
      fee_amount: Number(form.get("fee_amount") || 0),
      fee_currency: String(form.get("fee_currency") || "EUR"),
      payment_terms: String(form.get("payment_terms") || ""),
      deliverables: String(form.get("deliverables")),
      special_terms: String(form.get("special_terms") || ""),
    };
    const selectedContactId = String(form.get("contact_id") || "");

    try {
      const rawGeneratedContent =
        aiSettings.provider === "ollama"
          ? await generateContractWithOllama(payload, aiSettings)
          : generateContractContent(payload);
      const generatedContent = normalizeContractTextForLanguage(rawGeneratedContent, payload.language);
      const { data, error } = await supabase
        .from("contracts")
        .insert({
          company_id: company.id,
          contact_id: selectedContactId || null,
          ...payload,
          end_date: payload.end_date || null,
          generated_content: generatedContent,
          compliance_status: "needs_review",
          compliance_notes: "Generated from local open-source template rules. Review before signature.",
          legal_provisions: {
            copyright_clause: true,
            data_protection_clause: true,
            dispute_resolution: true,
            termination_clause: true,
            liability_clause: true,
          },
          source_payload: {
            ...payload,
            ai_provider: aiSettings.provider,
            ai_model: aiSettings.provider === "ollama" ? aiSettings.model : "local-template",
          },
        })
        .select("id")
        .single();
      if (error) throw error;

      event.currentTarget.reset();
      if (data?.id) {
        void pushMentionNotifications({
          event_type: "mention",
          company_id: company.id,
          source_label: payload.title,
          source_href: "/contracts",
          source_text: [payload.deliverables, payload.special_terms, generatedContent].join("\n"),
          entity_type: "contract",
          entity_id: data.id,
          source_event_id: `contract-${data.id}-draft`,
        });
      }
      onCreated();
    } catch (error) {
      setMessage(getMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  async function updateContract(id: string, status: string) {
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    if (status === "finalized") {
      const approval = approvals.find((item) => item.kind === "contract" && item.target_id === id);
      if (!approval || approval.status !== "approved") {
        setMessage("Request and approve this contract before finalizing it.");
        return;
      }
    }
    const { error } = await supabase.from("contracts").update({ status }).eq("id", id);
    if (error) setMessage(error.message);
    else onChanged();
  }

  function openContractPreview(contract: Contract) {
    const defaultLanguage = contract.language === "fr" ? "en" : "fr";
    const branding = getContractBranding(contract);
    setPreviewContract(contract);
    setPreviewContent(contract.generated_content);
    setTranslationLanguage(defaultLanguage);
    setTranslationContent(getContractTranslation(contract, defaultLanguage));
    setContractDisplayTitle(branding.title || contract.title);
    setContractAccentColor(branding.accentColor || "#223128");
    setContractFontFamily(branding.fontFamily || "helvetica");
    setContractLogoDataUrl(branding.logoDataUrl || "");
  }

  function updateTranslationLanguage(language: string) {
    setTranslationLanguage(language);
    if (previewContract) setTranslationContent(getContractTranslation(previewContract, language));
  }

  async function savePreviewDraft() {
    if (!previewContract) return;
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const { error } = await supabase
      .from("contracts")
      .update({
        generated_content: normalizeContractTextForLanguage(previewContent, previewContract.language),
        compliance_status: "needs_review",
        compliance_notes: "Edited manually after generation. Review before signature.",
      })
      .eq("id", previewContract.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    const normalizedPreviewContent = normalizeContractTextForLanguage(previewContent, previewContract.language);
    setPreviewContent(normalizedPreviewContent);
    setPreviewContract({ ...previewContract, generated_content: normalizedPreviewContent, compliance_status: "needs_review" });
    setMessage(t.draftSaved);
    void pushMentionNotifications({
      event_type: "mention",
      company_id: company.id,
      source_label: previewContract.title,
      source_href: "/contracts",
      source_text: normalizedPreviewContent,
      entity_type: "contract",
      entity_id: previewContract.id,
      source_event_id: `contract-${previewContract.id}-draft-edit-${Date.now()}`,
    });
    onChanged();
  }

  async function generateOtherLanguage() {
    if (!previewContract) return;
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    if (translationLanguage === previewContract.language) {
      setMessage("Choose a different language from the original draft.");
      return;
    }
    if (aiSettings.provider !== "ollama" && !["en", "fr"].includes(translationLanguage)) {
      setMessage(t.useOllamaForLanguage);
      return;
    }

    setGeneratingTranslation(true);
    try {
      const sourceText = normalizeContractTextForLanguage(previewContent || previewContract.generated_content, previewContract.language);
      const generated =
        aiSettings.provider === "ollama"
          ? await generateContractTranslationWithOllama(previewContract, translationLanguage, sourceText, aiSettings)
          : generateContractContent(contractToPayload(previewContract, translationLanguage));
      const normalizedTranslation = normalizeContractTextForLanguage(generated, translationLanguage);
      const issues = translationQualityIssues(translationLanguage, sourceText, normalizedTranslation);
      if (issues.length) {
        throw new Error(`Translation quality check failed: ${issues.join(" ")}`);
      }
      const sourcePayload = buildContractSourcePayloadWithTranslation(previewContract, translationLanguage, normalizedTranslation);
      const { error } = await supabase
        .from("contracts")
        .update({
          source_payload: sourcePayload,
          compliance_status: "needs_review",
          compliance_notes: `Generated ${contractLanguageName(translationLanguage)} translation. Review both language versions before signature.`,
        })
        .eq("id", previewContract.id);
      if (error) throw error;
      const updatedContract = {
        ...previewContract,
        source_payload: sourcePayload,
        compliance_status: "needs_review",
        compliance_notes: `Generated ${contractLanguageName(translationLanguage)} translation. Review both language versions before signature.`,
      };
      setPreviewContract(updatedContract);
      setTranslationContent(normalizedTranslation);
      setMessage(t.translationGenerated);
      onChanged();
    } catch (error) {
      setMessage(getMessage(error));
    } finally {
      setGeneratingTranslation(false);
    }
  }

  async function saveTranslationDraft() {
    if (!previewContract || !translationContent.trim()) return;
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const normalizedTranslation = normalizeContractTextForLanguage(translationContent, translationLanguage);
    const issues = translationQualityIssues(translationLanguage, previewContent || previewContract.generated_content, normalizedTranslation);
    if (issues.length) {
      setMessage(`Translation quality check failed: ${issues.join(" ")}`);
      return;
    }
    const sourcePayload = buildContractSourcePayloadWithTranslation(previewContract, translationLanguage, normalizedTranslation);
    const { error } = await supabase
      .from("contracts")
      .update({
        source_payload: sourcePayload,
        compliance_status: "needs_review",
        compliance_notes: `Edited ${contractLanguageName(translationLanguage)} translation. Review both language versions before signature.`,
      })
      .eq("id", previewContract.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setTranslationContent(normalizedTranslation);
    setPreviewContract({
      ...previewContract,
      source_payload: sourcePayload,
      compliance_status: "needs_review",
      compliance_notes: `Edited ${contractLanguageName(translationLanguage)} translation. Review both language versions before signature.`,
    });
    setMessage(t.draftSaved);
    void pushMentionNotifications({
      event_type: "mention",
      company_id: company.id,
      source_label: `${previewContract.title} translation`,
      source_href: "/contracts",
      source_text: normalizedTranslation,
      entity_type: "contract_translation",
      entity_id: previewContract.id,
      source_event_id: `contract-${previewContract.id}-translation-${translationLanguage}-${Date.now()}`,
    });
    onChanged();
  }

  function updateLogo(file: File | null) {
    if (!file) {
      setContractLogoDataUrl("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setContractLogoDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function saveContractDesign() {
    if (!previewContract) return;
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const branding: ContractPdfBranding = {
      title: contractDisplayTitle.trim() || previewContract.title,
      accentColor: contractAccentColor,
      fontFamily: contractFontFamily,
      logoDataUrl: contractLogoDataUrl || undefined,
    };
    const sourcePayload = buildContractSourcePayloadWithBranding(previewContract, branding);
    const { error } = await supabase
      .from("contracts")
      .update({
        title: branding.title,
        source_payload: sourcePayload,
        compliance_status: "needs_review",
        compliance_notes: "PDF design or contract display name changed. Review before signature.",
      })
      .eq("id", previewContract.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setPreviewContract({
      ...previewContract,
      title: branding.title || previewContract.title,
      source_payload: sourcePayload,
      compliance_status: "needs_review",
      compliance_notes: "PDF design or contract display name changed. Review before signature.",
    });
    setMessage(t.designSaved);
    onChanged();
  }

  async function requestContractApproval(contract: Contract) {
    setMessage("");
    if (!canRequestApproval(currentAccess)) {
      setMessage(t.approvalRequestRestricted);
      return;
    }
    const existing = approvals.find(
      (approval) => approval.kind === "contract" && approval.target_id === contract.id && approval.status === "pending",
    );
    if (existing) {
      setMessage("Contract approval is already pending.");
      return;
    }
    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        company_id: company.id,
        kind: "contract",
        target_table: "contracts",
        target_id: contract.id,
        title: `Approve ${contract.title}`,
        details: `${contractTypeLabels[contract.contract_type] ?? contract.contract_type}. Fee ${eur(contract.fee_amount)} ${contract.fee_currency}.`,
        requested_by: currentUserId,
      })
      .select("id")
      .single();
    if (error) setMessage(error.message);
    else {
      if (data?.id) void pushHubNotificationEvent({ event_type: "approval_requested", approval_id: data.id });
      setMessage("Contract approval requested.");
      onChanged();
    }
  }

  async function sendChatAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);
    const answer = String(form.get("answer") || "").trim();
    if (!answer) return;
    let nextAnswers = inferContractFactsFromText(answer, company, chatDraft.answers);
    const requestedLanguage = inferContractLanguage(answer);
    if (requestedLanguage) nextAnswers.language = requestedLanguage;

    if (chatDraft.step === 0) {
      const contractType = inferContractType(answer);
      nextAnswers.contract_type = contractType;
      nextAnswers.title = nextAnswers.title || `${contractTypeLabels[contractType]} contract`;
    } else if (chatDraft.step === 1) {
      const parts = answer.split(/\band\b|,|\/| with /i).map((part) => part.trim()).filter(Boolean);
      nextAnswers.party_a_name = nextAnswers.party_a_name || parts[0] || company.name;
      nextAnswers.party_b_name = nextAnswers.party_b_name || parts[1] || answer;
    } else if (chatDraft.step === 2) {
      nextAnswers.deliverables = appendUniqueLines(nextAnswers.deliverables, answer);
    } else if (chatDraft.step === 3) {
      nextAnswers.special_terms = [nextAnswers.special_terms, `Dates/location/deadlines: ${answer}`].filter(Boolean).join("\n");
    } else if (chatDraft.step === 4) {
      nextAnswers.fee_amount = parseChatAmount(answer);
      nextAnswers.fee_currency = /usd/i.test(answer) ? "USD" : /gbp/i.test(answer) ? "GBP" : "EUR";
      nextAnswers.payment_terms = appendUniqueLines(nextAnswers.payment_terms, answer);
    } else {
      nextAnswers.special_terms = [nextAnswers.special_terms, answer].filter(Boolean).join("\n");
    }

    const nextStep = chatDraft.step + 1;
    const nextMessages: ContractChatMessage[] = [...chatDraft.messages, { role: "user", content: answer }];
    let assistantMessage =
      nextStep < contractChatQuestions.length
        ? contractChatQuestions[nextStep]
        : "I have enough context. Review the summary and generate the contract when ready.";
    if (aiSettings.provider === "ollama" && nextStep < 8) {
      try {
        assistantMessage =
          (await generateContractFollowUpWithOllama(nextMessages, nextAnswers, aiSettings)) || assistantMessage;
      } catch (error) {
        setMessage(getMessage(error));
      }
    }
    setChatDraft({
      step: nextStep,
      answers: nextAnswers,
      messages: [...nextMessages, { role: "assistant", content: assistantMessage }],
    });
    event.currentTarget.reset();
  }

  async function generateFromChat() {
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    setGenerating(true);
    try {
      const payload = buildPayloadFromChat(company, chatDraft.answers);
      const rawGeneratedContent =
        aiSettings.provider === "ollama"
          ? await generateContractWithOllama(payload, aiSettings)
          : generateContractContent(payload);
      const generatedContent = normalizeContractTextForLanguage(rawGeneratedContent, payload.language);
      const { data, error } = await supabase
        .from("contracts")
        .insert({
          company_id: company.id,
          ...payload,
          end_date: payload.end_date || null,
          generated_content: generatedContent,
          compliance_status: "needs_review",
          compliance_notes: "Generated from guided AI chat. Review before signature.",
          legal_provisions: {
            copyright_clause: true,
            data_protection_clause: true,
            dispute_resolution: true,
            termination_clause: true,
            liability_clause: true,
          },
          source_payload: {
            ...payload,
            chat_messages: chatDraft.messages,
            ai_provider: aiSettings.provider,
            ai_model: aiSettings.provider === "ollama" ? aiSettings.model : "local-template",
          },
        })
        .select("id")
        .single();
      if (error) throw error;
      if (data?.id) {
        void pushMentionNotifications({
          event_type: "mention",
          company_id: company.id,
          source_label: payload.title,
          source_href: "/contracts",
          source_text: [payload.deliverables, payload.special_terms, generatedContent].join("\n"),
          entity_type: "contract",
          entity_id: data.id,
          source_event_id: `contract-${data.id}-chat-draft`,
        });
      }
      setChatDraft({
        step: 0,
        answers: {},
        messages: [{ role: "assistant", content: contractChatQuestions[0] }],
      });
      onCreated();
    } catch (error) {
      setMessage(getMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="split-view">
      <section className="wide-panel">
        <div className="section-heading">
          <Music size={22} />
          <div>
            <h2>{t.generateContract}</h2>
            <p>{t.generateContractHelp}</p>
          </div>
        </div>
        {!canWrite(currentAccess) && <p className="notice">{t.writeRestricted}</p>}
        <div className="scan-card">
          <ShieldCheck size={18} />
          <div>
            <strong>{t.aiProvider}</strong>
            <span>{t.aiProviderHelp}</span>
          </div>
          <select
            value={aiSettings.provider}
            onChange={(event) => setAiSettings((current) => ({ ...current, provider: event.target.value as ContractAiSettings["provider"] }))}
          >
            <option value="template">{t.localTemplate}</option>
            <option value="ollama">Ollama AI</option>
          </select>
        </div>
        {aiSettings.provider === "ollama" && (
          <div className="form-grid two ai-settings">
            <label>
              Ollama endpoint
              <input
                value={aiSettings.endpoint}
                onChange={(event) => setAiSettings((current) => ({ ...current, endpoint: event.target.value }))}
                placeholder="http://localhost:11434"
              />
            </label>
            <label>
              Model
              <input
                value={aiSettings.model}
                onChange={(event) => setAiSettings((current) => ({ ...current, model: event.target.value }))}
                placeholder="llama3.1:8b"
              />
            </label>
            <p className="notice span-form">
              For the hosted app, configure Ollama CORS with this origin before using local AI:
              {" "}
              <code>OLLAMA_ORIGINS=https://accounts.hinnoumusic.com</code>
            </p>
          </div>
        )}
        <form className="form-grid two" onSubmit={submit}>
          <label>
            {t.contractTitle}
            <input name="title" required placeholder="Artist booking - Client SAS" />
          </label>
          <label>
            {t.contractType}
            <select name="contract_type" defaultValue="artist_booking">
              {Object.entries(contractTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.existingClient}
            <select name="contact_id" defaultValue="">
              <option value="">{t.noLinkedClient}</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.countryJurisdiction}
            <input name="country" defaultValue="France" required />
          </label>
          <label>
            {t.language}
            <select name="language" defaultValue="en">
              {Object.entries(contractLanguageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.feeAmount}
            <input name="fee_amount" type="number" min="0" step="0.01" defaultValue="0" />
          </label>
          <label>
            {t.currency}
            <input name="fee_currency" defaultValue="EUR" required />
          </label>
          <label>
            {t.startDate}
            <input name="start_date" type="date" defaultValue={today} />
          </label>
          <label>
            {t.endDate}
            <input name="end_date" type="date" />
          </label>
          <label>
            {t.yourLegalName}
            <input name="party_a_name" defaultValue={company.name} required />
          </label>
          <label>
            {t.yourAddress}
            <input name="party_a_address" placeholder="Address" />
          </label>
          <label>
            {t.yourEmail}
            <input name="party_a_email" type="email" />
          </label>
          <label>
            {t.counterpartyName}
            <input name="party_b_name" required placeholder="Client SAS" />
          </label>
          <label>
            {t.counterpartyAddress}
            <input name="party_b_address" placeholder="Client address" />
          </label>
          <label>
            {t.counterpartyEmail}
            <input name="party_b_email" type="email" />
          </label>
          <label className="span-form">
            {t.paymentTerms}
            <textarea name="payment_terms" rows={3} placeholder="30% deposit, balance due before event." />
          </label>
          <label className="span-form">
            {t.deliverables}
            <textarea name="deliverables" rows={5} required placeholder="Performance, production, equipment, dates, locations, acceptance criteria." />
          </label>
          <label className="span-form">
            {t.specialTerms}
            <textarea name="special_terms" rows={4} placeholder="Cancellation fee, travel expenses, exclusivity, insurance, union rules." />
          </label>
          <button className="primary" disabled={generating || !canWrite(currentAccess)}>
            <Plus size={17} />
            {generating ? t.generating : aiSettings.provider === "ollama" ? t.generateWithOllama : t.generateContractButton}
          </button>
        </form>
        {message && <p className="notice error">{message}</p>}
      </section>
      <section className="wide-panel">
        <div className="section-heading">
          <ShieldCheck size={22} />
          <div>
            <h2>{t.aiContractInterview}</h2>
            <p>{t.aiContractInterviewHelp}</p>
          </div>
        </div>
        <div className="chat-box">
          {chatDraft.messages.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`chat-message ${item.role}`}>
              {item.content}
            </div>
          ))}
        </div>
        <form className="form-grid" onSubmit={sendChatAnswer}>
          <label>
            {t.yourAnswer}
            <textarea name="answer" rows={3} placeholder="Tell the AI what you need..." />
          </label>
          <div className="inline-actions">
            <button className="primary" disabled={chatDraft.step >= 8 || !canWrite(currentAccess)}>
              {t.sendAnswer}
            </button>
            <button type="button" className="ghost" disabled={generating || chatDraft.step < 2 || !canWrite(currentAccess)} onClick={() => void generateFromChat()}>
              {generating ? t.generating : t.generateFromChat}
            </button>
          </div>
        </form>
        <div className="section-spacer" />
        <div className="section-heading">
          <FileText size={22} />
          <div>
            <h2>{t.contractRegister}</h2>
            <p>{t.contractRegisterHelp}</p>
          </div>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={[t.created, t.title, t.language, t.status, t.approval, t.fee, t.actions]}
          rows={contracts.map((contract) => [
            new Date(contract.created_at).toLocaleDateString("fr-FR"),
            contract.title,
            contractLanguageName(contract.language),
            contract.status,
            approvals.find((approval) => approval.kind === "contract" && approval.target_id === contract.id)?.status ?? "not requested",
            `${eur(contract.fee_amount)} ${contract.fee_currency}`,
            "",
          ])}
          renderCell={(rowIndex, cellIndex, value) => {
            const contract = contracts[rowIndex];
            if (cellIndex !== 6) return value;
            return (
              <div className="row-actions">
                <button className="small-action" title="Preview" onClick={() => openContractPreview(contract)}>
                  <FileText size={15} />
                </button>
                <button className="small-action" title={t.downloadPdf} onClick={() => void downloadContractPdf(contract, company)}>
                  <FileDown size={15} />
                </button>
                {canWrite(currentAccess) && (
                  <>
                    {canRequestApproval(currentAccess) && (
                      <button className="small-action" title="Request approval" onClick={() => void requestContractApproval(contract)}>
                        <ShieldCheck size={15} />
                      </button>
                    )}
                    <button className="small-action" title="Finalize" onClick={() => void updateContract(contract.id, "finalized")}>
                      <CheckCircle2 size={15} />
                    </button>
                  </>
                )}
              </div>
            );
          }}
        />
        {previewContract && (
          <div className="contract-preview">
            <div className="section-heading">
              <ShieldCheck size={20} />
              <div>
                <h2>{previewContract.title}</h2>
                <p>{contractTypeLabels[previewContract.contract_type] ?? previewContract.contract_type}</p>
              </div>
            </div>
            <div className="scan-review">
              <strong>{t.legalReview}</strong>
              <span>{t.legalReviewHelp}</span>
              <span>{previewContract.compliance_status}</span>
            </div>
            <div className="contract-design-tools">
              <div className="span-form">
                <strong>{t.contractDesign}</strong>
                <span>{t.contractDesignHelp}</span>
              </div>
              <label>
                {t.contractDisplayName}
                <input value={contractDisplayTitle} onChange={(event) => setContractDisplayTitle(event.target.value)} />
              </label>
              <label>
                {t.accentColor}
                <input type="color" value={contractAccentColor} onChange={(event) => setContractAccentColor(event.target.value)} />
              </label>
              <label>
                {t.font}
                <select
                  value={contractFontFamily}
                  onChange={(event) => setContractFontFamily(event.target.value as ContractPdfBranding["fontFamily"])}
                >
                  <option value="helvetica">Helvetica</option>
                  <option value="times">Times</option>
                  <option value="courier">Courier</option>
                </select>
              </label>
              <label>
                {t.logo}
                <input type="file" accept="image/png,image/jpeg" onChange={(event) => updateLogo(event.currentTarget.files?.[0] ?? null)} />
              </label>
              <button className="ghost" disabled={!canWrite(currentAccess)} onClick={() => void saveContractDesign()}>
                {t.saveDesign}
              </button>
            </div>
            <div className="contract-language-tools">
              <div>
                <strong>{t.originalLanguage}</strong>
                <span>{contractLanguageName(previewContract.language)}</span>
              </div>
              <label>
                {t.translationLanguage}
                <select value={translationLanguage} onChange={(event) => updateTranslationLanguage(event.target.value)}>
                  {Object.entries(contractLanguageLabels)
                    .filter(([value]) => value !== previewContract.language)
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <button className="ghost" disabled={generatingTranslation || !canWrite(currentAccess)} onClick={() => void generateOtherLanguage()}>
                {generatingTranslation ? t.generating : t.generateOtherLanguage}
              </button>
              <button
                className="primary"
                disabled={!translationContent.trim()}
                onClick={() => void downloadBilingualContractPdf(previewContract, company, translationLanguage, translationContent)}
              >
                <FileDown size={17} />
                {t.bilingualPdf}
              </button>
            </div>
            <div className="contract-editor-split">
              <label>
                {t.editDraft}
                <textarea
                  className="contract-editor"
                  value={previewContent}
                  onChange={(event) => setPreviewContent(event.target.value)}
                  rows={18}
                />
              </label>
              <label>
                {t.secondLanguageDraft}
                <textarea
                  className="contract-editor secondary"
                  value={translationContent}
                  onChange={(event) => setTranslationContent(event.target.value)}
                  placeholder={t.useOllamaForLanguage}
                  rows={18}
                />
              </label>
            </div>
            <div className="inline-actions">
              <button className="ghost" disabled={!canWrite(currentAccess)} onClick={() => void savePreviewDraft()}>
                {t.saveDraft}
              </button>
              <button className="ghost" disabled={!translationContent.trim() || !canWrite(currentAccess)} onClick={() => void saveTranslationDraft()}>
                {t.saveDraft}
              </button>
              <button className="primary" onClick={() => void downloadContractPdf(previewContract, company)}>
                <FileDown size={17} />
                {t.downloadPdf}
              </button>
              <button className="ghost" onClick={() => {
                setPreviewContract(null);
                setPreviewContent("");
                setTranslationContent("");
                setContractLogoDataUrl("");
              }}>
                {t.closePreview}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function GrantFundingView({
  locale,
  projects,
  currentAccess,
  onChanged,
}: {
  locale: Locale;
  projects: GrantFundingProject[];
  currentAccess: CompanyAccess;
  onChanged: () => void;
}) {
  const t = labels[locale];
  const [message, setMessage] = useState("");
  const expectedTotal = projects.reduce((sum, project) => sum + Number(project.expected_amount_high ?? 0), 0);
  const requestedTotal = projects.reduce((sum, project) => sum + Number(project.requested_amount ?? 0), 0);
  const budgetTotal = projects.reduce((sum, project) => sum + Number(project.project_budget ?? 0), 0);

  async function updateProject(project: GrantFundingProject, formData: FormData) {
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const formPatch = {
      status: String(formData.get("status") || project.status),
      project_budget: Number(formData.get("project_budget") || project.project_budget || 0),
      requested_amount: Number(formData.get("requested_amount") || 0),
      expected_amount_low: Number(formData.get("expected_amount_low") || 0),
      expected_amount_high: Number(formData.get("expected_amount_high") || 0),
      accounting_notes: String(formData.get("accounting_notes") || "") || null,
      pricing_decision: String(formData.get("pricing_decision") || "") || null,
    };

    const changedFields = (Object.keys(formPatch) as Array<keyof typeof formPatch>).filter((field) => {
      const currentValue = project[field];
      const nextValue = formPatch[field];
      return typeof nextValue === "number" ? Number(currentValue ?? 0) !== nextValue : (currentValue ?? null) !== nextValue;
    });

    if (!changedFields.length) return;

    const patch = {
      ...formPatch,
      accounting_locked_fields: Array.from(new Set([...(project.accounting_locked_fields ?? []), ...changedFields])),
      accounting_updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("grant_funding_projects").update(patch).eq("id", project.id);
    if (error) setMessage(error.message);
    else {
      void pushMentionNotifications({
        event_type: "mention",
        company_id: project.company_id,
        source_label: project.project_name,
        source_href: "/grants",
        source_text: [formPatch.accounting_notes, formPatch.pricing_decision].filter(Boolean).join("\n"),
        entity_type: "grant_funding_project",
        entity_id: project.id,
        source_event_id: `grant-${project.id}-accounting-${Date.now()}`,
      });
      onChanged();
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="metric-panel">
        <Banknote size={20} />
        <span>{t.grantFunding}</span>
        <strong>{eur(budgetTotal)}</strong>
        <small>{projects.length} synced projects</small>
      </section>
      <section className="metric-panel">
        <ShieldCheck size={20} />
        <span>{t.expectedFunding}</span>
        <strong>{eur(expectedTotal)}</strong>
        <small>best-case eligible funding</small>
      </section>
      <section className="metric-panel">
        <FileText size={20} />
        <span>{t.requestedFunding}</span>
        <strong>{eur(requestedTotal)}</strong>
        <small>application request total</small>
      </section>
      <section className="wide-panel span-two">
        <div className="section-heading">
          <Banknote size={22} />
          <div>
            <h2>{t.grantBudgetPipeline}</h2>
            <p>{t.grantBudgetPipelineHelp}</p>
          </div>
        </div>
        <p className="notice">{t.grantReadbackHint}</p>
        {message && <p className="notice error">{message}</p>}
        {!canWrite(currentAccess) && <p className="notice error">{t.writeRestricted}</p>}
        {!projects.length ? (
          <p className="empty-state">{t.noRows}</p>
        ) : (
          <div className="stack-list">
            {projects.map((project) => (
              <form
                key={project.id}
                className="record-card"
                onSubmit={(event) => {
                  event.preventDefault();
                  void updateProject(project, new FormData(event.currentTarget));
                }}
              >
                <div className="record-main">
                  <strong>{project.project_name}</strong>
                  <span>{[project.funding_body_name, project.grant_program_name].filter(Boolean).join(" - ") || project.grant_program_code || "Grant"}</span>
                  <small>{t.synced}: {new Date(project.synced_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}</small>
                </div>
                <div className="form-grid two">
                  <label>
                    {t.status}
                    <select name="status" defaultValue={project.status} disabled={!canWrite(currentAccess)}>
                      <option value="draft">Draft</option>
                      <option value="preparing">Preparing</option>
                      <option value="submitted">Submitted</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                  <label>
                    {t.total}
                    <input name="project_budget" type="number" step="0.01" defaultValue={Number(project.project_budget || 0)} disabled={!canWrite(currentAccess)} />
                  </label>
                  <label>
                    {t.requestedFunding}
                    <input name="requested_amount" type="number" step="0.01" defaultValue={Number(project.requested_amount || 0)} disabled={!canWrite(currentAccess)} />
                  </label>
                  <label>
                    {t.expectedFunding} min
                    <input name="expected_amount_low" type="number" step="0.01" defaultValue={Number(project.expected_amount_low || 0)} disabled={!canWrite(currentAccess)} />
                  </label>
                  <label>
                    {t.expectedFunding} max
                    <input name="expected_amount_high" type="number" step="0.01" defaultValue={Number(project.expected_amount_high || 0)} disabled={!canWrite(currentAccess)} />
                  </label>
                  <label>
                    {t.pricingDecision}
                    <input name="pricing_decision" defaultValue={project.pricing_decision ?? ""} placeholder="Hold spend until decision, invoice grant admin, etc." disabled={!canWrite(currentAccess)} />
                  </label>
                </div>
                <label>
                  {t.accountingNotes}
                  <textarea name="accounting_notes" defaultValue={project.accounting_notes ?? ""} rows={3} disabled={!canWrite(currentAccess)} />
                </label>
                <div className="inline-actions">
                  <button className="primary" type="submit" disabled={!canWrite(currentAccess)}>{t.save}</button>
                  {project.source_url && (
                    <a href={project.source_url} target="_blank" rel="noreferrer">
                      {t.openReleaseManager}
                    </a>
                  )}
                </div>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SettingsView({
  locale,
  company,
  members,
  customRoles,
  invites,
  approvals,
  currentRole,
  currentCustomRole,
  currentAccess,
  currentUserId,
  onChanged,
}: {
  locale: Locale;
  company: Company;
  members: CompanyMember[];
  customRoles: CompanyCustomRole[];
  invites: CompanyInvite[];
  approvals: ApprovalRequest[];
  currentRole: CompanyRole;
  currentCustomRole: CompanyCustomRole | null;
  currentAccess: CompanyAccess;
  currentUserId: string;
  onChanged: () => void;
}) {
  const [message, setMessage] = useState("");
  const t = labels[locale];

  async function updateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!currentAccess.canManageCompany) {
      setMessage(t.manageCompanyRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);
    const { error } = await supabase
      .from("companies")
      .update({
        name: String(form.get("name")),
        legal_form: String(form.get("legal_form") || "") || null,
        fiscal_regime: String(form.get("fiscal_regime")),
        vat_liability_mode: String(form.get("vat_liability_mode")),
        invoice_prefix: String(form.get("invoice_prefix")),
        siret: String(form.get("siret") || "") || null,
        vat_number: String(form.get("vat_number") || "") || null,
        base_currency: String(form.get("base_currency") || "EUR"),
      })
      .eq("id", company.id);
    if (error) setMessage(error.message);
    else {
      setMessage("Company updated.");
      onChanged();
    }
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canManageMembers(currentAccess)) {
      setMessage(t.manageMembersRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);
    const selectedRole = String(form.get("role"));
    const customRoleId = selectedRole.startsWith("custom:")
      ? selectedRole.replace("custom:", "")
      : null;
    const { error } = await supabase.from("company_invites").insert({
      company_id: company.id,
      email: String(form.get("email")),
      role: customRoleId ? "viewer" : selectedRole,
      custom_role_id: customRoleId,
      invited_by: currentUserId,
    });
    if (error) setMessage(error.message);
    else {
      event.currentTarget.reset();
      onChanged();
    }
  }

  async function createCustomRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canManageMembers(currentAccess)) {
      setMessage(t.manageMembersRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("company_roles").insert({
      company_id: company.id,
      name: String(form.get("name")),
      description: String(form.get("description") || "") || null,
      can_create_records: form.get("can_create_records") === "on",
      can_request_approval: form.get("can_request_approval") === "on",
      can_approve: form.get("can_approve") === "on",
      can_manage_members: form.get("can_manage_members") === "on",
      can_manage_company: form.get("can_manage_company") === "on",
      can_view_reports: form.get("can_view_reports") === "on",
      created_by: currentUserId,
    });
    if (error) setMessage(error.message);
    else {
      event.currentTarget.reset();
      onChanged();
    }
  }

  async function deleteCustomRole(roleId: string) {
    setMessage("");
    if (!canManageMembers(currentAccess)) {
      setMessage(t.manageMembersRestricted);
      return;
    }
    const { error } = await supabase.from("company_roles").delete().eq("id", roleId);
    if (error) setMessage(error.message);
    else onChanged();
  }

  async function createApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canRequestApproval(currentAccess)) {
      setMessage(t.approvalRequestRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title"));
    const details = String(form.get("details") || "") || null;
    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        company_id: company.id,
        kind: String(form.get("kind")),
        title,
        details,
        requested_by: currentUserId,
      })
      .select("id")
      .single();
    if (error) setMessage(error.message);
    else {
      if (data?.id) void pushHubNotificationEvent({ event_type: "approval_requested", approval_id: data.id });
      if (data?.id) {
        void pushMentionNotifications({
          event_type: "mention",
          company_id: company.id,
          source_label: title,
          source_href: "/settings",
          source_text: [title, details].filter(Boolean).join("\n"),
          entity_type: "approval_request",
          entity_id: data.id,
          source_event_id: `approval-${data.id}-manual`,
        });
      }
      event.currentTarget.reset();
      onChanged();
    }
  }

  async function decideApproval(id: string, status: "approved" | "rejected") {
    if (!canApprove(currentAccess)) {
      setMessage(t.approvalDecisionRestricted);
      return;
    }
    const { error } = await supabase.rpc("decide_approval_request", {
      target_approval_id: id,
      decision: status,
      notes: null,
    });
    if (error) setMessage(error.message);
    else onChanged();
  }

  async function copyInviteLink(invite: CompanyInvite) {
    const url = `${window.location.origin}?invite=${invite.token}`;
    await navigator.clipboard.writeText(url);
    setMessage("Invite link copied.");
  }

  function openInviteMailClient(invite: CompanyInvite) {
    const url = `${window.location.origin}?invite=${invite.token}`;
    const subject = encodeURIComponent(`Invitation to ${company.name}`);
    const body = encodeURIComponent(
      `You have been invited to collaborate on ${company.name} in Compta Solo.\n\nOpen this invite link after signing in:\n${url}\n\nRole: ${invite.role}`,
    );
    window.location.href = `mailto:${encodeURIComponent(invite.email)}?subject=${subject}&body=${body}`;
  }

  async function sendInviteEmail(invite: CompanyInvite) {
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Authentication required.");

      const response = await fetch("/api/send-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ inviteId: invite.id }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Invite email failed.");
      setMessage("Invite email sent.");
    } catch (error) {
      setMessage(`${getMessage(error)} Opening your email client instead.`);
      openInviteMailClient(invite);
    }
  }

  async function sendMeetingInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canManageMembers(currentAccess)) {
      setMessage(t.manageMembersRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);
    const attendeeEmails = String(form.get("attendee_emails") || "")
      .split(/[,;\n]/)
      .map((email) => email.trim())
      .filter(Boolean);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Authentication required.");

      const response = await fetch("/api/meeting-invites/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          company_id: company.id,
          title: String(form.get("title") || ""),
          description: String(form.get("description") || ""),
          location: String(form.get("location") || ""),
          starts_at: String(form.get("starts_at") || ""),
          ends_at: String(form.get("ends_at") || ""),
          attendee_emails: attendeeEmails,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Meeting invite failed.");
      setMessage(t.meetingInviteSent);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(getMessage(error));
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="wide-panel span-two">
        <div className="section-heading">
          <Settings size={22} />
          <div>
            <h2>{t.companyInformation}</h2>
            <p>{t.companyInformationHelp}</p>
          </div>
        </div>
        <div className="scan-review">
          <strong>{t.currentRole}: {roleDisplayName(currentRole, currentCustomRole)}</strong>
          <span>{t.allowedRoles}</span>
          {!currentAccess.canManageCompany && <span>{t.manageCompanyRestricted}</span>}
        </div>
        <form className="form-grid two" onSubmit={updateCompany}>
          <label>
            {t.companyName}
            <input name="name" defaultValue={company.name} required />
          </label>
          <label>
            {t.legalForm}
            <input name="legal_form" defaultValue={company.legal_form ?? ""} placeholder="SASU, EI, micro-entreprise" />
          </label>
          <label>
            {t.fiscalRegime}
            <select name="fiscal_regime" defaultValue={company.fiscal_regime}>
              <option value="micro_bnc">Micro-BNC</option>
              <option value="micro_bic">Micro-BIC</option>
              <option value="reel_simplifie">Reel simplifie</option>
              <option value="reel_normal">Reel normal</option>
              <option value="sasu_is">SASU IS</option>
            </select>
          </label>
          <label>
            {t.vatMode}
            <select name="vat_liability_mode" defaultValue={company.vat_liability_mode}>
              <option value="exempt">Franchise en base</option>
              <option value="vat_registered">VAT registered</option>
            </select>
          </label>
          <label>
            {t.invoicePrefix}
            <input name="invoice_prefix" defaultValue={company.invoice_prefix} required />
          </label>
          <label>
            {t.baseCurrency}
            <input name="base_currency" defaultValue={company.base_currency ?? "EUR"} required />
          </label>
          <label>
            SIRET
            <input name="siret" defaultValue={company.siret ?? ""} />
          </label>
          <label>
            {t.vatNumber}
            <input name="vat_number" defaultValue={company.vat_number ?? ""} />
          </label>
          <button className="primary" disabled={!currentAccess.canManageCompany}>{t.saveCompany}</button>
        </form>
        {message && <p className="notice">{message}</p>}
      </section>

      <section className="wide-panel span-two">
        <div className="section-heading">
          <Users size={22} />
          <div>
            <h2>{t.teamMembers}</h2>
            <p>{t.teamMembersHelp}</p>
          </div>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={[t.userId, t.role, t.defaultCompany, t.created]}
          rows={members.map((member) => {
            const customRole = customRoles.find((role) => role.id === member.custom_role_id) ?? null;
            return [
              member.user_id === currentUserId ? `${member.user_id.slice(0, 8)}... (you)` : `${member.user_id.slice(0, 8)}...`,
              roleDisplayName(member.role, customRole),
              member.is_default_company ? "Yes" : "No",
              new Date(member.created_at).toLocaleDateString("fr-FR"),
            ];
          })}
        />
      </section>

      <section className="wide-panel span-two">
        <div className="section-heading">
          <ShieldCheck size={22} />
          <div>
            <h2>{t.customRoles}</h2>
            <p>{t.customRolesHelp}</p>
          </div>
        </div>
        {!canManageMembers(currentAccess) && <p className="notice">{t.manageMembersRestricted}</p>}
        <form className="form-grid two" onSubmit={createCustomRole}>
          <label>
            {t.roleName}
            <input name="name" required placeholder="Approver, External reviewer, Sales assistant" disabled={!canManageMembers(currentAccess)} />
          </label>
          <label>
            {t.roleDescription}
            <input name="description" placeholder="What this role is for" disabled={!canManageMembers(currentAccess)} />
          </label>
          <div className="span-form checkbox-grid">
            <strong>{t.permissions}</strong>
            <label><input type="checkbox" name="can_create_records" disabled={!canManageMembers(currentAccess)} /> {t.createRecordsPermission}</label>
            <label><input type="checkbox" name="can_request_approval" disabled={!canManageMembers(currentAccess)} /> {t.requestApprovalPermission}</label>
            <label><input type="checkbox" name="can_approve" disabled={!canManageMembers(currentAccess)} /> {t.approvePermission}</label>
            <label><input type="checkbox" name="can_manage_members" disabled={!canManageMembers(currentAccess)} /> {t.manageMembersPermission}</label>
            <label><input type="checkbox" name="can_manage_company" disabled={!canManageMembers(currentAccess)} /> {t.manageCompanyPermission}</label>
            <label><input type="checkbox" name="can_view_reports" defaultChecked disabled={!canManageMembers(currentAccess)} /> {t.viewReportsPermission}</label>
          </div>
          <button className="primary" disabled={!canManageMembers(currentAccess)}>{t.createCustomRole}</button>
        </form>
        <DataTable
          emptyLabel={t.noRows}
          columns={[t.roleName, t.permissions, t.actions]}
          rows={customRoles.map((role) => [
            role.name,
            [
              role.can_create_records ? t.createRecordsPermission : "",
              role.can_request_approval ? t.requestApprovalPermission : "",
              role.can_approve ? t.approvePermission : "",
              role.can_manage_members ? t.manageMembersPermission : "",
              role.can_manage_company ? t.manageCompanyPermission : "",
              role.can_view_reports ? t.viewReportsPermission : "",
            ].filter(Boolean).join(", "),
            "",
          ])}
          renderCell={(rowIndex, cellIndex, value) => {
            if (cellIndex !== 2) return value;
            const role = customRoles[rowIndex];
            return (
              <button className="small-action danger" disabled={!canManageMembers(currentAccess)} onClick={() => void deleteCustomRole(role.id)}>
                <XCircle size={15} />
              </button>
            );
          }}
        />
      </section>

      <section className="wide-panel span-two">
        <div className="section-heading">
          <Send size={22} />
          <div>
            <h2>{t.inviteLinks}</h2>
            <p>{t.inviteLinksHelp}</p>
          </div>
        </div>
        {!canManageMembers(currentAccess) && <p className="notice">{t.manageMembersRestricted}</p>}
        <form className="form-grid two" onSubmit={createInvite}>
          <label>
            Email
            <input name="email" type="email" required placeholder="bookkeeper@example.com" disabled={!canManageMembers(currentAccess)} />
          </label>
          <label>
            {t.role}
            <select name="role" defaultValue="viewer" disabled={!canManageMembers(currentAccess)}>
              <option value="admin">Admin</option>
              <option value="bookkeeper">Bookkeeper</option>
              <option value="viewer">Viewer</option>
              {customRoles.map((role) => (
                <option key={role.id} value={`custom:${role.id}`}>
                  {role.name} (custom)
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={!canManageMembers(currentAccess)}>{t.createInviteLink}</button>
        </form>
        <DataTable
          emptyLabel={t.noRows}
          columns={["Email", t.role, t.status, t.expires, t.link]}
          rows={invites.map((invite) => {
            const customRole = customRoles.find((role) => role.id === invite.custom_role_id) ?? null;
            return [invite.email, roleDisplayName(invite.role, customRole), invite.status, new Date(invite.expires_at).toLocaleDateString("fr-FR"), ""];
          })}
          renderCell={(rowIndex, cellIndex, value) => {
            if (cellIndex !== 4) return value;
            const invite = invites[rowIndex];
            return (
              <div className="row-actions">
                <button className="text-action" onClick={() => void copyInviteLink(invite)}>
                  {t.copyLink}
                </button>
                <button className="text-action" onClick={() => void sendInviteEmail(invite)}>
                  {t.sendEmail}
                </button>
              </div>
            );
          }}
        />
      </section>

      <section className="wide-panel span-two">
        <div className="section-heading">
          <Send size={22} />
          <div>
            <h2>{t.meetingInvites}</h2>
            <p>{t.meetingInvitesHelp}</p>
          </div>
        </div>
        <p className="notice">{t.mentionsHelp}</p>
        {!canManageMembers(currentAccess) && <p className="notice">{t.manageMembersRestricted}</p>}
        <form className="form-grid two" onSubmit={sendMeetingInvite}>
          <label className="span-form">
            {t.attendees}
            <textarea name="attendee_emails" rows={2} required placeholder="teammate@example.com, guest@example.com" disabled={!canManageMembers(currentAccess)} />
          </label>
          <label>
            {t.meetingTitle}
            <input name="title" required placeholder="Accounting review" disabled={!canManageMembers(currentAccess)} />
          </label>
          <label>
            {t.meetingLocation}
            <input name="location" placeholder="Google Meet, Zoom, office" disabled={!canManageMembers(currentAccess)} />
          </label>
          <label>
            {t.startsAt}
            <input name="starts_at" type="datetime-local" required disabled={!canManageMembers(currentAccess)} />
          </label>
          <label>
            {t.endsAt}
            <input name="ends_at" type="datetime-local" required disabled={!canManageMembers(currentAccess)} />
          </label>
          <label className="span-form">
            {t.meetingDescription}
            <textarea name="description" rows={3} placeholder="Agenda, preparation notes, links" disabled={!canManageMembers(currentAccess)} />
          </label>
          <button className="primary" disabled={!canManageMembers(currentAccess)}>{t.sendMeetingInvite}</button>
        </form>
      </section>

      <section className="wide-panel span-two">
        <div className="section-heading">
          <CheckCircle2 size={22} />
          <div>
            <h2>{t.approvalFlows}</h2>
            <p>{t.approvalFlowsHelp}</p>
          </div>
        </div>
        {!canRequestApproval(currentAccess) && <p className="notice">{t.approvalRequestRestricted}</p>}
        <form className="form-grid two" onSubmit={createApproval}>
          <label>
            {t.type}
            <select name="kind" defaultValue="contract">
              <option value="contract">Contract</option>
              <option value="invoice">Invoice</option>
              <option value="expense">Expense</option>
              <option value="company_change">Company change</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            {t.title}
            <input name="title" required placeholder="Approve artist booking contract" />
          </label>
          <label className="span-form">
            {t.details}
            <textarea name="details" rows={3} />
          </label>
          <button className="primary" disabled={!canRequestApproval(currentAccess)}>{t.requestApproval}</button>
        </form>
        <DataTable
          emptyLabel={t.noRows}
          columns={[t.created, t.type, t.title, t.status, t.actions]}
          rows={approvals.map((approval) => [
            new Date(approval.created_at).toLocaleDateString("fr-FR"),
            approval.kind,
            approval.title,
            approval.status,
            "",
          ])}
          renderCell={(rowIndex, cellIndex, value) => {
            if (cellIndex !== 4) return value;
            const approval = approvals[rowIndex];
            if (approval.status !== "pending") return "Closed";
            if (!canApprove(currentAccess)) return t.approvalDecisionRestricted;
            return (
              <div className="row-actions">
                <button className="small-action" title="Approve" onClick={() => void decideApproval(approval.id, "approved")}>
                  <CheckCircle2 size={15} />
                </button>
                <button className="small-action danger" title="Reject" onClick={() => void decideApproval(approval.id, "rejected")}>
                  <XCircle size={15} />
                </button>
              </div>
            );
          }}
        />
      </section>
    </div>
  );
}

function BankView({
  locale,
  company,
  bankAccounts,
  bankTransactions,
  currentAccess,
  onCreated,
}: {
  locale: Locale;
  company: Company;
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  currentAccess: CompanyAccess;
  onCreated: () => void;
}) {
  const [message, setMessage] = useState("");
  const t = labels[locale];

  async function ensureBankAccount() {
    if (!canWrite(currentAccess)) {
      throw new Error(t.writeRestricted);
    }
    if (bankAccounts[0]) return bankAccounts[0].id;
    const { data, error } = await supabase
      .from("bank_accounts")
      .insert({
        company_id: company.id,
        provider: "manual",
        bank_name: "Manual cashbook",
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);

    try {
      const bankAccountId = await ensureBankAccount();
      const amount = Math.abs(Number(form.get("amount")));
      const direction = String(form.get("direction")) as "in" | "out";
      const label = String(form.get("label"));
      const { data, error } = await supabase
        .from("bank_transactions")
        .insert({
          company_id: company.id,
          bank_account_id: bankAccountId,
          booking_date: String(form.get("booking_date")),
          amount,
          direction,
          counterparty_name: String(form.get("counterparty_name") || "") || null,
          label,
        })
        .select("id")
        .single();
      if (error) throw error;

      event.currentTarget.reset();
      if (data?.id) {
        void pushMentionNotifications({
          event_type: "mention",
          company_id: company.id,
          source_label: "Bank transaction",
          source_href: "/bank",
          source_text: label,
          entity_type: "bank_transaction",
          entity_id: data.id,
          source_event_id: `bank-${data.id}-label`,
        });
      }
      onCreated();
    } catch (error) {
      setMessage(getMessage(error));
    }
  }

  return (
    <div className="split-view">
      <section className="wide-panel">
        <div className="section-heading">
          <Landmark size={22} />
          <div>
            <h2>{t.manualBankLine}</h2>
            <p>{t.manualBankLineHelp}</p>
          </div>
        </div>
        {!canWrite(currentAccess) && <p className="notice">{t.writeRestricted}</p>}
        <form className="form-grid two" onSubmit={submit}>
          <label>
            {t.direction}
            <select name="direction" defaultValue="out">
              <option value="in">{t.moneyIn}</option>
              <option value="out">{t.moneyOut}</option>
            </select>
          </label>
          <label>
            {t.amount}
            <input name="amount" type="number" min="0" step="0.01" required />
          </label>
          <label>
            {t.counterparty}
            <input name="counterparty_name" placeholder="Client or supplier" />
          </label>
          <label>
            {t.label}
            <input name="label" required placeholder="SEPA OVH CLOUD" />
          </label>
          <label>
            {t.bookingDate}
            <input name="booking_date" type="date" defaultValue={today} required />
          </label>
          <button className="primary" disabled={!canWrite(currentAccess)}>
            <Plus size={17} />
            {t.addBankLine}
          </button>
        </form>
        {message && <p className="notice error">{message}</p>}
      </section>
      <section className="wide-panel">
        <div className="section-heading">
          <ArrowDownUp size={22} />
          <div>
            <h2>{t.bankFeed}</h2>
            <p>{t.bankFeedHelp}</p>
          </div>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={["Date", t.direction, t.label, t.amount]}
          rows={bankTransactions.map((tx) => [
            tx.booking_date,
            tx.direction === "in" ? "In" : "Out",
            tx.label,
            eur(tx.amount),
          ])}
        />
      </section>
    </div>
  );
}

function TaxesView({
  locale,
  company,
  revenue,
  expenseTotal,
  vatCollected,
  vatDeductible,
  urssafEstimate,
  invoices,
  invoiceLines,
  expenses,
  contacts,
}: {
  locale: Locale;
  company: Company;
  revenue: number;
  expenseTotal: number;
  vatCollected: number;
  vatDeductible: number;
  urssafEstimate: number;
  invoices: Invoice[];
  invoiceLines: InvoiceLine[];
  expenses: Expense[];
  contacts: Contact[];
}) {
  const t = labels[locale];
  function exportLivreRecettes() {
    downloadCsv(
      `livre-recettes-${company.name.toLowerCase().replaceAll(" ", "-")}.csv`,
      ["date_encaissement", "client", "reference", "nature", "montant_ht", "tva", "montant_ttc", "mode_paiement", "statut"],
      invoices
        .filter((invoice) => invoice.status !== "cancelled")
        .map((invoice) => [
          invoice.paid_at ?? invoice.issue_date,
          contacts.find((contact) => contact.id === invoice.contact_id)?.display_name ?? "",
          invoice.number ?? "",
          invoiceLines
            .filter((line) => line.invoice_id === invoice.id)
            .map((line) => line.description)
            .join(" | ") || "Facture",
          invoice.subtotal_ex_vat,
          invoice.vat_total,
          invoice.total_inc_vat,
          invoice.payment_method ?? "",
          invoice.status,
        ]),
    );
  }

  function exportRegistreAchats() {
    downloadCsv(
      `registre-achats-${company.name.toLowerCase().replaceAll(" ", "-")}.csv`,
      ["date_paiement", "fournisseur", "nature", "montant_ht", "tva", "montant_ttc", "mode_paiement", "statut"],
      expenses
        .filter((expense) => expense.status !== "cancelled")
        .map((expense) => [
          expense.payment_date ?? expense.expense_date,
          expense.supplier_name,
          expense.description,
          expense.total_ex_vat,
          expense.vat_total,
          expense.total_inc_vat,
          expense.payment_method ?? "",
          expense.status,
        ]),
    );
  }

  return (
    <div className="dashboard-grid">
      <section className="metric-panel">
        <FileDown size={20} />
        <span>{t.livreRecettes}</span>
        <strong>{eur(revenue)}</strong>
        <small>Export view: livre_des_recettes_export</small>
      </section>
      <section className="metric-panel">
        <ReceiptText size={20} />
        <span>{t.registreAchats}</span>
        <strong>{eur(expenseTotal)}</strong>
        <small>Export view: registre_des_achats_export</small>
      </section>
      <section className="metric-panel">
        <ShieldCheck size={20} />
        <span>{t.vatDue}</span>
        <strong>{eur(vatCollected - vatDeductible)}</strong>
        <small>{company.vat_liability_mode === "exempt" ? "Franchise en base" : "VAT registered"}</small>
      </section>
      <section className="metric-panel">
        <Banknote size={20} />
        <span>{t.urssafEstimate}</span>
        <strong>{eur(urssafEstimate)}</strong>
        <small>{t.finalRateRules}</small>
      </section>
      <section className="wide-panel span-two">
        <div className="section-heading">
          <FileDown size={22} />
          <div>
            <h2>{t.exportStatus}</h2>
            <p>{t.exportStatusHelp}</p>
          </div>
        </div>
        <div className="export-actions">
          <button className="primary" onClick={exportLivreRecettes}>
            <FileDown size={17} />
            {t.livreRecettesCsv}
          </button>
          <button className="ghost" onClick={exportRegistreAchats}>
            <FileDown size={17} />
            {t.registreAchatsCsv}
          </button>
          <button
            className="ghost"
            onClick={() =>
              void downloadTaxAnalyticsPdf({
                company,
                revenue,
                expenseTotal,
                vatCollected,
                vatDeductible,
                urssafEstimate,
                invoices,
                expenses,
              })
            }
          >
            <FileDown size={17} />
            {t.taxAnalyticsPdf}
          </button>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={["Export", t.readyNow, t.source]}
          rows={[
            [t.livreRecettes, t.yes, "invoices + contacts"],
            [t.registreAchats, t.yes, "expenses"],
            ["VAT summary", t.partial, "journal VAT lines"],
            ["FEC", t.schemaReady, "journal_entries + journal_lines"],
            ["Factur-X", t.payloadReady, "invoices.facturx_payload"],
          ]}
        />
      </section>
    </div>
  );
}

function ReportsView({
  locale,
  company,
  profitLoss,
  balanceSheet,
  accountBalances,
}: {
  locale: Locale;
  company: Company;
  profitLoss: ProfitLossReport | null;
  balanceSheet: BalanceSheetReport | null;
  accountBalances: AccountBalance[];
}) {
  const t = labels[locale];
  const balancesByClass = (accountClass: string) =>
    accountBalances.filter((account) => account.account_class === accountClass && Math.abs(Number(account.balance)) > 0.001);

  return (
    <div className="dashboard-grid">
      <section className="metric-panel">
        <BarChart3 size={20} />
        <span>{t.revenue}</span>
        <strong>{eur(profitLoss?.revenue)}</strong>
        <small>{t.reportsRevenueHelp}</small>
      </section>
      <section className="metric-panel">
        <ReceiptText size={20} />
        <span>{t.purchases}</span>
        <strong>{eur(profitLoss?.expenses)}</strong>
        <small>{t.reportsExpensesHelp}</small>
      </section>
      <section className="metric-panel">
        <Banknote size={20} />
        <span>{t.netResult}</span>
        <strong>{eur(profitLoss?.net_result)}</strong>
        <small>{t.profitAndLoss}</small>
      </section>
      <section className="metric-panel">
        <ArrowDownUp size={20} />
        <span>{t.balanceCheck}</span>
        <strong>{eur(balanceSheet?.imbalance)}</strong>
        <small>{t.balanceCheckHelp}</small>
      </section>
      <section className="wide-panel span-two">
        <div className="section-heading">
          <ClipboardList size={22} />
          <div>
            <h2>{t.profitAndLoss}</h2>
            <p>{t.profitAndLossHelp}</p>
          </div>
        </div>
        <div className="export-actions">
          <button
            className="primary"
            onClick={() =>
              void downloadReportsPdf({
                company,
                profitLoss,
                balanceSheet,
                accountBalances,
              })
            }
          >
            <FileDown size={17} />
            {t.financialReportsPdf}
          </button>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={["Section", t.amount]}
          rows={[
            [t.revenue, eur(profitLoss?.revenue)],
            [t.purchases, eur(profitLoss?.expenses)],
            [t.netResult, eur(profitLoss?.net_result)],
          ]}
        />
      </section>
      <section className="wide-panel span-two">
        <div className="section-heading">
          <ShieldCheck size={22} />
          <div>
            <h2>{t.balanceSheet}</h2>
            <p>{t.balanceSheetHelp}</p>
          </div>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={["Section", t.amount]}
          rows={[
            [t.assets, eur(balanceSheet?.assets)],
            [t.liabilities, eur(balanceSheet?.liabilities)],
            [t.equity, eur(balanceSheet?.equity)],
            [t.currentYearResult, eur(balanceSheet?.current_year_result)],
            [t.liabilitiesEquityResult, eur(balanceSheet?.liabilities_equity)],
            [t.imbalance, eur(balanceSheet?.imbalance)],
          ]}
        />
      </section>
      <section className="wide-panel span-two">
        <div className="section-heading">
          <FileText size={22} />
          <div>
            <h2>{t.accountBalances}</h2>
            <p>{t.accountBalancesHelp}</p>
          </div>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={[t.account, t.class, t.debit, t.credit, t.balance]}
          rows={["asset", "liability", "equity", "revenue", "expense"].flatMap((accountClass) =>
            balancesByClass(accountClass).map((account) => [
              `${account.account_code} ${account.label}`,
              account.account_class,
              eur(account.debit_total),
              eur(account.credit_total),
              eur(account.balance),
            ]),
          )}
        />
      </section>
    </div>
  );
}

function EInvoicingView({
  locale,
  company,
  invoices,
  connectors,
  deliveries,
  currentAccess,
  onChanged,
}: {
  locale: Locale;
  company: Company;
  invoices: Invoice[];
  connectors: EInvoicingConnector[];
  deliveries: EInvoiceDelivery[];
  currentAccess: CompanyAccess;
  onChanged: () => void;
}) {
  const [message, setMessage] = useState("");
  const t = labels[locale];
  const sendableInvoices = invoices.filter((invoice) => invoice.status !== "cancelled");

  async function createConnector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);

    const { error } = await supabase.from("e_invoicing_connectors").insert({
      company_id: company.id,
      kind: String(form.get("kind")),
      environment: String(form.get("environment")),
      display_name: String(form.get("display_name")),
      provider_name: String(form.get("provider_name") || "") || null,
      base_url: String(form.get("base_url") || "") || null,
      routing_identifier: String(form.get("routing_identifier") || "") || null,
      is_default: true,
    });

    if (error) setMessage(error.message);
    else {
      event.currentTarget.reset();
      onChanged();
    }
  }

  async function queueDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!canWrite(currentAccess)) {
      setMessage(t.writeRestricted);
      return;
    }
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("queue_e_invoice_delivery", {
      target_invoice_id: String(form.get("invoice_id")),
      target_connector_id: String(form.get("connector_id")),
      target_format: String(form.get("format")),
    });

    if (error) setMessage(error.message);
    else {
      event.currentTarget.reset();
      onChanged();
    }
  }

  return (
    <div className="split-view">
      <section className="wide-panel">
        <div className="section-heading">
          <Send size={22} />
          <div>
            <h2>{t.pdpConnector}</h2>
            <p>{t.pdpConnectorHelp}</p>
          </div>
        </div>
        {!canWrite(currentAccess) && <p className="notice">{t.writeRestricted}</p>}
        <form className="form-grid two" onSubmit={createConnector}>
          <label>
            {t.connectorType}
            <select name="kind" defaultValue="pdp">
              <option value="pdp">PDP</option>
              <option value="chorus_pro">Chorus Pro</option>
              <option value="manual_export">Manual export</option>
            </select>
          </label>
          <label>
            {t.environment}
            <select name="environment" defaultValue="sandbox">
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </label>
          <label>
            {t.displayName}
            <input name="display_name" required placeholder="Odoo PDP sandbox" />
          </label>
          <label>
            {t.provider}
            <input name="provider_name" placeholder="Odoo, Dext, Chorus Pro" />
          </label>
          <label>
            {t.baseUrl}
            <input name="base_url" placeholder="https://api.provider.example" />
          </label>
          <label>
            {t.routingId}
            <input name="routing_identifier" placeholder="SIREN/SIRET or provider routing key" />
          </label>
          <button className="primary" disabled={!canWrite(currentAccess)}>
            <Plus size={17} />
            {t.saveConnector}
          </button>
        </form>
        {message && <p className="notice error">{message}</p>}
      </section>
      <section className="wide-panel">
        <div className="section-heading">
          <FileText size={22} />
          <div>
            <h2>{t.queueInvoice}</h2>
            <p>{t.queueInvoiceHelp}</p>
          </div>
        </div>
        <form className="form-grid two" onSubmit={queueDelivery}>
          <label>
            {t.invoice}
            <select name="invoice_id" required>
              {sendableInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.number ?? invoice.id} - {eur(invoice.total_inc_vat)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.connector}
            <select name="connector_id" required>
              {connectors.map((connector) => (
                <option key={connector.id} value={connector.id}>
                  {connector.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.format}
            <select name="format" defaultValue="factur-x">
              <option value="factur-x">Factur-X</option>
              <option value="ubl">UBL</option>
              <option value="cii">CII</option>
              <option value="manual-pdf">Manual PDF</option>
            </select>
          </label>
          <button className="primary" disabled={!connectors.length || !sendableInvoices.length || !canWrite(currentAccess)}>
            <Send size={17} />
            {t.queueDelivery}
          </button>
        </form>
        <div className="section-spacer" />
        <DataTable
          emptyLabel={t.noRows}
          columns={["Created", t.invoice, t.format, t.status, "Error"]}
          rows={deliveries.map((delivery) => [
            new Date(delivery.created_at).toLocaleDateString("fr-FR"),
            invoices.find((invoice) => invoice.id === delivery.invoice_id)?.number ?? delivery.invoice_id,
            delivery.format,
            delivery.status,
            delivery.error_message ?? "",
          ])}
        />
      </section>
      <section className="wide-panel span-two">
        <div className="section-heading">
          <ShieldCheck size={22} />
          <div>
            <h2>{t.reformReadiness}</h2>
            <p>{t.reformReadinessHelp}</p>
          </div>
        </div>
        <DataTable
          emptyLabel={t.noRows}
          columns={[t.area, t.status]}
          rows={[
            [t.receivingSupplierInvoices, t.requiredAll2026],
            [t.issuingEInvoices, t.requiredPme2027],
            [t.exchangeRoute, t.accreditedPdp],
            [t.supportedPayloadRecords, t.facturxQueue],
            [t.nextIntegrationStep, t.addPdpAdapter],
          ]}
        />
      </section>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  emptyLabel = "No rows yet.",
  renderCell,
}: {
  columns: string[];
  rows: string[][];
  emptyLabel?: string;
  renderCell?: (rowIndex: number, cellIndex: number, value: string) => React.ReactNode;
}) {
  if (!rows.length) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.join("-")}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>{renderCell ? renderCell(index, cellIndex, cell) : cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
