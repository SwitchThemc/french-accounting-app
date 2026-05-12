const HUB_CONTEXT_STORAGE_KEY = "compta-solo-hub-context";
const HUB_CONTEXT_TTL_MS = 30 * 60 * 1000;
const HUB_QUERY_KEYS = [
  "hub",
  "hub_return_url",
  "hubReturnUrl",
  "launch_target",
  "launchTarget",
  "launch_source",
  "launchSource",
  "permissions",
  "session_bootstrap",
  "sessionBootstrap",
  "handoff_payload",
  "handoffPayload",
  "hub_state",
  "hubState",
];

export const TAB_PATH_MAP = {
  dashboard: "/dashboard",
  invoices: "/invoices",
  expenses: "/expenses",
  contracts: "/contracts",
  grants: "/grants",
  bank: "/bank",
  taxes: "/taxes",
  reports: "/reports",
  einvoicing: "/einvoicing",
  settings: "/settings",
} as const;

export type HubTabId = keyof typeof TAB_PATH_MAP;

type HubContext = {
  hub: boolean;
  hubReturnUrl: string | null;
  launchTarget: string;
  permissions: string[];
  sessionBootstrap: Record<string, unknown>;
  handoffPayload: Record<string, unknown>;
  hubState: string | null;
  proofToken: string | null;
  createdAt: number;
  expiresAt: number;
};

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (_error) {
    return fallback;
  }
}

function normalizeReturnUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).toString();
  } catch (_error) {
    return null;
  }
}

function normalizePermissions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeEpochMs(value: unknown, fallback: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
}

export function normalizeLaunchTarget(value: unknown, fallback: string = TAB_PATH_MAP.dashboard) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  const normalizedKey = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  const matchingEntry = Object.entries(TAB_PATH_MAP).find(([tabId, path]) => {
    const compactTabId = tabId.toLowerCase().replace(/[^a-z]/g, "");
    const compactPath = path.toLowerCase().replace(/[^a-z]/g, "");
    return normalizedKey === compactTabId || normalizedKey === compactPath;
  });

  return matchingEntry?.[1] || fallback;
}

function normalizeHubContext(rawContext: unknown): HubContext | null {
  if (!rawContext || typeof rawContext !== "object") {
    return null;
  }

  const source = rawContext as Record<string, unknown>;
  const sessionBootstrap =
    source.session_bootstrap && typeof source.session_bootstrap === "object"
      ? (source.session_bootstrap as Record<string, unknown>)
      : source.sessionBootstrap && typeof source.sessionBootstrap === "object"
        ? (source.sessionBootstrap as Record<string, unknown>)
        : {};
  const handoffPayload =
    source.handoff_payload && typeof source.handoff_payload === "object"
      ? (source.handoff_payload as Record<string, unknown>)
      : source.handoffPayload && typeof source.handoffPayload === "object"
        ? (source.handoffPayload as Record<string, unknown>)
        : {};
  const createdAt = normalizeEpochMs(source.created_at || source.createdAt, Date.now());
  const expiresAt = normalizeEpochMs(
    source.expires_at ||
      source.expiresAt ||
      sessionBootstrap.proof_expires_at ||
      sessionBootstrap.proofExpiresAt,
    Date.now() + HUB_CONTEXT_TTL_MS,
  );

  const normalized: HubContext = {
    hub:
      source.hub === true ||
      source.hub === "1" ||
      source.hub === 1 ||
      source.launch_source === "hinnou-hub" ||
      source.launchSource === "hinnou-hub",
    hubReturnUrl: normalizeReturnUrl(
      source.hub_return_url ||
        source.hubReturnUrl ||
        source.return_url ||
        handoffPayload.return_url,
    ),
    launchTarget: normalizeLaunchTarget(
      source.launch_target ||
        source.launchTarget ||
        handoffPayload.launch_target ||
        handoffPayload.launchTarget,
    ),
    permissions: normalizePermissions(source.permissions),
    sessionBootstrap,
    handoffPayload,
    hubState:
      typeof source.hub_state === "string"
        ? source.hub_state
        : typeof source.hubState === "string"
          ? source.hubState
          : null,
    proofToken:
      typeof source.proof_token === "string" && source.proof_token.trim()
        ? source.proof_token.trim()
        : typeof sessionBootstrap.proof_token === "string" && sessionBootstrap.proof_token.trim()
          ? sessionBootstrap.proof_token.trim()
          : typeof sessionBootstrap.proofToken === "string" && sessionBootstrap.proofToken.trim()
            ? sessionBootstrap.proofToken.trim()
            : null,
    createdAt,
    expiresAt,
  };

  if (normalized.expiresAt <= Date.now()) {
    return null;
  }

  if (!normalized.hub && !normalized.hubReturnUrl && !normalized.proofToken) {
    return null;
  }

  return normalized;
}

