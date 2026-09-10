import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('C:/Users/JamesYang/antigravity/firebase-control/studio-751317964-5794f-firebase-adminsdk-fbsvc-9301837026.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkFirebase() {
  const [projects, users] = await Promise.all([
    db.collection('projects').get(),
    db.collection('users').get()
  ]);
  console.log('Firebase Projects count:', projects.size);
  console.log('Firebase Users count:', users.size);
  
  const subSnap = await db.collectionGroup('sub_projects').get();
  console.log('Firebase SubProjects count:', subSnap.size);

  const logSnap = await db.collectionGroup('progress_logs').get();
  console.log('Firebase ProgressLogs count:', logSnap.size);

  if (projects.size > 0) {
    const list = projects.docs.map(d => ({ id: d.id, caseNumber: d.data().caseNumber, name: d.data().name }));
    console.log('Sample Firebase Projects (first 5):', list.slice(0, 5));
  }
}

checkFirebase().catch(console.error);
