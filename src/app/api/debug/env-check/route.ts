import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceKeyPrefix = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 12) || 'NOT_SET';
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_SERVICE_ROLE_KEY: hasServiceKey ? `SET (prefix: ${serviceKeyPrefix}...)` : 'NOT SET ❌',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: hasAnonKey ? 'SET ✅' : 'NOT SET ❌',
      NEXT_PUBLIC_SUPABASE_URL: hasUrl ? 'SET ✅' : 'NOT SET ❌',
    },
    usingKey: hasServiceKey ? 'service_role' : 'anon (fallback)',
    message: hasServiceKey
      ? '✅ SUPABASE_SERVICE_ROLE_KEY 已正確設定，刪除功能應正常運作。'
      : '❌ SUPABASE_SERVICE_ROLE_KEY 未設定！所有刪除操作會因 RLS 權限不足而靜默失敗。',
  });
}
