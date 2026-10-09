'use client';

import React, { useState } from 'react';
import { X, ZoomIn, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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
  const [lightboxImg, setLightboxImg] = useState<{ src: string; alt?: string } | null>(null);

  if (typeof content !== 'string' || !content.trim()) {
    return (
      <div className={`text-xs italic text-slate-400 py-2 ${className}`}>
        尚未填寫內容...
      </div>
    );
  }

  // 渲染獨立圖片元件 (帶點擊放大燈箱)
  const renderImage = (src: string, altText: string, key: React.Key) => {
    return (
      <figure key={key} className="my-5 text-center group">
        <div
          onClick={() => setLightboxImg({ src, alt: altText })}
          className="relative inline-block cursor-zoom-in max-w-full overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50 shadow-xs hover:shadow-md transition-all"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={altText}
            loading="lazy"
            className="max-h-[520px] w-auto mx-auto object-contain transition-transform group-hover:scale-[1.01]"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute bottom-2 right-2 bg-slate-900/70 hover:bg-slate-900 text-white p-1 rounded-md text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
            <ZoomIn className="w-3 h-3" />
            <span>點擊放大檢視</span>
          </div>
        </div>
        {altText && altText !== '文章圖片' && altText !== '文章圖表' && (
          <figcaption className="text-xs text-slate-500 mt-2 font-medium italic">
            {altText}
          </figcaption>
        )}
      </figure>
    );
  };

  // 輕量化安全 Markdown 渲染器
  const renderLine = (line: string, index: number) => {
    const trimmed = line.trim();

    // 水平分割線
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      return <hr key={index} className="my-5 border-t border-slate-200" />;
    }

    // 獨立圖片語法 ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imgMatch) {
      const altText = imgMatch[1] || '文章圖片';
      const imgSrc = imgMatch[2];
      return renderImage(imgSrc, altText, index);
    }

    // HTML 圖片標籤 <img src="..." alt="..." />
    const htmlImgMatch = trimmed.match(/^<img\s+[^>]*src=["']([^"']+)["'][^>]*alt=["']?([^"'>]*)["']?[^>]*\/?>$/i) ||
      trimmed.match(/^<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>$/i);
    if (htmlImgMatch) {
      const imgSrc = htmlImgMatch[1];
      const altText = htmlImgMatch[2] || '文章插圖';
      return renderImage(imgSrc, altText, index);
    }

    // 標題 4
    if (line.startsWith('#### ')) {
      return (
        <h5
          key={index}
          className={`font-bold text-slate-900 mt-3 mb-1.5 ${
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
          className={`font-bold text-slate-900 mt-4 mb-2 ${
            readingMode ? 'text-base md:text-lg text-indigo-950 font-black' : 'text-sm'
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
          className={`font-extrabold text-slate-900 mt-6 mb-3 pb-1.5 border-b border-slate-200/70 ${
            readingMode ? 'text-lg md:text-xl text-indigo-950 font-black' : 'text-base'
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
          className={`font-black text-slate-900 mt-7 mb-3.5 pb-2 border-b-2 border-indigo-200 ${
            readingMode ? 'text-xl md:text-2xl text-slate-950' : 'text-lg'
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
          className={`border-l-4 border-indigo-500 pl-4 py-2 my-3 bg-indigo-50/50 rounded-r-lg text-slate-700 italic ${
            readingMode ? 'text-sm md:text-[15px] leading-relaxed' : 'text-xs'
          }`}
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
    }

    // 表格列處理 | col1 | col2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (trimmed.includes('---')) {
        return null; // 分隔線已由表格外層處理或忽略
      }
      const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
      return (
        <div key={index} className="overflow-x-auto my-2">
          <div className="inline-flex border border-slate-200 rounded-lg overflow-hidden text-xs md:text-sm divide-x divide-slate-200 bg-white">
            {cells.map((cell, cIdx) => (
              <div key={cIdx} className="px-3 py-1.5 min-w-[80px]">
                {renderInline(cell)}
              </div>
            ))}
          </div>
        </div>
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
        className={`text-slate-800 my-1.5 ${
          readingMode
            ? 'text-sm md:text-[16px] leading-relaxed tracking-normal font-normal'
            : 'text-xs leading-relaxed'
        }`}
      >
        {renderInline(line)}
      </p>
    );
  };

  // 處理行內樣式 (粗體、行內代碼、超連結、行內圖片)
  const renderInline = (text: string) => {
    // 粗體 **text**、行內代碼 `code`、超連結 [title](url)、圖片 ![alt](url)、斜體 *text*
    const parts = text.split(/(!\[.*?\]\(.*?\)|\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|(?<!\*)\*(?!\*).*?(?<!\*)\*(?!\*))/g);
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
            onClick={() => setLightboxImg({ src: inlineImg[2], alt: inlineImg[1] })}
            className="inline-block max-h-48 rounded-lg border border-slate-200 my-1 align-middle cursor-zoom-in hover:opacity-95"
          />
        );
      }

      // 粗體
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-slate-950">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // 斜體
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return (
          <em key={i} className="italic text-slate-600">
            {part.slice(1, -1)}
          </em>
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
            className="text-indigo-600 hover:text-indigo-800 font-semibold underline decoration-indigo-300 hover:decoration-indigo-500 transition-colors"
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
    <>
      <div className={`prose-slate max-w-none text-slate-800 ${className}`}>
        {lines.map((line, idx) => renderLine(line, idx))}
      </div>

      {/* 圖片點擊放大燈箱 (Lightbox) */}
      {lightboxImg && (
        <Dialog open={Boolean(lightboxImg)} onOpenChange={() => setLightboxImg(null)}>
          <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] p-2 bg-slate-950/95 border-slate-800 flex flex-col items-center justify-center overflow-hidden">
            <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImg.src}
                alt={lightboxImg.alt || '放大檢視'}
                className="max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl"
              />
              {lightboxImg.alt && (
                <p className="text-xs text-slate-300 mt-2 text-center max-w-lg font-medium">
                  {lightboxImg.alt}
                </p>
              )}
              <div className="absolute top-2 right-2 flex items-center gap-2">
                <a
                  href={lightboxImg.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  title="另開新視窗開啟原圖"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImg(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  title="關閉"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
