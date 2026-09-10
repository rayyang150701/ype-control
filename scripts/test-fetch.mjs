import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testFetch() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  console.log('Testing URL:', url);
  try {
    const res = await fetch(url + '/rest/v1/', {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch error:', err.message);
    console.error('Cause:', err.cause);
  }
}

testFetch();
