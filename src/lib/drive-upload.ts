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
 * 透過 Google Drive Resumable Session 進行 Client-side 直傳 (避開 Vercel 4.5MB 限制)
 */
export async function uploadFileToDrive(
  file: File,
  onProgress?: (percent: number, status: 'requesting_session' | 'uploading' | 'publishing') => void
): Promise<ActionItemAttachment> {
  // 1. 向後端申請 Google Drive Resumable Upload Session URI
  onProgress?.(0, 'requesting_session');
  const sessionRes = await fetch('/api/drive/upload-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
    }),
  });

  const sessionData = await sessionRes.json();
  if (!sessionRes.ok || !sessionData.success) {
    throw new Error(sessionData.message || `申請上傳 Session 失敗 (${sessionRes.status})`);
  }

  const uploadUrl: string = sessionData.uploadUrl;

  // 2. 瀏覽器 Client 端直接 PUT 檔案位元組至 Google Drive (支援進度監聽)
  onProgress?.(5, 'uploading');
  const fileId = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const percent = Math.min(95, Math.max(5, Math.round((e.loaded / e.total) * 90) + 5));
        onProgress?.(percent, 'uploading');
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.id) {
            resolve(res.id);
          } else {
            reject(new Error('Google Drive 上傳完成但未取得檔案 ID'));
          }
        } catch {
          reject(new Error('解析 Google Drive 回應失敗'));
        }
      } else {
        let errMsg = `Google Drive 直傳失敗 (狀態碼: ${xhr.status})`;
        try {
          const errRes = JSON.parse(xhr.responseText);
          if (errRes?.error?.message) {
            const rawMsg = errRes.error.message;
            if (rawMsg.includes('storage quota')) {
              errMsg = 'Google 空間限制：Service Account 上傳之資料夾必須位於 Google Workspace『共用雲端硬碟 (Shared Drive)』，請確認資料夾所屬位置。';
            } else {
              errMsg = `Google Drive 錯誤: ${rawMsg}`;
            }
          }
        } catch {}
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('網路連線中斷或 Google Drive 跨域請求被拒'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Google Drive 直傳請求逾時'));
    };

    xhr.send(file);
  });

  // 3. 呼叫後端發布 API，設定 reader 檢視權限並取得檢視與下載連結
  onProgress?.(98, 'publishing');
  const publishRes = await fetch('/api/drive/publish-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId }),
  });

  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.success) {
    throw new Error(publishData.message || '檔案已上傳至硬碟，但設定權限時發生錯誤');
  }

  onProgress?.(100, 'publishing');
  return publishData.file as ActionItemAttachment;
}
