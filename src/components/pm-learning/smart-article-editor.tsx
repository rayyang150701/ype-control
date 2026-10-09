'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  Image as ImageIcon,
  ClipboardPaste,
  Eye,
  Edit3,
  Loader2,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { convertHtmlToMarkdown, fileToBase64 } from '@/lib/html-to-markdown';
import { MarkdownPreview } from './markdown-preview';
import { useToast } from '@/hooks/use-toast';

interface SmartArticleEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  minHeight?: string;
  label?: string;
  showPreviewTab?: boolean;
}

export function SmartArticleEditor({
  value,
  onChange,
  placeholder = '支援直接貼上包含圖片的 Notion / 網頁文章或截圖 (Ctrl+V)...',
  rows = 8,
  className = '',
  minHeight = '180px',
  label,
  showPreviewTab = true,
}: SmartArticleEditorProps) {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isProcessingPaste, setIsProcessingPaste] = useState(false);

  // 在游標處插入文字
  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value ? `${value}\n\n${textToInsert}` : textToInsert);
      return;
    }

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const currentVal = value || '';

    const newVal =
      currentVal.substring(0, startPos) +
      textToInsert +
      currentVal.substring(endPos);

    onChange(newVal);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = startPos + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  // 攔截並智慧處理貼上事件 (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // 1. 檢查剪貼簿中是否有圖片檔案 (例如：截圖 Win+Shift+S 或網頁右鍵複製圖片)
    const items = clipboardData.items;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          setIsProcessingPaste(true);
          try {
            const file = item.getAsFile();
            if (file) {
              const base64 = await fileToBase64(file);
              insertTextAtCursor(`\n\n![文章插圖](${base64})\n\n`);
              toast({
                title: '🖼️ 圖片/截圖已成功插入！',
                description: '已轉換為高解析度圖檔語法，切換至預覽可立即檢視。',
              });
            }
          } catch (err) {
            toast({ title: '圖片讀取失敗', variant: 'destructive' });
          } finally {
            setIsProcessingPaste(false);
          }
          return;
        }
      }
    }

    // 2. 檢查剪貼簿中是否有 HTML (從 Notion、網頁、Medium 等反白複製整篇圖文)
    const html = clipboardData.getData('text/html');
    if (html && (html.includes('<img') || html.includes('<figure') || html.includes('<h1') || html.includes('<h2') || html.includes('<table'))) {
      e.preventDefault();
      setIsProcessingPaste(true);
      try {
        const markdown = convertHtmlToMarkdown(html);
        if (markdown) {
          insertTextAtCursor(markdown);
          toast({
            title: '✨ 已智慧保留圖文並茂排版！',
            description: '已成功從剪貼簿擷取圖片網址、圖表說明與結構化格式。',
          });
          return;
        }
      } catch (err) {
        console.warn('HTML 轉 Markdown 失敗，退回預設文字貼上', err);
      } finally {
        setIsProcessingPaste(false);
      }
    }

    // 3. 一般純文字貼上，交由瀏覽器原生預設行為
  };

  // 處理本機圖片上傳插入
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingPaste(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const base64 = await fileToBase64(file);
          const altName = file.name.replace(/\.[^/.]+$/, '') || '文章插圖';
          insertTextAtCursor(`\n\n![${altName}](${base64})\n\n`);
        }
      }
      toast({ title: '📷 圖片已成功加入文章！' });
    } catch (err) {
      toast({ title: '圖片上傳失敗', variant: 'destructive' });
    } finally {
      setIsProcessingPaste(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 點擊「一鍵貼上剪貼簿內容」按鈕
  const handleReadClipboard = async () => {
    if (!navigator.clipboard) {
      toast({ title: '您的瀏覽器不支援讀取剪貼簿，請直接按 Ctrl+V 貼上' });
      return;
    }

    setIsProcessingPaste(true);
    try {
      // 嘗試讀取剪貼簿項目
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          // 圖片型態
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], 'clipboard-image.png', { type: imageType });
            const base64 = await fileToBase64(file);
            insertTextAtCursor(`\n\n![文章插圖](${base64})\n\n`);
            toast({ title: '🖼️ 剪貼簿圖片已成功插入！' });
            return;
          }

          // HTML 型態
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            const html = await blob.text();
            const md = convertHtmlToMarkdown(html);
            insertTextAtCursor(md);
            toast({ title: '✨ 剪貼簿圖文已成功貼入！' });
            return;
          }
        }
      }

      // 純文字備援
      const text = await navigator.clipboard.readText();
      if (text) {
        insertTextAtCursor(text);
        toast({ title: '已貼入文字內容' });
      }
    } catch (err: any) {
      toast({
        title: '無法直接讀取剪貼簿',
        description: '請直接在輸入框中按下鍵盤「Ctrl + V」(或 Cmd + V) 貼上即可！',
      });
    } finally {
      setIsProcessingPaste(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 頂部工具列 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {label && <span className="text-xs font-semibold text-slate-800">{label}</span>}
          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>支援直接 Ctrl+V 一鍵貼上圖文/截圖</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 貼上剪貼簿內容 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReadClipboard}
            disabled={isProcessingPaste}
            className="h-7 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-100"
            title="一鍵貼上剪貼簿圖文 (包含圖片與格式)"
          >
            {isProcessingPaste ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ClipboardPaste className="w-3 h-3 text-indigo-600" />
            )}
            <span>一鍵貼上圖文</span>
          </Button>

          {/* 插入本機圖片 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingPaste}
            className="h-7 text-xs gap-1 border-slate-200 text-slate-700 hover:bg-slate-100"
            title="選取本機圖片檔插入"
          >
            <ImageIcon className="w-3 h-3 text-emerald-600" />
            <span>插入圖片</span>
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* 編輯 / 預覽分頁切換 */}
          {showPreviewTab && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-1">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'edit'
                    ? 'bg-white text-indigo-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3 h-3" />
                <span>編輯</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                  activeTab === 'preview'
                    ? 'bg-white text-indigo-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>預覽圖文</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 內容區塊：編輯 vs 預覽 */}
      {activeTab === 'edit' ? (
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={handlePaste}
            placeholder={placeholder}
            rows={rows}
            style={{ minHeight }}
            className="text-xs font-mono leading-relaxed bg-white border-slate-200 focus-visible:ring-indigo-400 resize-y"
          />
          {isProcessingPaste && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center rounded-lg gap-2 text-xs text-indigo-900 font-bold">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>正在智慧轉換剪貼簿圖文...</span>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{ minHeight }}
          className="p-4 bg-slate-50/50 rounded-lg border border-slate-200 max-h-96 overflow-y-auto"
        >
          {value.trim() ? (
            <MarkdownPreview content={value} readingMode={false} />
          ) : (
            <div className="text-center py-8 text-xs text-slate-400 italic">
              尚未輸入內容，切換至「編輯」貼上圖文或截圖後即可在此即時預覽！
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
        <span className="flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          <span>從 Notion / 網頁全選複製後直接按 Ctrl+V，圖表與文字將自動轉入並保留！</span>
        </span>
        <span>{value ? `${value.length} 字元` : '0 字元'}</span>
      </div>
    </div>
  );
}
