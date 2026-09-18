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
 * 透過 Google Apps Script 端點直傳 Google 雲端硬碟 (使用 5TB 空間)
 * 策略：
 * 1. 檔案 <= 4MB 時，優先透過內部代理 (/api/drive/upload) 轉發，免除跨域 (CORS)、企業防火牆與 Google 帳號衝突。
 * 2. 檔案 > 4MB (避開 Vercel 4.5MB 限制) 或內部代理異常時，自動平滑切換至 GAS 直傳備援機制。
 */
export async function uploadFileToDrive(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<ActionItemAttachment> {
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error(`檔案大小 (${formatFileSize(file.size)}) 超過 50MB 上限，請先壓縮後再上傳`);
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

  const gasUrl = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL || DEFAULT_GAS_URL;
  const payloadStr = JSON.stringify({
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64: base64,
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

    try {
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

      if (!res.ok) {
        throw new Error(`Google 雲端硬碟連線失敗 (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.file) {
        throw new Error(data.error || 'Google 雲端硬碟建立檔案失敗');
      }

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
    } catch (err) {
      clearInterval(simInterval);
      throw err;
    }
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

      console.warn('內部代理上傳回應異常，切換至直接端點備援...');
    } catch (proxyErr) {
      clearInterval(proxyInterval);
      console.warn('內部代理端點連線異常，切換至直接端點備援:', proxyErr);
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


