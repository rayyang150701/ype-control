'use client';

import React from 'react';

interface MarkdownPreviewProps {
  content?: string;
  className?: string;
  readingMode?: boolean;
}

export function MarkdownPreview({
  content,
  className = '',
  readingMode = false,
}: MarkdownPreviewProps) {
  if (!content || !content.trim()) {
    return (
      <div className={`text-xs italic text-slate-400 py-2 ${className}`}>
        尚未填寫內容...
      </div>
    );
  }

  // 輕量化安全 Markdown 渲染器
  const renderLine = (line: string, index: number) => {
    const trimmed = line.trim();

    // 水平分割線
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      return <hr key={index} className="my-4 border-t border-slate-200" />;
    }

    // 獨立圖片語法 ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const altText = imgMatch[1] || '文章圖片';
      const imgSrc = imgMatch[2];
      return (
        <figure key={index} className="my-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={altText}
            loading="lazy"
            className="rounded-xl border border-slate-200 shadow-xs max-h-96 w-auto mx-auto object-contain bg-slate-50"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          {altText && altText !== '文章圖片' && (
            <figcaption className="text-xs text-slate-500 mt-1.5 italic">
              {altText}
            </figcaption>
          )}
        </figure>
      );
    }

    // 標題 4
    if (line.startsWith('#### ')) {
      return (
        <h5
          key={index}
          className={`font-bold text-slate-900 mt-2 mb-1 ${
            readingMode ? 'text-sm md:text-base' : 'text-xs'
          }`}
        >
          {renderInline(line.slice(5))}
        </h5>
      );
    }

    // 標題 3
    if (line.startsWith('### ')) {
      return (
        <h4
          key={index}
          className={`font-bold text-slate-900 mt-3 mb-1.5 ${
            readingMode ? 'text-base md:text-lg text-indigo-950' : 'text-sm'
          }`}
        >
          {renderInline(line.slice(4))}
        </h4>
      );
    }

    // 標題 2
    if (line.startsWith('## ')) {
      return (
        <h3
          key={index}
          className={`font-extrabold text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-100 ${
            readingMode ? 'text-lg md:text-xl text-indigo-900' : 'text-base'
          }`}
        >
          {renderInline(line.slice(3))}
        </h3>
      );
    }

    // 標題 1
    if (line.startsWith('# ')) {
      return (
        <h2
          key={index}
          className={`font-black text-slate-900 mt-5 mb-2.5 pb-1.5 border-b border-slate-200 ${
            readingMode ? 'text-xl md:text-2xl text-slate-900' : 'text-lg'
          }`}
        >
          {renderInline(line.slice(2))}
        </h2>
      );
    }

    // 待辦項目清單
    if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
      return (
        <div key={index} className="flex items-center gap-2 text-xs md:text-sm text-slate-500 line-through my-0.5 pl-1">
          <span className="w-3.5 h-3.5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
            ✓
          </span>
          <span>{renderInline(line.slice(6))}</span>
        </div>
      );
    }
    if (line.startsWith('- [ ] ')) {
      return (
        <div key={index} className="flex items-center gap-2 text-xs md:text-sm text-slate-700 my-0.5 pl-1">
          <span className="w-3.5 h-3.5 rounded border border-slate-300 inline-block shrink-0" />
          <span>{renderInline(line.slice(6))}</span>
        </div>
      );
    }

    // 數字編號清單
    const numListMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numListMatch) {
      return (
        <li
          key={index}
          value={Number(numListMatch[1])}
          className={`ml-5 list-decimal text-slate-700 my-1 ${
            readingMode ? 'text-sm md:text-base leading-relaxed' : 'text-xs leading-relaxed'
          }`}
        >
          {renderInline(numListMatch[2])}
        </li>
      );
    }

    // 項目清單
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li
          key={index}
          className={`ml-5 list-disc text-slate-700 my-1 ${
            readingMode ? 'text-sm md:text-base leading-relaxed' : 'text-xs leading-relaxed'
          }`}
        >
          {renderInline(line.slice(2))}
        </li>
      );
    }

    // 引用區塊
    if (line.startsWith('> ')) {
      return (
        <blockquote
          key={index}
          className={`border-l-3 border-indigo-400 pl-3.5 py-1.5 my-2.5 bg-indigo-50/40 rounded-r-md text-slate-700 italic ${
            readingMode ? 'text-sm md:text-[15px] leading-relaxed' : 'text-xs'
          }`}
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
    }

    // 空行
    if (!trimmed) {
      return <div key={index} className={readingMode ? 'h-3' : 'h-1.5'} />;
    }

    // 普通段落
    return (
      <p
        key={index}
        className={`text-slate-700 my-1 ${
          readingMode
            ? 'text-sm md:text-[15px] leading-relaxed tracking-normal'
            : 'text-xs leading-relaxed'
        }`}
      >
        {renderInline(line)}
      </p>
    );
  };

  // 處理行內樣式 (粗體、行內代碼、超連結、行內圖片)
  const renderInline = (text: string) => {
    // 粗體 **text**、行內代碼 `code`、超連結 [title](url)、圖片 ![alt](url)
    const parts = text.split(/(!\[.*?\]\(.*?\)|\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g);
    return parts.map((part, i) => {
      // 行內圖片
      const inlineImg = part.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (inlineImg) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={inlineImg[2]}
            alt={inlineImg[1] || '圖片'}
            loading="lazy"
            className="inline-block max-h-48 rounded border border-slate-200 my-1 align-middle"
          />
        );
      }

      // 粗體
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // 行內代碼
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-[11px] font-mono border border-slate-200"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // 連結
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 font-medium underline decoration-indigo-300 hover:decoration-indigo-500 transition-colors"
          >
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  const lines = content.split('\n');

  return (
    <div className={`prose-slate max-w-none text-slate-700 ${className}`}>
      {lines.map((line, idx) => renderLine(line, idx))}
    </div>
  );
}
