import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 支援 Vercel Serverless Function 執行時間最大化 (Node.js runtime)
export const maxDuration = 60;

const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbzofi5NGKF9qv8q6JTnThYSp85OOqH2ElJ7d_zFWGtLP6QZ_92G2s1FTAb4BmYozeSkqw/exec';

/**
 * 系統內部 Drive 代理端點：
 * 接收 Client 端上傳與刪除請求，由伺服器端直通 Google Apps Script (5TB 雲端硬碟)。
 * 好處：
 * 1. 同源請求 (/api/drive/upload)，徹底免除瀏覽器跨域 (CORS) 與企業內網防火牆攔截 script.google.com 問題。
 * 2. 避開瀏覽器隨附 Google 帳號 Cookie 或企業 SSO 導致的 302 轉址 404/403 異常。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const gasUrl =
      process.env.GOOGLE_APPS_SCRIPT_URL ||
      process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL ||
      DEFAULT_GAS_URL;

    // 處理檔案刪除
    if (body.action === 'delete') {
      const { fileId } = body;
      if (!fileId) {
        return NextResponse.json({ success: false, message: '缺少 fileId' }, { status: 400 });
      }

      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'delete', fileId }),
        redirect: 'follow',
      });

      if (!res.ok) {
        return NextResponse.json(
          { success: false, message: `雲端硬碟刪除回應 HTTP ${res.status}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      return NextResponse.json(data);
    }

    // 處理檔案上傳
    const { fileName, mimeType, base64 } = body;
    if (!fileName || !base64) {
      return NextResponse.json(
        { success: false, message: '缺少檔案名稱或 Base64 內容' },
        { status: 400 }
      );
    }

    // 呼叫 Google Apps Script 端點
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        fileName,
        mimeType: mimeType || 'application/octet-stream',
        base64,
      }),
      redirect: 'follow',
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('GAS 回應非 200:', res.status, errText);
      return NextResponse.json(
        { success: false, message: `Google 雲端硬碟回應錯誤 (HTTP ${res.status})` },
        { status: res.status }
      );
    }

    const data = await res.json();
    if (!data.success || !data.file) {
      return NextResponse.json(
        { success: false, message: data.error || 'Google 雲端硬碟未正常回傳檔案物件' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      file: data.file,
    });
  } catch (err: any) {
    console.error('API /api/drive/upload 處理異常:', err);
    return NextResponse.json(
      { success: false, message: err?.message || '內部伺服器處理上傳時發生異常' },
      { status: 500 }
    );
  }
}
