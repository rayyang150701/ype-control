import { NextRequest, NextResponse } from 'next/server';
import { createClient as getSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('id');
  
  if (!projectId) {
    return NextResponse.json({ error: '請提供 ?id=專案ID' });
  }

  const supabase = getSupabaseClient();
  const results: any = { projectId, steps: [] };

  try {
    // Step 0: 確認專案存在
    const { data: project, error: findErr } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();
    results.steps.push({ step: '0-find', project, error: findErr?.message || null });

    if (!project) {
      results.conclusion = '專案不存在或無法查詢';
      return NextResponse.json(results);
    }

    // Step 1: 嘗試刪除 action_items
    const { data: aiData, error: aiErr } = await supabase
      .from('project_action_items')
      .delete()
      .eq('project_id', projectId)
      .select();
    results.steps.push({ step: '1-action_items', deletedCount: aiData?.length || 0, error: aiErr?.message || null });

    // Step 2: 查詢子專案
    const { data: subs, error: subFindErr } = await supabase
      .from('sub_projects')
      .select('id')
      .eq('project_id', projectId);
    results.steps.push({ step: '2-find_subs', subCount: subs?.length || 0, error: subFindErr?.message || null });

    if (subs && subs.length > 0) {
      const subIds = subs.map(s => s.id);
      
      // Step 2b: 刪除週報
      const { data: logsData, error: logsErr } = await supabase
        .from('progress_logs')
        .delete()
        .in('sub_project_id', subIds)
        .select();
      results.steps.push({ step: '2b-progress_logs', deletedCount: logsData?.length || 0, error: logsErr?.message || null });

      // Step 2c: 刪除子專案
      const { data: subsData, error: subsErr } = await supabase
        .from('sub_projects')
        .delete()
        .eq('project_id', projectId)
        .select();
      results.steps.push({ step: '2c-sub_projects', deletedCount: subsData?.length || 0, error: subsErr?.message || null });
    }

    // Step 3: 直接嘗試刪除主專案
    const { data: deletedRows, error: deleteErr } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .select();
    results.steps.push({ step: '3-delete_project', deletedCount: deletedRows?.length || 0, error: deleteErr?.message || null });

    if (deletedRows && deletedRows.length > 0) {
      results.conclusion = '✅ 刪除成功！';
    } else if (deleteErr) {
      results.conclusion = `❌ 刪除失敗：${deleteErr.message}`;
    } else {
      results.conclusion = '❌ 刪除回傳 0 筆，可能是 RLS 阻擋或專案不存在';
    }

  } catch (err: any) {
    results.error = err.message;
    results.conclusion = `❌ 發生例外：${err.message}`;
  }

  return NextResponse.json(results, { status: 200 });
}
