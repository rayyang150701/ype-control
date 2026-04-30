require('dotenv').config();
const val = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
try {
  let keyString = val;
  keyString = keyString.replace(/\\"/g, '"');
  keyString = keyString.replace(/\n/g, '\\n');
  const obj = JSON.parse(keyString);
  console.log('SUCCESS, Project ID:', obj.project_id);
} catch (e) {
  console.error('PARSE ERROR:', e.message);
}
