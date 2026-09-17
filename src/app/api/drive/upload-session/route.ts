import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType, fileSize } = await req.json();

    if (!fileName) {
      return NextResponse.json({ success: false, message: '缺少檔案名稱' }, { status: 400 });
    }

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!email || !key) {
      return NextResponse.json({
        success: false,
        message: '系統尚未設定 GOOGLE_SERVICE_ACCOUNT_EMAIL 或 GOOGLE_PRIVATE_KEY 環境變數',
      }, { status: 500 });
    }

    const auth = new JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const { token } = await auth.getAccessToken();
    if (!token) {
      return NextResponse.json({
        success: false,
        message: '取得 Google Service Account Access Token 失敗',
      }, { status: 500 });
    }

    // 建立 Google Drive Resumable Upload Session
    // 支援 Google Workspace 共用雲端硬碟 (supportsAllDrives=true)
    const metadata: Record<string, any> = {
      name: fileName,
    };
    if (folderId) {
      metadata.parents = [folderId];
    }

    const sessionRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': fileType || 'application/octet-stream',
        'X-Upload-Content-Length': String(fileSize || 0),
      },
      body: JSON.stringify(metadata),
    });

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      let errJson: any = null;
      try { errJson = JSON.parse(errText); } catch {}
      console.error('申請 Google Drive Resumable Session 失敗:', sessionRes.status, errText);
      return NextResponse.json({
        success: false,
        status: sessionRes.status,
        message: errJson?.error?.message || `Google Drive 回應錯誤 (${sessionRes.status})`,
      }, { status: sessionRes.status });
    }

    const uploadUrl = sessionRes.headers.get('location');
    if (!uploadUrl) {
      return NextResponse.json({
        success: false,
        message: 'Google Drive 未回傳 Resumable Location URI',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      uploadUrl,
      folderId,
    });
  } catch (err: any) {
    console.error('建立上傳 Session 異常:', err);
    return NextResponse.json({
      success: false,
      message: err?.message || '建立 Google Drive 上傳階段時發生異常',
    }, { status: 500 });
  }
}
