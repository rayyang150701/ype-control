import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileSize, sinceMinutes = 15 } = await req.json();

    if (!fileName) {
      return NextResponse.json({ success: false, message: '缺少 fileName 參數' }, { status: 400 });
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

    // 搜尋 Google Drive 中檔名相符且未被移至垃圾桶的檔案
    const safeName = fileName.replace(/'/g, "\\'");
    const query = `name = '${safeName}' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&q=${encodeURIComponent(query)}&orderBy=createdTime desc&pageSize=10&fields=files(id,name,size,mimeType,webViewLink,webContentLink,createdTime)`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error('查詢近期 Google Drive 檔案失敗:', searchRes.status, errText);
      return NextResponse.json({
        success: false,
        message: `Google Drive 查詢失敗 (${searchRes.status})`,
      }, { status: searchRes.status });
    }

    const data = await searchRes.json();
    const files: any[] = data.files || [];

    if (files.length === 0) {
      return NextResponse.json({
        success: true,
        found: false,
        message: '未於 Google 雲端硬碟中尋獲相符檔案',
      });
    }

    // 計算時間區間（預設檢查近 15 分鐘以內上傳之檔案）
    const thresholdTime = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
    
    // 依據時間篩選或挑選最近建立的一筆
    let matchedFile = files.find((f) => f.createdTime >= thresholdTime);
    if (!matchedFile) {
      // 若超過 15 分鐘但有同名且大小相符或同名的最新檔案，作為次要比對
      if (fileSize) {
        matchedFile = files.find((f) => Math.abs(Number(f.size) - Number(fileSize)) < 1024);
      }
      if (!matchedFile) {
        matchedFile = files[0];
      }
    }

    // 自動發布讀取權限 (role: reader, type: anyone) 以確保連結所有人皆可檢視/下載
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${matchedFile.id}/permissions?supportsAllDrives=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });
    } catch (permErr) {
      console.warn('為尋獲檔案設定 reader 權限警告:', permErr);
    }

    const webViewLink = matchedFile.webViewLink || `https://drive.google.com/file/d/${matchedFile.id}/view?usp=drivesdk`;
    const webContentLink = matchedFile.webContentLink || `https://drive.google.com/uc?id=${matchedFile.id}&export=download`;

    return NextResponse.json({
      success: true,
      found: true,
      file: {
        id: matchedFile.id,
        fileId: matchedFile.id,
        name: matchedFile.name,
        size: matchedFile.size ? Number(matchedFile.size) : (fileSize || 0),
        mimeType: matchedFile.mimeType || 'application/octet-stream',
        webViewLink,
        webContentLink,
        uploadedAt: matchedFile.createdTime || new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('檢查 Google Drive 近期檔案異常:', err);
    return NextResponse.json({
      success: false,
      message: err?.message || '檢查 Google 雲端硬碟檔案時發生異常',
    }, { status: 500 });
  }
}
