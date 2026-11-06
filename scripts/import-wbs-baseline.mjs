// 從「WBS基準日匯入範本.xlsx」匯入第二階工作包的基準起訖日（與名稱）。
// 預設只預覽 (dry-run)；加 --apply 才寫入；加 --lock 則在寫入後鎖定「已有基準日」的專案。
// 規則：日期留白的列略過；已鎖定基準的專案略過；基準結束日不可早於開始日。
//
//   預覽：node scripts/import-wbs-baseline.mjs <xlsx路徑>
//   寫入：node scripts/import-wbs-baseline.mjs <xlsx路徑> --apply
//   寫入並鎖定：node scripts/import-wbs-baseline.mjs <xlsx路徑> --apply --lock
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import XLSX from 'xlsx-js-style';
import fs from 'fs';
dotenv.config({ path: './.env' });

const file = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
const LOCK = process.argv.includes('--lock');
if (!file) {
  console.error('請提供 xlsx 路徑');
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const toDateStr = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    // Excel 日期以本地時間解析，取本地年月日避免時區位移
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim().replace(/\//g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : 'INVALID';
};

const wb = XLSX.readFile(file, { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets['基準日填寫'], { defval: null });

// 依專案分組：projectId -> { wbsId -> { start, end, name } }
const byProject = new Map();
const problems = [];
for (const r of rows) {
  const pid = r['專案ID(勿改)'];
  const wid = r['工作包ID(勿改)'];
  if (!pid || !wid) continue;
  const start = toDateStr(r['基準開始日']);
  const end = toDateStr(r['基準結束日']);
  const name = (r['工作包名稱(可改)'] || '').toString().trim();
  if (start === 'INVALID' || end === 'INVALID') {
    problems.push(`[${r['案號']}] ${r['工作包編號']} 日期格式錯誤`);
    continue;
  }
  if ((start && !end) || (!start && end)) {
    problems.push(`[${r['案號']}] ${r['工作包編號']} 只填了一個日期（開始/結束需成對）`);
    continue;
  }
  if (start && end && end < start) {
    problems.push(`[${r['案號']}] ${r['工作包編號']} 結束日早於開始日`);
    continue;
  }
  if (!byProject.has(pid)) byProject.set(pid, new Map());
  byProject.get(pid).set(wid, { start, end, name, code: r['工作包編號'], caseNo: r['案號'] });
}

const { data: projects, error } = await supabase.from('projects').select('id, case_number, name, on_hold_notes');
if (error) throw error;
const parse = (raw) => {
  try {
    const t = (raw || '').trim();
    return t.startsWith('{') ? JSON.parse(t) : {};
  } catch {
    return {};
  }
};

const plan = [];
for (const p of projects) {
  const edits = byProject.get(p.id);
  if (!edits) continue;
  const meta = parse(p.on_hold_notes);
  if (meta.wbsBaselineLockedAt) {
    console.log(`略過（基準已鎖定）：[${p.case_number}] ${p.name}`);
    continue;
  }
  let changedDates = 0;
  let renamed = 0;
  const items = (meta.wbsItems || []).map((it) => {
    const e = edits.get(it.id);
    if (!e) return it;
    const next = { ...it };
    if (e.start && e.end && (it.baselineStart !== e.start || it.baselineEnd !== e.end)) {
      next.baselineStart = e.start;
      next.baselineEnd = e.end;
      changedDates++;
    }
    if (e.name && e.name !== it.name) {
      next.name = e.name;
      renamed++;
    }
    return next;
  });
  if (changedDates === 0 && renamed === 0) continue;
  const withDates = items.filter((i) => i.baselineStart && i.baselineEnd).length;
  plan.push({ p, meta, items, changedDates, renamed, withDates });
}

console.log(`\n預覽：將更新 ${plan.length} 個專案`);
for (const x of plan) {
  console.log(`  [${x.p.case_number}] ${x.p.name}：基準日 ${x.changedDates} 項、改名 ${x.renamed} 項（已有基準日共 ${x.withDates}/${x.items.length}）`);
}
if (problems.length) {
  console.log(`\n⚠ 有 ${problems.length} 列資料有問題（已略過）：`);
  problems.forEach((t) => console.log('  ' + t));
}

if (!APPLY) {
  console.log('（預覽模式，未寫入。確認後加 --apply）');
} else {
  const backupFile = `./wbs-import-backup-${Date.now()}.json`;
  fs.writeFileSync(backupFile, JSON.stringify(plan.map((x) => ({ id: x.p.id, on_hold_notes: x.p.on_hold_notes })), null, 1), 'utf8');
  console.log(`\n已備份原內容至 ${backupFile}`);

  for (const x of plan) {
    const meta = { ...x.meta, wbsItems: x.items };
    if (LOCK && x.withDates > 0) {
      meta.wbsItems = x.items.map((i) => (i.baselineStart && i.baselineEnd ? i : { ...i, addedAfterLock: true }));
      meta.wbsBaselineLockedAt = new Date().toISOString();
    }
    const { error: e } = await supabase.from('projects').update({ on_hold_notes: JSON.stringify(meta) }).eq('id', x.p.id);
    console.log(e ? `  失敗 [${x.p.case_number}] ${e.message}` : `  完成 [${x.p.case_number}]${LOCK && x.withDates > 0 ? '（已鎖定）' : ''}`);
  }
}
