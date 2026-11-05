// 一次把「預設第二階 WBS 範本」套用到尚未建立工作包的專案。
// 預設只預覽 (dry-run)；加上 --apply 才會真的寫入。已有工作包的專案不會被覆蓋。
// 範本內容需與 src/lib/phase-constants.ts 的 DEFAULT_WBS_TEMPLATE 保持一致。
//
//   預覽：node scripts/apply-wbs-template.mjs
//   寫入：node scripts/apply-wbs-template.mjs --apply
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: './.env' });

const APPLY = process.argv.includes('--apply');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TEMPLATE = [
  ['design', '1.1.1', '現場勘查與規格確認（立項/簽呈）'],
  ['design', '1.1.2', '硬體架構與電控圖面設計'],
  ['design', '1.1.3', '軟體/PLC 通訊協定定義'],
  ['construction', '1.2.1', '關鍵設備採購與到貨檢驗（備料）'],
  ['construction', '1.2.2', '廠內盤體組裝與預先測試'],
  ['construction', '1.2.3', '現場硬體架設與佈線施工'],
  ['verification', '1.3.1', '單機功能與訊號測試'],
  ['verification', '1.3.2', '系統整合對接測試'],
  ['verification', '1.3.3', '試運行與異常收斂（故障排除）'],
  ['acceptance', '1.4.1', '教育訓練與操作手冊交付'],
  ['acceptance', '1.4.2', '驗收測試報告簽認與結案'],
];

const newId = () => `wbs_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
const buildItems = () =>
  TEMPLATE.map(([phaseKey, code, name]) => ({ id: newId(), phaseKey, code, name, baselineStart: null, baselineEnd: null }));

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

// 與 Gap Analysis 使用的專案一致：排除明確標記為客戶管制表版本 (isInternal === false) 者
const targets = projects.filter((p) => {
  const meta = parse(p.on_hold_notes);
  return meta.isInternal !== false && !(meta.wbsItems && meta.wbsItems.length > 0) && p.case_number;
});

console.log(`專案總數 ${projects.length}，將套用範本：${targets.length} 個（${APPLY ? '寫入模式' : '預覽模式，不會寫入'}）`);
targets.forEach((p) => console.log(`  [${p.case_number}] ${p.name}`));

if (APPLY) {
  const backup = targets.map((p) => ({ id: p.id, on_hold_notes: p.on_hold_notes }));
  const file = `./wbs-apply-backup-${Date.now()}.json`;
  fs.writeFileSync(file, JSON.stringify(backup, null, 1), 'utf8');
  console.log(`已備份原 on_hold_notes 至 ${file}`);
  for (const p of targets) {
    const meta = parse(p.on_hold_notes);
    meta.wbsItems = buildItems();
    const { error: e } = await supabase.from('projects').update({ on_hold_notes: JSON.stringify(meta) }).eq('id', p.id);
    console.log(e ? `  失敗 [${p.case_number}] ${e.message}` : `  完成 [${p.case_number}]`);
  }
}
