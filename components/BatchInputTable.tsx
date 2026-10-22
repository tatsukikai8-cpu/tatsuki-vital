import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { THRESHOLDS, ERR_LIMITS, DAYS_JP, DEFAULT_THRESHOLDS } from '../constants';
import { VitalRecord, Meal, Resident, VitalThresholds } from '../types';
import { getTodayJstString } from '../lib/dateUtils';
import { 
  AlertCircle, 
  Calendar, 
  UserX, 
  CheckCircle2, 
  CloudUpload, 
  Loader2, 
  Download, 
  Eye, 
  Lock, 
  ShieldAlert,
  Camera,
  Image as ImageIcon,
  ZoomIn,
  X,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { exportVitalRecordsToCSV } from '../lib/csvExport';
import { uploadVitalImage, deleteVitalImage } from '../lib/imageUtils';
import { ImageLightboxModal } from './ImageLightboxModal';

interface BatchInputTableProps {
  onSave: (records: VitalRecord[]) => void;
  residents: Resident[];
  records: VitalRecord[];
  facilityName?: string;
  thresholds?: VitalThresholds;
  isReadOnly?: boolean;
}

interface ActiveInputState {
  resId: string;
  resName: string;
  roomNumber?: string;
  fieldKey: string;
  fieldLabel: string;
}

const BatchInputTable: React.FC<BatchInputTableProps> = ({ 
  onSave, 
  residents, 
  records, 
  facilityName,
  thresholds,
  isReadOnly = false
}) => {
  const effectiveThresholds = useMemo(() => thresholds || DEFAULT_THRESHOLDS, [thresholds]);
  const [date, setDate] = useState(getTodayJstString());
  const [isSaving, setIsSaving] = useState(false);

  // スマートフォン・キーボード入力ナビゲーション用ステート & Ref
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeInputInfo, setActiveInputInfo] = useState<ActiveInputState | null>(null);

  // 画像アップロード・拡大表示関連ステート
  const [uploadingResId, setUploadingResId] = useState<string | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);
  const [lightboxData, setLightboxData] = useState<{
    url: string;
    residentName: string;
    roomNumber?: string;
    resId: string;
  } | null>(null);
  
  // 曜日を取得
  const dayOfWeek = useMemo(() => {
    if (!date) return '';
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? '' : DAYS_JP[d.getDay()];
  }, [date]);

  // 曜日の色分け設定
  const dayColorClass = useMemo(() => {
    if (dayOfWeek === '日') return 'text-red-600 bg-red-50 border-red-100';
    if (dayOfWeek === '土') return 'text-blue-600 bg-blue-50 border-blue-100';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  }, [dayOfWeek]);

  // フォームデータの初期状態を生成
  const createInitialRow = useCallback((res: Resident): Partial<VitalRecord> => ({
    facilityId: res.facilityId,
    residentId: res.id,
    residentName: res.name,
    temperature: '',
    systolic: '',
    diastolic: '',
    pulse: '',
    spo2: '',
    mealMorning: { main: 10, side: 10 },
    mealNoon: { main: 10, side: 10 },
    mealNight: { main: 10, side: 10 },
    bowelCount: '0',
    note: '',
    imageUrl: '',
    imageStoragePath: '',
    isAbsent: false
  }), []);

  const [data, setData] = useState<Record<string, Partial<VitalRecord>>>({});

  // 日付または全体レコードが変更された際、その日の既存データをロードする
  useEffect(() => {
    const nextData: Record<string, Partial<VitalRecord>> = {};
    residents.forEach(res => {
      const existing = records.find(r => r.residentId === res.id && r.date === date);
      if (existing) {
        nextData[res.id] = { ...existing };
      } else {
        nextData[res.id] = createInitialRow(res);
      }
    });
    setData(nextData);
  }, [date, residents, records, createInitialRow]);

  // 直近の記録（比較用）
  const prevDataMap = useMemo(() => {
    const map: Record<string, VitalRecord> = {};
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    residents.forEach(res => {
      const last = sorted.find(r => r.residentId === res.id && r.date < date);
      if (last) map[res.id] = last;
    });
    return map;
  }, [records, date, residents]);

  // 本日（表示日）の異常値該当者の集計
  const abnormalStats = useMemo(() => {
    let count = 0;
    const abnormalResidentIds = new Set<string>();

    residents.forEach(res => {
      const row = data[res.id];
      if (!row || row.isAbsent) return;
      let hasAbnormal = false;

      const t = parseFloat(row.temperature || '');
      if (!isNaN(t) && t >= effectiveThresholds.tempHigh) hasAbnormal = true;

      const sys = parseFloat(row.systolic || '');
      if (!isNaN(sys) && (sys >= effectiveThresholds.bpSysHigh || (effectiveThresholds.bpSysLow !== undefined && sys <= effectiveThresholds.bpSysLow))) hasAbnormal = true;

      const dia = parseFloat(row.diastolic || '');
      if (!isNaN(dia) && (dia >= effectiveThresholds.bpDiaHigh || (effectiveThresholds.bpDiaLow !== undefined && dia <= effectiveThresholds.bpDiaLow))) hasAbnormal = true;

      const p = parseFloat(row.pulse || '');
      if (!isNaN(p) && ((effectiveThresholds.pulseHigh !== undefined && p >= effectiveThresholds.pulseHigh) || (effectiveThresholds.pulseLow !== undefined && p <= effectiveThresholds.pulseLow))) hasAbnormal = true;

      const s = parseFloat(row.spo2 || '');
      if (!isNaN(s) && effectiveThresholds.spo2Low !== undefined && s <= effectiveThresholds.spo2Low) hasAbnormal = true;

      if (hasAbnormal) {
        count++;
        abnormalResidentIds.add(res.id);
      }
    });

    return { count, abnormalResidentIds };
  }, [data, residents, effectiveThresholds]);

  // 添付画像付きの記録数
  const attachedPhotoCount = useMemo(() => {
    return (Object.values(data) as Partial<VitalRecord>[]).filter(r => Boolean(r?.imageUrl)).length;
  }, [data]);

  /**
   * 指定した利用者のデータを親へ保存依頼する（閲覧専用時は保存不可）
   */
  const triggerAutoSave = (resId: string, updatedRow?: Partial<VitalRecord>) => {
    if (isReadOnly) return;
    const row = updatedRow || data[resId];
    if (!row) return;

    // 数値の異常チェック（バリデーション失敗時は保存しない）
    const hasError = ['temperature', 'systolic', 'diastolic', 'pulse', 'spo2'].some(f => 
      isInputError(f, (row as any)[f])
    );
    if (hasError) return;

    setIsSaving(true);
    onSave([{ ...row, date } as VitalRecord]);
    
    setTimeout(() => setIsSaving(false), 800);
  };

  const handleChange = (resId: string, field: keyof VitalRecord, value: any, autoSave = false) => {
    if (isReadOnly) return;
    let finalValue = value;

    // 体温の小数点自動挿入ロジック (例: 365 -> 36.5)
    if (field === 'temperature' && typeof value === 'string') {
      const digits = value.replace(/[^\d]/g, '');
      if (digits.length === 3 && !value.includes('.')) {
        finalValue = `${digits.slice(0, 2)}.${digits.slice(2)}`;
      }
    }

    setData(prev => {
      const newRow = { ...prev[resId], [field]: finalValue };
      const next = { ...prev, [resId]: newRow };
      if (autoSave) triggerAutoSave(resId, next[resId]);
      return next;
    });
  };

  const handleMealChange = (resId: string, time: 'mealMorning' | 'mealNoon' | 'mealNight', type: keyof Meal, value: number) => {
    if (isReadOnly) return;
    setData(prev => {
      const currentMeal = (prev[resId]?.[time] as Meal) || { main: 10, side: 10 };
      const newMeal = { ...currentMeal, [type]: value };
      const newRow = { ...prev[resId], [time]: newMeal };
      const next = { ...prev, [resId]: newRow };
      triggerAutoSave(resId, next[resId]);
      return next;
    });
  };

  // 全ての有効な入力要素を取得
  const getAllInputs = useCallback(() => {
    if (!tableContainerRef.current) return [];
    return Array.from(
      tableContainerRef.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input[data-vitals-input="true"]:not([disabled]):not([readonly]), textarea[data-vitals-input="true"]:not([disabled]):not([readonly])'
      )
    );
  }, []);

  // 次の入力項目へフォーカス移動
  const goToNextInput = useCallback(() => {
    const inputs = getAllInputs();
    if (inputs.length === 0) return;
    const current = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    const currentIndex = inputs.indexOf(current);
    const nextIndex = currentIndex >= 0 && currentIndex < inputs.length - 1 ? currentIndex + 1 : 0;
    const target = inputs[nextIndex];
    if (target) {
      target.focus();
      if ('select' in target && typeof target.select === 'function') {
        target.select();
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [getAllInputs]);

  // 前の入力項目へフォーカス移動
  const goToPrevInput = useCallback(() => {
    const inputs = getAllInputs();
    if (inputs.length === 0) return;
    const current = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    const currentIndex = inputs.indexOf(current);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : inputs.length - 1;
    const target = inputs[prevIndex];
    if (target) {
      target.focus();
      if ('select' in target && typeof target.select === 'function') {
        target.select();
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [getAllInputs]);

  // フォーカス解除（キーボードを閉じる）
  const closeActiveInput = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setActiveInputInfo(null);
  }, []);

  // キーボードのEnterキー（またはShift+Enter）での項目間自動送り
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.currentTarget.tagName === 'TEXTAREA' && e.shiftKey) {
        return; // 備考欄のShift+Enterは改行
      }
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevInput();
      } else {
        goToNextInput();
      }
    }
  }, [goToNextInput, goToPrevInput]);

  // フィールドフォーカス時の追跡ハンドラー
  const handleFieldFocus = useCallback((
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    res: Resident,
    fieldKey: string,
    fieldLabel: string
  ) => {
    if (isReadOnly) return;
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    e.target.select?.();
    setActiveInputInfo({
      resId: res.id,
      resName: res.name,
      roomNumber: res.roomNumber,
      fieldKey,
      fieldLabel
    });
  }, [isReadOnly]);

  // フィールドブラー時のハンドラー
  const handleFieldBlur = useCallback((resId: string) => {
    triggerAutoSave(resId);
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      const active = document.activeElement;
      if (!active || !active.hasAttribute('data-vitals-input')) {
        setActiveInputInfo(null);
      }
    }, 200);
  }, [triggerAutoSave]);

  // ワンタップで数値を反映して次の項目へ送るクイック入力ヘルパー
  const handleQuickApply = useCallback((val: string | number) => {
    if (!activeInputInfo || isReadOnly) return;
    const { resId, fieldKey } = activeInputInfo;

    if (fieldKey.startsWith('meal')) {
      const [mealTime, mealType] = fieldKey.split('-') as ['mealMorning' | 'mealNoon' | 'mealNight', 'main' | 'side'];
      handleMealChange(resId, mealTime, mealType, Number(val));
    } else {
      handleChange(resId, fieldKey as keyof VitalRecord, String(val), true);
    }

    setTimeout(() => {
      goToNextInput();
    }, 60);
  }, [activeInputInfo, isReadOnly, handleMealChange, handleChange, goToNextInput]);

  /**
   * 画像のフロントエンド自動リサイズ・圧縮および Firebase Storage へのアップロード
   */
  const handleImageUpload = async (resId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = event.target.files?.[0];
    if (!file) return;

    // input要素の値をリセット
    event.target.value = '';

    const res = residents.find(r => r.id === resId);
    if (!res) return;

    setUploadingResId(resId);
    setUploadStatusText('画像を長辺1024pxに自動圧縮中...');

    try {
      // 1. Canvas API自動リサイズ & 圧縮 & Firebase Storageアップロード
      const { downloadUrl, storagePath, compressedSizeKB } = await uploadVitalImage(
        file,
        res.facilityId,
        res.id,
        date
      );

      // 2. 前の画像が存在し別パスなら削除
      const prevPath = data[resId]?.imageStoragePath;
      if (prevPath && prevPath !== storagePath) {
        deleteVitalImage(prevPath).catch(() => {});
      }

      // 3. データの更新と自動同期
      const updatedRow = {
        ...data[resId],
        imageUrl: downloadUrl,
        imageStoragePath: storagePath
      };

      setData(prev => ({
        ...prev,
        [resId]: updatedRow
      }));

      triggerAutoSave(resId, updatedRow);

      setUploadStatusText(`写真アップロード完了 (${compressedSizeKB} KB)`);
      setTimeout(() => setUploadStatusText(null), 3500);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert(err instanceof Error ? err.message : '画像のアップロードに失敗しました。');
    } finally {
      setUploadingResId(null);
    }
  };

  /**
   * 添付された画像を削除する
   */
  const handleRemoveImage = async (resId: string) => {
    if (isReadOnly) return;
    const current = data[resId];
    if (!current?.imageUrl) return;

    const storagePath = current.imageStoragePath;
    if (storagePath) {
      deleteVitalImage(storagePath).catch(() => {});
    }

    const updatedRow = {
      ...current,
      imageUrl: '',
      imageStoragePath: ''
    };

    setData(prev => ({
      ...prev,
      [resId]: updatedRow
    }));

    triggerAutoSave(resId, updatedRow);
  };

  const isInputError = (field: string, val: string | undefined): boolean => {
    if (!val || val.trim() === '') return false;
    const num = parseFloat(val);
    if (isNaN(num)) return true;

    if (field === 'temperature') return num < ERR_LIMITS.TEMP_MIN || num > ERR_LIMITS.TEMP_MAX;
    if (field === 'systolic') return num < ERR_LIMITS.BP_SYS_MIN || num > ERR_LIMITS.BP_SYS_MAX;
    if (field === 'diastolic') return num < ERR_LIMITS.BP_DIA_MIN || num > ERR_LIMITS.BP_DIA_MAX;
    if (field === 'pulse') return num < ERR_LIMITS.PULSE_MIN || num > ERR_LIMITS.PULSE_MAX;
    if (field === 'spo2') return num < ERR_LIMITS.SPO2_MIN || num > 100;
    return false;
  };

  const getStatusClass = (field: string, val: string) => {
    if (!val || val.trim() === '') return 'border-slate-300 text-slate-800';
    const num = parseFloat(val);
    if (isNaN(num)) return 'border-slate-300 text-slate-800';

    if (isInputError(field, val)) {
      return 'bg-purple-100 border-purple-500 text-purple-700 font-bold';
    }

    // マスタ設定の閾値による強調表示
    if (field === 'temperature') {
      if (num >= effectiveThresholds.tempHigh) {
        return 'bg-red-50 border-red-500 text-red-600 font-black ring-2 ring-red-400 shadow-xs';
      }
      if (effectiveThresholds.tempCaution && num >= effectiveThresholds.tempCaution) {
        return 'bg-amber-50 border-amber-400 text-amber-700 font-bold';
      }
    }
    if (field === 'systolic') {
      if (num >= effectiveThresholds.bpSysHigh || (effectiveThresholds.bpSysLow !== undefined && num <= effectiveThresholds.bpSysLow)) {
        return 'bg-red-50 border-red-500 text-red-600 font-black ring-2 ring-red-400 shadow-xs';
      }
    }
    if (field === 'diastolic') {
      if (num >= effectiveThresholds.bpDiaHigh || (effectiveThresholds.bpDiaLow !== undefined && num <= effectiveThresholds.bpDiaLow)) {
        return 'bg-red-50 border-red-500 text-red-600 font-black ring-2 ring-red-400 shadow-xs';
      }
    }
    if (field === 'pulse') {
      if ((effectiveThresholds.pulseHigh !== undefined && num >= effectiveThresholds.pulseHigh) || 
          (effectiveThresholds.pulseLow !== undefined && num <= effectiveThresholds.pulseLow)) {
        return 'bg-red-50 border-red-500 text-red-600 font-black ring-2 ring-red-400 shadow-xs';
      }
    }
    if (field === 'spo2') {
      if (effectiveThresholds.spo2Low !== undefined && num <= effectiveThresholds.spo2Low) {
        return 'bg-red-50 border-red-500 text-red-600 font-black ring-2 ring-red-400 shadow-xs';
      }
    }
    return 'border-slate-300 text-slate-800';
  };

  return (
    <div className="space-y-4">
      {/* 閲覧専用バナー */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-amber-900 text-xs no-print shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-600 shrink-0" />
            <span className="font-bold">
              【閲覧権限】あなたのアカウントは「閲覧のみ（Viewer）」に設定されています。
            </span>
            <span className="text-amber-700">各入力欄は読み取り専用となり、データの保存や更新は行えません。</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-100/90 px-2.5 py-1 rounded-md border border-amber-300 shrink-0">
            <Lock size={12} />
            <span>編集には「editor」権限が必要です</span>
          </span>
        </div>
      )}

      {/* アップロード通知トースト */}
      {uploadStatusText && (
        <div className="bg-blue-600 text-white p-3 px-4 rounded-xl flex items-center justify-between gap-3 text-xs font-bold shadow-md animate-in fade-in duration-200 no-print">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-yellow-300 animate-spin" />
            <span>{uploadStatusText}</span>
          </div>
          <span className="text-[10px] bg-blue-700/80 px-2 py-0.5 rounded font-mono">Firebase Storage</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border no-print">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-500" size={24} />
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">記録日を選択</label>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  className="border rounded-md px-2.5 sm:px-3 py-1 text-slate-700 font-bold text-[16px] sm:text-sm touch-manipulation focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className={`px-2 py-1 rounded border font-bold text-sm min-w-[2.5rem] text-center transition-colors ${dayColorClass}`}>
                  {dayOfWeek}
                </span>
                {facilityName && (
                  <span className="hidden md:inline-flex items-center gap-1.5 ml-1 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    {facilityName}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="h-10 w-[1px] bg-slate-200 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            {isReadOnly ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs">
                <Eye size={15} className="text-slate-500" />
                <span>閲覧専用（編集不可）</span>
              </div>
            ) : isSaving ? (
              <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm animate-pulse">
                <Loader2 size={18} className="animate-spin" />
                <span>保存中...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                <CheckCircle2 size={18} />
                <span>すべての変更を保存済み</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {abnormalStats.count > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 border border-red-300 px-3 py-1.5 rounded-lg animate-pulse" title="設定マスタの閾値を超過した記録が検出されました">
              <AlertCircle size={15} className="text-red-600 shrink-0" />
              <span>異常値アラート: {abnormalStats.count} 名</span>
            </div>
          ) : (
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-red-50/70 border border-red-200 px-2.5 py-1 rounded-lg" title="設定マスタで変更可能">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span>異常値判定: 体温 ≥{effectiveThresholds.tempHigh}℃ / 血圧 ≥{effectiveThresholds.bpSysHigh}/{effectiveThresholds.bpDiaHigh} / SpO₂ ≤{effectiveThresholds.spo2Low}%</span>
            </div>
          )}

          {attachedPhotoCount > 0 && (
            <div className="hidden md:flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg">
              <Camera size={14} className="text-blue-500" />
              <span>写真添付: {attachedPhotoCount} 名</span>
            </div>
          )}

          {isReadOnly ? (
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <Lock size={14} className="text-slate-400" />
              <span>入力要素はロックされています</span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border">
              <CloudUpload size={14} />
              <span>入力・写真添付は自動保存されます</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => exportVitalRecordsToCSV(records, residents, facilityName)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 hover:text-blue-700 border border-slate-300 hover:border-blue-300 rounded-lg shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            title="現在の全バイタル記録をCSV形式でダウンロード"
          >
            <Download size={14} className="text-blue-600" />
            <span>CSV出力</span>
          </button>
        </div>
      </div>

      {/* スマホ操作ガイド（横スクロール可能かつ氏名固定であることを通知） */}
      <div className="flex sm:hidden items-center justify-between px-3 py-1.5 bg-blue-50/80 border border-blue-200/70 rounded-lg text-[11px] text-blue-800 font-medium no-print">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
          <span>氏名列は左側に固定表示されます</span>
        </span>
        <span className="text-blue-600 text-[10px]">👉 横スクロールで全項目入力</span>
      </div>

      <div 
        ref={tableContainerRef}
        className={`mobile-sticky-table-container max-h-[calc(100dvh-220px)] min-h-[380px] rounded-xl shadow-sm border border-slate-200 bg-white relative w-full transition-all ${
          activeInputInfo ? 'pb-28' : ''
        }`}
      >
        <table className="min-w-max w-full divide-y divide-slate-200 text-sm border-separate border-spacing-0">
          <thead className="bg-slate-50 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <tr>
              <th className="px-1.5 sm:px-2 py-2 text-left font-semibold text-xs sm:text-sm text-slate-700 sticky top-0 left-0 bg-slate-100 z-40 border-b border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.08)] w-[84px] sm:w-[94px] min-w-[80px] max-w-[94px]">氏名</th>
              <th className="px-2 py-3 text-center font-semibold text-slate-700 sticky top-0 bg-slate-50 z-30 border-b border-slate-200 w-20 sm:w-24">利用無し</th>
              <th className="px-2 py-3 text-center font-semibold text-slate-700 sticky top-0 bg-slate-50 z-30 border-b border-slate-200 w-24 sm:w-28">体温</th>
              <th className="px-2 py-3 text-center font-semibold text-slate-700 sticky top-0 bg-slate-50 z-30 border-b border-slate-200 w-20 sm:w-24">脈拍</th>
              <th className="px-2 py-3 text-center font-semibold text-slate-700 sticky top-0 bg-slate-50 z-30 border-b border-slate-200 w-36 sm:w-44">血圧 (上/下)</th>
              <th className="px-2 py-3 text-center font-semibold text-slate-700 sticky top-0 bg-slate-50 z-30 border-b border-slate-200 w-20 sm:w-24">SpO₂</th>
              <th className="px-2 py-3 text-center font-semibold text-slate-700 sticky top-0 bg-slate-50 z-30 border-b border-slate-200 w-64 sm:w-72">食事 (朝/昼/晩)</th>
              <th className="px-2 py-3 text-center font-semibold text-slate-700 sticky top-0 bg-slate-50 z-30 border-b border-slate-200 w-16 sm:w-20">排便</th>
              <th className="px-3 py-3 text-left font-semibold text-slate-700 sticky top-0 bg-slate-50 z-30 border-b border-slate-200 min-w-[280px] sm:min-w-[340px]">
                <div className="flex items-center gap-1.5">
                  <span>備考</span>
                  <span className="text-[11px] font-normal text-slate-400">/ 写真添付</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {residents.map((res) => {
              const row = data[res.id] || {};
              const prev = prevDataMap[res.id];
              const isAbnormalResident = abnormalStats.abnormalResidentIds.has(res.id);
              const isUploadingThis = uploadingResId === res.id;
              const isRowActive = activeInputInfo?.resId === res.id;

              return (
                <tr 
                  key={res.id} 
                  className={`group transition-colors ${
                    row.isAbsent ? 'bg-slate-100 opacity-60' : isRowActive ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className={`px-1.5 sm:px-2 py-1.5 sm:py-2.5 font-medium text-slate-800 sticky left-0 z-20 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.08)] ${
                    row.isAbsent 
                      ? 'bg-slate-100' 
                      : isRowActive
                        ? 'bg-blue-50 border-r-blue-400'
                        : isAbnormalResident 
                          ? 'bg-red-50 hover:bg-red-100' 
                          : 'bg-white hover:bg-slate-50'
                  } w-[84px] sm:w-[94px] min-w-[80px] max-w-[94px]`}>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1 py-0 rounded border border-slate-200 shrink-0 leading-tight">
                          #{res.roomNumber}
                        </span>
                        {isAbnormalResident && (
                          <span className="text-[8px] font-bold text-red-700 bg-red-100 border border-red-300 px-0.5 py-0 rounded leading-tight shrink-0">
                            異常
                          </span>
                        )}
                        {isRowActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping ml-auto shrink-0" title="入力中"></span>
                        )}
                      </div>
                      <span 
                        className={`text-[12px] sm:text-xs font-bold leading-tight tracking-tight break-all line-clamp-2 ${
                          isAbnormalResident ? 'text-red-950 font-black' : isRowActive ? 'text-blue-950 font-bold' : 'text-slate-800'
                        }`} 
                        title={res.name}
                      >
                        {res.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button 
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => handleChange(res.id, 'isAbsent', !row.isAbsent, true)}
                      className={`p-1.5 rounded-full transition-colors ${
                        isReadOnly ? 'cursor-not-allowed opacity-50 ' : ''
                      }${row.isAbsent ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      title={isReadOnly ? '閲覧権限のため利用無しフラグは変更できません' : '利用無しに設定'}
                    >
                      <UserX size={18} />
                    </button>
                  </td>
                  <td className="px-2 py-3">
                    <div className="relative pb-5">
                      <input
                        type="text" 
                        inputMode="decimal" 
                        enterKeyHint="next"
                        data-vitals-input="true"
                        data-res-id={res.id}
                        data-field-key="temperature"
                        disabled={isReadOnly || row.isAbsent}
                        readOnly={isReadOnly}
                        placeholder={isReadOnly ? '-' : '365'}
                        className={`w-full text-center border rounded py-1.5 font-bold text-[16px] sm:text-sm touch-manipulation focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                          isReadOnly ? 'bg-slate-100/70 cursor-not-allowed text-slate-600 border-slate-200 ' : ''
                        }${getStatusClass('temperature', row.temperature || '')}`}
                        value={row.temperature || ''}
                        onChange={(e) => handleChange(res.id, 'temperature', e.target.value)}
                        onBlur={() => handleFieldBlur(res.id)}
                        onFocus={(e) => handleFieldFocus(e, res, 'temperature', '体温')}
                        onKeyDown={handleKeyDown}
                      />
                      <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center text-slate-400 truncate">前回:{prev?.temperature || '-'}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="relative pb-5">
                      <input
                        type="text" 
                        inputMode="numeric" 
                        pattern="[0-9]*"
                        enterKeyHint="next"
                        data-vitals-input="true"
                        data-res-id={res.id}
                        data-field-key="pulse"
                        disabled={isReadOnly || row.isAbsent}
                        readOnly={isReadOnly}
                        placeholder={isReadOnly ? '-' : ''}
                        className={`w-full text-center border rounded py-1.5 font-bold text-[16px] sm:text-sm touch-manipulation focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                          isReadOnly ? 'bg-slate-100/70 cursor-not-allowed text-slate-600 border-slate-200 ' : ''
                        }${getStatusClass('pulse', row.pulse || '')}`}
                        value={row.pulse || ''}
                        onChange={(e) => handleChange(res.id, 'pulse', e.target.value)}
                        onBlur={() => handleFieldBlur(res.id)}
                        onFocus={(e) => handleFieldFocus(e, res, 'pulse', '脈拍')}
                        onKeyDown={handleKeyDown}
                      />
                      <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center text-slate-400 truncate">前回:{prev?.pulse || '-'}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="relative pb-5">
                      <div className="flex items-center gap-1">
                        <input
                          type="text" 
                          inputMode="numeric" 
                          pattern="[0-9]*"
                          enterKeyHint="next"
                          data-vitals-input="true"
                          data-res-id={res.id}
                          data-field-key="systolic"
                          disabled={isReadOnly || row.isAbsent}
                          readOnly={isReadOnly}
                          placeholder={isReadOnly ? '-' : ''}
                          className={`w-full text-center border rounded py-1.5 font-bold text-[16px] sm:text-sm touch-manipulation focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                            isReadOnly ? 'bg-slate-100/70 cursor-not-allowed text-slate-600 border-slate-200 ' : ''
                          }${getStatusClass('systolic', row.systolic || '')}`}
                          value={row.systolic || ''}
                          onChange={(e) => handleChange(res.id, 'systolic', e.target.value)}
                          onBlur={() => handleFieldBlur(res.id)}
                          onFocus={(e) => handleFieldFocus(e, res, 'systolic', '血圧(上)')}
                          onKeyDown={handleKeyDown}
                        />
                        <span className="text-slate-400 font-bold">/</span>
                        <input
                          type="text" 
                          inputMode="numeric" 
                          pattern="[0-9]*"
                          enterKeyHint="next"
                          data-vitals-input="true"
                          data-res-id={res.id}
                          data-field-key="diastolic"
                          disabled={isReadOnly || row.isAbsent}
                          readOnly={isReadOnly}
                          placeholder={isReadOnly ? '-' : ''}
                          className={`w-full text-center border rounded py-1.5 font-bold text-[16px] sm:text-sm touch-manipulation focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                            isReadOnly ? 'bg-slate-100/70 cursor-not-allowed text-slate-600 border-slate-200 ' : ''
                          }${getStatusClass('diastolic', row.diastolic || '')}`}
                          value={row.diastolic || ''}
                          onChange={(e) => handleChange(res.id, 'diastolic', e.target.value)}
                          onBlur={() => handleFieldBlur(res.id)}
                          onFocus={(e) => handleFieldFocus(e, res, 'diastolic', '血圧(下)')}
                          onKeyDown={handleKeyDown}
                        />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center text-slate-400 truncate">前回:{prev ? `${prev.systolic}/${prev.diastolic}` : '-'}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="relative pb-5">
                      <input
                        type="text" 
                        inputMode="numeric" 
                        pattern="[0-9]*"
                        enterKeyHint="next"
                        data-vitals-input="true"
                        data-res-id={res.id}
                        data-field-key="spo2"
                        disabled={isReadOnly || row.isAbsent}
                        readOnly={isReadOnly}
                        placeholder={isReadOnly ? '-' : ''}
                        className={`w-full text-center border rounded py-1.5 font-bold text-[16px] sm:text-sm touch-manipulation focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                          isReadOnly ? 'bg-slate-100/70 cursor-not-allowed text-slate-600 border-slate-200 ' : ''
                        }${getStatusClass('spo2', row.spo2 || '')}`}
                        value={row.spo2 || ''}
                        onChange={(e) => handleChange(res.id, 'spo2', e.target.value)}
                        onBlur={() => handleFieldBlur(res.id)}
                        onFocus={(e) => handleFieldFocus(e, res, 'spo2', 'SpO₂')}
                        onKeyDown={handleKeyDown}
                      />
                      <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center text-slate-400 truncate">前回:{prev?.spo2 || '-'}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex gap-1.5 justify-center">
                      {(['mealMorning', 'mealNoon', 'mealNight'] as const).map((time) => {
                        const meal = (row[time] as Meal) || { main: 10, side: 10 };
                        const label = time === 'mealMorning' ? '朝' : time === 'mealNoon' ? '昼' : '晩';
                        return (
                          <div key={time} className="flex flex-col items-center gap-0.5 border border-slate-200 p-1 rounded-lg bg-slate-50/80">
                            <span className="text-[11px] font-bold text-slate-700">{label}</span>
                            <div className="flex gap-1">
                              {/* 主食 */}
                              <div className="flex flex-col items-center">
                                <span className="text-[8px] text-slate-400 font-semibold leading-none mb-0.5">主</span>
                                <input 
                                  type="text" 
                                  inputMode="numeric" 
                                  pattern="[0-9]*"
                                  enterKeyHint="next"
                                  data-vitals-input="true"
                                  data-res-id={res.id}
                                  data-field-key={`${time}-main`}
                                  disabled={isReadOnly || row.isAbsent} 
                                  readOnly={isReadOnly}
                                  title={`${label} 主食 (0-10)`}
                                  className={`w-7 sm:w-6 h-7 sm:h-6 text-center border rounded font-bold text-[16px] sm:text-xs touch-manipulation transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
                                    isReadOnly ? 'bg-slate-100/80 cursor-not-allowed text-slate-500 border-slate-200' : 'bg-white border-slate-300 text-slate-800'
                                  }`} 
                                  value={meal.main !== undefined ? meal.main : 10} 
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    handleMealChange(res.id, time, 'main', isNaN(val) ? 0 : Math.min(10, Math.max(0, val)));
                                  }} 
                                  onBlur={() => handleFieldBlur(res.id)}
                                  onFocus={(e) => handleFieldFocus(e, res, `${time}-main`, `${label}主`)}
                                  onKeyDown={handleKeyDown}
                                />
                              </div>
                              {/* 副食 */}
                              <div className="flex flex-col items-center">
                                <span className="text-[8px] text-blue-500 font-semibold leading-none mb-0.5">副</span>
                                <input 
                                  type="text" 
                                  inputMode="numeric" 
                                  pattern="[0-9]*"
                                  enterKeyHint="next"
                                  data-vitals-input="true"
                                  data-res-id={res.id}
                                  data-field-key={`${time}-side`}
                                  disabled={isReadOnly || row.isAbsent} 
                                  readOnly={isReadOnly}
                                  title={`${label} 副食 (0-10)`}
                                  className={`w-7 sm:w-6 h-7 sm:h-6 text-center border rounded font-bold text-[16px] sm:text-xs touch-manipulation transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
                                    isReadOnly ? 'bg-slate-100/80 cursor-not-allowed text-slate-500 border-slate-200' : 'border-blue-300 bg-blue-50/70 text-blue-900'
                                  }`} 
                                  value={meal.side !== undefined ? meal.side : 10} 
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    handleMealChange(res.id, time, 'side', isNaN(val) ? 0 : Math.min(10, Math.max(0, val)));
                                  }} 
                                  onBlur={() => handleFieldBlur(res.id)}
                                  onFocus={(e) => handleFieldFocus(e, res, `${time}-side`, `${label}副`)}
                                  onKeyDown={handleKeyDown}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <input 
                      type="text" 
                      inputMode="numeric" 
                      pattern="[0-9]*"
                      enterKeyHint="next"
                      data-vitals-input="true"
                      data-res-id={res.id}
                      data-field-key="bowelCount"
                      disabled={isReadOnly || row.isAbsent} 
                      readOnly={isReadOnly}
                      className={`w-full text-center border rounded py-1.5 font-bold text-[16px] sm:text-sm touch-manipulation focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                        isReadOnly ? 'bg-slate-100/70 cursor-not-allowed text-slate-600 border-slate-200' : ''
                      }`} 
                      value={row.bowelCount || '0'} 
                      onChange={(e) => handleChange(res.id, 'bowelCount', e.target.value)} 
                      onBlur={() => handleFieldBlur(res.id)}
                      onFocus={(e) => handleFieldFocus(e, res, 'bowelCount', '排便')}
                      onKeyDown={handleKeyDown}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-2.5">
                      {/* 備考テキストエリア */}
                      <textarea 
                        disabled={isReadOnly || row.isAbsent} 
                        readOnly={isReadOnly}
                        rows={2}
                        data-vitals-input="true"
                        data-res-id={res.id}
                        data-field-key="note"
                        enterKeyHint="next"
                        className={`flex-1 min-w-[170px] border rounded py-1 px-2 text-[16px] sm:text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-tight touch-manipulation ${
                          isReadOnly ? 'bg-slate-100/70 cursor-not-allowed text-slate-600 border-slate-200' : ''
                        }`} 
                        value={row.note || ''} 
                        onChange={(e) => handleChange(res.id, 'note', e.target.value)} 
                        onBlur={() => handleFieldBlur(res.id)}
                        onFocus={(e) => handleFieldFocus(e, res, 'note', '備考')}
                        onKeyDown={handleKeyDown}
                        placeholder={isReadOnly ? '（閲覧のみ）' : '備考を入力...'} 
                      />

                      {/* 写真添付 & サムネイルエリア */}
                      <div className="shrink-0 flex items-center justify-center">
                        {row.imageUrl ? (
                          <div className="relative group/thumb">
                            <button
                              type="button"
                              onClick={() => setLightboxData({
                                url: row.imageUrl!,
                                residentName: res.name,
                                roomNumber: res.roomNumber,
                                resId: res.id
                              })}
                              className="block w-12 h-12 rounded-lg overflow-hidden border border-slate-300 shadow-xs hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer bg-slate-100 relative"
                              title="クリックして拡大プレビュー"
                            >
                              <img 
                                src={row.imageUrl} 
                                alt="添付写真" 
                                className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform" 
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <ZoomIn size={14} />
                              </div>
                            </button>

                            {/* 削除ボタン（閲覧者は非表示） */}
                            {!isReadOnly && !row.isAbsent && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`${res.name} 様の添付写真を削除しますか？`)) {
                                    handleRemoveImage(res.id);
                                  }
                                }}
                                className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-0.5 shadow-sm transition-colors cursor-pointer"
                                title="添付写真を削除"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        ) : isUploadingThis ? (
                          <div className="w-12 h-12 rounded-lg border border-blue-200 bg-blue-50 flex flex-col items-center justify-center text-blue-600 animate-pulse">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-[8px] font-bold mt-0.5">圧縮中</span>
                          </div>
                        ) : (
                          !isReadOnly && !row.isAbsent && (
                            <label 
                              className="w-12 h-12 rounded-lg border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/80 hover:bg-blue-50/80 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 transition-all cursor-pointer group active:scale-95"
                              title="写真を添付（長辺最大1024pxにCanvas自動縮小・JPEG圧縮してStorage保存）"
                            >
                              <Camera size={16} className="group-hover:scale-110 transition-transform" />
                              <span className="text-[8px] font-bold mt-0.5">写真添付</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isReadOnly || row.isAbsent}
                                onChange={(e) => handleImageUpload(res.id, e)}
                              />
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* スマホ・タブレット専用 入力アシストナビゲーションバー（iPhone Chrome等のテンキー入力で「次へ」「完了」を提供） */}
      {activeInputInfo && !isReadOnly && (
        <aside 
          aria-label="入力ナビゲーションツールバー"
          className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 text-white backdrop-blur-md border-t border-slate-700/80 px-3 pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom duration-200 no-print"
        >
          <div className="max-w-4xl mx-auto flex flex-col gap-1.5">
            {/* 上段: 現在選択中の利用者・項目・クイック入力チップ */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-mono text-blue-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded shrink-0">
                  #{activeInputInfo.roomNumber || '-'}
                </span>
                <span className="text-xs font-bold text-slate-100 truncate max-w-[120px] sm:max-w-none">
                  {activeInputInfo.resName}
                </span>
                <span className="bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-xs shrink-0">
                  {activeInputInfo.fieldLabel}
                </span>
              </div>

              {/* クイック入力チップ（食事や排便、体温の代表値をワンタップで反映して即座に次へ送る） */}
              <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
                {activeInputInfo.fieldKey.startsWith('meal') && (
                  <>
                    <span className="text-[10px] text-slate-400 font-medium hidden xs:inline">即入力:</span>
                    {[10, 8, 5, 0].map(num => (
                      <button
                        key={num}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleQuickApply(num)}
                        className="px-2 py-0.5 text-xs font-bold bg-slate-800 hover:bg-blue-700 active:bg-blue-600 text-slate-200 hover:text-white rounded border border-slate-700 touch-manipulation cursor-pointer"
                        title={`${num}割`}
                      >
                        {num}
                      </button>
                    ))}
                  </>
                )}
                {activeInputInfo.fieldKey === 'bowelCount' && (
                  <>
                    <span className="text-[10px] text-slate-400 font-medium hidden xs:inline">即入力:</span>
                    {['0', '1', '2'].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleQuickApply(cnt)}
                        className="px-2 py-0.5 text-xs font-bold bg-slate-800 hover:bg-blue-700 active:bg-blue-600 text-slate-200 hover:text-white rounded border border-slate-700 touch-manipulation cursor-pointer"
                        title={`${cnt}回`}
                      >
                        {cnt}回
                      </button>
                    ))}
                  </>
                )}
                {activeInputInfo.fieldKey === 'temperature' && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleQuickApply('36.5')}
                    className="px-2 py-0.5 text-xs font-bold bg-slate-800 hover:bg-blue-700 active:bg-blue-600 text-slate-200 hover:text-white rounded border border-slate-700 touch-manipulation cursor-pointer"
                    title="平熱 36.5℃"
                  >
                    36.5℃
                  </button>
                )}
              </div>
            </div>

            {/* 下段: ナビゲーション操作ボタン群 */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={goToPrevInput}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1 touch-manipulation cursor-pointer active:scale-95 transition-transform"
                  title="前の入力項目へ"
                >
                  <ChevronLeft size={16} />
                  <span>前へ</span>
                </button>
                <span className="text-[10px] text-slate-400 hidden sm:inline">Enterキーでも移動可能</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={closeActiveInput}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1 touch-manipulation cursor-pointer transition-colors"
                  title="入力を完了してキーボードを閉じる"
                >
                  <Check size={14} className="text-emerald-400" />
                  <span>完了</span>
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={goToNextInput}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5 touch-manipulation cursor-pointer active:scale-95 transition-all ring-2 ring-blue-400/40"
                  title="次の入力項目へ (Enter)"
                >
                  <span>次へ</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ガイドエリア */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center no-print">
        <div className="flex gap-3">
          <AlertCircle className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 space-y-1">
            <p><b>自動小数点入力:</b> 体温を「365」と打つと自動で「36.5」になります。</p>
            <p><b>写真添付機能:</b> 備考欄横のカメラボタンから、皮膚状態や傷口、食事状況などの写真を添付できます。</p>
            <p><b>自動リサイズ・圧縮:</b> Canvas APIにより長辺最大1024px・軽量JPEG形式へ自動縮小し、Firebase Storageへ保存されます。</p>
          </div>
        </div>
        <div className="text-[11px] text-blue-600/90 font-medium bg-blue-100/60 border border-blue-200/80 px-3 py-1.5 rounded-lg shrink-0">
          サムネイルをクリックすると拡大確認・ダウンロードが可能です
        </div>
      </div>

      {/* 写真拡大表示モーダル */}
      {lightboxData && (
        <ImageLightboxModal
          isOpen={Boolean(lightboxData)}
          onClose={() => setLightboxData(null)}
          imageUrl={lightboxData.url}
          residentName={lightboxData.residentName}
          roomNumber={lightboxData.roomNumber}
          date={date}
          canDelete={!isReadOnly}
          onDelete={() => handleRemoveImage(lightboxData.resId)}
        />
      )}
    </div>
  );
};

export default BatchInputTable;
