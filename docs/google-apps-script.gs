/**
 * Google Apps Script Web App - 支援多模組 Google 雲端硬碟檔案直傳 (專屬資料夾版)
 *
 * 新增功能：action = 'ensureFolder'
 *   於「父資料夾」底下依穩定識別碼 (key) 尋找或建立專屬子資料夾，回傳 folderId。
 *   - 以資料夾「說明 (description)」記錄 key (ype-key:xxx)，專案/課程改名時仍能找回同一個資料夾並同步更名。
 *   - 同一個 key 永遠只會對應一個資料夾 (整支程式受 LockService 保護，避免同時建立)。
 *   - 未帶 key 時僅以名稱尋找或建立。
 *
 * 部署方式：貼上覆蓋原程式碼 → 部署 → 管理部署作業 → 編輯(鉛筆) → 版本選「新版本」→ 部署。
 * (網址不會改變，不需修改 .env)
 */
var DEFAULT_TODO_FOLDER_ID = '11OWbYO9k7p_dfXKZ7Y1VsyJIBrZwg7Fn';
var KEY_PREFIX = 'ype-key:';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ success: false, error: '缺少請求資料 (Empty payload)' });
    }

    var data = JSON.parse(e.postData.contents);

    // 1. 處理檔案移至垃圾桶 (專案待辦既有功能相容)
    if (data.action === 'delete') {
      if (!data.fileId) {
        return responseJSON({ success: false, error: '缺少 fileId' });
      }
      var fileToDelete = DriveApp.getFileById(data.fileId);
      fileToDelete.setTrashed(true);
      return responseJSON({ success: true, message: '檔案已移至雲端硬碟垃圾桶' });
    }

    // 2. ★ 新增：尋找或建立專屬子資料夾
    if (data.action === 'ensureFolder') {
      var parentId = data.parentFolderId ? String(data.parentFolderId).trim() : DEFAULT_TODO_FOLDER_ID;
      var folderName = sanitizeFolderName(data.folderName);
      if (!folderName) {
        return responseJSON({ success: false, error: '缺少 folderName' });
      }
      var key = data.key ? String(data.key).trim() : '';
      var sub = ensureSubFolder(parentId, folderName, key);
      return responseJSON({
        success: true,
        folder: { id: sub.getId(), name: sub.getName(), url: sub.getUrl() }
      });
    }

    // 3. 處理檔案上傳
    var fileName = data.fileName;
    var mimeType = data.mimeType || 'application/octet-stream';
    var base64 = data.base64;

    if (!fileName || !base64) {
      return responseJSON({ success: false, error: '缺少 fileName 或 base64 檔案內容' });
    }

    // 未帶 folderId 時，退回使用待辦原本預設的資料夾 ID
    var targetFolderId = data.folderId ? String(data.folderId).trim() : DEFAULT_TODO_FOLDER_ID;
    var folder = DriveApp.getFolderById(targetFolderId);

    // 解碼 Base64 並建立檔案
    var decoded = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);
    var file = folder.createFile(blob);

    var fileId = file.getId();
    var webViewLink = 'https://drive.google.com/file/d/' + fileId + '/view?usp=drivesdk';
    var webContentLink = 'https://drive.google.com/uc?id=' + fileId + '&export=download';

    try {
      webViewLink = file.getUrl() || webViewLink;
    } catch (urlErr) {}

    // 嘗試設定共用權限，若受企業網域政策限制則安全略過
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {
      // 檔案已自動繼承父資料夾權限，安全忽略
    }

    return responseJSON({
      success: true,
      file: {
        id: fileId,
        name: file.getName(),
        size: file.getSize(),
        mimeType: file.getMimeType(),
        webViewLink: webViewLink,
        webContentLink: webContentLink,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (err) {
    return responseJSON({
      success: false,
      error: err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * 於 parentId 底下尋找或建立子資料夾。
 * 比對順序：1) key 相符 (若名稱已變更則同步更名)  2) 名稱相符且尚未綁定 key (認領並寫入 key)  3) 建立新資料夾
 */
function ensureSubFolder(parentId, name, key) {
  var parent = DriveApp.getFolderById(parentId);
  var byName = null;
  var takenNames = {};

  var it = parent.getFolders();
  while (it.hasNext()) {
    var f = it.next();
    var fKey = readKey(f);
    var fName = f.getName();

    if (key && fKey === key) {
      if (fName !== name && !hasFolderNamed(parent, name)) {
        f.setName(name);
      }
      return f;
    }
    if (fName === name && !fKey && !byName) {
      byName = f;
    }
    takenNames[fName] = true;
  }

  if (byName) {
    if (key) byName.setDescription(KEY_PREFIX + key);
    return byName;
  }

  // 與其他專案/課程同名時，加流水號避免混在一起
  var finalName = name;
  var n = 2;
  while (takenNames[finalName]) {
    finalName = name + ' (' + n + ')';
    n++;
  }
  var created = parent.createFolder(finalName);
  if (key) created.setDescription(KEY_PREFIX + key);
  return created;
}

function readKey(folder) {
  var desc = folder.getDescription() || '';
  var idx = desc.indexOf(KEY_PREFIX);
  if (idx === -1) return '';
  return desc.substring(idx + KEY_PREFIX.length).split(/\s/)[0];
}

function hasFolderNamed(parent, name) {
  return parent.getFoldersByName(name).hasNext();
}

function sanitizeFolderName(name) {
  return String(name || '').replace(/[\\\/:*?"<>|\r\n\t]/g, '_').replace(/\s+/g, ' ').trim().substring(0, 100);
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function authorizeDrive() {
  DriveApp.getRootFolder();
}
