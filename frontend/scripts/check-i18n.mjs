// Checks that French and English have the same keys and that every key used in src/ exists.
//   node scripts/check-i18n.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { messages } from "../src/locales.js";

const src = new URL("../src/", import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(f)) files.push(p);
  }
})(src);

// keys built at run time: prefix -> values
const DYNAMIC = {
  "contract.": ["CDI", "CDD", "STAGE", "INTERIM", "CDI_long", "CDD_long", "STAGE_long", "INTERIM_long"],
  "leave.": ["annual", "sick", "maternity", "paternity", "unpaid"],
  "leaves.type_rule_": ["annual", "sick", "maternity", "paternity", "unpaid"],
  "emp.": ["active", "on_leave", "inactive"],
  "att.": ["present", "absent", "on_leave", "not_recorded"],
  "lstatus.": ["pending", "approved", "rejected", "cancelled"],
  "cstate.": ["active", "upcoming", "ended", "archived"],
  "pstatus.": ["draft", "validated"],
  "ostatus.": ["open", "closed"],
  "astatus.": ["received", "shortlisted", "interview", "rejected", "hired"],
  "role.": ["hr", "employee"],
  "boot.": ["runtime", "bundle", "django", "database"],
  "feature.": ["employees", "leaves", "contracts", "payroll", "attendance", "recruitment", "dashboard", "security"].flatMap((k) => [k, k + "_text"]),
  "slip.": ["bonus", "advance"],
};

const used = new Set();
for (const f of files) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(/\bt\(\s*"([a-z_]+\.[A-Za-z0-9_]+)"/g)) if (!m[1].endsWith("_")) used.add(m[1]);
}
Object.entries(DYNAMIC).forEach(([p, vals]) => vals.forEach((v) => used.add(p + v)));

let problems = 0;
const fr = new Set(Object.keys(messages.fr));
const en = new Set(Object.keys(messages.en));
for (const k of fr) if (!en.has(k)) { console.log("missing in en:", k); problems++; }
for (const k of en) if (!fr.has(k)) { console.log("missing in fr:", k); problems++; }
for (const k of used) if (!fr.has(k)) { console.log("used but undefined:", k); problems++; }
for (const k of fr) {
  const a = (messages.fr[k].match(/\{\w+\}/g) || []).sort().join();
  const b = ((messages.en[k] || "").match(/\{\w+\}/g) || []).sort().join();
  if (a !== b) { console.log("placeholders differ:", k, a, "/", b); problems++; }
}
console.log(`${used.size} keys used, ${fr.size} defined, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
