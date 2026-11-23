// @ts-nocheck
// ============================================================
// ISPAT হালচাল : "Sync now" button (Supabase Edge Function "sync-now")
// Supabase > Edge Functions > Deploy a new function > Via Editor
// Name it exactly:  sync-now   then replace all the code with this file.
// The OneDrive link is pasted in the app: Settings > Data > Live Excel link.
// No secrets needed.
// ============================================================
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";

const TEAM_EMAIL = "ispat@ispat-halchal.app";   // must match the team login

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Use POST" }, 405);
  try {
    const base = Deno.env.get("SUPABASE_URL");
    const auth = req.headers.get("Authorization") || "";
    const apikey = req.headers.get("apikey") || "";

    // 1. Only the signed-in team account may sync
    const userRes = await fetch(`${base}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
    if (!userRes.ok) return reply({ error: "Please sign in again." }, 401);
    const user = await userRes.json();
    if ((user.email || "").toLowerCase() !== TEAM_EMAIL) return reply({ error: "Not allowed." }, 403);

    // 2. The OneDrive link saved in the app (Settings > Data)
    const cfg = await fetch(`${base}/rest/v1/app_config?key=eq.excel_link&select=value`, { headers: { Authorization: auth, apikey } });
    if (!cfg.ok) return reply({ error: "Please run the latest supabase/setup.sql in Supabase SQL Editor (the settings table is missing)." }, 500);
    const cfgRows = await cfg.json();
    const share = (cfgRows[0] && cfgRows[0].value) || Deno.env.get("EXCEL_SHARE_URL") || "";
    if (!share.trim()) return reply({ error: "No OneDrive link yet. Paste it in Settings > Data > Live Excel link and tap Save." }, 400);
    let target;
    try { target = downloadUrl(share); } catch { return reply({ error: "The saved OneDrive link is not a valid web address. Copy it again from OneDrive." }, 400); }

    // 3. Download the Excel file from OneDrive
    const file = await fetch(target, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 ISPAT-Halchal-sync" } });
    const finalHost = (() => { try { return new URL(file.url).hostname; } catch { return ""; } })();
    const NEEDS_LOGIN = "This OneDrive link needs a UNDP sign-in, so the app cannot read it. In OneDrive: Share > link settings > choose \"Anyone with the link\" > Copy, then paste the new link in Settings. If \"Anyone\" cannot be chosen, UNDP blocks public links: use Upload instead.";
    if (/login\.microsoftonline\.com|login\.live\.com/i.test(finalHost) || file.status === 401 || file.status === 403) return reply({ error: NEEDS_LOGIN }, 502);
    if (file.status === 404) return reply({ error: "OneDrive says the file was not found. The link may be old or the file was moved. Copy a fresh link." }, 502);
    if (!file.ok) return reply({ error: `OneDrive answered with error ${file.status}. Try copying a fresh link.` }, 502);
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) return reply({ error: NEEDS_LOGIN }, 502);

    // 4. Read it (same rules as the app)
    let parsed;
    try { parsed = parseWorkbook(XLSX, XLSX.read(buf, { type: "array" })); }
    catch (e) { return reply({ error: "The file was downloaded but it is not the ISPAT Halchal Excel template (sheet names must not change). " + (e && e.message ? e.message : "") }, 422); }
    const { warnings, parsedAt, ...data } = parsed;
    const json = JSON.stringify(data);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

    // 5. Save (as the signed-in team user, so the database rules apply)
    const cur = await fetch(`${base}/rest/v1/dashboard?id=eq.current&select=hash`, { headers: { Authorization: auth, apikey } });
    const rows = cur.ok ? await cur.json() : [];
    const changed = !(rows[0] && rows[0].hash === hash);
    if (changed) {
      const put = await fetch(`${base}/rest/v1/dashboard`, {
        method: "POST",
        headers: { Authorization: auth, apikey, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: "current", data, hash, source: "Synced from OneDrive", updated_at: new Date().toISOString() }),
      });
      if (!put.ok) return reply({ error: `Could not save (${put.status}). Did you run supabase/setup.sql?` }, 500);
    }
    return reply({ ok: true, changed, warnings, years: data.yearList.map((y) => `${y}: ${data.years[y] ? "has data" : "empty"}`) });
  } catch (e) {
    console.error(e);
    return reply({ error: "Sync failed: " + (e && e.message ? e.message : "unknown error") }, 500);
  }
});

function downloadUrl(shareUrl) {
  const u = new URL(shareUrl.trim());
  if (/sharepoint\.com$/i.test(u.hostname)) { u.searchParams.set("download", "1"); return u.toString(); }
  if (/(^|\.)1drv\.ms$|onedrive\.live\.com$/i.test(u.hostname)) {
    const b64 = btoa(shareUrl.trim()).replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
    return `https://api.onedrive.com/v1.0/shares/u!${b64}/root/content`;
  }
  return u.toString();
}

