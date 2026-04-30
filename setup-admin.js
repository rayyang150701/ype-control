// Setup script: Create initial admin user in Firebase Auth + Firestore
const admin = require('firebase-admin');
const path = require('path');

const keyPath = path.join(__dirname, 'studio-751317964-5794f-firebase-adminsdk-fbsvc-9301837026.json');
const serviceAccount = require(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

async function setup() {
  const email = 'jamesyang@emmt.com.tw';
  const password = 'Ype2025!';  // Initial password - please change after first login
  const displayName = 'James Yang';

  try {
    // Create Firebase Auth user
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log('✅ 使用者已存在:', user.uid);
    } catch (e) {
      user = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
      });
      console.log('✅ Firebase Auth 使用者已建立:', user.uid);
    }

    // Create Firestore user doc
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email,
      displayName,
      role: 'admin',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('✅ Firestore 使用者文件已建立 (role: admin)');

    console.log('\n========================================');
    console.log('🎉 初始 Admin 帳號設定完成！');
    console.log('========================================');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role:     admin`);
    console.log('========================================');
    console.log('⚠️  請登入後盡快更改密碼！');

  } catch (error) {
    console.error('❌ 設定失敗:', error.message);
  }

  process.exit(0);
}

setup();
