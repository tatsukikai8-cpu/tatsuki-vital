import React, { useState, useMemo, useEffect } from 'react';
import { THRESHOLDS, DEFAULT_THRESHOLDS } from '../constants';
import { VitalRecord, Resident, VitalThresholds } from '../types';
import { getJstDate } from '../lib/dateUtils';
import { 
  User, 
  Printer, 
  FileText, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Files, 
  CheckSquare, 
  Square, 
  Filter, 
  Check, 
  X, 
  Users, 
  Loader2,
  SlidersHorizontal,
  ZoomIn,
  Image as ImageIcon,
  Camera
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ImageLightboxModal } from './ImageLightboxModal';

interface IndividualHistoryProps {
  records: VitalRecord[];
  residents: Resident[];
  facilityName: string;
  thresholds?: VitalThresholds;
}

interface ResidentSheetProps {
  resident: Resident;
  records: VitalRecord[];
  facilityName: string;
  startDate: string;
  endDate: string;
  includeCharts: boolean;
  thresholds?: VitalThresholds;
}

const ResidentSheet: React.FC<ResidentSheetProps> = ({
  resident,
  records,
  facilityName,
  startDate,
  endDate,
  includeCharts,
  thresholds
}) => {
  const effectiveThresholds = useMemo(() => thresholds || DEFAULT_THRESHOLDS, [thresholds]);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; date: string } | null>(null);

  // 期間内に添付された写真レコード一覧（新しい日付順）
  const photoRecords = useMemo(() => {
    return records
      .filter(r => Boolean(r.imageUrl))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records]);

  const chartData = useMemo(() => {
    return records.filter(r => !r.isAbsent).map(r => ({
      date: r.date.split('-').slice(1).join('/'),
      temp: parseFloat(r.temperature) || null,
      systolic: parseInt(r.systolic) || null,
      diastolic: parseInt(r.diastolic) || null,
      pulse: parseInt(r.pulse) || null,
    }));
  }, [records]);

  return (
    <div className="resident-sheet bg-white p-6 sm:p-8 rounded-xl shadow-sm border mb-8 print:shadow-none print:border-none print:p-0 print:mb-0">
      <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">月間バイタル管理表</h2>
          <p className="text-slate-500 mt-1 font-medium text-sm">施設名: {facilityName}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-800">氏名: {resident?.name} 様</p>
          <p className="text-sm text-slate-500 font-medium">居室: {resident?.roomNumber}号室</p>
          <p className="text-[11px] text-slate-400 mt-1 tracking-wider font-mono">{startDate} 〜 {endDate}</p>
        </div>
      </div>

      {/* 期間中の添付写真ギャラリー（写真が存在する場合のみ画面表示） */}
      {photoRecords.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50/50 border border-blue-200/80 rounded-xl no-print">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Camera size={16} className="text-blue-600" />
              <span>期間内の添付写真一覧 ({photoRecords.length}枚)</span>
            </h3>
            <span className="text-[11px] font-medium text-blue-600">クリックで拡大表示</span>
          </div>
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {photoRecords.map((rec, idx) => (
              <div 
                key={`${rec.date}-${idx}`}
                onClick={() => setSelectedPhoto({ url: rec.imageUrl!, date: rec.date })}
                className="group/card bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md rounded-lg overflow-hidden shadow-2xs transition-all cursor-pointer flex flex-col active:scale-95"
                title={`${rec.date} の写真を拡大表示`}
              >
                <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                  <img 
                    src={rec.imageUrl} 
                    alt={`${rec.date} 添付写真`} 
                    className="w-full h-full object-cover group-hover/card:scale-105 transition-transform" 
                  />
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/card:opacity-100 flex items-center justify-center text-white transition-opacity">
                    <ZoomIn size={18} />
                  </div>
                  <span className="absolute bottom-1 left-1 bg-black/65 text-white font-mono text-[9px] px-1 py-0.5 rounded leading-none backdrop-blur-2xs">
                    {rec.date.split('-').slice(1).join('/')}
                  </span>
                </div>
                {rec.note ? (
                  <div className="p-1.5 text-[10px] text-slate-700 line-clamp-1 truncate bg-white" title={rec.note}>
                    {rec.note}
                  </div>
                ) : (
                  <div className="p-1 text-[9px] text-slate-400 text-center bg-slate-50/50">
                    写真のみ
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {includeCharts && records.length > 0 && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 print:grid-cols-2">
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <h3 className="text-[10px] font-bold mb-2 flex items-center gap-1 text-slate-500 uppercase tracking-wider">
              <TrendingUp size={12} /> 血圧・脈拍推移
            </h3>
            <div className="h-40 w-full" style={{ minHeight: '160px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={9} />
                  <YAxis fontSize={9} domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px' }} />
                  <Line type="linear" dataKey="systolic" stroke="#ef4444" name="血圧(上)" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                  <Line type="linear" dataKey="diastolic" stroke="#3b82f6" name="血圧(下)" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                  <Line type="linear" dataKey="pulse" stroke="#10b981" name="脈拍" strokeWidth={1} strokeDasharray="3 3" dot={{ r: 1.5 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <h3 className="text-[10px] font-bold mb-2 flex items-center gap-1 text-slate-500 uppercase tracking-wider">
              <TrendingUp size={12} /> 体温推移
            </h3>
            <div className="h-40 w-full" style={{ minHeight: '160px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={9} />
                  <YAxis fontSize={9} domain={[35, 38]} />
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px' }} />
                  <Line type="linear" dataKey="temp" stroke="#f59e0b" name="体温(℃)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 border border-dashed rounded-lg bg-slate-50/50">
          <FileText size={48} className="mb-2 opacity-30" />
          <p className="text-sm font-medium">指定された期間内に記録データがありません。</p>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 mb-2 px-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">赤字強調基準</span>
              <span className="text-red-600 font-bold">体温 ≥{effectiveThresholds.tempHigh}℃</span>
              <span className="text-slate-300">|</span>
              <span className="text-red-600 font-bold">血圧 ≥{effectiveThresholds.bpSysHigh}/{effectiveThresholds.bpDiaHigh} mmHg</span>
              <span className="text-slate-300">|</span>
              <span className="text-red-600 font-bold">SpO₂ ≤{effectiveThresholds.spo2Low}%</span>
            </div>
            <span className="text-[10px] text-slate-400">※ 施設マスタ設定基準に準拠</span>
          </div>
          <table className="w-full border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-300 px-2 py-2 w-24 text-center">日付</th>
              <th className="border border-slate-300 px-2 py-2 text-center">体温</th>
              <th className="border border-slate-300 px-2 py-2 text-center">脈拍</th>
              <th className="border border-slate-300 px-2 py-2 text-center">血圧 (上/下)</th>
              <th className="border border-slate-300 px-2 py-2 text-center">SpO₂</th>
              <th className="border border-slate-300 px-2 py-2 text-center">食事(朝/昼/晩)</th>
              <th className="border border-slate-300 px-2 py-2 text-center">排便</th>
              <th className="border border-slate-300 px-2 py-2 text-left min-w-[190px]">
                <div className="flex items-center gap-1">
                  <span>備考</span>
                  <span className="text-[10px] text-slate-500 font-normal">/ 添付写真</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {[...records].reverse().map((rec, i) => {
              const tempVal = parseFloat(rec.temperature);
              const isHighTemp = !isNaN(tempVal) && tempVal >= effectiveThresholds.tempHigh;
              const isCautionTemp = !isNaN(tempVal) && effectiveThresholds.tempCaution && tempVal >= effectiveThresholds.tempCaution;

              const sysVal = parseFloat(rec.systolic);
              const diaVal = parseFloat(rec.diastolic);
              const isSysAbnormal = (!isNaN(sysVal) && (sysVal >= effectiveThresholds.bpSysHigh || (effectiveThresholds.bpSysLow !== undefined && sysVal <= effectiveThresholds.bpSysLow && rec.systolic !== '')));
              const isDiaAbnormal = (!isNaN(diaVal) && (diaVal >= effectiveThresholds.bpDiaHigh || (effectiveThresholds.bpDiaLow !== undefined && diaVal <= effectiveThresholds.bpDiaLow && rec.diastolic !== '')));
              const isBPHigh = (!isNaN(sysVal) && sysVal >= effectiveThresholds.bpSysHigh) || (!isNaN(diaVal) && diaVal >= effectiveThresholds.bpDiaHigh);
              const isBPLow = (!isNaN(sysVal) && effectiveThresholds.bpSysLow !== undefined && sysVal <= effectiveThresholds.bpSysLow && rec.systolic !== '') ||
                              (!isNaN(diaVal) && effectiveThresholds.bpDiaLow !== undefined && diaVal <= effectiveThresholds.bpDiaLow && rec.diastolic !== '');

              const pulseVal = parseInt(rec.pulse);
              const isPulseAbnormal = !isNaN(pulseVal) && (
                (effectiveThresholds.pulseHigh !== undefined && pulseVal >= effectiveThresholds.pulseHigh) ||
                (effectiveThresholds.pulseLow !== undefined && pulseVal <= effectiveThresholds.pulseLow)
              );

              const spo2Val = parseFloat(rec.spo2);
              const isSpo2Low = !isNaN(spo2Val) && effectiveThresholds.spo2Low !== undefined && spo2Val <= effectiveThresholds.spo2Low && rec.spo2 !== '';

              return (
                <tr key={i} className={`text-center ${rec.isAbsent ? 'bg-slate-50 text-slate-400 italic' : ''}`}>
                  <td className="border border-slate-300 px-2 py-2 font-medium">{rec.date}</td>
                  {rec.isAbsent ? (
                    <td colSpan={7} className="border border-slate-300 px-4 py-2 text-left">
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="flex-1">
                          利用無し {rec.note && <span className="ml-2 text-slate-600 not-italic">({rec.note})</span>}
                        </span>
                        {rec.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setSelectedPhoto({ url: rec.imageUrl!, date: rec.date })}
                            className="shrink-0 w-11 h-11 rounded-lg border-2 border-slate-300 hover:border-blue-500 overflow-hidden shadow-xs group/img relative cursor-pointer bg-slate-100 transition-all hover:scale-105 active:scale-95"
                            title={`${rec.date} の添付写真を拡大表示`}
                          >
                            <img 
                              src={rec.imageUrl} 
                              alt="添付写真" 
                              className="w-full h-full object-cover group-hover/img:scale-110 transition-transform" 
                            />
                            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                              <ZoomIn size={14} />
                              <span className="text-[7px] font-bold">拡大</span>
                            </div>
                          </button>
                        )}
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className={`border border-slate-300 px-2 py-2 ${isHighTemp ? 'text-red-600 font-black bg-red-50 ring-1 ring-red-400' : isCautionTemp ? 'text-amber-700 font-bold bg-amber-50' : ''}`}>
                        {rec.temperature}
                      </td>
                      <td className={`border border-slate-300 px-2 py-2 ${isPulseAbnormal ? 'text-red-600 font-black bg-red-50 ring-1 ring-red-400' : ''}`}>
                        {rec.pulse}
                      </td>
                      <td className={`border border-slate-300 px-2 py-2 ${(isSysAbnormal || isDiaAbnormal) ? 'text-red-600 font-black bg-red-50 ring-1 ring-red-400' : ''}`}>
                        <span className={isSysAbnormal ? 'text-red-600 font-black' : ''}>{rec.systolic}</span>
                        <span className="text-slate-400 mx-0.5">/</span>
                        <span className={isDiaAbnormal ? 'text-red-600 font-black' : ''}>{rec.diastolic}</span>
                      </td>
                      <td className={`border border-slate-300 px-2 py-2 ${isSpo2Low ? 'text-red-600 font-black bg-red-50 ring-1 ring-red-400' : ''}`}>
                        {rec.spo2 ? `${rec.spo2}%` : ''}
                      </td>
                      <td className="border border-slate-300 px-1 py-1 text-[10px]">
                        <div>朝 {rec.mealMorning.main}/{rec.mealMorning.side}</div>
                        <div>昼 {rec.mealNoon.main}/{rec.mealNoon.side}</div>
                        <div>晩 {rec.mealNight.main}/{rec.mealNight.side}</div>
                      </td>
                      <td className="border border-slate-300 px-2 py-2">{rec.bowelCount}</td>
                      <td className="border border-slate-300 px-2 py-2 text-left whitespace-pre-wrap break-words min-w-[190px]">
                        <div className="flex items-start justify-between gap-2.5">
                          <span className="flex-1 leading-snug">{rec.note || '-'}</span>
                          {rec.imageUrl && (
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto({ url: rec.imageUrl!, date: rec.date })}
                              className="shrink-0 w-12 h-12 rounded-lg border-2 border-slate-300 hover:border-blue-500 overflow-hidden shadow-xs group/img relative cursor-pointer bg-slate-100 transition-all hover:scale-105 active:scale-95"
                              title={`${rec.date} の添付写真を拡大表示`}
                            >
                              <img 
                                src={rec.imageUrl} 
                                alt="添付写真" 
                                className="w-full h-full object-cover group-hover/img:scale-110 transition-transform" 
                              />
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/img:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                                <ZoomIn size={14} />
                                <span className="text-[7px] font-bold">拡大</span>
                              </div>
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {/* 写真拡大モーダル */}
      {selectedPhoto && (
        <ImageLightboxModal
          isOpen={Boolean(selectedPhoto)}
          onClose={() => setSelectedPhoto(null)}
          imageUrl={selectedPhoto.url}
          residentName={resident?.name}
          roomNumber={resident?.roomNumber}
          date={selectedPhoto.date}
          canDelete={false}
        />
      )}
    </div>
  );
};

const IndividualHistory: React.FC<IndividualHistoryProps> = ({ records, residents, facilityName, thresholds }) => {
  const [selectedId, setSelectedId] = useState(residents[0]?.id || '');
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [onlyWithRecords, setOnlyWithRecords] = useState(false);
  const [isResidentModalOpen, setIsResidentModalOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // 対象利用者の選択（デフォルトは全員）
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>(() => residents.map(r => r.id));

  // residentsが更新された場合に同期
  useEffect(() => {
    if (residents.length > 0) {
      if (!residents.some(r => r.id === selectedId)) {
        setSelectedId(residents[0].id);
      }
      setSelectedResidentIds(prev => {
        const valid = prev.filter(id => residents.some(r => r.id === id));
        return valid.length > 0 ? valid : residents.map(r => r.id);
      });
    }
  }, [residents, selectedId]);

  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [startDate, setStartDate] = useState(() => {
    const now = getJstDate();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return formatLocalDate(firstDay);
  });

  const [endDate, setEndDate] = useState(() => {
    const now = getJstDate();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return formatLocalDate(lastDay);
  });

  const setRange = (type: 'this_month' | 'last_month' | 'last_90') => {
    const now = new Date();
    if (type === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatLocalDate(start));
      setEndDate(formatLocalDate(end));
    } else if (type === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatLocalDate(start));
      setEndDate(formatLocalDate(end));
    } else if (type === 'last_90') {
      const startD = new Date();
      startD.setDate(startD.getDate() - 90);
      setStartDate(formatLocalDate(startD));
      setEndDate(formatLocalDate(now));
    }
  };

  // 全利用者の期間内レコードマップ
  const residentRecordsMap = useMemo(() => {
    const map = new Map<string, VitalRecord[]>();
    residents.forEach(res => {
      const resRecs = records
        .filter(r => r.residentId === res.id && r.date >= startDate && r.date <= endDate)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      map.set(res.id, resRecs);
    });
    return map;
  }, [records, residents, startDate, endDate]);

  // 記録がある利用者のID一覧
  const residentsWithRecordsIds = useMemo(() => {
    const set = new Set<string>();
    residentRecordsMap.forEach((recs, id) => {
      if (recs.length > 0) set.add(id);
    });
    return set;
  }, [residentRecordsMap]);

  // 一括出力の対象となる利用者リスト
  const targetResidents = useMemo(() => {
    return residents.filter(res => {
      if (!selectedResidentIds.includes(res.id)) return false;
      if (onlyWithRecords && !residentsWithRecordsIds.has(res.id)) return false;
      return true;
    });
  }, [residents, selectedResidentIds, onlyWithRecords, residentsWithRecordsIds]);

  // 現在選択中の利用者
  const singleResident = useMemo(() => {
    return residents.find(r => r.id === selectedId) || residents[0];
  }, [residents, selectedId]);

  // 印刷 / PDF保存の実行
  const executePrint = () => {
    setIsPrinting(true);
    window.focus();
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  // 個別印刷
  const handleSinglePrint = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    executePrint();
  };

  // 全員一括印刷 / PDF保存
  const handleBatchPrint = () => {
    setViewMode('all');
    // 全員表示に切り替えてから印刷ダイアログを開く
    setIsPrinting(true);
    window.focus();
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 450);
  };

  return (
    <div className="space-y-6">
      {/* 操作コントロールパネル */}
      <div className="bg-white p-5 rounded-xl shadow-sm border no-print space-y-4">
        {/* モード切替タブ & メインアクション */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-100">
          {/* 表示モード選択 */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'single'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User size={16} />
              <span>個別表示 (1名)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'all'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Files size={16} />
              <span>全員一括表示 / PDF出力 ({residents.length}名)</span>
            </button>
          </div>

          {/* 出力ボタン群 */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            {viewMode === 'single' ? (
              <>
                <button
                  type="button"
                  onClick={handleSinglePrint}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Printer size={16} />
                  <span>この利用者を印刷 / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleBatchPrint}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Files size={16} />
                  <span>全員一括PDF保存</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setViewMode('single')}
                  className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all"
                >
                  <User size={16} />
                  <span>個別表示へ戻る</span>
                </button>
                <button
                  type="button"
                  onClick={executePrint}
                  disabled={targetResidents.length === 0 || isPrinting}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isPrinting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>準備中...</span>
                    </>
                  ) : (
                    <>
                      <Printer size={16} />
                      <span>全 {targetResidents.length} 名を一括PDF保存 / 印刷</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 期間設定 & 利用者選択 & オプション */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            {/* 個別表示時の利用者ドロップダウン */}
            {viewMode === 'single' ? (
              <div className="flex items-center gap-2 w-full sm:w-64">
                <User className="text-slate-400 shrink-0" size={18} />
                <select 
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold bg-white text-slate-800"
                >
                  {residents.map(res => (
                    <option key={res.id} value={res.id}>
                      {res.roomNumber}号室 - {res.name} {residentsWithRecordsIds.has(res.id) ? '' : '(記録なし)'}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              /* 一括表示時の対象者選択ボタン */
              <button
                type="button"
                onClick={() => setIsResidentModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-bold transition-colors"
              >
                <SlidersHorizontal size={16} />
                <span>出力対象の利用者を選択 ({targetResidents.length}/{residents.length}名)</span>
              </button>
            )}

            {/* 期間選択 */}
            <div className="flex items-center h-10 bg-slate-50 px-3 rounded-lg border border-slate-200">
              <Calendar size={16} className="text-slate-400 shrink-0" />
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                className="bg-transparent border-none px-2 py-0 text-xs font-semibold focus:ring-0 cursor-pointer h-full text-slate-700" 
              />
              <span className="text-slate-300 font-bold px-1 select-none">〜</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="bg-transparent border-none px-2 py-0 text-xs font-semibold focus:ring-0 cursor-pointer h-full text-slate-700" 
              />
            </div>
          </div>

          {/* 出力オプション（グラフ有無・記録ありのみ） */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
              <input 
                type="checkbox" 
                checked={includeCharts} 
                onChange={(e) => setIncludeCharts(e.target.checked)} 
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <span>推移グラフを含める</span>
            </label>

            {viewMode === 'all' && (
              <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
                <input 
                  type="checkbox" 
                  checked={onlyWithRecords} 
                  onChange={(e) => setOnlyWithRecords(e.target.checked)} 
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>記録がある人のみ出力 ({residentsWithRecordsIds.size}名)</span>
              </label>
            )}
          </div>
        </div>
        
        {/* 期間ショートカット */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Clock size={12} /> 期間ショートカット:
          </span>
          <button onClick={() => setRange('this_month')} className="px-3 py-1 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded-full text-xs font-medium transition-all shadow-sm">今月</button>
          <button onClick={() => setRange('last_month')} className="px-3 py-1 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded-full text-xs font-medium transition-all shadow-sm">先月</button>
          <button onClick={() => setRange('last_90')} className="px-3 py-1 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded-full text-xs font-medium transition-all shadow-sm">過去90日</button>
        </div>
      </div>

      {/* 一括出力モード時の案内バー */}
      {viewMode === 'all' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg shrink-0">
              <Files size={20} />
            </div>
            <div>
              <p className="font-bold text-blue-900 text-sm">
                全員一括プレビュー表示中（計 {targetResidents.length} 名）
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                印刷またはPDF出力時に、利用者ごとに自動で改ページされて1名ずつキレイにPDF保存されます。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={executePrint}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow transition-all"
          >
            <Printer size={16} />
            <span>全員を一括PDF保存</span>
          </button>
        </div>
      )}

      {/* バイタル管理表の表示領域 */}
      <div id="printable-area">
        {viewMode === 'single' ? (
          /* 個別表示 */
          singleResident && (
            <ResidentSheet
              key={singleResident.id}
              resident={singleResident}
              records={residentRecordsMap.get(singleResident.id) || []}
              facilityName={facilityName}
              startDate={startDate}
              endDate={endDate}
              includeCharts={includeCharts}
              thresholds={thresholds}
            />
          )
        ) : (
          /* 全員一括表示 */
          targetResidents.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border text-center text-slate-400 space-y-2">
              <Users size={48} className="mx-auto opacity-30" />
              <p className="font-bold">出力対象の利用者が選択されていません。</p>
              <p className="text-xs">上の「出力対象の利用者を選択」からチェックを付けてください。</p>
            </div>
          ) : (
            targetResidents.map((res, index) => {
              const resRecords = residentRecordsMap.get(res.id) || [];
              return (
                <div key={res.id}>
                  {/* 画面プレビュー用のページ区切りインジケーター */}
                  <div className="no-print flex items-center justify-between bg-slate-200/80 px-4 py-2 rounded-t-lg text-xs font-bold text-slate-600 mt-6 first:mt-0">
                    <span className="flex items-center gap-1.5">
                      <FileText size={14} />
                      ページ {index + 1} / {targetResidents.length} : {res.roomNumber}号室 {res.name} 様
                    </span>
                    <span className="text-[11px] font-normal text-slate-500">
                      記録数: {resRecords.length} 件
                    </span>
                  </div>
                  <ResidentSheet
                    resident={res}
                    records={resRecords}
                    facilityName={facilityName}
                    startDate={startDate}
                    endDate={endDate}
                    includeCharts={includeCharts}
                    thresholds={thresholds}
                  />
                </div>
              );
            })
          )
        )}
      </div>

      {/* 対象利用者選択モーダル */}
      {isResidentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Filter size={20} className="text-blue-600" />
                  一括PDF出力対象の利用者を選択
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  チェックを付けた利用者のみが一括PDF出力に含まれます。
                </p>
              </div>
              <button 
                onClick={() => setIsResidentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* 一括選択ボタン */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedResidentIds(residents.map(r => r.id))}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
              >
                全員を選択
              </button>
              <button
                type="button"
                onClick={() => setSelectedResidentIds([])}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
              >
                全員解除
              </button>
              <button
                type="button"
                onClick={() => setSelectedResidentIds(residents.filter(r => residentsWithRecordsIds.has(r.id)).map(r => r.id))}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors"
              >
                記録がある人のみ選択 ({residentsWithRecordsIds.size}名)
              </button>
            </div>

            {/* 名簿チェックリスト */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border rounded-xl p-2 max-h-96">
              {residents.map(res => {
                const isSelected = selectedResidentIds.includes(res.id);
                const count = (residentRecordsMap.get(res.id) || []).length;
                return (
                  <label 
                    key={res.id} 
                    className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedResidentIds(prev => [...prev, res.id]);
                          } else {
                            setSelectedResidentIds(prev => prev.filter(id => id !== res.id));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-slate-400">#{res.roomNumber}</span>
                      <span className="text-sm font-bold text-slate-800">{res.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      count > 0 ? 'bg-emerald-50 text-emerald-700 font-bold' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {count > 0 ? `${count}件の記録` : '記録なし'}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* モーダルフッター */}
            <div className="pt-3 border-t flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">
                選択中: <span className="text-blue-600 font-extrabold text-sm">{selectedResidentIds.length}</span> / {residents.length} 名
              </span>
              <button
                type="button"
                onClick={() => setIsResidentModalOpen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow transition-all"
              >
                決定する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndividualHistory;
