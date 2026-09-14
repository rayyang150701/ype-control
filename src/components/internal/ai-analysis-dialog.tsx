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

  // API Key 與 Provider 設定狀態
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiProviderInput, setApiProviderInput] = useState<'gemini' | 'openai'>('gemini');
  const [savedApiKey, setSavedApiKey] = useState('');

  // 診斷報告狀態
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<AnalysisData | null>(null);

  // 對話狀態
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 載入本地保存之 API Key
  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('user_ai_api_key') || '';
      const storedProvider = (localStorage.getItem('user_ai_provider') as 'gemini' | 'openai') || 'gemini';
      setSavedApiKey(storedKey);
      setApiKeyInput(storedKey);
      setApiProviderInput(storedProvider);
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
          customProvider: apiProviderInput,
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

  // 儲存 API Key
  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    try {
      localStorage.setItem('user_ai_api_key', trimmed);
      localStorage.setItem('user_ai_provider', apiProviderInput);
      setSavedApiKey(trimmed);
      setSettingsOpen(false);
      toast({
        title: trimmed ? '✅ API Key 已成功儲存！' : '已清除自訂 API Key',
        description: trimmed ? `後續將優先使用您的 ${apiProviderInput === 'gemini' ? 'Google Gemini' : 'OpenAI'} 金鑰進行對話與診斷。` : '系統將使用伺服器 .env 預設配置。',
      });
    } catch (err) {
      toast({ title: '儲存失敗', variant: 'destructive' });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* 頂部標題區 */}
          <DialogHeader className="p-4 pb-3 border-b bg-slate-50/80">
            <div className="flex items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>AI 專案智慧診斷與對話顧問</span>
                    {savedApiKey ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-0">
                        ⚡ 自訂 API 啟用中
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] py-0 font-normal">
                        專家推理引擎
                      </Badge>
                    )}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    結合真實待辦歷程、時程調整紀錄、實際工期與等候卡關數據進行互動式深度問答
                  </p>
                </div>
              </div>

              {/* 頂部按鈕：API 設定 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                className="gap-1.5 text-xs h-8 bg-white border-slate-300 hover:bg-slate-100"
              >
                <Settings className="h-3.5 w-3.5 text-slate-600" />
                <span>API 設定</span>
              </Button>
            </div>

            {/* 專案選擇列與模式切換標籤 */}
            <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
              {/* 診斷標的選單 */}
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
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
          </DialogHeader>

          {/* 內容本體 */}
          <div className="flex-1 overflow-y-auto min-h-[420px] max-h-[62vh] p-4">
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
                          <span className="text-[10px] text-muted-foreground block px-1">
                            {msg.timestamp}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* 思考中動畫 */}
                  {isThinking && (
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl rounded-tl-none p-3 text-xs text-indigo-900 flex items-center gap-2">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                        <span>AI 正在深入剖析【{currentProjectDisplayName}】所有待辦事項、時程落差與卡關紀錄...</span>
                      </div>
                    </div>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* 快捷發問建議 Chips */}
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium mb-1.5">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span>快捷提問推薦（點擊直接發問）：</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {QUICK_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(prompt)}
                        disabled={isThinking}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors disabled:opacity-50 text-left cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ─── 模式 2：專案歷程診斷指標報告 ─── */
              <div>
                {reportLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-3">
                    <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-xs font-medium text-muted-foreground">
                      AI 正在盤點專案歷程、計算延遲天數與歸納卡關熱點...
                    </p>
                  </div>
                ) : reportData ? (
                  <div className="space-y-4">
                    {/* 核心指標卡片 */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      <div className="rounded-lg border bg-slate-50 p-2 text-center">
                        <div className="text-[11px] text-muted-foreground">總待辦歷程</div>
                        <div className="text-base font-bold text-slate-800">{reportData.totalItems} 項</div>
                      </div>
                      <div className="rounded-lg border bg-blue-50 p-2 text-center border-blue-200">
                        <div className="text-[11px] text-blue-700">平均施作工期</div>
                        <div className="text-base font-bold text-blue-800">
                          {reportData.avgWorkDays !== null && reportData.avgWorkDays !== undefined ? `${reportData.avgWorkDays} 天` : '統計中'}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-orange-50 p-2 text-center border-orange-200">
                        <div className="text-[11px] text-orange-700">時程調整次數</div>
                        <div className="text-base font-bold text-orange-800">
                          {reportData.totalRescheduledCount || 0} 次
                        </div>
                      </div>
                      <div className="rounded-lg border bg-rose-50 p-2 text-center border-rose-200">
                        <div className="text-[11px] text-rose-700">累計延誤天數</div>
                        <div className="text-base font-bold text-rose-600">{reportData.totalDelayedDays} 天</div>
                      </div>
                      <div className="rounded-lg border bg-amber-50 p-2 text-center border-amber-200">
                        <div className="text-[11px] text-amber-700">卡關等候中</div>
                        <div className="text-base font-bold text-amber-600">{reportData.blockedCount} 項</div>
                      </div>
                      <div className="rounded-lg border bg-emerald-50 p-2 text-center border-emerald-200">
                        <div className="text-[11px] text-emerald-700">已完結項目</div>
                        <div className="text-base font-bold text-emerald-600">{reportData.completedCount} 項</div>
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

      {/* ─── API Key 設定面板彈窗 ─── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Key className="h-5 w-5 text-indigo-600" />
              <span>AI 智慧診斷 API 設定</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* 說明文字 */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1 text-blue-950">
              <p className="font-semibold">💡 API 設定說明與金鑰申請：</p>
              <p className="leading-relaxed text-blue-900">
                本系統支援 **Google Gemini**（推薦）或 **OpenAI**。即使未輸入金鑰，系統亦內建智慧專家推理引擎為您分析。
              </p>
              <div className="pt-1">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-700 hover:underline font-semibold"
                >
                  <span>👉 點此免費獲取 Google Gemini API Key</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* 模型選擇 */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-800">模型提供商 (Provider)</label>
              <Select value={apiProviderInput} onValueChange={(val: any) => setApiProviderInput(val)}>
                <SelectTrigger className="bg-white text-xs h-9">
                  <SelectValue placeholder="請選擇模型提供商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini (Gemini 1.5 Flash - 推薦，免費額度充足)</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT-4o-mini)</SelectItem>
                </SelectContent>
              </Select>
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
                金鑰僅儲存於您目前的瀏覽器中，或您亦可由伺服端管理員直接寫入根目錄 <code>.env</code> 檔案（<code>GEMINI_API_KEY=...</code>）。
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {savedApiKey && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setApiKeyInput('');
                  localStorage.removeItem('user_ai_api_key');
                  setSavedApiKey('');
                  toast({ title: '已清除本機金鑰' });
                }}
                className="text-xs text-rose-600 hover:text-rose-700"
              >
                清除金鑰
              </Button>
            )}
            <Button size="sm" onClick={handleSaveApiKey} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
              儲存設定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
