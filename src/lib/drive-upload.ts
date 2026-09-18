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
    const pct = Math.min(10, Math.max(2, Math.round(p * 0.1)));
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

  // 2. 優先使用 XMLHttpRequest 以獲得精準真實的位元組上傳進度與速率
  return new Promise<ActionItemAttachment>((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    let fallbackAttempted = false;

    const executeFallbackFetch = async () => {
      if (fallbackAttempted) return;
      fallbackAttempted = true;
      if (timer) clearInterval(timer);

      try {
        let simulatedPct = 35;
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

        const res = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payloadStr,
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
        resolve({
          id: f.id,
          fileId: f.id,
          name: f.name || file.name,
          size: f.size || file.size,
          mimeType: f.mimeType || file.type || 'application/octet-stream',
          webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
          webContentLink: f.webContentLink || `https://drive.google.com/uc?id=${f.id}&export=download`,
          uploadedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        reject(err);
      }
    };

    // 檢查瀏覽器是否支援 XMLHttpRequest
    if (typeof XMLHttpRequest === 'undefined') {
      executeFallbackFetch();
      return;
    }

    const xhr = new XMLHttpRequest();
    const startTime = Date.now();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const ratio = e.loaded / e.total;
        // 映射網路傳輸進度至 10% ~ 90%
        const percent = Math.min(90, Math.max(10, Math.round(10 + ratio * 80)));
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedBytes = elapsedSec > 0 ? e.loaded / elapsedSec : 0;
        const remainingBytes = Math.max(0, e.total - e.loaded);
        const etaSec = speedBytes > 0 ? Math.round(remainingBytes / speedBytes) : 0;

        const speedText = speedBytes > 1024 * 1024
          ? `${(speedBytes / (1024 * 1024)).toFixed(1)} MB/s`
          : `${Math.round(speedBytes / 1024)} KB/s`;
        const etaText = etaSec > 0 ? `剩餘約 ${etaSec} 秒` : '';
        const loadedFormatted = formatFileSize(Math.round(ratio * file.size));
        const totalFormatted = formatFileSize(file.size);

        onProgress?.(percent, 'uploading', {
          percent,
          status: 'uploading',
          loadedBytes: Math.round(ratio * file.size),
          totalBytes: file.size,
          speedText,
          etaText,
          stageMessage: `正在直傳雲端硬碟 (${loadedFormatted} / ${totalFormatted}) · ${speedText}${etaText ? ' · ' + etaText : ''}`,
        });
      }
    };

    xhr.upload.onloadend = () => {
      // 網路傳輸完畢，進入 Google Drive 雲端儲存與分享權限設定階段
      let publishPct = 91;
      onProgress?.(publishPct, 'publishing', {
        percent: publishPct,
        status: 'publishing',
        stageMessage: '檔案已全數送達！Google Drive 正在儲存檔案並設定檢視權限 (約需 5~10 秒)...',
      });

      // 雲端處理心跳，避免 90%~98% 畫面停滯
      timer = setInterval(() => {
        if (publishPct < 98) {
          publishPct += 1;
          onProgress?.(publishPct, 'publishing', {
            percent: publishPct,
            status: 'publishing',
            stageMessage: 'Google Drive 正完成雲端硬碟寫入與連結發布中，請稍候...',
          });
        }
      }, 2000);
    };

    xhr.onload = () => {
      if (timer) clearInterval(timer);

      if (xhr.status >= 200 && xhr.status < 400) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.success && data.file) {
            onProgress?.(100, 'done', {
              percent: 100,
              status: 'done',
              stageMessage: '已完成上傳與權限發布！',
            });

            const f = data.file;
            resolve({
              id: f.id,
              fileId: f.id,
              name: f.name || file.name,
              size: f.size || file.size,
              mimeType: f.mimeType || file.type || 'application/octet-stream',
              webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
              webContentLink: f.webContentLink || `https://drive.google.com/uc?id=${f.id}&export=download`,
              uploadedAt: new Date().toISOString(),
            });
            return;
          }
          reject(new Error(data.error || 'Google 雲端硬碟建立檔案失敗'));
        } catch {
          // 若 XHR 收到重導向但回應解析異常，回退至 fetch
          console.warn('XHR 回應解析失敗，嘗試 Fetch 回退機制...');
          executeFallbackFetch();
        }
      } else {
        console.warn(`XHR HTTP ${xhr.status}，嘗試 Fetch 回退機制...`);
        executeFallbackFetch();
      }
    };

    xhr.onerror = () => {
      if (timer) clearInterval(timer);
      console.warn('XHR 跨域或連線中斷，切換為 Fetch 模式...');
      executeFallbackFetch();
    };

    xhr.ontimeout = () => {
      if (timer) clearInterval(timer);
      reject(new Error('Google 雲端硬碟直傳請求逾時，請檢查網路連線'));
    };

    try {
      xhr.open('POST', gasUrl, true);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      xhr.timeout = 180000; // 3 分鐘超時保護 (支援超大檔案)
      xhr.send(payloadStr);
    } catch {
      if (timer) clearInterval(timer);
      executeFallbackFetch();
    }
  });
}

/**
 * 透過 Google Apps Script 端點將 Google 雲端硬碟檔案移至垃圾桶 (雙向同步刪除)
 */
export async function deleteFileFromDrive(fileId: string): Promise<boolean> {
  if (!fileId) return false;
  try {
    const gasUrl = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL || DEFAULT_GAS_URL;
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'delete',
        fileId: fileId,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error('刪除 Google 雲端檔案失敗:', err);
    return false;
  }
}