// ---------------- Excel reader (same as docs/js/parse.js) ----------------
/*
 * ISPAT হালচাল : Excel reader
 * ---------------------------------------------------------------
 * Turns the "ISPAT_Halchal_Data_Template.xlsx" workbook into the
 * data object the app shows. The same file is used in two places:
 *   1. the browser, when someone uploads the Excel file from Settings
 *   2. the GitHub "Sync Excel" job (sync/sync.mjs)
 * so the app always reads the workbook the same way.
 *
 * Columns are found by their HEADER TEXT (row 3 of each sheet), so the
 * column order may change, but sheet names and header names must not.
 */

const SHEETS = {
  summary: 'Year_Summary', components: 'Components', ngo: 'Training_NGO', ngoab: 'Training_NGOAB',
  policy: 'Policy_Dialogue', workshop: 'Workshop', plan: 'Activity_Plan', achievements: 'Achievements', settings: 'App_Settings'
};

/* ---------- small value helpers ---------- */
const norm = (s) => String(s ?? '').split('\n')[0].replace(/\(auto\)/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
const text = (v) => (v === null || v === undefined) ? '' : String(v).trim();

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[,$%\s]/g, ''));
  return isFinite(n) ? n : null;
}
function int(v) { const n = num(v); return n === null ? null : Math.round(n); }

/** Percentages may be stored as 0.45 (Excel % format) or typed as 45. Returns 0..100. */
function pct(v) {
  if (v === null || v === undefined || v === '') return null;
  const hasSign = typeof v === 'string' && v.includes('%');
  const n = num(v);
  if (n === null) return null;
  return Math.round((hasSign || n > 1) ? n : n * 100);
}

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, sept:8, oct:9, nov:10, dec:11 };
const iso = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
};
/** Excel date (serial number, Date or text like 15-Mar-2026) -> "YYYY-MM-DD" or null */
function dateISO(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return iso(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null;                     // not a sensible date serial
    const ms = Date.UTC(1899, 11, 30) + Math.round(v) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);                  // 2026-03-15
  if (m) return iso(+m[1], +m[2] - 1, +m[3]);
  const month = (w) => { const k = w.toLowerCase(); return MONTHS[k.slice(0, 4)] ?? MONTHS[k.slice(0, 3)]; };
  m = s.match(/^(\d{1,2})[\s\-\/]+([A-Za-z]{3,9})[\s\-\/,]+(\d{4})$/); // 15-Mar-2026, 15 March 2026
  if (m && month(m[2]) !== undefined) return iso(+m[3], month(m[2]), +m[1]);
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);          // March 15, 2026
  if (m && month(m[1]) !== undefined) return iso(+m[3], month(m[1]), +m[2]);
  return null;                                                         // 03/05/2026 is ambiguous: rejected on purpose
}

/* ---------- table reader ---------- */
function rowsOf(XLSX, wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
}

