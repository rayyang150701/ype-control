/**
 * 智慧 HTML 轉 Markdown 工具函式
 * 支援將從 Notion、網頁文章、Medium、電子報複製之富文本 (包含圖表 <img>、標題、表格、清單)
 * 完美轉換為 Markdown 語法，保留圖片 URL 與圖說。
 */

export function convertHtmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // 在瀏覽器環境下使用 DOMParser 進行語法樹解析
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // 伺服端簡易正規表示式備援
    return html
      .replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, '![]($1)')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return processNode(doc.body).trim();
  } catch (err) {
    console.warn('HTML to Markdown 解析失敗，使用文字備援:', err);
    return html.replace(/<[^>]+>/g, '');
  }
}

function processNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // 1. 圖片處理 (支援獨立 <img> 與 Notion 專屬 <figure><img/><figcaption></figure>)
  if (tag === 'img') {
    const src = el.getAttribute('src') || '';
    const alt = el.getAttribute('alt') || '文章圖片';
    if (!src) return '';
    return `\n\n![${alt}](${src})\n\n`;
  }

  if (tag === 'figure') {
    const img = el.querySelector('img');
    const figcaption = el.querySelector('figcaption');
    if (img) {
      const src = img.getAttribute('src') || '';
      const captionText = figcaption ? figcaption.textContent?.trim() : '';
      const alt = captionText || img.getAttribute('alt') || '文章圖表';
      if (!src) return '';
      return `\n\n![${alt}](${src})${captionText ? `\n\n*${captionText}*` : ''}\n\n`;
    }
  }

  // 2. 標題處理
  if (tag === 'h1') {
    return `\n\n# ${getChildrenMarkdown(el).trim()}\n\n`;
  }
  if (tag === 'h2') {
    return `\n\n## ${getChildrenMarkdown(el).trim()}\n\n`;
  }
  if (tag === 'h3') {
    return `\n\n### ${getChildrenMarkdown(el).trim()}\n\n`;
  }
  if (tag === 'h4') {
    return `\n\n#### ${getChildrenMarkdown(el).trim()}\n\n`;
  }
  if (tag === 'h5' || tag === 'h6') {
    return `\n\n##### ${getChildrenMarkdown(el).trim()}\n\n`;
  }

  // 3. 段落與換行
  if (tag === 'p') {
    const content = getChildrenMarkdown(el).trim();
    if (!content) return '';
    return `\n\n${content}\n\n`;
  }
  if (tag === 'br') {
    return '\n';
  }
  if (tag === 'hr') {
    return '\n\n---\n\n';
  }

  // 4. 引用區塊
  if (tag === 'blockquote') {
    const lines = getChildrenMarkdown(el).trim().split('\n');
    return `\n\n${lines.map((l) => `> ${l}`).join('\n')}\n\n`;
  }

  // 5. 清單處理
  if (tag === 'ul') {
    const items = Array.from(el.children)
      .map((child) => `- ${getChildrenMarkdown(child).trim()}`)
      .join('\n');
    return `\n\n${items}\n\n`;
  }
  if (tag === 'ol') {
    const items = Array.from(el.children)
      .map((child, idx) => `${idx + 1}. ${getChildrenMarkdown(child).trim()}`)
      .join('\n');
    return `\n\n${items}\n\n`;
  }
  if (tag === 'li') {
    return getChildrenMarkdown(el);
  }

  // 6. 表格處理
  if (tag === 'table') {
    const rows = Array.from(el.querySelectorAll('tr'));
    if (rows.length === 0) return '';
    const tableMd: string[] = [];
    rows.forEach((tr, rIdx) => {
      const cells = Array.from(tr.querySelectorAll('th, td')).map((c) =>
        (c.textContent || '').replace(/[\r\n|]/g, ' ').trim()
      );
      if (cells.length > 0) {
        tableMd.push(`| ${cells.join(' | ')} |`);
        if (rIdx === 0) {
          tableMd.push(`| ${cells.map(() => '---').join(' | ')} |`);
        }
      }
    });
    return `\n\n${tableMd.join('\n')}\n\n`;
  }

  // 7. 行內強調與格式
  if (tag === 'strong' || tag === 'b') {
    const text = getChildrenMarkdown(el).trim();
    return text ? ` **${text}** ` : '';
  }
  if (tag === 'em' || tag === 'i') {
    const text = getChildrenMarkdown(el).trim();
    return text ? ` *${text}* ` : '';
  }
  if (tag === 'code') {
    return `\`${el.textContent || ''}\``;
  }
  if (tag === 'pre') {
    return `\n\n\`\`\`\n${el.textContent || ''}\n\`\`\`\n\n`;
  }
  if (tag === 'a') {
    const href = el.getAttribute('href');
    const text = getChildrenMarkdown(el).trim() || href || '連結';
    if (href) {
      return `[${text}](${href})`;
    }
    return text;
  }

  // 其他容器標籤 (div, span, section, article 等) 遞迴處理子節點
  return getChildrenMarkdown(el);
}

function getChildrenMarkdown(el: Element | Node): string {
  let result = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    result += processNode(el.childNodes[i]);
  }
  return result;
}

/**
 * 將圖片檔案 (File/Blob) 轉換為 Base64 Data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('讀取圖片失敗'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
