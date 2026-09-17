import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json({ success: false, message: '缺少 fileId 參數' }, { status: 400 });
    }

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (!email || !key) {
      return NextResponse.json({
        success: false,
        message: '系統尚未設定 Google 憑證環境變數',
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

    // 1. 設定檔案存取權限為公開檢視 (role: reader, type: anyone)
    try {
      const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });

      if (!permRes.ok) {
        console.warn('設定 reader 權限警告 (可能由資料夾繼承或受組織限制):', permRes.status, await permRes.text());
      }
    } catch (permErr) {
      console.warn('設定權限呼叫失敗:', permErr);
    }

    // 2. 取得檔案完整中繼資料 (包含 webViewLink, webContentLink, thumbnailLink 等)
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink,iconLink`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error('取得檔案中繼資料失敗:', metaRes.status, errText);
      return NextResponse.json({
        success: false,
        message: `取得 Google Drive 檔案資訊失敗 (${metaRes.status})`,
      }, { status: metaRes.status });
    }

    const fileMeta = await metaRes.json();

    // 備援處理 webViewLink
    const webViewLink = fileMeta.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;
    const webContentLink = fileMeta.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`;

    return NextResponse.json({
      success: true,
      file: {
        id: fileMeta.id,
        name: fileMeta.name,
        mimeType: fileMeta.mimeType,
        size: fileMeta.size ? Number(fileMeta.size) : 0,
        webViewLink,
        webContentLink,
        thumbnailLink: fileMeta.thumbnailLink || undefined,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('發布 Google Drive 檔案異常:', err);
    return NextResponse.json({
      success: false,
      message: err?.message || '發布 Google Drive 檔案時發生異常',
    }, { status: 500 });
  }
}
