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

function sanitizeFolderName(name: string): string {
  return (name || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

// 伺服器端記憶體快取：並行上傳多個檔案時共用同一個 Promise，避免重複呼叫 GAS 建立相同資料夾
const courseFolderCache = new Map<string, Promise<string>>();

async function getOrCreateCourseFolder(
  gasUrl: string,
  rootFolderId: string,
  courseId?: string,
  courseTitle?: string
): Promise<string> {
  const cleanName = sanitizeFolderName(courseTitle || courseId || '');
  if (!cleanName) {
    return rootFolderId;
  }
  const key = courseId ? `course:${courseId}` : '';
  const cacheKey = `${rootFolderId}|${key}|${cleanName}`;

  const cached = courseFolderCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'ensureFolder',
          folderName: cleanName,
          key,
          parentFolderId: rootFolderId,
        }),
        redirect: 'follow',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && data.folder?.id) {
          return data.folder.id as string;
        }
      }
    } catch (err) {
      console.warn('建立或取得課程專屬資料夾失敗，退回專案-Map 根資料夾:', err);
    }
    // 失敗時清除快取，供下次重試
    courseFolderCache.delete(cacheKey);
    return rootFolderId;
  })();

  courseFolderCache.set(cacheKey, promise);
  return promise;
}

/**
 * POST /api/pm-learning/upload-session
 * 驗證上傳前置資格：
 * 1. 嚴格驗證 GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID 環境變數 (不可退回待辦資料夾)
 * 2. 阻擋危險副檔名 (.exe/.bat/.sh 等)
 * 3. 檢查單檔大小上限 100MB
 * 4. 根據課程 (courseId / courseTitle) 自動尋找或建立專屬雲端資料夾 (一堂課程只有一個專屬資料夾)
 * 5. 回傳安全授權的 upload URL (Google Apps Script 直傳端點) 與專屬 folderId
 */
export async function POST(req: NextRequest) {
  try {
    const { fileName, fileSize, courseId, courseTitle } = await req.json();

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
    const rootFolderId = process.env.GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID;
    if (!rootFolderId || !rootFolderId.trim()) {
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

    // 解析課程專屬資料夾 (一堂課程永遠只有一個資料夾)
    let targetFolderId = rootFolderId.trim();
    if (courseId || courseTitle) {
      targetFolderId = await getOrCreateCourseFolder(
        gasUrl,
        rootFolderId.trim(),
        courseId,
        courseTitle
      );
    }

    return NextResponse.json({
      success: true,
      folderId: targetFolderId,
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
