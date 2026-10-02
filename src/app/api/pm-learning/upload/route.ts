import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 支援 Vercel Node.js Serverless 執行上限

const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbzofi5NGKF9qv8q6JTnThYSp85OOqH2ElJ7d_zFWGtLP6QZ_92G2s1FTAb4BmYozeSkqw/exec';

// 阻擋危險執行檔副檔名
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.com', '.vbs', '.msi', '.scr', '.ps1', '.reg', '.wsf'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 單檔上限 100MB

function isBlocked(fileName: string): boolean {
  const lower = (fileName || '').toLowerCase();
  return BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * GET: 取得專案-Map 上傳組態 (包含驗證過的專屬 folderId 與 GAS 端點)
 * 防呆安全規範：
 * 1. 嚴格驗證 GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID 是否存在。
 * 2. 絕不退回使用專案待辦的 GOOGLE_DRIVE_FOLDER_ID。
 */
export async function GET() {
  try {
    const folderId = process.env.GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID;

    if (!folderId || !folderId.trim()) {
      console.error('缺少專案-Map 專用雲端硬碟環境變數: GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID');
      return NextResponse.json(
        {
          success: false,
          message: '系統尚未設定 GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID 環境變數，請先於系統環境變數中設定專案-Map 專用雲端資料夾 ID。',
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
      gasUrl,
      maxFileSize: MAX_FILE_SIZE,
    });
  } catch (err: any) {
    console.error('取得專案-Map 上傳配置異常:', err);
    return NextResponse.json(
      { success: false, message: err?.message || '取得專案-Map 上傳配置時發生伺服器異常' },
      { status: 500 }
    );
  }
}

/**
 * POST: 專案-Map 伺服器內部代理上傳 (適用於 <= 4MB 檔案，100% 避開 CORS 與企業防火牆限制)
 * 同時支援檔案安全性前置校驗
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. 嚴格驗證資料夾 ID
    const folderId = process.env.GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID;
    if (!folderId || !folderId.trim()) {
      console.error('缺少專案-Map 專屬資料夾 ID');
      return NextResponse.json(
        {
          success: false,
          message: '系統尚未設定 GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID 環境變數，拒絕上傳以防誤存至待辦資料夾。',
        },
        { status: 500 }
      );
    }

    // 2. 檔名與安全性校驗
    const { fileName, mimeType, base64, fileSize } = body;
    if (!fileName) {
      return NextResponse.json({ success: false, message: '缺少 fileName 檔案名稱參數' }, { status: 400 });
    }

    if (isBlocked(fileName)) {
      return NextResponse.json(
        { success: false, message: `檔案「${fileName}」屬於系統禁止上傳的可執行檔案格式 (.exe, .bat, .sh 等)` },
        { status: 400 }
      );
    }

    if (fileSize && Number(fileSize) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: `檔案大小超過單檔 100MB 上限限制` },
        { status: 400 }
      );
    }

    // 3. 若為前置校驗請求 (action: 'validate')，通過校驗直接回傳核准與配置
    if (body.action === 'validate' || !base64) {
      const gasUrl =
        process.env.GOOGLE_APPS_SCRIPT_URL ||
        process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL ||
        DEFAULT_GAS_URL;

      return NextResponse.json({
        success: true,
        valid: true,
        folderId: folderId.trim(),
        gasUrl,
      });
    }

    // 4. 代理上傳轉發至 Google Apps Script
    const gasUrl =
      process.env.GOOGLE_APPS_SCRIPT_URL ||
      process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL ||
      DEFAULT_GAS_URL;

    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        fileName,
        mimeType: mimeType || 'application/octet-stream',
        base64,
        folderId: folderId.trim(), // 嚴格帶入專案-Map 專用資料夾 ID
      }),
      redirect: 'follow',
    });

    if (!gasRes.ok) {
      const errText = await gasRes.text().catch(() => '');
      console.error('GAS 代理上傳回應非 200:', gasRes.status, errText);
      return NextResponse.json(
        { success: false, message: `Google 雲端硬碟服務回應異常 (HTTP ${gasRes.status})` },
        { status: gasRes.status }
      );
    }

    const data = await gasRes.json();
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
    console.error('專案-Map 上傳代理異常:', err);
    return NextResponse.json(
      { success: false, message: err?.message || '處理檔案上傳時發生伺服器異常' },
      { status: 500 }
    );
  }
}
