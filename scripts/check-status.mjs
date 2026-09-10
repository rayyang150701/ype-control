import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const [users, projects, subProjects, logs] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('sub_projects').select('*', { count: 'exact', head: true }),
    supabase.from('progress_logs').select('*', { count: 'exact', head: true })
  ]);
  console.log('Supabase Counts:');
  console.log('Users:', users.count, users.error?.message || 'OK');
  console.log('Projects:', projects.count, projects.error?.message || 'OK');
  console.log('SubProjects:', subProjects.count, subProjects.error?.message || 'OK');
  console.log('ProgressLogs:', logs.count, logs.error?.message || 'OK');

  if (projects.count > 0) {
    const { data: sample } = await supabase.from('projects').select('case_number, name').order('case_number', { ascending: false }).limit(5);
    console.log('Sample projects in Supabase:', sample);
  }
}

check().catch(console.error);
