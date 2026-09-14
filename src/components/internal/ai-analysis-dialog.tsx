'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bot,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Lightbulb,
  RefreshCw,
  Send,
  Settings,
  MessageSquare,
  BarChart3,
  Key,
  ExternalLink,
  Sparkles,
  Check,
  RotateCcw,
  User,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProjectOption {
  id: string;
  name: string;
  caseNumber?: string;
  category?: string;
  status?: string;
}

interface AIAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectName?: string;
  projects?: ProjectOption[];
}

interface AnalysisData {
  projectTitle: string;
  totalItems: number;
  completedCount: number;
  pendingCount: number;
  blockedCount: number;
  totalDelayedDays: number;
  delayedItemsCount: number;
  avgWorkDays?: number | null;
  totalRescheduledCount?: number;
  topDelayReasons: string[];
  bottlenecks: Array<{
    party: string;
    count: number;
    delayedDays: number;
    status: string;
  }>;
  lessonsLearnedSummary: string;
  actionableAdvice: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  '🚨 這專案目前卡關在誰身上？延誤多久？',
  '⏱ 分析當初預計完成日與實際施作工期落差？',
  '🤝 下週開進度會議，建議我和主管/客戶報告哪些重點？',
  '💡 總結這專案當初所有待辦事項的 Lesson Learnt？',
  '📅 哪些項目延期調整了最多次？原因為何？',
];

