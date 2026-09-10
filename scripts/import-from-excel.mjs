import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ 請確認 .env 中的 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY 是否已填寫！");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importExcel(filePath) {
  const excelPath = filePath || 'C:/Users/JamesYang/antigravity/firebase-control/reference/全專案最新進度總表 (5).xlsx';
  console.log(`📖 讀取 Excel 總表: ${excelPath}`);

  const wb = xlsx.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

  // 取得現有成員，預設給第一位管理者
  const { data: existingUsers } = await supabase.from('users').select('uid').limit(1);
  const defaultUserId = existingUsers && existingUsers.length > 0 ? existingUsers[0].uid : 'admin-user';

  const projectsMap = {};

  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;

    const caseNumber = String(row[0] || '').trim();
    const projectName = String(row[1] || '').trim();
    if (!caseNumber) continue;

    if (!projectsMap[caseNumber]) {
      projectsMap[caseNumber] = {
        caseNumber,
        name: projectName,
        projectPurpose: String(row[2] || ''),
        currentStatusAndIssues: String(row[3] || ''),
        yiehPhuiProjectManager: String(row[4] || ''),
        tpmOfficeContact: String(row[5] || ''),
        egigaContact: String(row[6] || ''),
        subProjects: []
      };
    }

    const subProjectName = String(row[7] || '');
    let completionStr = String(row[11] || '').replace('%', '').trim();
    let completionPercentage = parseInt(completionStr);
    if (isNaN(completionPercentage)) completionPercentage = 0;

    const expectedStr = String(row[12] || '').trim();
    const actualStr = String(row[13] || '').trim();

    let expectedDate = null;
    let actualDate = null;

    if (expectedStr) {
      if (!isNaN(expectedStr)) {
        const excelEpoch = new Date(1899, 11, 30);
        expectedDate = new Date(excelEpoch.getTime() + parseInt(expectedStr) * 86400000).toISOString();
      } else {
        const d = new Date(expectedStr);
        if (!isNaN(d.getTime())) expectedDate = d.toISOString();
      }
    }

    if (actualStr) {
      if (!isNaN(actualStr)) {
        const excelEpoch = new Date(1899, 11, 30);
        actualDate = new Date(excelEpoch.getTime() + parseInt(actualStr) * 86400000).toISOString();
      } else {
        const d = new Date(actualStr);
        if (!isNaN(d.getTime())) actualDate = d.toISOString();
      }
    }

    projectsMap[caseNumber].subProjects.push({
      name: subProjectName || projectName,
      owner: defaultUserId,
      expectedCompletionDate: expectedDate,
      actualCompletionDate: actualDate,
      log: {
        reportingPeriod: 'Excel 匯入',
        executionSummary: String(row[8] || ''),
        nextWeekPlan: String(row[9] || ''),
        roadblocks: String(row[10] || ''),
        completionPercentage,
      }
    });
  }

  console.log(`📊 解析完成，準備寫入 ${Object.keys(projectsMap).length} 個專案...`);

  for (const caseNumber of Object.keys(projectsMap)) {
    const pData = projectsMap[caseNumber];

    // 檢查或插入主專案
    let projectId;
    const { data: existingProj } = await supabase
      .from('projects')
      .select('id')
      .eq('case_number', caseNumber)
      .maybeSingle();

    if (existingProj) {
      projectId = existingProj.id;
    } else {
      const { data: newProj, error: projErr } = await supabase.from('projects').insert({
        case_number: pData.caseNumber,
        name: pData.name,
        project_purpose: pData.projectPurpose,
        current_status_and_issues: pData.currentStatusAndIssues,
        yieh_phui_project_manager: pData.yiehPhuiProjectManager,
        tpm_office_contact: pData.tpmOfficeContact,
        egiga_contact: pData.egigaContact,
        status: 'active',
        created_by: defaultUserId,
      }).select('id').single();

      if (projErr) {
        console.error(`❌ 主專案 ${pData.name} 寫入失敗:`, projErr.message);
        continue;
      }
      projectId = newProj.id;
    }

    // 處理子專案
    for (const sp of pData.subProjects) {
      const { data: newSub, error: subErr } = await supabase.from('sub_projects').insert({
        project_id: projectId,
        name: sp.name,
        owner: sp.owner,
        expected_completion_date: sp.expectedCompletionDate,
        actual_completion_date: sp.actualCompletionDate,
        is_on_hold: false,
      }).select('id').single();

      if (subErr) {
        console.error(`❌ 子專案 ${sp.name} 寫入失敗:`, subErr.message);
        continue;
      }

      if (sp.log.executionSummary || sp.log.nextWeekPlan) {
        await supabase.from('progress_logs').insert({
          sub_project_id: newSub.id,
          reporting_period: sp.log.reportingPeriod,
          execution_summary: sp.log.executionSummary,
          next_week_plan: sp.log.nextWeekPlan,
          roadblocks: sp.log.roadblocks,
          completion_percentage: sp.log.completionPercentage,
          created_by: defaultUserId,
        });
      }
    }
  }

  console.log("🎉 Excel 總表資料匯入完成！");
}

const targetFile = process.argv[2];
importExcel(targetFile).catch(console.error);