/** Finds the header row (the row with a cell exactly equal to `anchor`) and returns { rows, col(name), first } */
function table(rows, anchor) {
  if (!rows) return null;
  const h = rows.findIndex((r, i) => i < 15 && (r || []).some(c => norm(c) === anchor));
  if (h < 0) return null;
  const headers = rows[h].map(norm);
  const col = (name) => headers.findIndex(x => x === name || x.startsWith(name));
  return { rows: rows.slice(h + 1), col, headerRow: h + 1 };
}

const get = (row, i) => (i < 0 || !row) ? null : row[i];

/* ---------- main ---------- */
function parseWorkbook(XLSX, wb) {
  const warnings = [];
  const missing = Object.values(SHEETS).filter(s => !wb.Sheets[s]);
  if (missing.length === Object.keys(SHEETS).length) throw new Error('This does not look like the ISPAT Halchal template: none of the expected sheets were found.');
  missing.forEach(s => warnings.push(`Sheet "${s}" was not found.`));

  const years = {};              // year -> bucket
  const bucket = (y) => (years[y] ||= { budget:null, spent:null, components:[], beneficiaries:{ male:null, female:null }, trainingPlanned:null, ngo:[], ngoab:[], policy:[], workshop:[] });
  const validYear = (y) => Number.isInteger(y) && y >= 2000 && y <= 2100;

  /* Year_Summary */
  const ys = table(rowsOf(XLSX, wb, SHEETS.summary), 'year');
  const summaryYears = new Set();
  if (ys) {
    const c = { y: ys.col('year'), b: ys.col('total budget'), s: ys.col('total expenditure'), m: ys.col('beneficiaries male'), f: ys.col('beneficiaries female'), p: ys.col('planned trainings') };
    ys.rows.forEach(r => {
      const y = int(get(r, c.y));
      if (!validYear(y)) return;
      summaryYears.add(String(y));
      const b = bucket(String(y));
      b.budget = num(get(r, c.b)); b.spent = num(get(r, c.s));
      b.beneficiaries = { male: int(get(r, c.m)), female: int(get(r, c.f)) };
      b.trainingPlanned = int(get(r, c.p));
    });
  }

  /* Components */
  const cp = table(rowsOf(XLSX, wb, SHEETS.components), 'year');
  if (cp) {
    const c = { y: cp.col('year'), no: cp.col('component no'), n: cp.col('component name'), b: cp.col('budget'), s: cp.col('expenditure') };
    cp.rows.forEach((r, i) => {
      const name = text(get(r, c.n)), budget = num(get(r, c.b)), spent = num(get(r, c.s));
      if (!name && budget === null && spent === null) return;
      const y = int(get(r, c.y));
      if (!validYear(y)) { warnings.push(`Components row ${cp.headerRow + i + 1}: year is missing, row skipped.`); return; }
      bucket(String(y)).components.push({ no: int(get(r, c.no)), name: name || 'Component', budget: budget || 0, spent: spent || 0 });
    });
    Object.values(years).forEach(b => b.components.sort((a, z) => (a.no ?? 99) - (z.no ?? 99)));
  }

  /* Trainings and events */
  function readList(sheet, key, anchor, withScores) {
    const t = table(rowsOf(XLSX, wb, sheet), anchor);
    if (!t) return;
    const c = { n: t.col(anchor), v: t.col('venue'), d: t.col(anchor === 'training name' ? 'training date' : 'date of event'), m: t.col('male'), f: t.col('female'), pre: t.col('pre assessment'), post: t.col('post assessment') };
    t.rows.forEach((r, i) => {
      const name = text(get(r, c.n));
      if (!name) return;
      const d = dateISO(get(r, c.d));
      if (!d) { warnings.push(`${sheet} row ${t.headerRow + i + 1} ("${name}"): date is missing or not a real date, row skipped.`); return; }
      const item = { name, venue: text(get(r, c.v)), date: d, male: int(get(r, c.m)) || 0, female: int(get(r, c.f)) || 0 };
      if (withScores) { item.pre = pct(get(r, c.pre)); item.post = pct(get(r, c.post)); }
      bucket(d.slice(0, 4))[key].push(item);
    });
  }
  readList(SHEETS.ngo, 'ngo', 'training name', true);
  readList(SHEETS.ngoab, 'ngoab', 'training name', true);
  readList(SHEETS.policy, 'policy', 'name of event', false);
  readList(SHEETS.workshop, 'workshop', 'name of event', false);
  Object.values(years).forEach(b => ['ngo', 'ngoab', 'policy', 'workshop'].forEach(k => b[k].sort((a, z) => a.date.localeCompare(z.date))));

  /* Activity plan */
  const activities = [];
  const ap = table(rowsOf(XLSX, wb, SHEETS.plan), 'activity / event name');
  if (ap) {
    const c = { n: ap.col('activity'), cat: ap.col('category'), d: ap.col('planned date'), s: ap.col('status') };
    const CATS = ['Training', 'Workshop', 'Policy Dialogue', 'Other'], STAT = ['Not started', 'Ongoing', 'Completed'];
    ap.rows.forEach((r, i) => {
      const name = text(get(r, c.n));
      if (!name) return;
      const d = dateISO(get(r, c.d));
      if (!d) { warnings.push(`Activity_Plan row ${ap.headerRow + i + 1} ("${name}"): planned date is missing or not a real date, row skipped.`); return; }
      const cat = CATS.find(x => x.toLowerCase() === text(get(r, c.cat)).toLowerCase()) || 'Other';
      const status = STAT.find(x => x.toLowerCase() === text(get(r, c.s)).toLowerCase()) || 'Not started';
      activities.push({ name, cat, date: d, status });
    });
  }

  /* Achievements */
  const achievements = [];
  const ac = table(rowsOf(XLSX, wb, SHEETS.achievements), 'achievement');
  if (ac) {
    const c = { t: ac.col('achievement'), cat: ac.col('category'), show: ac.col('show in app') };
    ac.rows.forEach(r => {
      const t = text(get(r, c.t));
      if (!t || text(get(r, c.show)).toLowerCase() === 'no') return;
      achievements.push({ text: t, tag: text(get(r, c.cat)), icon: pickIcon(t + ' ' + text(get(r, c.cat))) });
    });
  }

  /* App settings */
  let ngoabOnline = null, lastUpdated = null;
  const st = rowsOf(XLSX, wb, SHEETS.settings);
  (st || []).forEach(r => {
    const label = norm(get(r, 0));
    if (label.startsWith('ngoab online')) ngoabOnline = pct(get(r, 1));
    if (label.startsWith('data last updated')) lastUpdated = dateISO(get(r, 1));
  });

  /* Decide which years have data ("coming soon" when empty) */
  const allYears = [...new Set([...summaryYears, ...Object.keys(years)])].sort();
  const out = {};
  allYears.forEach(y => {
    const b = years[y];
    const has = b && (b.budget !== null || b.spent !== null || b.beneficiaries.male !== null || b.beneficiaries.female !== null ||
                      b.trainingPlanned !== null || b.components.length || b.ngo.length || b.ngoab.length || b.policy.length || b.workshop.length);
    out[y] = has ? {
      ...b, budget: b.budget || 0, spent: b.spent || 0, trainingPlanned: b.trainingPlanned || 0,
      beneficiaries: { male: b.beneficiaries.male || 0, female: b.beneficiaries.female || 0 }
    } : null;
  });

  return { years: out, yearList: allYears, activities, achievements, ngoabOnline, lastUpdated, warnings, parsedAt: new Date().toISOString() };
}

function pickIcon(s) {
  const t = s.toLowerCase();
  if (/registr/.test(t)) return 'registration';
  if (/polic|bangla|translat|law|act\b/.test(t)) return 'policy';
  if (/beneficiar|reach|people/.test(t)) return 'reached';
  if (/train|capacity|learn/.test(t)) return 'training';
  if (/digital|online|system|software/.test(t)) return 'computer';
  if (/fund|budget|financ|cost/.test(t)) return 'financing';
  if (/workshop|dialogue|meeting/.test(t)) return 'meeting';
  if (/time|faster|reduc/.test(t)) return 'time';
  return 'trophy';
}