export function AIAnalysisDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projects = [],
}: AIAnalysisDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'chat' | 'report'>('chat');
  const [currentProjectId, setCurrentProjectId] = useState<string>(projectId || 'all');

  // API Key、Provider 與 Model 設定狀態
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiProviderInput, setApiProviderInput] = useState<'gemini' | 'openai'>('openai');
  const [apiModelInput, setApiModelInput] = useState('gpt-5.6-luna');
  const [savedApiKey, setSavedApiKey] = useState('');
  const [savedProvider, setSavedProvider] = useState<'gemini' | 'openai'>('openai');
  const [savedModel, setSavedModel] = useState('');
  const [activeModelName, setActiveModelName] = useState('');

  // 診斷報告狀態
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<AnalysisData | null>(null);

  // 對話狀態
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 載入本地保存之 API 設定
  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('user_ai_api_key') || '';
      const storedProvider = (localStorage.getItem('user_ai_provider') as 'gemini' | 'openai') || (storedKey.startsWith('AIza') ? 'gemini' : 'openai');
      const defaultModel = storedProvider === 'openai' ? 'gpt-5.6-luna' : 'gemini-1.5-flash';
      const storedModel = localStorage.getItem('user_ai_model') || defaultModel;

      setSavedApiKey(storedKey);
      setApiKeyInput(storedKey);
      setSavedProvider(storedProvider);
      setApiProviderInput(storedProvider);
      setSavedModel(storedModel);
      setApiModelInput(storedModel);
      setActiveModelName(storedModel);
    } catch {}
  }, []);

  // 取得目前選取專案名稱
  const currentProjectObj = projects.find((p) => p.id === currentProjectId);
  const currentProjectDisplayName = currentProjectId === 'all'
    ? '全部專案 (全廠綜合盤點)'
    : currentProjectObj
    ? `${currentProjectObj.caseNumber ? `[${currentProjectObj.caseNumber}] ` : ''}${currentProjectObj.name}`
    : projectName || '指定專案';

  // 初始化歡迎對話訊息
  const initGreeting = (projName: string) => {
    const greeting: ChatMessage = {
      id: 'greeting',
      role: 'assistant',
      content: `您好！我是您的 **AI 專案顧問** 🤖。\n\n我已完整載入【**${projName}**】的所有歷史待辦事項、最初預計完成日、時程延期次數、實際工期與卡關等候等全方位歷程數據。\n\n您可以點選下方**建議問題**或直接提問，我將針對該專案為您進行客觀剖析與行動策略建議！`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([greeting]);
  };

  // 執行診斷報告
  const runAnalysis = async (targetId: string = currentProjectId) => {
    setReportLoading(true);
    try {
      const res = await fetch('/api/ai/analyze-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: targetId === 'all' ? undefined : targetId }),
      });
      const json = await res.json();
      if (json.success && json.analysis) {
        setReportData(json.analysis);
      }
    } catch (err) {
      console.error('執行 AI 分析失敗:', err);
    } finally {
      setReportLoading(false);
    }
  };

  // 發送對話問題
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuestion).trim();
    if (!query || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputQuestion('');
    setIsThinking(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProjectId === 'all' ? undefined : currentProjectId,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          customApiKey: savedApiKey || undefined,
          customProvider: savedApiKey ? savedProvider : undefined,
          customModel: savedApiKey ? (savedModel || undefined) : undefined,
        }),
      });

      const json = await res.json();
      if (json.success && json.reply) {
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: json.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (json.usedModel) {
          setActiveModelName(json.usedModel);
        }
      } else {
        toast({ title: 'AI 分析異常', description: json.message || '無法取得回答', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: '連線失敗', description: err.message, variant: 'destructive' });
    } finally {
      setIsThinking(false);
    }
  };

  // 當彈窗打開或 projectId 變更
  useEffect(() => {
    if (open) {
      const initialId = projectId || 'all';
      setCurrentProjectId(initialId);
      const proj = projects.find((p) => p.id === initialId);
      const name = initialId === 'all' ? '全部專案 (全廠綜合盤點)' : (proj ? `${proj.caseNumber ? `[${proj.caseNumber}] ` : ''}${proj.name}` : projectName || '指定專案');
      initGreeting(name);
      runAnalysis(initialId);
    }
  }, [open, projectId]);

  // 切換專案連動
  const handleProjectChange = (val: string) => {
    setCurrentProjectId(val);
    const proj = projects.find((p) => p.id === val);
    const name = val === 'all' ? '全部專案 (全廠綜合盤點)' : (proj ? `${proj.caseNumber ? `[${proj.caseNumber}] ` : ''}${proj.name}` : '指定專案');
    initGreeting(name);
    runAnalysis(val);
  };

  // 自動捲動至對話最底端
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, activeTab]);

  // 儲存 API 設定
  const handleSaveApiKey = () => {
    try {
      const trimmedKey = apiKeyInput.trim();
      const trimmedModel = apiModelInput.trim() || (apiProviderInput === 'openai' ? 'gpt-5.6-luna' : 'gemini-1.5-flash');

      if (trimmedKey) {
        localStorage.setItem('user_ai_api_key', trimmedKey);
        setSavedApiKey(trimmedKey);
      }
      localStorage.setItem('user_ai_provider', apiProviderInput);
      setSavedProvider(apiProviderInput);
      localStorage.setItem('user_ai_model', trimmedModel);
      setSavedModel(trimmedModel);
      setApiModelInput(trimmedModel);
      setActiveModelName(trimmedKey ? trimmedModel : '內建專家規則引擎');

      toast({
        title: 'API 設定已儲存',
        description: `供應商: ${apiProviderInput === 'openai' ? 'OpenAI' : 'Google Gemini'} | 模型: ${trimmedModel}`,
      });
      setSettingsOpen(false);
    } catch (e: any) {
      toast({ title: '儲存失敗', description: e.message, variant: 'destructive' });
    }
  };

  // 清除 API 設定
  const handleClearSettings = () => {
    setApiKeyInput('');
    setSavedApiKey('');
    localStorage.removeItem('user_ai_api_key');
    localStorage.removeItem('user_ai_model');
    localStorage.removeItem('user_ai_provider');
    setSavedModel('');
    setActiveModelName('內建專家規則引擎');
    toast({ title: '已清除本機 API 設定' });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50/50">
          {/* 頂部 Header */}
          <DialogHeader className="p-4 bg-white border-b shrink-0 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                    <span>AI 智慧診斷顧問</span>
                    <Badge variant="secondary" className="text-[11px] font-normal bg-indigo-50 text-indigo-700 border-indigo-200">
                      專案歷程深度分析
                    </Badge>
                  </DialogTitle>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* API 設定按鈕 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettingsOpen(true)}
                  className="gap-1.5 text-xs h-8 text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-slate-500" />
                  <span>⚙️ API 與模型設定</span>
                  {savedApiKey && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </Button>
              </div>
            </div>

            {/* 專案選單列與頁籤切換 */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
              {/* 專案選擇器 */}
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">
                  診斷標的：
                </span>
                <Select value={currentProjectId} onValueChange={handleProjectChange}>
                  <SelectTrigger className="bg-white text-xs h-8 border-slate-300 flex-1">
                    <SelectValue placeholder="請選擇診斷專案" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all" className="font-semibold text-indigo-900">
                      🌐 全部專案 (全廠綜合盤點與跨案比較)
                    </SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.caseNumber ? `[${p.caseNumber}] ` : ''}{p.name}
                        {p.category ? ` (${p.category})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 模式切換 Tabs */}
              <div className="flex items-center p-1 bg-slate-200/70 rounded-lg border border-slate-300/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'chat'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>💬 對話式問答</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('report')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'report'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>📊 歷程診斷報告</span>
                </button>
              </div>
            </div>

            {/* 目前使用的模型資訊條 */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/90 rounded-md border text-[11px] text-slate-600">
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span>目前引擎：</span>
                <span className="font-mono font-bold text-indigo-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {activeModelName || savedModel || (savedProvider === 'openai' ? 'gpt-5.6-luna' : 'gemini-1.5-flash')}
                </span>
                {savedApiKey ? (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-300">
                    {savedProvider === 'openai' ? 'OpenAI' : 'Gemini'} (個人金鑰)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-blue-50 text-blue-700 border-blue-300">
                    伺服端環境預設
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline cursor-pointer flex items-center gap-1 shrink-0 ml-2"
              >
                <Settings className="h-3 w-3" />
                <span>切換模型</span>
              </button>
            </div>
          </DialogHeader>

          {/* 內容本體 */}
          <div className="flex-1 overflow-y-auto min-h-[420px] max-h-[60vh] p-4">
            {activeTab === 'chat' ? (
              /* ─── 模式 1：對話式 AI 顧問 ─── */
              <div className="flex flex-col h-full space-y-3.5">
                {/* 訊息流 */}
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isUser ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white shadow-2xs'
                          }`}
                        >
                          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>

                        <div className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`p-3 rounded-xl text-xs leading-relaxed ${
                              isUser
                                ? 'bg-blue-600 text-white rounded-tr-none'
                                : 'bg-white border border-slate-200 text-slate-900 shadow-2xs rounded-tl-none whitespace-pre-line'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <div className={`text-[10px] text-slate-400 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                            {msg.timestamp}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* AI 思考中指示 */}
                  {isThinking && (
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 animate-pulse" />
                      </div>
                      <div className="bg-white border border-indigo-200 p-3 rounded-xl rounded-tl-none text-xs text-indigo-900 flex items-center gap-2 shadow-2xs">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                        <span>AI 顧問正在比對【{currentProjectDisplayName}】的所有歷史待辦與工期數據...</span>
                      </div>
                    </div>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* 快捷推薦問題 Chips */}
                <div className="pt-2 border-t border-slate-200/80">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-1.5">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span>快速請教 AI（點擊即發問）：</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(prompt)}
                        disabled={isThinking}
                        className="text-[11px] px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 rounded-full text-slate-600 transition-colors text-left cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ─── 模式 2：歷程診斷報告 (圖表與量化分析) ─── */
              <div className="space-y-4">
                {reportLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
                    <p className="text-sm">正在深度分析【{currentProjectDisplayName}】的待辦時程數據...</p>
                  </div>
                ) : reportData ? (
                  <div className="space-y-4">
                    {/* 數據總覽小卡 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="rounded-lg border bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="text-xs">總待辦項目</span>
                          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="mt-1.5 text-xl font-bold text-slate-900">
                          {reportData.totalItems}
                          <span className="text-xs font-normal text-muted-foreground ml-1">項</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          完成率 {reportData.totalItems > 0 ? Math.round((reportData.completedCount / reportData.totalItems) * 100) : 0}%
                        </div>
                      </div>

                      <div className="rounded-lg border bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="text-xs">卡關等候中</span>
                          <Clock className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="mt-1.5 text-xl font-bold text-amber-600">
                          {reportData.blockedCount}
                          <span className="text-xs font-normal text-muted-foreground ml-1">項</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          需要跨單位介入協調
                        </div>
                      </div>

                      <div className="rounded-lg border bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="text-xs">平均施作工期</span>
                          <Clock className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="mt-1.5 text-xl font-bold text-emerald-600">
                          {reportData.avgWorkDays !== null && reportData.avgWorkDays !== undefined
                            ? `${reportData.avgWorkDays} 天`
                            : '計算中'}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          累計調整 {reportData.totalRescheduledCount || 0} 次時程
                        </div>
                      </div>

                      <div className="rounded-lg border bg-white p-3 shadow-2xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="text-xs">累計延誤天數</span>
                          <AlertTriangle className="h-4 w-4 text-rose-500" />
                        </div>
                        <div className="mt-1.5 text-xl font-bold text-rose-600">
                          {reportData.totalDelayedDays}
                          <span className="text-xs font-normal text-muted-foreground ml-1">天</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          共 {reportData.delayedItemsCount} 項曾發生逾期
                        </div>
                      </div>
                    </div>

                    {/* AI 行動跟催建議 */}
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2 text-indigo-950 font-bold text-xs">
                        <Bot className="h-4 w-4 text-indigo-600" />
                        AI 專家跟催與行動對策
                      </div>
                      <p className="text-xs leading-relaxed text-indigo-950 whitespace-pre-line bg-white/80 rounded p-2.5 border border-indigo-100">
                        {reportData.actionableAdvice}
                      </p>
                    </div>

                    {/* 卡關對象與瓶頸排行榜 */}
                    {reportData.bottlenecks.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <Users className="h-3.5 w-3.5 text-rose-600" />
                          卡關熱點對象排行榜 (Waiting-on Bottlenecks)
                        </div>
                        <div className="space-y-1.5">
                          {reportData.bottlenecks.map((b, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between rounded-md border px-3 py-2 text-xs bg-white"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700">
                                  {idx + 1}. {b.party}
                                </span>
                                <Badge
                                  variant={b.status === '嚴重卡關' ? 'destructive' : 'secondary'}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {b.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-muted-foreground text-xs">
                                <span>卡關項目：{b.count} 筆</span>
                                <span className="font-bold text-rose-600">
                                  累計延誤：{b.delayedDays} 天
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 具體延誤議題清單 */}
                    {reportData.topDelayReasons.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          延遲主要議題
                        </div>
                        <ul className="space-y-1 rounded-md border bg-slate-50/50 p-2.5 text-xs text-slate-700 list-disc list-inside">
                          {reportData.topDelayReasons.map((reason, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 歷史經驗檢討總結 */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                        歷史歷程檢討總結 (Lesson Learnt)
                      </div>
                      <p className="text-xs text-amber-950 leading-relaxed bg-white/80 p-2 rounded border border-amber-100">
                        {reportData.lessonsLearnedSummary}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-xs text-muted-foreground">
                    尚無分析資料
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 底部輸入列 (僅在對話模式顯示) / 關閉按鈕 */}
          <DialogFooter className="p-3 border-t bg-slate-50/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {activeTab === 'chat' ? (
              <div className="flex items-center gap-2 w-full">
                <Input
                  placeholder={`向 AI 請教【${currentProjectDisplayName}】的待辦事項與改善對策... (按 Enter 發送)`}
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isThinking}
                  className="bg-white text-xs h-9 flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => handleSendMessage()}
                  disabled={isThinking || !inputQuestion.trim()}
                  className="h-9 px-3 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>發送</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAnalysis(currentProjectId)}
                  disabled={reportLoading}
                  className="gap-1.5 text-xs h-8"
                >
                  <RefreshCw className={`h-3 w-3 ${reportLoading ? 'animate-spin' : ''}`} />
                  <span>重新產生診斷</span>
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onOpenChange(false)} className="text-xs h-8">
                  關閉視窗
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── API Key 與模型指定設定面板彈窗 ─── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Key className="h-5 w-5 text-indigo-600" />
              <span>AI 智慧診斷 API 與模型設定</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* 說明文字 */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5 text-blue-950">
              <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                <span>支援 OpenAI 全系列與 Google Gemini 模型</span>
              </div>
              <p className="leading-relaxed text-blue-900">
                若您的 OpenAI 帳號支援 <strong className="font-mono bg-blue-100 px-1 py-0.5 rounded text-indigo-800">gpt-5.6-luna</strong>（擁有高達 5,000,000 TPD 的充裕額度），可直接於下方指定使用！
              </p>
            </div>

            {/* 模型提供商選擇 */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800">模型提供商 (Provider)</label>
              <Select
                value={apiProviderInput}
                onValueChange={(val: 'gemini' | 'openai') => {
                  setApiProviderInput(val);
                  if (val === 'openai' && (!apiModelInput || apiModelInput.includes('gemini'))) {
                    setApiModelInput('gpt-5.6-luna');
                  } else if (val === 'gemini' && (!apiModelInput || apiModelInput.includes('gpt'))) {
                    setApiModelInput('gemini-1.5-flash');
                  }
                }}
              >
                <SelectTrigger className="bg-white text-xs h-9">
                  <SelectValue placeholder="請選擇模型提供商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (支援 gpt-5.6-luna, gpt-4o-mini 等)</SelectItem>
                  <SelectItem value="gemini">Google Gemini (支援 1.5 Flash, 2.0 Flash 等)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 指定模型名稱與快速標籤 Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800">指定模型名稱 (Model ID)</label>
                <span className="text-[11px] text-muted-foreground">點選下方標籤快速填入</span>
              </div>

              {/* 快速標籤 Chips */}
              {apiProviderInput === 'openai' ? (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'gpt-5.6-luna', label: '⭐ gpt-5.6-luna (500萬 TPD 首選)', hot: true },
                    { id: 'gpt-4o-mini', label: 'gpt-4o-mini (200萬 TPD)' },
                    { id: 'gpt-5.6-terra', label: 'gpt-5.6-terra (90萬 TPD)' },
                    { id: 'gpt-4o', label: 'gpt-4o (旗艦版)' },
                    { id: 'o3-mini', label: 'o3-mini (深度推理)' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setApiModelInput(m.id)}
                      className={`px-2 py-1 rounded border text-[11px] transition-colors cursor-pointer ${
                        apiModelInput === m.id
                          ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-2xs'
                          : m.hot
                          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-medium'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'gemini-1.5-flash', label: '⭐ gemini-1.5-flash (推薦免費)', hot: true },
                    { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash (最新極速)' },
                    { id: 'gemini-1.5-pro', label: 'gemini-1.5-pro (深度長文)' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setApiModelInput(m.id)}
                      className={`px-2 py-1 rounded border text-[11px] transition-colors cursor-pointer ${
                        apiModelInput === m.id
                          ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-2xs'
                          : m.hot
                          ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-medium'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              <Input
                placeholder={apiProviderInput === 'openai' ? '例如: gpt-5.6-luna' : '例如: gemini-1.5-flash'}
                value={apiModelInput}
                onChange={(e) => setApiModelInput(e.target.value)}
                className="bg-white text-xs font-mono h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                亦可自行手動輸入任何專屬或客製模型 ID。
              </p>
            </div>

            {/* API Key 輸入框 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800">
                  {apiProviderInput === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
                </label>
                {savedApiKey && (
                  <span className="text-[11px] text-emerald-600 font-medium">● 本機已儲存金鑰</span>
                )}
              </div>
              <Input
                type="password"
                placeholder={apiProviderInput === 'gemini' ? '貼上 AIzaSy... 格式金鑰' : '貼上 sk-... 格式金鑰'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="bg-white text-xs font-mono h-9"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                金鑰僅儲存於您個人的瀏覽器中，亦可由系統管理者直接寫入 <code>.env</code> 檔案。
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {savedApiKey && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSettings}
                className="text-xs text-rose-600 hover:text-rose-700 cursor-pointer"
              >
                清除金鑰與自訂
              </Button>
            )}
            <Button size="sm" onClick={handleSaveApiKey} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer">
              儲存設定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
