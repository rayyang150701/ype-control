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

let serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}';
if (serviceAccountStr.includes('\\"')) {
    serviceAccountStr = serviceAccountStr.replace(/\\"/g, '"');
}
serviceAccountStr = serviceAccountStr.replace(/\n/g, '\\n');
const serviceAccountKey = JSON.parse(serviceAccountStr);
if (serviceAccountKey.private_key) {
    serviceAccountKey.private_key = serviceAccountKey.private_key.replace(/\\n/g, '\n');
}

initializeApp({
  credential: cert(serviceAccountKey)
});

const db = getFirestore();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log("Starting migration from Firebase to Supabase...");

  // 1. Migrate Users
  console.log("Migrating Users...");
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const { error } = await supabase.from('users').upsert({
      firebase_uid: doc.id,
      email: data.email || null,
      display_name: data.displayName || null,
      role: data.role || 'viewer',
      status: data.status || 'active',
      created_at: getSafeTime(data.createdAt) ? new Date(getSafeTime(data.createdAt)).toISOString() : new Date().toISOString()
    }, { onConflict: 'firebase_uid' });
    
    if (error) console.error("Error migrating user:", doc.id, error);
  }
  console.log(`Migrated ${usersSnap.size} users.`);

  // 2. Migrate Projects
  console.log("Migrating Projects...");
  const projectsSnap = await db.collection('projects').get();
  const projectMap = new Map(); // map firebase_id to supabase id

  for (const doc of projectsSnap.docs) {
    const data = doc.data();
    const projectData = {
      firebase_id: doc.id,
      case_number: data.caseNumber,
      name: data.name,
      status: data.status || 'active',
      project_purpose: data.projectPurpose || null,
      current_status_and_issues: data.currentStatusAndIssues || null,
      yieh_phui_project_manager: data.yiehPhuiProjectManager || null,
      tpm_office_contact: data.tpmOfficeContact || null,
      egiga_contact: data.egigaContact || null,
      is_on_hold: !!data.isOnHold,
      on_hold_reason: data.onHoldReason || null,
      on_hold_start_date: data.onHoldStartDate || null,
      on_hold_end_date: data.onHoldEndDate || null,
      on_hold_notes: data.onHoldNotes || null,
      created_by: data.createdBy || null,
      created_at: getSafeTime(data.createdAt) ? new Date(getSafeTime(data.createdAt)).toISOString() : new Date().toISOString()
    };

    const { data: insertedProject, error } = await supabase.from('projects')
      .upsert(projectData, { onConflict: 'firebase_id' })
      .select('id').single();
      
    if (error) {
        console.error("Error migrating project:", doc.id, error);
    } else {
        projectMap.set(doc.id, insertedProject.id);
    }
  }
  console.log(`Migrated ${projectsSnap.size} projects.`);

  // 3. Migrate Sub-Projects
  console.log("Migrating Sub-Projects...");
  const subProjectsSnap = await db.collectionGroup('sub_projects').get();
  const subProjectMap = new Map();

  for (const doc of subProjectsSnap.docs) {
    const data = doc.data();
    const projectId = data.projectId || doc.ref.parent.parent?.id;
    
    if (!projectId || !projectMap.has(projectId)) {
        console.log(`Skipping sub-project ${doc.id} as parent project ${projectId} not found.`);
        continue;
    }

    const subProjectData = {
      firebase_id: doc.id,
      project_id: projectMap.get(projectId),
      name: data.name,
      owner: data.owner || null,
      expected_completion_date: data.expectedCompletionDate ? getSafeTime(data.expectedCompletionDate).toString() : null,
      actual_completion_date: data.actualCompletionDate ? getSafeTime(data.actualCompletionDate).toString() : null,
      is_on_hold: !!data.isOnHold,
      created_at: getSafeTime(data.createdAt) ? new Date(getSafeTime(data.createdAt)).toISOString() : new Date().toISOString()
    };

    const { data: insertedSub, error } = await supabase.from('sub_projects')
      .upsert(subProjectData, { onConflict: 'firebase_id' })
      .select('id').single();

    if (error) {
        console.error("Error migrating sub-project:", doc.id, error);
    } else {
        subProjectMap.set(doc.id, insertedSub.id);
    }
  }
  console.log(`Migrated ${subProjectsSnap.size} sub-projects.`);

  // 4. Migrate Progress Logs
  console.log("Migrating Progress Logs...");
  const logsSnap = await db.collectionGroup('progress_logs').get();
  let logCount = 0;
  
  for (const doc of logsSnap.docs) {
    const data = doc.data();
    const subProjectId = data.subProjectId || doc.ref.parent.parent?.id;

    if (!subProjectId || !subProjectMap.has(subProjectId)) {
        continue;
    }

    const logData = {
      firebase_id: doc.id,
      sub_project_id: subProjectMap.get(subProjectId),
      reporting_period: data.reportingPeriod || null,
      execution_summary: data.executionSummary || null,
      next_week_plan: data.nextWeekPlan || null,
      roadblocks: data.roadblocks || null,
      completion_percentage: data.completionPercentage || 0,
      created_by: data.createdBy || null,
      updated_at: getSafeTime(data.updatedAt) ? new Date(getSafeTime(data.updatedAt)).toISOString() : new Date().toISOString()
    };

    const { error } = await supabase.from('progress_logs')
      .upsert(logData, { onConflict: 'firebase_id' });

    if (error) {
        console.error("Error migrating log:", doc.id, error);
    } else {
        logCount++;
    }
  }
  console.log(`Migrated ${logCount} progress logs.`);

  console.log("Migration completed successfully!");
}

function getSafeTime(date) {
    if (!date) return 0;
    try {
        if (typeof date === 'object' && date !== null && 'seconds' in date) {
            return date.seconds * 1000 + Math.floor(date.nanoseconds / 1000000);
        }
        if (typeof date.toDate === 'function') {
            return date.toDate().getTime();
        }
        const time = new Date(date).getTime();
        return isNaN(time) ? 0 : time;
    } catch {
        return 0;
    }
}

migrate().catch(console.error);
