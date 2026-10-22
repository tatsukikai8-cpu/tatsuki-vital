
import React, { useState, useEffect, useRef } from 'react';
import { Resident, VitalThresholds } from '../types';
import { 
  Plus, Trash2, Save, UserCheck, Building, RotateCcw, UserMinus, ChevronUp, ChevronDown, 
  AlertCircle, CheckCircle2, Loader2, Building2, SlidersHorizontal, Activity, Thermometer, 
  Heart, Wind, ShieldAlert, Sparkles, RefreshCw, Cloud, Terminal, ExternalLink, Copy, Check,
  Lock, LayoutGrid
} from 'lucide-react';
import { DEFAULT_THRESHOLDS, THRESHOLDS, getInitialResidentsForFacility } from '../constants';

interface ResidentMasterProps {
  residents: Resident[];
  onUpdate: (residents: Resident[]) => Promise<void> | void;
  facilityName: string;
  facilityId: string;
  onFacilityNameUpdate: (name: string) => Promise<void> | void;
  thresholds?: VitalThresholds;
  onThresholdsUpdate?: (thresholds: VitalThresholds) => Promise<void> | void;
  isReadOnly?: boolean;
  onReturnToInput?: () => void;
}

const ResidentMaster: React.FC<ResidentMasterProps> = ({ 
  residents, 
  onUpdate, 
  facilityName, 
  facilityId,
  onFacilityNameUpdate,
  thresholds,
  onThresholdsUpdate,
  isReadOnly = false,
  onReturnToInput
}) => {
  // コンポーネント内で独立して管理するリスト
  const [localResidents, setLocalResidents] = useState<Resident[]>(() => {
    return Array.isArray(residents) ? [...residents] : [];
  });
  const [localFacilityName, setLocalFacilityName] = useState<string>(facilityName || '');
  const [localThresholds, setLocalThresholds] = useState<VitalThresholds>(() => {
    return { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 施設名称専用の保存ステート
  const [isSavingFacilityName, setIsSavingFacilityName] = useState(false);
  const [facilityNameSuccess, setFacilityNameSuccess] = useState(false);
  const [facilityNameError, setFacilityNameError] = useState<string | null>(null);

  const prevFacilityIdRef = useRef(facilityId);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [showDeployGuide, setShowDeployGuide] = useState(false);

  const handleCopyCommand = (cmd: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(cmd).catch(() => {});
      }
    } catch {
      // ignore clipboard error in restricted iframes
    }
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  // 施設切り替えまたは親ステート同期
  useEffect(() => {
    // 施設IDが変わった場合は無条件に親のデータに同期
    if (prevFacilityIdRef.current !== facilityId) {
      prevFacilityIdRef.current = facilityId;
      setLocalFacilityName(facilityName);
      setLocalResidents([...residents]);
      if (thresholds) {
        setLocalThresholds({ ...thresholds });
      }
      setIsDirty(false);
      setSaveSuccess(false);
      setSaveError(null);
      setFacilityNameSuccess(false);
      setFacilityNameError(null);
      return;
    }

    // 編集中でない場合のみ、親の最新データを取り込む
    if (!isDirty) {
      setLocalResidents([...residents]);
    }
  }, [facilityId, residents, isDirty]);

  // 施設名の同期（編集中でない時のみ）
  useEffect(() => {
    if (!isDirty && prevFacilityIdRef.current === facilityId) {
      setLocalFacilityName(facilityName);
    }
  }, [facilityName, isDirty, facilityId]);

  // 閾値の同期（編集中でない時のみ）
  useEffect(() => {
    if (!isDirty && thresholds && prevFacilityIdRef.current === facilityId) {
      setLocalThresholds({ ...thresholds });
    }
  }, [thresholds, isDirty, facilityId]);

  const handleUpdate = (id: string, field: keyof Resident, value: string) => {
    const next = localResidents.map(r => r.id === id ? { ...r, [field]: value } : r);
    setLocalResidents(next);
    setIsDirty(true);
  };

  const handleThresholdChange = (field: keyof VitalThresholds, value: number) => {
    setLocalThresholds(prev => ({
      ...prev,
      [field]: value
    }));
    setIsDirty(true);
  };

  // プリセット適用
  const applyPreset = (type: 'standard' | 'strict' | 'anderson' | 'default') => {
    let preset: VitalThresholds;
    if (type === 'strict') {
      preset = {
        tempHigh: 37.3,
        tempCaution: 36.9,
        bpSysHigh: 135,
        bpSysLow: 95,
        bpDiaHigh: 85,
        bpDiaLow: 55,
        pulseHigh: 100,
        pulseLow: 55,
        spo2Low: 95
      };
    } else if (type === 'anderson') {
      preset = {
        tempHigh: 38.0,
        tempCaution: 37.0,
        bpSysHigh: 180,
        bpSysLow: 90,
        bpDiaHigh: 100,
        bpDiaLow: 50,
        pulseHigh: 110,
        pulseLow: 50,
        spo2Low: 94
      };
    } else {
      preset = { ...DEFAULT_THRESHOLDS };
    }
    setLocalThresholds(preset);
    setIsDirty(true);
  };

  const handleAdd = () => {
    const newId = `res-${facilityId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newResident: Resident = { 
      id: newId, 
      facilityId,
      name: '', 
      roomNumber: '' 
    };
    setLocalResidents([...localResidents, newResident]);
    setIsDirty(true);
  };

  // 削除ボタンの処理（確実に動作させるためconfirmを一旦除外）
  const handleRemove = (id: string) => {
    const filtered = localResidents.filter(r => r.id !== id);
    setLocalResidents(filtered);
    setIsDirty(true);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= localResidents.length) return;

    const updated = [...localResidents];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    
    setLocalResidents(updated);
    setIsDirty(true);
  };

  // 施設名称のみを即時保存するハンドラー
  const handleSaveFacilityNameOnly = async () => {
    const trimmed = localFacilityName.trim();
    if (!trimmed || isSavingFacilityName || isReadOnly) return;
    setIsSavingFacilityName(true);
    setFacilityNameError(null);
    setFacilityNameSuccess(false);

    try {
      if (onFacilityNameUpdate) {
        await onFacilityNameUpdate(trimmed);
      }
      setFacilityNameSuccess(true);
      // 名簿・閾値に変更がなければダーティ状態を解除
      const residentsUnchanged = JSON.stringify(localResidents) === JSON.stringify(residents);
      const thresholdsUnchanged = JSON.stringify(localThresholds) === JSON.stringify(thresholds);
      if (residentsUnchanged && thresholdsUnchanged) {
        setIsDirty(false);
      }
      setTimeout(() => setFacilityNameSuccess(false), 4000);
    } catch (err: any) {
      console.error("Facility name save error:", err);
      setFacilityNameError(err?.message || "施設名称の保存に失敗しました。権限や通信環境をご確認ください。");
    } finally {
      setIsSavingFacilityName(false);
    }
  };

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const trimmedFacilityName = localFacilityName.trim();
      let hasError = false;
      const errorDetails: string[] = [];

      // 1. 施設名称の保存（変更されている場合）
      if (trimmedFacilityName && trimmedFacilityName !== facilityName) {
        try {
          await onFacilityNameUpdate(trimmedFacilityName);
        } catch (err: any) {
          hasError = true;
          errorDetails.push(`施設名保存: ${err?.message || 'エラー'}`);
        }
      }

      // 2. 警告閾値の保存（変更されている場合）
      if (onThresholdsUpdate && JSON.stringify(localThresholds) !== JSON.stringify(thresholds)) {
        try {
          await onThresholdsUpdate(localThresholds);
        } catch (err: any) {
          hasError = true;
          errorDetails.push(`警告閾値保存: ${err?.message || 'エラー'}`);
        }
      }

      // 3. 名簿の保存（変更されている場合）
      if (JSON.stringify(localResidents) !== JSON.stringify(residents)) {
        try {
          await onUpdate([...localResidents]);
        } catch (err: any) {
          hasError = true;
          errorDetails.push(`名簿保存: ${err?.message || 'エラー'}`);
        }
      }

      if (hasError) {
        setSaveError(errorDetails.join(' / '));
      } else {
        setIsDirty(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveError(err?.message || "設定の保存に失敗しました。権限や通信環境をご確認のうえ再試行してください。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLocalResidents([...residents]);
    setLocalFacilityName(facilityName);
    setLocalThresholds(thresholds ? { ...thresholds } : { ...DEFAULT_THRESHOLDS });
    setIsDirty(false);
    setSaveError(null);
    setFacilityNameError(null);
    setFacilityNameSuccess(false);
  };

  const handleDefaultSample = () => {
    setLocalResidents([...getInitialResidentsForFacility(facilityId)]);
    setIsDirty(true);
  };

  return (
    <div className="space-y-6">
      {/* 閲覧専用バナー */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs no-print shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-600 shrink-0" />
            <span className="font-bold">【閲覧専用モード】施設基本設定・警告閾値・名簿の閲覧が可能です（編集・保存はロックされています）。</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              <Lock size={12} />
              <span>閲覧のみ（編集不可）</span>
            </span>
            {onReturnToInput && (
              <button
                type="button"
                onClick={onReturnToInput}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-bold text-xs shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                <LayoutGrid size={13} />
                <span>一括入力画面へ戻る</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 施設基本設定 */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building size={20} className="text-blue-600" />
            施設基本設定
          </h2>
          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-mono border">
            <Building2 size={13} className="text-blue-600" />
            <span>対象施設ID: {facilityId}</span>
          </span>
        </div>
        <div className="max-w-xl">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
            施設名称 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              type="text" 
              value={localFacilityName}
              placeholder="施設名称を入力"
              disabled={isReadOnly || isSavingFacilityName}
              onChange={(e) => {
                if (isReadOnly) return;
                setLocalFacilityName(e.target.value);
                setIsDirty(true);
                setFacilityNameSuccess(false);
                setFacilityNameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isReadOnly && localFacilityName.trim()) {
                  e.preventDefault();
                  handleSaveFacilityNameOnly();
                }
              }}
              className={`flex-1 border rounded-md px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 ${
                isReadOnly ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white'
              }`}
            />
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSaveFacilityNameOnly}
                disabled={isSavingFacilityName || !localFacilityName.trim()}
                className={`px-4 py-2.5 rounded-md font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-xs ${
                  isSavingFacilityName
                    ? 'bg-blue-400 text-white cursor-wait'
                    : localFacilityName.trim()
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
                title="施設名称の変更を保存"
              >
                {isSavingFacilityName ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>施設名を保存</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* 施設名保存メッセージ */}
          {facilityNameSuccess && (
            <div className="mt-2.5 text-xs text-emerald-700 font-semibold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>施設名称を「{localFacilityName.trim()}」に更新してデータベースへ保存しました。</span>
            </div>
          )}
          {facilityNameError && (
            <div className="mt-2.5 text-xs text-red-700 font-semibold flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              <AlertCircle size={15} className="text-red-600 shrink-0" />
              <span>{facilityNameError}</span>
            </div>
          )}

          <p className="text-[11px] text-slate-400 mt-2">
            ※ 上の「施設名を保存」または下部の『設定を保存』ボタンを押すと施設データベースに即時永続保存され、ヘッダー・一覧表・個人履歴・CSV出力等へリアルタイム反映されます。
          </p>
        </div>
      </div>

      {/* バイタル異常値・警告閾値マスタ設定 */}
      <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <SlidersHorizontal size={20} className="text-red-500" />
              バイタル異常値・警告閾値マスタ設定
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              入力画面や管理表・ダッシュボードで赤字強調表示する判定ラインを設定できます。施設ごとの管理基準に応じて調整してください。
            </p>
          </div>
          {/* プリセット選択ボタン */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Sparkles size={13} className="text-amber-500" /> プリセット:
            </span>
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => applyPreset('standard')}
              className={`text-xs px-2.5 py-1 font-bold rounded-lg border transition-colors ${
                isReadOnly 
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 cursor-pointer'
              }`}
              title="体温 37.5℃ / 血圧 140/90 mmHg / SpO2 94%"
            >
              標準基準 (37.5℃ / 140/90)
            </button>
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => applyPreset('strict')}
              className={`text-xs px-2.5 py-1 font-bold rounded-lg border transition-colors ${
                isReadOnly 
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 cursor-pointer'
              }`}
              title="体温 37.3℃ / 血圧 135/85 mmHg / SpO2 95%"
            >
              厳格基準 (37.3℃ / 135/85)
            </button>
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => applyPreset('anderson')}
              className={`text-xs px-2.5 py-1 font-bold rounded-lg border transition-colors ${
                isReadOnly 
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 cursor-pointer'
              }`}
              title="体温 38.0℃ / 血圧 180/100 mmHg (中止・禁忌基準)"
            >
              アンダーソン・土肥基準
            </button>
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => applyPreset('default')}
              className={`text-xs px-2.5 py-1 font-bold rounded-lg border transition-colors flex items-center gap-1 ${
                isReadOnly 
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 cursor-pointer'
              }`}
              title="初期デフォルト値に戻す"
            >
              <RotateCcw size={12} /> リセット
            </button>
          </div>
        </div>

        {/* 4グループ設定グリッド */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. 体温 */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800 font-bold text-sm">
              <Thermometer size={18} className="text-red-500" />
              <span>体温設定 (℃)</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                発熱警告 (上限・赤字強調)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="35.0"
                  max="42.0"
                  disabled={isReadOnly}
                  value={localThresholds.tempHigh}
                  onChange={(e) => !isReadOnly && handleThresholdChange('tempHigh', parseFloat(e.target.value) || 37.5)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm font-black text-red-600 focus:ring-2 focus:ring-red-400 outline-none ${
                    isReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                  }`}
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">℃ 以上</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">※ この体温以上で赤色警告強調</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                微熱注意 (参考・黄文字)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="35.0"
                  max="40.0"
                  disabled={isReadOnly}
                  value={localThresholds.tempCaution}
                  onChange={(e) => !isReadOnly && handleThresholdChange('tempCaution', parseFloat(e.target.value) || 37.0)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm font-bold text-amber-700 focus:ring-2 focus:ring-amber-400 outline-none ${
                    isReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                  }`}
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">℃ 以上</span>
              </div>
            </div>
          </div>

          {/* 2. 血圧 */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800 font-bold text-sm">
              <Activity size={18} className="text-red-500" />
              <span>血圧設定 (mmHg)</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                収縮期(上) 上限・赤字
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="100"
                  max="240"
                  disabled={isReadOnly}
                  value={localThresholds.bpSysHigh}
                  onChange={(e) => !isReadOnly && handleThresholdChange('bpSysHigh', parseInt(e.target.value) || 140)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm font-black text-red-600 focus:ring-2 focus:ring-red-400 outline-none ${
                    isReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                  }`}
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">mmHg ↑</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                拡張期(下) 上限・赤字
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="60"
                  max="160"
                  disabled={isReadOnly}
                  value={localThresholds.bpDiaHigh}
                  onChange={(e) => !isReadOnly && handleThresholdChange('bpDiaHigh', parseInt(e.target.value) || 90)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm font-black text-red-600 focus:ring-2 focus:ring-red-400 outline-none ${
                    isReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                  }`}
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">mmHg ↑</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  上 低血圧下限
                </label>
                <input
                  type="number"
                  step="1"
                  min="50"
                  max="120"
                  disabled={isReadOnly}
                  value={localThresholds.bpSysLow}
                  onChange={(e) => !isReadOnly && handleThresholdChange('bpSysLow', parseInt(e.target.value) || 90)}
                  className={`w-full border rounded px-2 py-1 text-xs font-bold text-slate-700 ${
                    isReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  下 低血圧下限
                </label>
                <input
                  type="number"
                  step="1"
                  min="30"
                  max="90"
                  disabled={isReadOnly}
                  value={localThresholds.bpDiaLow}
                  onChange={(e) => !isReadOnly && handleThresholdChange('bpDiaLow', parseInt(e.target.value) || 50)}
                  className={`w-full border rounded px-2 py-1 text-xs font-bold text-slate-700 ${
                    isReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* 3. 脈拍 */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800 font-bold text-sm">
              <Heart size={18} className="text-emerald-500" />
              <span>脈拍設定 (回/分)</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                頻脈警告 (上限・赤字)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="70"
                  max="200"
                  disabled={isReadOnly}
                  value={localThresholds.pulseHigh}
                  onChange={(e) => !isReadOnly && handleThresholdChange('pulseHigh', parseInt(e.target.value) || 110)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm font-black text-red-600 focus:ring-2 focus:ring-red-400 outline-none ${
                    isReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                  }`}
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">bpm ↑</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                徐脈警告 (下限・赤字)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="30"
                  max="80"
                  disabled={isReadOnly}
                  value={localThresholds.pulseLow}
                  onChange={(e) => !isReadOnly && handleThresholdChange('pulseLow', parseInt(e.target.value) || 50)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm font-black text-red-600 focus:ring-2 focus:ring-red-400 outline-none ${
                    isReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                  }`}
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">bpm ↓</span>
              </div>
            </div>
          </div>

          {/* 4. SpO2 */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-slate-800 font-bold text-sm">
              <Wind size={18} className="text-blue-500" />
              <span>血中酸素飽和度 SpO₂ (%)</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                低酸素警告 (下限・赤字強調)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="70"
                  max="99"
                  disabled={isReadOnly}
                  value={localThresholds.spo2Low}
                  onChange={(e) => !isReadOnly && handleThresholdChange('spo2Low', parseInt(e.target.value) || 94)}
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm font-black text-red-600 focus:ring-2 focus:ring-red-400 outline-none ${
                    isReadOnly ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'
                  }`}
                />
                <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">% ↓</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                ※ このパーセンテージ以下で赤色警告強調（一般的な呼吸不全・低酸素血症ライン）
              </p>
            </div>
          </div>
        </div>

        {/* プレビュー表示 */}
        <div className="bg-slate-100/80 rounded-xl p-4 border border-slate-200">
          <div className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-blue-600" />
            <span>現在の設定での赤字強調表示プレビュー:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-red-50 border border-red-500 text-red-600 px-3 py-1.5 rounded-lg text-xs font-black ring-2 ring-red-400 flex items-center gap-1.5">
              <span>体温: 37.6 ℃</span>
              <span className="text-[10px] bg-red-100 px-1 py-0.2 rounded font-normal">
                {37.6 >= localThresholds.tempHigh ? '発熱警告 (赤字)' : '正常範囲'}
              </span>
            </div>
            <div className="bg-red-50 border border-red-500 text-red-600 px-3 py-1.5 rounded-lg text-xs font-black ring-2 ring-red-400 flex items-center gap-1.5">
              <span>血圧: 142 / 92</span>
              <span className="text-[10px] bg-red-100 px-1 py-0.2 rounded font-normal">
                {(142 >= localThresholds.bpSysHigh || 92 >= localThresholds.bpDiaHigh) ? '高血圧警告 (赤字)' : '正常範囲'}
              </span>
            </div>
            <div className="bg-red-50 border border-red-500 text-red-600 px-3 py-1.5 rounded-lg text-xs font-black ring-2 ring-red-400 flex items-center gap-1.5">
              <span>SpO₂: 93 %</span>
              <span className="text-[10px] bg-red-100 px-1 py-0.2 rounded font-normal">
                {93 <= localThresholds.spo2Low ? '酸素低下警告 (赤字)' : '正常範囲'}
              </span>
            </div>
            <div className="bg-white border border-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <span>体温: 36.5 ℃ (正常)</span>
            </div>
            <div className="bg-white border border-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <span>血圧: 124 / 78 (正常)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 操作ボタンエリア */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 sticky top-20 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <UserCheck size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-lg">利用者名簿管理</h2>
            <p className="text-xs text-slate-500">現在の表示数: {localResidents.length} 名</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          {!isReadOnly ? (
            <>
              <button 
                type="button" 
                onClick={handleAdd}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold transition-all cursor-pointer"
              >
                <Plus size={18} /> 新規追加
              </button>
              <button 
                type="button" 
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm ${
                  isSaving 
                    ? 'bg-blue-400 text-white cursor-wait'
                    : isDirty 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-95' 
                      : saveSuccess
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>保存完了</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>設定を保存</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold border border-slate-200">
              <Lock size={15} />
              <span>閲覧専用モード（編集・保存不可）</span>
            </div>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl flex items-center gap-2.5 text-sm font-semibold shadow-sm">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>施設名称「{localFacilityName.trim() || facilityName}」、バイタル警告閾値、名簿設定をデータベースに保存しました。</span>
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl flex items-center gap-2.5 text-sm font-semibold shadow-sm">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {isDirty && !saveSuccess && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
            <AlertCircle size={16} />
            <span>施設名称、警告閾値、または名簿の変更があります。『設定を保存』を押して反映してください。</span>
          </div>
          <button onClick={handleReset} className="text-xs text-amber-700 hover:underline cursor-pointer">
            キャンセルして元に戻す
          </button>
        </div>
      )}

      {/* 名簿テーブル */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">順序</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">居室</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">氏名</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">削除</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {localResidents.map((res, index) => (
              <tr key={res.id} className="hover:bg-slate-50">
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-0.5">
                    <button 
                      type="button" 
                      onClick={() => handleMove(index, 'up')} 
                      disabled={isReadOnly || index === 0} 
                      className={`p-1 rounded ${isReadOnly || index === 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-200 cursor-pointer'}`}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleMove(index, 'down')} 
                      disabled={isReadOnly || index === localResidents.length - 1} 
                      className={`p-1 rounded ${isReadOnly || index === localResidents.length - 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-200 cursor-pointer'}`}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input 
                    type="text" 
                    value={res.roomNumber}
                    disabled={isReadOnly}
                    onChange={(e) => !isReadOnly && handleUpdate(res.id, 'roomNumber', e.target.value)}
                    className={`w-20 border border-slate-200 rounded px-2 py-1.5 text-sm ${
                      isReadOnly ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''
                    }`}
                    placeholder="101"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <input 
                    type="text" 
                    value={res.name}
                    disabled={isReadOnly}
                    onChange={(e) => !isReadOnly && handleUpdate(res.id, 'name', e.target.value)}
                    className={`w-full max-w-sm border border-slate-200 rounded px-3 py-1.5 text-sm ${
                      isReadOnly ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''
                    }`}
                    placeholder="利用者名"
                  />
                </td>
                <td className="px-6 py-3 whitespace-nowrap text-center">
                  {!isReadOnly ? (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemove(res.id);
                      }}
                      className="p-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                      title="削除"
                    >
                      <Trash2 size={20} />
                    </button>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {localResidents.length === 0 && (
          <div className="py-20 text-center text-slate-400">
             <UserMinus size={48} className="mx-auto mb-4 opacity-20" />
             <p>利用者が登録されていません</p>
             {!isReadOnly && (
               <button type="button" onClick={handleAdd} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">新規追加する</button>
             )}
          </div>
        )}
      </div>

      {!isReadOnly && (
        <div className="pt-4 flex justify-start">
          <button 
            type="button" 
            onClick={handleDefaultSample}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={14} /> サンプルデータ（29名）を読み込む
          </button>
        </div>
      )}

      {/* Firebase Hosting 本番デプロイ情報＆ガイドカード */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-xl border border-slate-700 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/20 text-amber-400 p-2.5 rounded-lg border border-amber-500/30">
              <Cloud size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Firebase Hosting 本番運用設定
                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                  設定済 (firebase.json)
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                SPAリライト・HTTPセキュリティヘッダー・Firestoreルール連携が構成されています。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDeployGuide(!showDeployGuide)}
            className="self-start sm:self-auto text-xs font-bold px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg border border-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Terminal size={14} className="text-amber-400" />
            {showDeployGuide ? 'ガイドを閉じる' : 'デプロイ手順書を見る'}
          </button>
        </div>

        {/* クイック情報バー */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-700/60 text-xs">
          <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
            <span className="text-slate-400 font-medium">デプロイ先プロジェクトID:</span>
            <span className="font-mono text-amber-300 font-bold">cs-project-7wfoj3ka</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
            <span className="text-slate-400 font-medium">本番Hosting URL:</span>
            <a 
              href="https://cs-project-7wfoj3ka.web.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-mono font-bold flex items-center gap-1 underline underline-offset-2"
            >
              cs-project-7wfoj3ka.web.app
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* クイックコマンド一覧 */}
        <div className="space-y-2 pt-1">
          <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Terminal size={14} className="text-blue-400" />
            ワンクリック・デプロイコマンド（ターミナルで実行）:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              { label: '一括本番デプロイ (ビルド + Hosting + Rules)', cmd: 'npm run deploy' },
              { label: 'Web画面のみ更新 (Hosting)', cmd: 'npm run deploy:hosting' },
              { label: 'セキュリティルールのみ更新 (Firestore)', cmd: 'npm run deploy:rules' }
            ].map(({ label, cmd }) => (
              <div key={cmd} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between gap-1.5">
                <span className="text-[11px] text-slate-400 leading-tight">{label}</span>
                <div className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded border border-slate-800 font-mono text-xs text-emerald-400">
                  <span className="truncate">{cmd}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyCommand(cmd)}
                    className="p-1 hover:text-white transition-colors cursor-pointer text-slate-400 ml-1.5 shrink-0"
                    title="コマンドをコピー"
                  >
                    {copiedCmd === cmd ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 詳細デプロイガイド (アコーディオン) */}
        {showDeployGuide && (
          <div className="mt-4 pt-4 border-t border-slate-700 space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              本番公開までの完全手順（詳細は DEPLOYMENT_GUIDE.md にも記載）
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed">
              <li>
                <strong className="text-white">Firebase CLIのインストール（初回のみ）:</strong>
                <div className="mt-1 font-mono bg-slate-900 px-2.5 py-1 rounded text-emerald-300 border border-slate-800 inline-block">
                  npm install -g firebase-tools
                </div>
              </li>
              <li>
                <strong className="text-white">Googleアカウントでログイン:</strong>
                <div className="mt-1 font-mono bg-slate-900 px-2.5 py-1 rounded text-emerald-300 border border-slate-800 inline-block">
                  firebase login
                </div>
              </li>
              <li>
                <strong className="text-white">一括ビルド＆デプロイを実行:</strong>
                <div className="mt-1 font-mono bg-slate-900 px-2.5 py-1 rounded text-emerald-300 border border-slate-800 inline-block">
                  npm run deploy
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ※ TypeScriptの型チェックとViteによる静的ファイル生成（dist/）後、Firebase Hostingおよびfirestore.rulesへ即時反映されます。
                </p>
              </li>
              <li>
                <strong className="text-white">公開URLの確認:</strong>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ターミナルに表示される <code className="text-amber-300 font-mono">https://cs-project-7wfoj3ka.web.app</code> へアクセスし、ログインや施設切り替え、バイタル入力をお試しください。
                </p>
              </li>
            </ol>
            <div className="pt-2 text-slate-400 text-[11px] flex items-center justify-between">
              <span>※ プロジェクトルートにある <code className="text-white font-mono">DEPLOYMENT_GUIDE.md</code> に詳細な運用・ドメイン設定ガイドがあります。</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResidentMaster;
