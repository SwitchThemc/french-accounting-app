import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function fileExists(path) {
  return existsSync(join(root, path));
}

function addCheck(name, ok, detail, severity = "error") {
  checks.push({ name, ok, detail, severity });
}

function includes(path, needle) {
  return read(path).includes(needle);
}

function extractObjectBody(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) return "";
  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) return "";

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(braceStart + 1, index);
  }
  return "";
}

function objectKeys(body) {
  const matches = [...body.matchAll(/^\s{4}([A-Za-z][A-Za-z0-9_]*):\s*"/gm)];
  return matches.map((match) => match[1]);
}

function duplicateKeys(keys) {
  const counts = new Map();
  keys.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}

function run() {
  const app = read("src/App.tsx");
  const pkg = JSON.parse(read("package.json"));
  const enLabels = objectKeys(extractObjectBody(app, "en: {"));
  const frLabels = objectKeys(extractObjectBody(app, "fr: {"));
  const missingFr = enLabels.filter((key) => !frLabels.includes(key));
  const missingEn = frLabels.filter((key) => !enLabels.includes(key));
  const duplicateLabelKeys = [...duplicateKeys(enLabels).map((key) => `en.${key}`), ...duplicateKeys(frLabels).map((key) => `fr.${key}`)];

  addCheck("Build script exists", Boolean(pkg.scripts?.build), "package.json has a build command.");
  addCheck("App audit tool is wired", pkg.scripts?.["audit:app"] === "node scripts/audit-app.mjs", "Run with npm run audit:app.");
  addCheck("Translation key parity", missingFr.length === 0 && missingEn.length === 0, [
    missingFr.length ? `Missing FR keys: ${missingFr.join(", ")}` : "No missing FR keys.",
    missingEn.length ? `Missing EN keys: ${missingEn.join(", ")}` : "No missing EN keys.",
  ].join(" "));
  addCheck("No duplicate label keys", duplicateLabelKeys.length === 0, duplicateLabelKeys.length ? duplicateLabelKeys.join(", ") : "No duplicate labels.");

  const pwaFiles = ["public/manifest.webmanifest", "public/sw.js", "public/icon-192.png", "public/icon-512.png", "public/apple-touch-icon.png", "public/favicon.png"];
  const missingPwaFiles = pwaFiles.filter((file) => !fileExists(file));
  addCheck("PWA assets exist", missingPwaFiles.length === 0, missingPwaFiles.length ? `Missing: ${missingPwaFiles.join(", ")}` : "Manifest, service worker, and icons are present.");
  addCheck("PWA manifest linked", includes("index.html", "manifest.webmanifest") && includes("index.html", "apple-touch-icon"), "index.html links install metadata.");

  addCheck("PDF layout helpers present", app.includes("const pdfLayout") && app.includes("contractTextForPdf") && app.includes("pdfContentWidth"), "PDF exports use shared margins, width, and text normalization.");
  addCheck("Contract PDF columns are block aligned", app.includes("contractBlocksForPdf") && app.includes("const maxBlocks = Math.max"), "Bilingual contract PDFs align translated blocks instead of raw wrapped line indexes.");
  addCheck("Contract chat preserves revenue-share facts", app.includes("inferContractFactsFromText") && app.includes("Preserve percentage values exactly"), "Contract interview extracts percentage, floor, and variable compensation facts.");
  addCheck("Contract split editor is responsive", includes("src/styles.css", "contract-editor-split") && includes("src/styles.css", "grid-template-columns: repeat(2, minmax(0, 1fr))"), "Original and translated contract drafts render as a split editor on wide screens.");
  addCheck("Contract language options avoid unsupported PDF scripts", !app.includes('ar: "Arabic"') && !app.includes('return "ar"'), "Language picker avoids RTL scripts until a Unicode PDF font pipeline exists.");
  addCheck("French contract type labels are localized", app.includes("contractTypeLabelForLanguage") && app.includes("contrat de prestation de services"), "French drafts do not insert English contract type labels in the parties clause.");
  addCheck("Heavy dependency chunks configured", includes("vite.config.ts", "manualChunks") && includes("vite.config.ts", "pdf-vendor") && includes("vite.config.ts", "ocr-vendor"), "Vite separates large PDF/OCR dependencies from the main app bundle.");
  addCheck("Approval-request permission split", app.includes("canRequestApproval") && includes("supabase/migrations/20260427100000_permission_gap_fixes.sql", "request_approval"), "Request approval is separate from full write access.");
  addCheck("Report visibility permission enforced", app.includes("reportsRestricted") && includes("supabase/migrations/20260427100000_permission_gap_fixes.sql", "view_reports"), "Reports have UI and database permission checks.");
  addCheck("Invite form cannot grant owner", !app.includes('<option value="owner">'), "Owner membership should be created by company bootstrap, not invite links.");

  const appSize = statSync(join(root, "src/App.tsx")).size;
  addCheck("App.tsx size is manageable", appSize < 180_000, `src/App.tsx is ${(appSize / 1024).toFixed(1)} KB. Consider splitting features into modules.`, "warning");

  const secretPattern = /(service_role|sbp_|cfat_|cfut_|Ikkythenewf13)/;
  const publicSource = ["src/App.tsx", "src/supabase.ts", "src/hubSession.ts", "public/hinnou-hub-contract.json", "README.md"].map(read).join("\n");
  addCheck("No obvious secrets in public/client files", !secretPattern.test(publicSource), "Client/public files should not contain service keys or platform tokens.");

  if (fileExists("public/hinnou-hub-contract.json")) {
    try {
      const contract = JSON.parse(read("public/hinnou-hub-contract.json"));
      addCheck("Hub contract JSON is valid", true, "public/hinnou-hub-contract.json parses.");
      addCheck("Hub notification contract is declared", Boolean(contract.notification_push_url && contract.notification_event_contract), "Contract exposes notification_push_url and event schema metadata.");
      addCheck("Hub notification signing metadata is declared", Boolean(
        contract.notification_event_contract?.signed === true &&
        contract.notification_event_contract?.signature_algorithm &&
        contract.notification_event_contract?.signature_header &&
        contract.notification_event_contract?.signature_key_id
      ), "Contract exposes non-secret signature algorithm, header, and key id.");
      addCheck("Hub notification event types cover collaboration", Boolean(
        contract.notification_event_contract?.supported_types?.includes("approval_requested") &&
        contract.notification_event_contract?.supported_types?.includes("mention") &&
        contract.notification_event_contract?.supported_types?.includes("meeting_invite")
      ), "Contract declares approval, mention, and meeting invite events.");
    } catch (error) {
      addCheck("Hub contract JSON is valid", false, error.message);
    }
  }

  addCheck("Hub notification push endpoint exists", fileExists("functions/api/hub/notifications/push.ts") && includes("functions/api/hub/notifications/push.ts", "pushHubNotification"), "Approval events can be normalized and forwarded to the hub.");
  addCheck("Mention notification support exists", includes("functions/api/hub/notifications/push.ts", "notifyMentionedUsers") && includes("src/App.tsx", "pushMentionNotifications"), "@mention text can produce hub notifications.");
  addCheck("Meeting invite endpoint exists", fileExists("functions/api/meeting-invites/send.ts") && includes("functions/api/meeting-invites/send.ts", "text/calendar") && includes("src/App.tsx", "sendMeetingInvite"), "Meeting invites can be emailed with calendar attachments and hub notifications.");
  addCheck("Summary exposes recent notifications", includes("functions/api/hub/summary.ts", "recent_notifications"), "Summary feed includes inbox/fallback notification data.");
  addCheck("Supabase keep-alive is configured", fileExists("supabase/migrations/20260512123000_keepalive_heartbeat.sql") && fileExists("workers/supabase-keepalive/wrangler.jsonc") && includes("workers/supabase-keepalive/src/index.ts", "keepalive_ping"), "Daily Cloudflare Worker heartbeat can prevent Free project inactivity pauses.");

  const errors = checks.filter((check) => !check.ok && check.severity === "error");
  const warnings = checks.filter((check) => !check.ok && check.severity === "warning");

  console.log("# Compta Solo app audit");
  console.log("");
  checks.forEach((check) => {
    const status = check.ok ? "PASS" : check.severity === "warning" ? "WARN" : "FAIL";
    console.log(`- ${status}: ${check.name} - ${check.detail}`);
  });
  console.log("");
  console.log(`Summary: ${checks.length - errors.length - warnings.length}/${checks.length} passing, ${warnings.length} warning(s), ${errors.length} error(s).`);

  if (errors.length) {
    process.exitCode = 1;
  }
}

run();
