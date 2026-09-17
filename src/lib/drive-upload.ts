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

/**
 * 透過 Google Apps Script 端點直傳 Google 雲端硬碟 (使用 5TB 空間，避開 Vercel 4.5MB 限制)
 */
export async function uploadFileToDrive(
  file: File,
  onProgress?: (percent: number, status: 'requesting_session' | 'uploading' | 'publishing') => void
): Promise<ActionItemAttachment> {
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error(`檔案大小 (${formatFileSize(file.size)}) 超過 50MB 上限，請先壓縮後再上傳`);
  }

  // 1. 讀取並轉換檔案為 Base64
  onProgress?.(5, 'requesting_session');
  const base64 = await fileToBase64(file, (p) => {
    onProgress?.(Math.min(30, Math.max(5, Math.round(p * 0.3))), 'requesting_session');
  });

  // 2. 瀏覽器 Client 端直傳至 Google 雲端硬碟 (GAS Web App)
  onProgress?.(35, 'uploading');

  const gasUrl = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL || DEFAULT_GAS_URL;

  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8', // 避免觸發 OPTIONS preflight 造成 GAS CORS 錯誤
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      base64: base64,
    }),
  });

  onProgress?.(92, 'publishing');

  if (!res.ok) {
    throw new Error(`Google 雲端硬碟連線失敗 (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.success || !data.file) {
    throw new Error(data.error || 'Google 雲端硬碟建立檔案失敗');
  }

  onProgress?.(100, 'publishing');

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

