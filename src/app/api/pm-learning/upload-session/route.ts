import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbzofi5NGKF9qv8q6JTnThYSp85OOqH2ElJ7d_zFWGtLP6QZ_92G2s1FTAb4BmYozeSkqw/exec';

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.com', '.vbs', '.msi', '.scr', '.ps1', '.reg', '.wsf'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 單檔上限 100MB

function isBlocked(fileName: string): boolean {
  const lower = (fileName || '').toLowerCase();
  return BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * POST /api/pm-learning/upload-session
 * 驗證上傳前置資格：
 * 1. 嚴格驗證 GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID 環境變數 (不可退回待辦資料夾)
 * 2. 阻擋危險副檔名 (.exe/.bat/.sh 等)
 * 3. 檢查單檔大小上限 100MB
 * 4. 回傳安全授權的 upload URL (Google Apps Script 直傳端點) 與專案-Map 專屬 folderId
 */
export async function POST(req: NextRequest) {
  try {
    const { fileName, fileSize } = await req.json();

    if (!fileName) {
      return NextResponse.json({ success: false, message: '缺少 fileName 參數' }, { status: 400 });
    }

    // 阻擋危險執行檔
    if (isBlocked(fileName)) {
      return NextResponse.json(
        {
          success: false,
          message: `檔案「${fileName}」屬於系統禁止上傳的執行檔案類型 (.exe, .bat, .sh 等)，請移除後再試。`,
        },
        { status: 400 }
      );
    }

    // 單檔上限 100MB
    if (fileSize && Number(fileSize) > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: `檔案「${fileName}」超過單檔 100MB 上限限制，請先壓縮或精簡檔案。`,
        },
        { status: 400 }
      );
    }

    // 嚴格讀取專案-Map 專用資料夾 ID，若無設定絕不退回使用待辦資料夾
    const folderId = process.env.GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID;
    if (!folderId || !folderId.trim()) {
      console.error('缺少專案-Map 專用雲端硬碟環境變數: GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID');
      return NextResponse.json(
        {
          success: false,
          message: '系統尚未設定 GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID 環境變數，拒絕上傳以防誤存至待辦資料夾。',
        },
        { status: 500 }
      );
    }

    const gasUrl =
      process.env.GOOGLE_APPS_SCRIPT_URL ||
      process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL ||
      DEFAULT_GAS_URL;

    return NextResponse.json({
      success: true,
      folderId: folderId.trim(),
      uploadUrl: gasUrl,
      maxFileSize: MAX_FILE_SIZE,
    });
  } catch (err: any) {
    console.error('建立專案-Map 上傳 session 失敗:', err);
    return NextResponse.json(
      { success: false, message: err?.message || '建立上傳 Session 異常' },
      { status: 500 }
    );
  }
}