export function readHubContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const storage = window.sessionStorage || window.localStorage;
  const normalized = normalizeHubContext(safeParseJson(storage.getItem(HUB_CONTEXT_STORAGE_KEY), null));
  if (!normalized) {
    storage.removeItem(HUB_CONTEXT_STORAGE_KEY);
  }
  return normalized;
}

export function writeHubContext(context: unknown) {
  if (typeof window === "undefined") {
    return null;
  }

  const normalized = normalizeHubContext(context);
  if (!normalized) {
    return null;
  }

  const storage = window.sessionStorage || window.localStorage;
  storage.setItem(HUB_CONTEXT_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearHubContext() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage?.removeItem(HUB_CONTEXT_STORAGE_KEY);
  window.localStorage?.removeItem(HUB_CONTEXT_STORAGE_KEY);
}

export function captureHubContextFromUrl(locationLike: Location = window.location) {
  if (!locationLike) {
    return readHubContext();
  }

  const url = new URL(locationLike.href || window.location.href);
  const hasHubQuery = HUB_QUERY_KEYS.some((key) => url.searchParams.has(key));
  if (!hasHubQuery) {
    return readHubContext();
  }

  const nextContext = normalizeHubContext({
    hub: url.searchParams.get("hub"),
    hub_return_url: url.searchParams.get("hub_return_url") || url.searchParams.get("hubReturnUrl"),
    launch_target: url.searchParams.get("launch_target") || url.searchParams.get("launchTarget"),
    launch_source: url.searchParams.get("launch_source") || url.searchParams.get("launchSource"),
    permissions: safeParseJson(url.searchParams.get("permissions"), []),
    session_bootstrap: safeParseJson(
      url.searchParams.get("session_bootstrap") || url.searchParams.get("sessionBootstrap"),
      {},
    ),
    handoff_payload: safeParseJson(
      url.searchParams.get("handoff_payload") || url.searchParams.get("handoffPayload"),
      {},
    ),
    hub_state: url.searchParams.get("hub_state") || url.searchParams.get("hubState"),
  });

  const stored = writeHubContext(nextContext);
  HUB_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  return stored;
}

export function getHubLaunchTarget(fallback = TAB_PATH_MAP.dashboard) {
  return readHubContext()?.launchTarget || fallback;
}

export function getHubReturnUrl() {
  return readHubContext()?.hubReturnUrl || null;
}

export function wasLaunchedFromHub() {
  return Boolean(readHubContext()?.hub || readHubContext()?.hubReturnUrl);
}

export function tabFromPath(pathname: string | null | undefined, fallback: HubTabId = "dashboard"): HubTabId {
  const fallbackPath = TAB_PATH_MAP[fallback] as string;
  const normalizedPath = normalizeLaunchTarget(pathname || fallbackPath, fallbackPath).toLowerCase();
  const matchingEntry = Object.entries(TAB_PATH_MAP).find(([, path]) => path.toLowerCase() === normalizedPath);
  return (matchingEntry?.[0] as HubTabId | undefined) || fallback;
}

export function pathForTab(tab: HubTabId) {
  return TAB_PATH_MAP[tab] || TAB_PATH_MAP.dashboard;
}

export function getHubLoginRedirectUrl() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const hubContext = readHubContext();
  if (hubContext || window.location.pathname.replace(/\/+$/, "") === "/hublaunch") {
    return `${window.location.origin}/hublaunch`;
  }

  return `${window.location.origin}${pathForTab(tabFromPath(window.location.pathname))}`;
}
