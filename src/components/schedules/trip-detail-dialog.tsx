'use client';

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
} from 'lucide-react';
import { BusinessTrip, TRIP_CATEGORIES } from '@/types/businessTrip';
import { formatDateChinese, isTripReportOverdue, generateGoogleCalendarUrl } from '@/lib/calendar-helper';

interface TripDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: BusinessTrip | null;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange?: (newStatus: 'confirmed' | 'pending') => void;
}

export function TripDetailDialog({
  open,
  onOpenChange,
  trip,
  onEdit,
  onDelete,
  onStatusChange,
}: TripDetailDialogProps) {
  if (!trip) return null;

  const category = TRIP_CATEGORIES.find((c) => c.value === trip.category);
  const isOverdue = isTripReportOverdue(trip.endDate, trip.endTime, trip.notes);

  const handleStatusToggle = () => {
    if (onStatusChange) {
      const newStatus = trip.status === 'pending' ? 'confirmed' : 'pending';
      onStatusChange(newStatus);
    }
  };

  const handleAddToGoogleCalendar = () => {
    const url = generateGoogleCalendarUrl(
      trip.subject,
      trip.startDate,
      trip.startTime,
      trip.endDate,
      trip.endTime,
      trip.location,
      trip.notes
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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

          {/* 地點 */}
          <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-gray-500 font-medium">出差地點</div>
              <div className="font-medium text-gray-800 text-sm mt-0.5">{trip.location || '—'}</div>
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

          {/* TPM */}
          {trip.tpm && (
            <div className="flex items-start gap-3 p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl">
              <Users className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-xs text-gray-500 font-medium">TPM 負責人</div>
                <div className="font-medium text-gray-800 text-sm mt-0.5">{trip.tpm}</div>
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
          {/* 加入 Google 行事曆按鈕 */}
          <button
            type="button"
            onClick={handleAddToGoogleCalendar}
            className="w-full px-4 py-2.5 bg-white border border-blue-400 text-blue-600 rounded-xl hover:bg-blue-50 transition flex items-center justify-center gap-2 font-semibold text-sm shadow-xs cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-blue-500" />
            <span>🗓️ 一鍵加入 Google 行事曆</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
          </button>

          {/* 編輯 / 刪除按鈕 */}
          <div className="flex gap-2.5">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
