'use client';

import React from 'react';

interface MarkdownPreviewProps {
  content?: string;
  className?: string;
}

export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  if (!content || !content.trim()) {
    return (
      <div className={`text-xs italic text-slate-400 py-2 ${className}`}>
        尚未填寫心得筆記...
      </div>
    );
  }

  // 輕量化安全 Markdown 渲染器
  const renderLine = (line: string, index: number) => {
    // 標題
    if (line.startsWith('### ')) {
      return (
        <h4 key={index} className="text-sm font-bold text-slate-900 mt-2 mb-1">
          {renderInline(line.slice(4))}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={index} className="text-base font-bold text-slate-900 mt-2.5 mb-1 pb-0.5 border-b border-slate-100">
          {renderInline(line.slice(3))}
        </h3>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h2 key={index} className="text-lg font-bold text-slate-900 mt-3 mb-1.5 pb-1 border-b border-slate-200">
          {renderInline(line.slice(2))}
        </h2>
      );
    }

    // 待辦項目清單
    if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
      return (
        <div key={index} className="flex items-center gap-2 text-xs text-slate-500 line-through my-0.5 pl-1">
          <span className="w-3.5 h-3.5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">✓</span>
          <span>{renderInline(line.slice(6))}</span>
        </div>
      );
    }
    if (line.startsWith('- [ ] ')) {
      return (
        <div key={index} className="flex items-center gap-2 text-xs text-slate-700 my-0.5 pl-1">
          <span className="w-3.5 h-3.5 rounded border border-slate-300 inline-block" />
          <span>{renderInline(line.slice(6))}</span>
        </div>
      );
    }

    // 項目清單
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={index} className="ml-4 list-disc text-xs text-slate-700 my-0.5 leading-relaxed">
          {renderInline(line.slice(2))}
        </li>
      );
    }

    // 引用區塊
    if (line.startsWith('> ')) {
      return (
        <blockquote key={index} className="border-l-2 border-indigo-400 pl-3 py-1 my-1.5 bg-indigo-50/50 rounded-r text-xs text-slate-700 italic">
          {renderInline(line.slice(2))}
        </blockquote>
      );
    }

    // 空行
    if (!line.trim()) {
      return <div key={index} className="h-1.5" />;
    }

    // 普通段落
    return (
      <p key={index} className="text-xs text-slate-700 leading-relaxed my-0.5">
        {renderInline(line)}
      </p>
    );
  };

  // 處理行內樣式 (粗體、行內代碼、超連結)
  const renderInline = (text: string) => {
    // 粗體 **text**
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-[11px] font-mono border border-slate-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        return (
          <a
            key={i}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline decoration-blue-300"
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
    <div className={`prose-sm max-w-none text-slate-700 ${className}`}>
      {lines.map((line, idx) => renderLine(line, idx))}
    </div>
  );
}
