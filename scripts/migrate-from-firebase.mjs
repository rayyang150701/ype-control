import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const certPath = 'C:/Users/JamesYang/antigravity/firebase-control/studio-751317964-5794f-firebase-adminsdk-fbsvc-9301837026.json';
const serviceAccount = JSON.parse(fs.readFileSync(certPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ 請確認 .env 中的 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY 是否已填寫！");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getSafeDate(dateVal) {
  if (!dateVal) return null;
  try {
    if (typeof dateVal === 'object' && 'seconds' in dateVal) {
      return new Date(dateVal.seconds * 1000 + Math.floor(dateVal.nanoseconds / 1000000)).toISOString();
    }
    if (typeof dateVal.toDate === 'function') {
      return dateVal.toDate().toISOString();
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

async function runMigration() {
  console.log("🚀 開始將 Firebase 歷史資料完整遷移至 Supabase...");

  // 1. 遷移 Users
  console.log("1️⃣ 遷移成員資料 (Users)...");
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const { error } = await supabase.from('users').upsert({
      uid: doc.id,
      email: data.email || '',
      display_name: data.displayName || '',
      role: data.role || 'viewer',
      status: data.status || 'active',
      created_at: getSafeDate(data.createdAt) || new Date().toISOString()
    }, { onConflict: 'uid' });

    if (error) {
      console.error(`❌ 成員 ${doc.id} 寫入失敗:`, error.message);
    }
  }
  console.log(`✅ 已成功遷移 ${usersSnap.size} 位成員！`);

  // 2. 遷移 Projects
  console.log("2️⃣ 遷移主專案 (Projects)...");
  const projectsSnap = await db.collection('projects').get();
  const projectMap = new Map(); // firebase_id -> supabase_id

  for (const doc of projectsSnap.docs) {
    const data = doc.data();
    const projectPayload = {
      firebase_id: doc.id,
      case_number: String(data.caseNumber || '').trim(),
      name: data.name || '',
      status: data.status || 'active',
      project_purpose: data.projectPurpose || '',
      current_status_and_issues: data.currentStatusAndIssues || '',
      yieh_phui_project_manager: data.yiehPhuiProjectManager || '',
      tpm_office_contact: data.tpmOfficeContact || '',
      egiga_contact: data.egigaContact || '',
      is_on_hold: !!data.isOnHold,
      on_hold_reason: data.onHoldReason || '',
      on_hold_start_date: getSafeDate(data.onHoldStartDate),
      on_hold_end_date: getSafeDate(data.onHoldEndDate),
      on_hold_notes: data.onHoldNotes || '',
      created_by: data.createdBy || null,
      created_at: getSafeDate(data.createdAt) || new Date().toISOString()
    };

    const { data: insertedProject, error } = await supabase
      .from('projects')
      .upsert(projectPayload, { onConflict: 'firebase_id' })
      .select('id')
      .single();

    if (error) {
      console.error(`❌ 主專案 ${data.name} 寫入失敗:`, error.message);
    } else if (insertedProject) {
      projectMap.set(doc.id, insertedProject.id);
    }
  }
  console.log(`✅ 已成功遷移 ${projectMap.size} 個主專案！`);

  // 3. 遷移 Sub-Projects
  console.log("3️⃣ 遷移子專案 (Sub-Projects)...");
  const subSnap = await db.collectionGroup('sub_projects').get();
  const subMap = new Map(); // firebase_id -> supabase_id

  for (const doc of subSnap.docs) {
    const data = doc.data();
    const fbProjectId = data.projectId || doc.ref.parent.parent?.id;
    const supabaseProjectId = projectMap.get(fbProjectId);

    if (!supabaseProjectId) {
      console.warn(`⚠️ 跳過子專案 ${data.name}，找不到對應主專案 ID: ${fbProjectId}`);
      continue;
    }

    const subPayload = {
      firebase_id: doc.id,
      project_id: supabaseProjectId,
      name: data.name || '',
      owner: data.owner || null,
      expected_completion_date: getSafeDate(data.expectedCompletionDate),
      actual_completion_date: getSafeDate(data.actualCompletionDate),
      is_on_hold: !!data.isOnHold,
      created_at: getSafeDate(data.createdAt) || new Date().toISOString()
    };

    const { data: insertedSub, error } = await supabase
      .from('sub_projects')
      .upsert(subPayload, { onConflict: 'firebase_id' })
      .select('id')
      .single();

    if (error) {
      console.error(`❌ 子專案 ${data.name} 寫入失敗:`, error.message);
    } else if (insertedSub) {
      subMap.set(doc.id, insertedSub.id);
    }
  }
  console.log(`✅ 已成功遷移 ${subMap.size} 個子專案！`);

  // 4. 遷移 Progress Logs
  console.log("4️⃣ 遷移歷史週報 (Progress Logs)...");
  const logsSnap = await db.collectionGroup('progress_logs').get();
  let logCount = 0;

  for (const doc of logsSnap.docs) {
    const data = doc.data();
    const fbSubId = data.subProjectId || doc.ref.parent.parent?.id;
    const supabaseSubId = subMap.get(fbSubId);

    if (!supabaseSubId) {
      continue;
    }

    const logPayload = {
      firebase_id: doc.id,
      sub_project_id: supabaseSubId,
      reporting_period: data.reportingPeriod || '',
      execution_summary: data.executionSummary || '',
      next_week_plan: data.nextWeekPlan || '',
      roadblocks: data.roadblocks || '',
      completion_percentage: Number(data.completionPercentage) || 0,
      created_by: data.createdBy || null,
      updated_at: getSafeDate(data.updatedAt) || new Date().toISOString()
    };

    const { error } = await supabase
      .from('progress_logs')
      .upsert(logPayload, { onConflict: 'firebase_id' });

    if (error) {
      console.error(`❌ 週報 ${doc.id} 寫入失敗:`, error.message);
    } else {
      logCount++;
    }
  }
  console.log(`✅ 已成功遷移 ${logCount} 筆歷史週報！`);
  console.log("🎉 全部 Firebase 資料已完整成功注入 Supabase！");
}

runMigration().catch(console.error);
