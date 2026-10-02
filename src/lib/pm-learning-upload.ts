import type { PMLearningAttachment } from '@/types/pm-learning';

export interface PMLearningUploadProgress {
  percent: number;
  stageMessage: string;
}

export type PMLearningProgressCallback = (progress: PMLearningUploadProgress) => void;

// 禁止上傳的危險執行檔副檔名
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.com', '.vbs', '.msi', '.scr', '.ps1', '.reg', '.wsf'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 單檔上限 100MB

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
 * 格式化專案-Map 檔名前綴：「課程名稱_成員名稱_原檔名」
 * 自動清理特殊字元以符合雲端硬碟與作業系統檔名限制
 */
export function formatLearningFileName(
  courseTitle: string,
  memberName: string,
  originalFileName: string
): string {
  const sanitize = (s: string) => (s || '').replace(/[\\/:*?"<>|\r\n\t]/g, '_').trim();
  const cleanTitle = sanitize(courseTitle) || '課程';
  const cleanMember = sanitize(memberName) || '成員';
  const cleanOriginal = sanitize(originalFileName) || '檔案';
  return `${cleanTitle}_${cleanMember}_${cleanOriginal}`;
}

/**
 * 本機將 File 物件非同步轉換為 Base64 字串
 */
function fileToBase64(file: File, onProgress?: (percent: number) => void): Promise<string> {
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

/**
 * 專案-Map 專用 Google Drive 檔案上傳主函式
 * 流程：
 * 1. 檔名與副檔名檢查（擋 .exe/.bat/.sh，上限 100MB）
 * 2. 呼叫後端 /api/pm-learning/upload-session 取得驗證過的專屬 folderId 與端點
 * 3. 讀取 Base64
 * 4. 根據檔案大小（<= 4MB 走內部代理，> 4MB 直傳 GAS 端點）透過 XMLHttpRequest 發送並監聽即時上傳進度
 * 5. 上傳成功自動回傳 PMLearningAttachment 物件
 */
export async function uploadPMLearningFile(
  file: File,
  targetFileName: string,
  onProgress?: PMLearningProgressCallback
): Promise<PMLearningAttachment> {
  // 1. 本地前置校驗
  const lowerName = file.name.toLowerCase();
  if (BLOCKED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    throw new Error(`檔案「${file.name}」為可執行檔 (.exe, .bat, .sh 等)，為系統安全考量禁止上傳。`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`檔案大小 (${formatFileSize(file.size)}) 超過單檔 100MB 上限，請先壓縮後再上傳。`);
  }

  // 2. 向伺服器申請 upload-session，確保 GOOGLE_DRIVE_PM_LEARNING_FOLDER_ID 存在且合法
  onProgress?.({ percent: 5, stageMessage: '向伺服器驗證上傳權限與目標資料夾...' });

  const sessionRes = await fetch('/api/pm-learning/upload-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: targetFileName,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
    }),
  });

  const sessionData = await sessionRes.json().catch(() => null);

  if (!sessionRes.ok || !sessionData?.success) {
    throw new Error(
      sessionData?.message || `建立上傳 Session 失敗 (狀態碼: ${sessionRes.status})`
    );
  }

  const { folderId, uploadUrl } = sessionData;
  if (!folderId) {
    throw new Error('伺服器未回傳專案-Map 雲端資料夾 ID，拒絕上傳以保護資料安全。');
  }

  // 3. 讀取本機檔案並轉換為 Base64
  onProgress?.({ percent: 10, stageMessage: '正在讀取本機檔案...' });
  const base64 = await fileToBase64(file, (p) => {
    const scaled = Math.min(25, Math.max(10, Math.round(10 + p * 0.15)));
    onProgress?.({ percent: scaled, stageMessage: `正在讀取本機檔案 (${p}%)...` });
  });

  // 4. 判斷上傳通道：<= 4MB 優先透過伺服器代理 /api/pm-learning/upload，避開跨域與防火牆；> 4MB 則直接 PUT/POST 至 GAS
  const payloadStr = JSON.stringify({
    fileName: targetFileName,
    mimeType: file.type || 'application/octet-stream',
    base64: base64,
    folderId: folderId,
  });

  const PROXY_LIMIT = 4 * 1024 * 1024; // 4MB
  const postUrl = file.size <= PROXY_LIMIT ? '/api/pm-learning/upload' : uploadUrl;

  onProgress?.({ percent: 30, stageMessage: `正在上傳至 Google 雲端硬碟 (${formatFileSize(file.size)})...` });

  return new Promise<PMLearningAttachment>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', postUrl, true);
    xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        // 進度映射至 30% - 95%
        const uploadPercent = Math.min(95, Math.max(30, Math.round(30 + (e.loaded / e.total) * 65)));
        onProgress?.({
          percent: uploadPercent,
          stageMessage: `檔案直傳中 (${uploadPercent}%)...`,
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.file) {
            onProgress?.({ percent: 100, stageMessage: '已完成上傳並取得雲端連結！' });
            const f = res.file;
            const webViewLink =
              f.webViewLink || `https://drive.google.com/file/d/${f.id}/view?usp=drivesdk`;

            const attachment: PMLearningAttachment = {
              id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
              title: targetFileName,
              url: webViewLink,
              type: 'drive',
              createdAt: new Date().toISOString(),
            };

            resolve(attachment);
          } else {
            reject(new Error(res.error || res.message || 'Google 雲端硬碟建立檔案失敗'));
          }
        } catch {
          reject(new Error('解析 Google 雲端服務回應失敗'));
        }
      } else {
        let errMsg = `上傳連線失敗 (HTTP ${xhr.status})`;
        try {
          const errRes = JSON.parse(xhr.responseText);
          if (errRes.message || errRes.error) {
            errMsg = errRes.message || errRes.error;
          }
        } catch {}
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('網路連線異常或 Google 雲端端點連線失敗'));
    };

    xhr.ontimeout = () => {
      reject(new Error('上傳連線逾時，請檢查網路連線後重試'));
    };

    // 逾時設定為 5 分鐘
    xhr.timeout = 5 * 60 * 1000;
    xhr.send(payloadStr);
  });
}
