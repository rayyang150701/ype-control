const admin = require('firebase-admin');
const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config();

const serviceAccount = require('../studio-751317964-5794f-firebase-adminsdk-fbsvc-9301837026.json');

// prevent double init
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function importData() {
  const wb = xlsx.readFile(path.join(__dirname, '../reference/全專案最新進度總表 (5).xlsx'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
  
  const projectsMap = {};
  
  // Find users first to get a real admin user
  const usersSnapshot = await db.collection('users').limit(1).get();
  const userId = usersSnapshot.empty ? 'demo-admin' : usersSnapshot.docs[0].id;
  
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
    
    // Attempt to parse Excel dates or string dates
    if (expectedStr) {
      if (!isNaN(expectedStr)) {
        // Excel serial date
        const excelEpoch = new Date(1899, 11, 30);
        expectedDate = new Date(excelEpoch.getTime() + parseInt(expectedStr) * 86400000);
      } else {
        expectedDate = new Date(expectedStr);
      }
    }
    if (actualStr) {
       if (!isNaN(actualStr)) {
        const excelEpoch = new Date(1899, 11, 30);
        actualDate = new Date(excelEpoch.getTime() + parseInt(actualStr) * 86400000);
      } else {
        actualDate = new Date(actualStr);
      }
    }
    
    const subProject = {
      name: subProjectName || projectName,
      owner: userId,
      expectedCompletionDate: expectedDate ? admin.firestore.Timestamp.fromDate(expectedDate) : null,
      actualCompletionDate: actualDate ? admin.firestore.Timestamp.fromDate(actualDate) : null,
      log: {
        executionSummary: String(row[8] || ''),
        nextWeekPlan: String(row[9] || ''),
        roadblocks: String(row[10] || ''),
        completionPercentage: completionPercentage,
      }
    };
    
    projectsMap[caseNumber].subProjects.push(subProject);
  }
  
  let count = 0;
  for (const caseNumber of Object.keys(projectsMap)) {
    const pData = projectsMap[caseNumber];
    const newProjectRef = db.collection('projects').doc();
    
    await newProjectRef.set({
      caseNumber: pData.caseNumber,
      name: pData.name,
      projectPurpose: pData.projectPurpose,
      currentStatusAndIssues: pData.currentStatusAndIssues,
      yiehPhuiProjectManager: pData.yiehPhuiProjectManager,
      tpmOfficeContact: pData.tpmOfficeContact,
      egigaContact: pData.egigaContact,
      status: 'active',
      createdBy: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    for (const sp of pData.subProjects) {
      const spRef = db.collection(`projects/${newProjectRef.id}/sub_projects`).doc();
      await spRef.set({
        name: sp.name,
        owner: sp.owner,
        expectedCompletionDate: sp.expectedCompletionDate,
        actualCompletionDate: sp.actualCompletionDate,
        projectId: newProjectRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      if (sp.log.executionSummary || sp.log.nextWeekPlan) {
        const logRef = db.collection(`projects/${newProjectRef.id}/sub_projects/${spRef.id}/progress_logs`).doc();
        await logRef.set({
          subProjectId: spRef.id,
          reportingPeriod: 'Excel 匯入',
          executionSummary: sp.log.executionSummary,
          nextWeekPlan: sp.log.nextWeekPlan,
          roadblocks: sp.log.roadblocks,
          completionPercentage: sp.log.completionPercentage,
          createdBy: userId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    console.log(`Imported Project: ${pData.name}`);
    count++;
  }
  console.log(`Successfully imported ${count} projects.`);
  process.exit(0);
}

importData().catch(e => {
  console.error(e);
  process.exit(1);
});
