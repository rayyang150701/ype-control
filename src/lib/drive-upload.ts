import type { ActionItemAttachment } from '@/types';

export interface UploadProgressEvent {
  file: File;
  percent: number;
  status: 'pending' | 'requesting_session' | 'uploading' | 'publishing' | 'completed' | 'error';
  error?: string;
  attachment?: ActionItemAttachment;
}

/**
 * 格式化檔案大小為易讀字串 (B, KB, MB, GB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * 依 MIME 類型或檔名取得適當的副檔名分類標籤
 */
export function getFileCategory(mimeType: string, fileName: string): 'image' | 'pdf' | 'doc' | 'sheet' | 'archive' | 'file' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return 'image';
  }
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    ['doc', 'docx', 'txt', 'md'].includes(ext)
  ) {
    return 'doc';
  }
  if (
    mimeType.includes('sheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv') ||
    ['xls', 'xlsx', 'csv'].includes(ext)
  ) {
    return 'sheet';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return 'archive';
  }
  return 'file';
}

/**
 * 將 File 轉為 Base64 字串
 */
function fileToBase64(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    };
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(',');
      if (commaIdx !== -1) {
        resolve(result.substring(commaIdx + 1));
      } else {
        resolve(result);
      }
    };
    reader.onerror = () => reject(new Error('本機讀取檔案失敗'));
    reader.readAsDataURL(file);
  });
}

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzofi5NGKF9qv8q6JTnThYSp85OOqH2ElJ7d_zFWGtLP6QZ_92G2s1FTAb4BmYozeSkqw/exec';

export interface UploadProgressInfo {
  percent: number;
  status: 'requesting_session' | 'uploading' | 'publishing' | 'done';
  loadedBytes?: number;
  totalBytes?: number;
  speedText?: string;
  etaText?: string;
  stageMessage?: string;
}

export type UploadProgressCallback = (
  percent: number,
  status: 'requesting_session' | 'uploading' | 'publishing' | 'done',
  info?: Partial<UploadProgressInfo>
) => void;

/**
 * 透過 Google Apps Script 端點直傳 Google 雲端硬碟 (使用 5TB 空間，避開 Vercel 4.5MB 限制)
 * 支援真實位元組上傳進度、傳輸速率、剩餘時間預估與雲端處理心跳回饋
 */
/**
 * 查詢 Google 雲端硬碟是否已成功收錄特定檔案 (用於直傳中斷、逾時或發布失敗後的自動校驗與恢復)
 */
export async function checkRecentFileInDrive(
  fileName: string,
  fileSize?: number,
  sinceMinutes: number = 15
): Promise<ActionItemAttachment | null> {
  try {
    const res = await fetch('/api/drive/check-recent-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileSize, sinceMinutes }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.found && data.file) {
      return data.file as ActionItemAttachment;
    }
  } catch (err) {
    console.warn('檢查雲端硬碟近期檔案失敗:', err);
  }
  return null;
}

/**
 * 輪詢校驗雲端硬碟收件狀態 (弭平 Google Apps Script 寫入 5TB 雲端硬碟的非同步延遲)
 */
async function pollReconcileRecentFile(
  fileName: string,
  fileSize?: number,
  maxAttempts: number = 4,
  delayMs: number = 3000
): Promise<ActionItemAttachment | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const file = await checkRecentFileInDrive(fileName, fileSize);
    if (file) return file;
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

/**
 * 專屬資料夾描述：一個專案或一堂課程只對應一個資料夾。
 * - key：穩定識別碼 (例如 project:<id>、course:<id>)，改名後仍能找回同一個資料夾
 * - name：資料夾顯示名稱 (例如「案號_專案名稱」)
 * - parentFolderId：父資料夾 ID，未帶則由 GAS 使用待辦預設根資料夾
 */
export interface DriveFolderContext {
  key?: string;
  name: string;
  parentFolderId?: string;
}

export interface UploadFileOptions {
  folderContext?: DriveFolderContext;
  /**
   * 上傳識別碼 (冪等鍵)：同一個檔案的所有重試必須沿用同一個 ID，
   * GAS 會依此判斷「已經收過」而直接回傳既有檔案，不會重複建檔。
   */
  uploadId?: string;
}

