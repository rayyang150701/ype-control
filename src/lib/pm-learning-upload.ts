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
 * 4. 根據檔案大小（<= 4MB 優先走內部代理，> 4MB 透過 fetch 支援 302 重導向直傳 GAS 端點）
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

  // 4. 判斷上傳通道：<= 4MB 優先透過伺服器代理 /api/pm-learning/upload，避開跨域與防火牆；> 4MB 則直接透過 fetch 直傳 GAS (完美支援 302 重導向)
  const payloadStr = JSON.stringify({
    fileName: targetFileName,
    mimeType: file.type || 'application/octet-stream',
    base64: base64,
    folderId: folderId,
  });

  const executeDirectGAS = async (): Promise<PMLearningAttachment> => {
    let simulatedPct = 30;
    onProgress?.({ percent: simulatedPct, stageMessage: `正在直傳 Google 雲端硬碟 (${formatFileSize(file.size)})...` });

    const simInterval = setInterval(() => {
      if (simulatedPct < 90) {
        simulatedPct += 2;
        onProgress?.({ percent: simulatedPct, stageMessage: `正在直傳 Google 雲端硬碟 (${simulatedPct}%)...` });
      }
    }, 700);

    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payloadStr,
        redirect: 'follow',
      });

      clearInterval(simInterval);
      onProgress?.({ percent: 95, stageMessage: 'Google Drive 正在儲存檔案並設定公開檢視權限...' });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Google 雲端回應格式錯誤 (HTTP ${res.status}): ${text.substring(0, 120)}`);
      }

      if (data && data.success && data.file) {
        onProgress?.({ percent: 100, stageMessage: '已完成上傳並取得雲端連結！' });
        const f = data.file;
        const webViewLink = f.webViewLink || `https://drive.google.com/file/d/${f.id}/view?usp=drivesdk`;

        return {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          title: targetFileName,
          url: webViewLink,
          type: 'drive',
          createdAt: new Date().toISOString(),
        };
      } else {
        const errorMsg = data?.error || data?.message || 'Google 雲端硬碟建立檔案失敗';
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      clearInterval(simInterval);
      throw err;
    }
  };

  const PROXY_LIMIT = 4 * 1024 * 1024; // 4MB
  if (file.size <= PROXY_LIMIT) {
    let proxyPct = 25;
    onProgress?.({ percent: proxyPct, stageMessage: `正在傳輸至伺服器代理 (${formatFileSize(file.size)})...` });
    const proxyInterval = setInterval(() => {
      if (proxyPct < 85) {
        proxyPct += 4;
        onProgress?.({ percent: proxyPct, stageMessage: `正在傳輸至雲端硬碟 (${proxyPct}%)...` });
      }
    }, 400);

    try {
      const res = await fetch('/api/pm-learning/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
      });

      clearInterval(proxyInterval);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.file) {
          onProgress?.({ percent: 100, stageMessage: '已完成上傳並取得雲端連結！' });
          const f = data.file;
          const webViewLink = f.webViewLink || `https://drive.google.com/file/d/${f.id}/view?usp=drivesdk`;
          return {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            title: targetFileName,
            url: webViewLink,
            type: 'drive',
            createdAt: new Date().toISOString(),
          };
        } else if (data.message || data.error) {
          throw new Error(data.message || data.error);
        }
      }
      console.warn('伺服器內部代理上傳失敗，切換至直傳 GAS 備援...');
    } catch (proxyErr: any) {
      clearInterval(proxyInterval);
      console.warn('伺服器代理端點異常，切換至直傳 GAS 備援:', proxyErr);
    }
  }

  // 大於 4MB 或代理回退：執行直傳 GAS
  return await executeDirectGAS();
}
