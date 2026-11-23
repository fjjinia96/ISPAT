/*
 * ISPAT হালচাল : Excel sync job (OPTIONAL)
 * ---------------------------------------------------------------
 * Runs on GitHub Actions (github-actions/sync-excel.yml).
 * 1. Downloads the Excel file from its OneDrive "Anyone with the link" share link
 * 2. Reads it with the same reader the app uses (docs/js/parse.js)
 * 3. Saves it to Supabase, only when something changed
 *
 * GitHub secrets needed:
 *   EXCEL_SHARE_URL      the OneDrive share link of the Excel file
 *   SUPABASE_URL         https://xxxx.supabase.co
 *   SUPABASE_SECRET_KEY  Supabase secret key (sb_secret_...) or the legacy service_role key
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../docs/js/parse.js';

const DRY = process.argv.includes('--dry-run');

export function downloadUrl(shareUrl) {
  const u = new URL(shareUrl.trim());
  if (/sharepoint\.com$/i.test(u.hostname)) { u.searchParams.set('download', '1'); return u.toString(); }
  if (/(^|\.)1drv\.ms$|onedrive\.live\.com$/i.test(u.hostname)) {
    const b64 = Buffer.from(shareUrl.trim()).toString('base64').replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
    return `https://api.onedrive.com/v1.0/shares/u!${b64}/root/content`;
  }
  return u.toString();
}

async function getWorkbookBuffer() {
  if (process.env.EXCEL_FILE) return readFile(process.env.EXCEL_FILE);
  const share = process.env.EXCEL_SHARE_URL;
  if (!share) throw new Error('EXCEL_SHARE_URL secret is missing.');
  const res = await fetch(downloadUrl(share), { redirect: 'follow', headers: { 'User-Agent': 'ispat-halchal-sync' } });
  if (!res.ok) throw new Error(`Download failed with HTTP ${res.status}. Check that the share link is "Anyone with the link can view".`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 2).toString() !== 'PK') throw new Error('The link returned a web page, not an Excel file. Use an "Anyone with the link" link to the .xlsx file.');
  return buf;
}

function supa(path, init = {}) {
  const base = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!base || !key) throw new Error('SUPABASE_URL or SUPABASE_SECRET_KEY secret is missing.');
  const headers = { apikey: key, 'Content-Type': 'application/json', ...(init.headers || {}) };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;   // legacy service_role key is a JWT
  return fetch(`${base}/rest/v1/${path}`, { ...init, headers });
}

async function main() {
  const wb = XLSX.read(await getWorkbookBuffer(), { type: 'buffer' });
  const { warnings, parsedAt, ...data } = parseWorkbook(XLSX, wb);
  console.log(`Read workbook. Years ${data.yearList.map(y => `${y}:${data.years[y] ? 'data' : 'empty'}`).join(' ')}. Activities ${data.activities.length}. Achievements ${data.achievements.length}.`);
  warnings.forEach(w => console.log(`::warning::${w}`));

  const json = JSON.stringify(data);
  const hash = createHash('sha256').update(json).digest('hex');
  if (DRY) { console.log('Dry run: nothing saved.'); return; }

  const cur = await supa('dashboard?id=eq.current&select=hash');
  if (!cur.ok) throw new Error(`Supabase said ${cur.status}: ${(await cur.text()).slice(0, 200)}. Did you run supabase/setup.sql?`);
  const rows = await cur.json();
  if (rows[0] && rows[0].hash === hash) { console.log('No changes in the Excel file. Nothing to update.'); return; }

  const put = await supa('dashboard', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 'current', data, hash, source: 'Synced from OneDrive', updated_at: new Date().toISOString() })
  });
  if (!put.ok) throw new Error(`Saving failed (${put.status}): ${(await put.text()).slice(0, 200)}`);
  console.log('Saved. The app now shows the new data.');
}

if (process.argv[1] && process.argv[1].endsWith('sync.mjs')) {
  main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1); });
}