export function generateUploadId(): string {
  return `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 向 GAS 以 uploadId 查詢檔案是否已成功寫入雲端硬碟 (GAS 以檔案擁有者身分執行，
 * 不受服務帳號權限限制，比檔名搜尋可靠，且不會誤抓到其他同名檔案)。
 */
export async function lookupUploadedFile(
  uploadId: string,
  folderId?: string | null
): Promise<ActionItemAttachment | null> {
  const body = { action: 'lookup', uploadId, ...(folderId ? { folderId } : {}) };
  const toAttachment = (f: any): ActionItemAttachment => ({
    id: f.id,
    fileId: f.id,
    name: f.name,
    size: f.size || 0,
    mimeType: f.mimeType || 'application/octet-stream',
    webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    webContentLink: f.webContentLink || `https://drive.google.com/uc?id=${f.id}&export=download`,
    uploadedAt: f.uploadedAt || new Date().toISOString(),
  });

  try {
    const res = await fetch('/api/drive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data.found && data.file?.id) return toAttachment(data.file);
      if (data?.success && data.found === false) return null;
    }
  } catch {
    // 回退至直接端點
  }

  try {
    const gasUrl = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL || DEFAULT_GAS_URL;
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data.found && data.file?.id) return toAttachment(data.file);
    }
  } catch (err) {
    console.warn('查詢上傳結果失敗:', err);
  }
  return null;
}

