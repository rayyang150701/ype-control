'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  MapPin,
  Users,
  Building,
  FileText,
  Clock,
  Edit,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  ExternalLink,
  Video,
  Copy,
  Check,
  Mail,
} from 'lucide-react';
import { BusinessTrip, TRIP_CATEGORIES } from '@/types/businessTrip';
import { formatDateChinese, isTripReportOverdue, generateGoogleCalendarUrl } from '@/lib/calendar-helper';
import { useToast } from '@/hooks/use-toast';

interface TripDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: BusinessTrip | null;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange?: (newStatus: 'confirmed' | 'pending') => void;
  canManage?: boolean;
}

export function TripDetailDialog({
  open,
  onOpenChange,
  trip,
  onEdit,
  onDelete,
  onStatusChange,
  canManage = true,
}: TripDetailDialogProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const category = trip ? TRIP_CATEGORIES.find((c) => c.value === trip.category) : undefined;
  const isOverdue = trip
    ? isTripReportOverdue(trip.endDate, trip.endTime, trip.notes, trip.location, trip.travelers)
    : false;

  const handleStatusToggle = () => {
    if (!canManage) return;
    if (trip && onStatusChange) {
      const newStatus = trip.status === 'pending' ? 'confirmed' : 'pending';
      onStatusChange(newStatus);
    }
  };

  // 生成排版專業乾淨的郵件內容 (可直接發送或貼至通訊軟體)
  const emailContent = useMemo(() => {
    if (!trip) return '';
    const categoryLabel = category?.label || '行程';
    const travelersStr = trip.travelers && trip.travelers.length > 0 ? trip.travelers.join('、') : '未指定';
    const dateStr = trip.startDate === trip.endDate 
      ? formatDateChinese(trip.startDate)
      : `${formatDateChinese(trip.startDate)} ~ ${formatDateChinese(trip.endDate)}`;
    const timeStr = `${trip.startTime} ~ ${trip.endTime}`;

    const lines = [
      `【${categoryLabel}通知】${trip.subject}`,
      ``,
      `各位同仁好：`,
      `以下為「${trip.subject}」的行程資訊：`,
      ``,
      `📅 行程日期：${dateStr}`,
      `⏰ 行程時間：${timeStr}`,
      `🏷️ 行程類別：${categoryLabel}`,
      `👥 參與人員：${travelersStr}`,
    ];

    if (trip.location) {
      lines.push(`📍 ${trip.category === 'online_meeting' ? '會議地點' : '出差地點'}：${trip.location}`);
    }
    if (trip.meetingUrl) {
      lines.push(`🔗 線上會議連結：${trip.meetingUrl}`);
    }
    if (trip.customerName) {
      lines.push(`🏢 關聯客戶：${trip.customerName}`);
    }
    if (trip.projectName) {
      lines.push(`📁 關聯專案：${trip.projectName}`);
    }
    if (trip.pm) {
      lines.push(`👤 負責 PM：${trip.pm}`);
    }
    if (trip.tpm) {
      lines.push(`👤 TPM 負責人：${trip.tpm}`);
    }
    if (trip.lunchBoxes && trip.lunchBoxes > 0) {
      lines.push(`🍱 廠區便當代訂：${trip.lunchBoxes} 個`);
    }
    if (trip.notes) {
      lines.push(``, `📝 行程說明 / 備忘錄：`, `${trip.notes}`);
    }
    lines.push(``, `---`, `此行程資訊由 燁輝/億威專案進度管理系統 發送`);

    return lines.join('\n');
  }, [trip, category]);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(emailContent);
      setCopied(true);
      toast({
        title: '已複製郵件內容！',
        description: '您可直接在 Outlook、Gmail 或通訊軟體中貼上作為通知發送。',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('複製失敗:', e);
    }
  };

  const mailToUrl = useMemo(() => {
    if (!trip) return '#';
    const categoryLabel = category?.label || '行程';
    const subject = encodeURIComponent(`【${categoryLabel}通知】${trip.subject}`);
    const body = encodeURIComponent(emailContent);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [trip, category, emailContent]);

  const handleAddToGoogleCalendar = () => {
    if (!trip) return;
    const calendarDetails = [
      trip.meetingUrl ? `【線上會議連結】\n${trip.meetingUrl}` : '',
      trip.travelers && trip.travelers.length > 0 ? `【參與人員】\n${trip.travelers.join('、')}` : '',
      trip.customerName ? `【關聯客戶】\n${trip.customerName}` : '',
      trip.projectName ? `【關聯專案】\n${trip.projectName}` : '',
      trip.pm ? `【負責 PM】\n${trip.pm}` : '',
      trip.tpm ? `【TPM 負責人】\n${trip.tpm}` : '',
      trip.notes ? `【出差/會議重點】\n${trip.notes}` : '',
    ].filter(Boolean).join('\n\n');

    const url = generateGoogleCalendarUrl(
      trip.subject,
      trip.startDate,
      trip.startTime,
      trip.endDate,
      trip.endTime,
      trip.location || (trip.category === 'online_meeting' ? '線上會議' : undefined),
      calendarDetails
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!trip) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        {/* Header 橫幅區塊 */}
        <div
          className="px-6 py-5 border-b flex items-start justify-between"
          style={{
            background: `linear-gradient(135deg, ${category?.color || '#3b82f6'}18 0%, ${category?.color || '#3b82f6'}06 100%)`,
          }}
        >
          <div className="flex items-start gap-3.5 pr-8">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5"
              style={{ backgroundColor: category?.color || '#3b82f6' }}
            >
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900 leading-snug">
                {trip.subject}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white shadow-xs"
                  style={{ backgroundColor: category?.color || '#3b82f6' }}
                >
                  {category?.label || '行程'}
                </span>

                {/* 狀態切換按鈕 */}
                <button
                  type="button"
                  onClick={handleStatusToggle}
                  className={`px-2.5 py-0.5 text-xs rounded-full font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                    trip.status === 'pending'
                      ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  }`}
                  title={trip.status === 'pending' ? '點擊標記為已確認' : '點擊標記為待確認'}
                >
                  {trip.status === 'pending' ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>待確認</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>已確認</span>
                    </>
                  )}
                </button>

                {/* 逾期未填報告警示 */}
                {isOverdue && (
                  <span
                    className="px-2.5 py-0.5 text-xs rounded-full font-bold flex items-center gap-1 bg-red-100 text-red-700 border border-red-200"
                    title="出差報告逾期未填"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>缺出差報告</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 內容區塊 */}
        <div className="p-6 space-y-4">
          {/* 日期與時間 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500 font-medium">開始時間</div>
                <div className="font-semibold text-gray-800 text-sm mt-0.5">
                  {formatDateChinese(trip.startDate)}
                </div>
                <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span>{trip.startTime}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-gray-500 font-medium">結束時間</div>
                <div className="font-semibold text-gray-800 text-sm mt-0.5">
                  {formatDateChinese(trip.endDate)}
                </div>
                <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span>{trip.endTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 出差人員 */}
          <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
            <Users className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 font-medium mb-1.5">出差人員</div>
              <div className="flex flex-wrap gap-1.5">
                {trip.travelers && trip.travelers.length > 0 ? (
                  trip.travelers.map((traveler, index) => (
                    <span
                      key={index}
                      className="px-2.5 py-0.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 shadow-2xs"
                    >
                      {traveler}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">未指定出差人員</span>
                )}
              </div>
            </div>
          </div>

          {/* 線上會議連結 */}
          {trip.meetingUrl && (
            <div className="flex items-start gap-3 p-3.5 bg-purple-50/80 border border-purple-200 rounded-xl">
              <Video className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-purple-700 font-semibold mb-1">線上會議連結</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={trip.meetingUrl.startsWith('http') ? trip.meetingUrl : `https://${trip.meetingUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-purple-700 hover:text-purple-900 underline truncate max-w-sm flex items-center gap-1.5"
                    title="點擊開啟線上會議"
                  >
                    <span>{trip.meetingUrl}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(trip.meetingUrl!);
                      toast({ title: '已複製會議連結！' });
                    }}
                    className="px-2.5 py-0.5 text-xs bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-100 font-medium transition cursor-pointer shadow-2xs"
                  >
                    複製網址
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 地點 */}
          <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-gray-500 font-medium">
                {trip.category === 'online_meeting' ? '會議地點' : '出差地點'}
              </div>
              <div className="font-medium text-gray-800 text-sm mt-0.5">
                {trip.location || (trip.category === 'online_meeting' ? '線上會議' : '—')}
              </div>
            </div>
          </div>

          {/* 客戶與專案 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {trip.customerName && (
              <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
                <Building className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 font-medium">關聯客戶</div>
                  <div className="font-medium text-gray-800 text-sm mt-0.5 truncate">{trip.customerName}</div>
                </div>
              </div>
            )}

            {trip.projectName && (
              <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
                <FileText className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 font-medium">關聯專案</div>
                  <div className="font-medium text-gray-800 text-sm mt-0.5 truncate">{trip.projectName}</div>
                </div>
              </div>
            )}
          </div>

          {/* 負責 PM 與 TPM */}
          {(trip.pm || trip.tpm) && (
            <div className={`grid grid-cols-1 ${trip.pm && trip.tpm ? 'sm:grid-cols-2' : ''} gap-3`}>
              {trip.pm && (
                <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
                  <Users className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 font-medium">負責 PM</div>
                    <div className="font-medium text-gray-800 text-sm mt-0.5 truncate">{trip.pm}</div>
                  </div>
                </div>
              )}
              {trip.tpm && (
                <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
                  <Users className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 font-medium">TPM 負責人</div>
                    <div className="font-medium text-gray-800 text-sm mt-0.5 truncate">{trip.tpm}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 燁輝廠區便當代訂數量 */}
          {Boolean(trip.lunchBoxes && trip.lunchBoxes > 0) && (
            <div className="flex items-start gap-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl">
              <div className="text-xl shrink-0 mt-0.5">🍱</div>
              <div className="flex-1">
                <div className="text-xs text-amber-800 font-semibold">燁輝廠區便當代訂</div>
                <div className="font-bold text-amber-950 text-sm mt-0.5 flex items-center gap-2">
                  <span>{trip.lunchBoxes} 個便當</span>
                  <span className="text-[11px] font-normal text-amber-700 bg-amber-100 px-2 py-0.2 rounded-full">
                    已登記代訂
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 出差重點彙整 */}
          {trip.notes ? (
            <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 font-medium mb-1">出差重點彙整 (Key Takeaways)</div>
                <div className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{trip.notes}</div>
              </div>
            </div>
          ) : isOverdue ? (
            <div className="flex items-start gap-3 p-3.5 bg-red-50/80 rounded-xl border border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-xs text-red-700 font-bold mb-0.5">出差重點彙整（待補填）</div>
                <div className="text-red-600 text-xs">
                  此行程已結束超過 3 天，請點擊下方「編輯」按鈕儘速補全出差成果重點。
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer 操作區塊 */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 space-y-2.5">
          {/* 郵件通知拷貝與寄送 (2 欄) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyEmail}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition flex items-center justify-center gap-2 font-semibold text-sm shadow-xs cursor-pointer"
              title="拷貝為標準郵件格式，可直接貼入 Email 或通訊軟體發送"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">已複製郵件內容！</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-300" />
                  <span>📋 拷貝郵件內容</span>
                </>
              )}
            </button>

            <a
              href={mailToUrl}
              className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition flex items-center justify-center gap-2 font-medium text-sm shadow-xs text-center"
              title="以電腦預設郵件軟體 (Outlook/Thunderbird) 開啟新信件"
            >
              <Mail className="w-4 h-4 text-blue-600" />
              <span>✉️ 開啟郵件發送</span>
            </a>
          </div>

          {/* 加入 Google 行事曆按鈕 */}
          <button
            type="button"
            onClick={handleAddToGoogleCalendar}
            className="w-full px-4 py-2 bg-blue-50/60 border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-100/70 transition flex items-center justify-center gap-2 font-medium text-xs shadow-2xs cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>🗓️ 一鍵加入 Google 行事曆</span>
            <ExternalLink className="w-3 h-3 text-blue-500" />
          </button>

          {/* 編輯 / 刪除按鈕 (僅具備完全管理權限才可操作) */}
          {canManage && (
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onEdit}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium text-sm shadow-xs cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                <span>編輯行程</span>
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition flex items-center justify-center gap-2 font-medium text-sm cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>刪除</span>
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