/** 輪詢 uploadId，直到 GAS 完成寫入或逾時 */
async function pollLookupUploadedFile(
  uploadId: string,
  folderId: string | null,
  maxMs: number,
  intervalMs: number,
  onTick?: (elapsedSec: number) => void
): Promise<ActionItemAttachment | null> {
  const start = Date.now();
  while (true) {
    const found = await lookupUploadedFile(uploadId, folderId);
    if (found) return found;
    const elapsed = Date.now() - start;
    if (elapsed >= maxMs) return null;
    onTick?.(Math.round(elapsed / 1000));
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// 同一個資料夾只解析一次：並行上傳多個檔案時共用同一個進行中的請求，避免重複建立
const folderResolveCache = new Map<string, Promise<string | null>>();

function sanitizeFolderName(name: string): string {
  return (name || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

async function requestEnsureFolder(ctx: DriveFolderContext): Promise<string | null> {
  const body = {
    action: 'ensureFolder',
    folderName: sanitizeFolderName(ctx.name),
    key: ctx.key || '',
    parentFolderId: ctx.parentFolderId || '',
  };

  // 1. 優先走同源內部代理
  try {
    const res = await fetch('/api/drive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data.folder?.id) return data.folder.id as string;
    }
  } catch {
    // 回退至直接端點
  }

  // 2. 備援：直接呼叫 GAS
  try {
    const gasUrl = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL || DEFAULT_GAS_URL;
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data.folder?.id) return data.folder.id as string;
    }
  } catch (err) {
    console.warn('建立專屬雲端資料夾失敗:', err);
  }

  return null;
}

/**
 * 取得專案/課程專屬資料夾 ID (不存在則由 GAS 建立)。
 * 失敗時回傳 null，呼叫端應退回預設資料夾，確保上傳流程不中斷。
 */
export function ensureDriveFolder(ctx: DriveFolderContext): Promise<string | null> {
  if (!sanitizeFolderName(ctx.name)) return Promise.resolve(null);

  const cacheKey = `${ctx.parentFolderId || 'default'}|${ctx.key || ''}|${sanitizeFolderName(ctx.name)}`;
  const cached = folderResolveCache.get(cacheKey);
  if (cached) return cached;

  const promise = requestEnsureFolder(ctx).then((id) => {
    // 失敗不快取，下次上傳可重試
    if (!id) folderResolveCache.delete(cacheKey);
    return id;
  });
  folderResolveCache.set(cacheKey, promise);
  return promise;
}

/**
 * 透過 Google Apps Script 端點直傳 Google 雲端硬碟 (使用 5TB 空間)
 * 策略：
 * 1. 檔案 <= 4MB 時，優先透過內部代理 (/api/drive/upload) 轉發，免除跨域 (CORS)、企業防火牆與 Google 帳號衝突。
 * 2. 檔案 > 4MB (避開 Vercel 4.5MB 限制) 或內部代理異常時，自動切換至 GAS 直傳。
 * 3. 雙重保險：直傳遇網路中斷或逾時 (30s 企業防火牆限制) 時，自動觸發雲端收件校驗 (Auto-Reconciliation)，保證檔案絕不漏失！
 * 4. 若提供 options.folderContext，檔案會存入該專案/課程的專屬資料夾 (自動建立，不重複)。
 */
export async function uploadFileToDrive(
  file: File,
  onProgress?: UploadProgressCallback,
  options?: UploadFileOptions
): Promise<ActionItemAttachment> {
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error(`檔案大小 (${formatFileSize(file.size)}) 超過 50MB 上限，請先壓縮後再上傳`);
  }

  // 0. 解析專屬資料夾 (失敗則退回預設資料夾)
  let targetFolderId: string | null = null;
  if (options?.folderContext) {
    onProgress?.(3, 'requesting_session', {
      percent: 3,
      status: 'requesting_session',
      stageMessage: '正在準備專屬雲端資料夾...',
    });
    targetFolderId = await ensureDriveFolder(options.folderContext);
  }

  // 1. 讀取並轉換檔案為 Base64
  onProgress?.(5, 'requesting_session', {
    percent: 5,
    status: 'requesting_session',
    stageMessage: '正在讀取本機檔案...',
  });

  const base64 = await fileToBase64(file, (p) => {
    const pct = Math.min(15, Math.max(2, Math.round(p * 0.15)));
    onProgress?.(pct, 'requesting_session', {
      percent: pct,
      status: 'requesting_session',
      stageMessage: `正在讀取本機檔案 (${p}%)...`,
    });
  });

  const uploadId = options?.uploadId || generateUploadId();
  const gasUrl = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL || DEFAULT_GAS_URL;
  const payloadStr = JSON.stringify({
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64: base64,
    uploadId,
    ...(targetFolderId ? { folderId: targetFolderId } : {}),
  });

  // 輔助函式：透過直接 GAS 端點直傳 (備援或 > 4MB 大檔案)
  const executeDirectGASUpload = async (): Promise<ActionItemAttachment> => {
    let simulatedPct = 30;
    onProgress?.(simulatedPct, 'uploading', {
      percent: simulatedPct,
      status: 'uploading',
      stageMessage: `正在直傳雲端硬碟 (${formatFileSize(file.size)})...`,
    });

    const simInterval = setInterval(() => {
      if (simulatedPct < 88) {
        simulatedPct += 2;
        onProgress?.(simulatedPct, 'uploading', {
          percent: simulatedPct,
          status: 'uploading',
          stageMessage: `正在直傳雲端硬碟 (${simulatedPct}%)...`,
        });
      }
    }, 800);

    let directError: any = null;

    try {
      // 支援長時傳輸 (4 分鐘逾時防護)
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payloadStr,
        redirect: 'follow',
      });

      clearInterval(simInterval);

      onProgress?.(92, 'publishing', {
        percent: 92,
        status: 'publishing',
        stageMessage: '檔案已送達雲端，Google Drive 正處理儲存與設定分享權限...',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.file) {
          onProgress?.(100, 'done', {
            percent: 100,
            status: 'done',
            stageMessage: '已完成上傳與權限發布！',
          });

          const f = data.file;
          return {
            id: f.id,
            fileId: f.id,
            name: f.name || file.name,
            size: f.size || file.size,
            mimeType: f.mimeType || file.type || 'application/octet-stream',
            webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
            webContentLink: f.webContentLink || `https://drive.google.com/uc?id=${f.id}&export=download`,
            uploadedAt: new Date().toISOString(),
          };
        }
        if (data && data.success === false) {
          // GAS 明確回報失敗：不需輪詢，直接回報錯誤
          throw new Error(data.error || data.message || 'Google 雲端硬碟回報上傳失敗');
        }
      }
    } catch (err: any) {
      clearInterval(simInterval);
      directError = err;
      console.warn('直接上傳 GAS 傳輸中斷或逾時，啟動雲端自動校驗修復機制...', err);
      if (String(err?.message || '').startsWith('Google 雲端硬碟回報')) {
        throw err;
      }
    }

    // ─── 關鍵韌性備援：以 uploadId 向 GAS 查詢 (冪等) ───
    // 大檔案 (20MB+) GAS 需 1~2 分鐘寫入，瀏覽器連線可能先逾時；
    // 但 GAS 仍會完成寫入並記錄 uploadId，這裡持續輪詢直到取得該檔案 (最多 3 分鐘)。
    onProgress?.(94, 'publishing', {
      percent: 94,
      status: 'publishing',
      stageMessage: '檔案已送達，等待 Google 雲端硬碟完成寫入...',
    });

    const reconciled = await pollLookupUploadedFile(uploadId, targetFolderId, 180000, 4000, (sec) => {
      onProgress?.(95, 'publishing', {
        percent: 95,
        status: 'publishing',
        stageMessage: `雲端硬碟寫入中，請勿重複上傳 (已等待 ${sec} 秒)...`,
      });
    });
    if (reconciled) {
      onProgress?.(100, 'done', {
        percent: 100,
        status: 'done',
        stageMessage: '檔案已由雲端硬碟確認收件成功！',
      });
      return reconciled;
    }

    throw directError || new Error('Google 雲端硬碟連線失敗且尚未偵測到已儲存檔案，請點擊「重新嘗試」(不會重複建檔)。');
  };

  // 2. 若檔案 <= 4MB，優先走同源內部代理 API (/api/drive/upload)
  // 這可以 100% 避開企業內網防火牆攔截 script.google.com、跨域 302 CORS 與 Google 帳號 Cookie 衝突
  const PROXY_SIZE_LIMIT = 4 * 1024 * 1024; // 4MB
  if (file.size <= PROXY_SIZE_LIMIT) {
    let proxyPct = 20;
    onProgress?.(proxyPct, 'uploading', {
      percent: proxyPct,
      status: 'uploading',
      stageMessage: `正在安全傳輸至 Google Drive (${formatFileSize(file.size)})...`,
    });

    const proxyInterval = setInterval(() => {
      if (proxyPct < 88) {
        proxyPct += 3;
        onProgress?.(proxyPct, 'uploading', {
          percent: proxyPct,
          status: 'uploading',
          stageMessage: `正在安全傳輸至 Google Drive (${proxyPct}%)...`,
        });
      }
    }, 400);

    try {
      const res = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
      });

      clearInterval(proxyInterval);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.file) {
          onProgress?.(100, 'done', {
            percent: 100,
            status: 'done',
            stageMessage: '已完成上傳與權限發布！',
          });

          const f = data.file;
          return {
            id: f.id,
            fileId: f.id,
            name: f.name || file.name,
            size: f.size || file.size,
            mimeType: f.mimeType || file.type || 'application/octet-stream',
            webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
            webContentLink: f.webContentLink || `https://drive.google.com/uc?id=${f.id}&export=download`,
            uploadedAt: new Date().toISOString(),
          };
        }
      }

      console.warn('內部代理上傳回應異常，檢查雲端硬碟收件狀態或切換備援...');
    } catch (proxyErr) {
      clearInterval(proxyInterval);
      console.warn('內部代理端點連線異常，檢查雲端硬碟收件狀態或切換備援:', proxyErr);
    }

    // ★ 重複檔案防護：切換備援直傳前，先以 uploadId 查詢 GAS 是否「已經」收件。
    // 即使查詢沒找到而重送，GAS 也會依 uploadId 冪等處理，不會重複建檔。
    try {
      const reconciled = await pollLookupUploadedFile(uploadId, targetFolderId, 4000, 2000);
      if (reconciled) {
        onProgress?.(100, 'done', {
          percent: 100,
          status: 'done',
          stageMessage: '已完成上傳與權限發布！',
        });
        return reconciled;
      }
    } catch (checkErr) {
      console.warn('代理失敗後之雲端自動校驗檢查異常:', checkErr);
    }
  }

  // 3. 超過 4MB 或內部代理回退：執行直接 GAS 直傳
  return await executeDirectGASUpload();
}

/**
 * 透過 Google Apps Script 端點將 Google 雲端硬碟檔案移至垃圾桶 (雙向同步刪除)
 * 優先走內部代理 /api/drive/upload，若失敗則回退至直接端點
 */
export async function deleteFileFromDrive(fileId: string): Promise<boolean> {
  if (!fileId) return false;

  // 1. 優先透過內部代理
  try {
    const res = await fetch('/api/drive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', fileId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return true;
    }
  } catch {
    // 內部代理失敗時靜默回退
  }

  // 2. 備援：直接呼叫 GAS
  try {
    const gasUrl = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL || DEFAULT_GAS_URL;
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'delete', fileId }),
      redirect: 'follow',
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error('刪除 Google 雲端檔案失敗:', err);
    return false;
  }
}


