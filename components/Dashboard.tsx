
import React, { useMemo } from 'react';
import { VitalRecord, Resident, VitalThresholds } from '../types';
import { DEFAULT_THRESHOLDS } from '../constants';
import { getTodayJstString } from '../lib/dateUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, AlertTriangle, CheckCircle2, Thermometer, Download } from 'lucide-react';
import { exportVitalRecordsToCSV } from '../lib/csvExport';

interface DashboardProps {
  records: VitalRecord[];
  residents: Resident[];
  facilityName?: string;
  thresholds?: VitalThresholds;
}

const Dashboard: React.FC<DashboardProps> = ({ records, residents, facilityName, thresholds }) => {
  const effectiveThresholds = useMemo(() => thresholds || DEFAULT_THRESHOLDS, [thresholds]);

  const stats = useMemo(() => {
    const todayStr = getTodayJstString();
    const latestRecords = records.filter(r => r.date === todayStr);
    
    const highTemp = latestRecords.filter(r => {
      const t = parseFloat(r.temperature);
      return !isNaN(t) && t >= effectiveThresholds.tempHigh;
    }).length;

    const highBP = latestRecords.filter(r => {
      const sys = parseFloat(r.systolic);
      const dia = parseFloat(r.diastolic);
      return (!isNaN(sys) && sys >= effectiveThresholds.bpSysHigh) ||
             (!isNaN(dia) && dia >= effectiveThresholds.bpDiaHigh);
    }).length;

    const lowSpO2 = latestRecords.filter(r => {
      const s = parseFloat(r.spo2);
      return !isNaN(s) && effectiveThresholds.spo2Low !== undefined && s <= effectiveThresholds.spo2Low && r.spo2 !== '';
    }).length;

    return {
      todayCount: latestRecords.length,
      highTemp,
      highBP,
      lowSpO2
    };
  }, [records, effectiveThresholds]);

  // 本日の異常値該当者リスト
  const abnormalAlertList = useMemo(() => {
    const todayStr = getTodayJstString();
    const todayRecords = records.filter(r => r.date === todayStr && !r.isAbsent);

    const alerts: Array<{
      resident: Resident;
      record: VitalRecord;
      issues: string[];
    }> = [];

    todayRecords.forEach(rec => {
      const res = residents.find(r => r.id === rec.residentId);
      if (!res) return;
      const issues: string[] = [];

      const t = parseFloat(rec.temperature);
      if (!isNaN(t) && t >= effectiveThresholds.tempHigh) {
        issues.push(`発熱 ${rec.temperature}℃ (基準 ≥${effectiveThresholds.tempHigh}℃)`);
      }

      const sys = parseFloat(rec.systolic);
      const dia = parseFloat(rec.diastolic);
      if (!isNaN(sys) && sys >= effectiveThresholds.bpSysHigh) {
        issues.push(`高血圧(上) ${rec.systolic} mmHg (基準 ≥${effectiveThresholds.bpSysHigh})`);
      }
      if (!isNaN(sys) && effectiveThresholds.bpSysLow !== undefined && sys <= effectiveThresholds.bpSysLow && rec.systolic !== '') {
        issues.push(`低血圧(上) ${rec.systolic} mmHg (基準 ≤${effectiveThresholds.bpSysLow})`);
      }
      if (!isNaN(dia) && dia >= effectiveThresholds.bpDiaHigh) {
        issues.push(`高血圧(下) ${rec.diastolic} mmHg (基準 ≥${effectiveThresholds.bpDiaHigh})`);
      }
      if (!isNaN(dia) && effectiveThresholds.bpDiaLow !== undefined && dia <= effectiveThresholds.bpDiaLow && rec.diastolic !== '') {
        issues.push(`低血圧(下) ${rec.diastolic} mmHg (基準 ≤${effectiveThresholds.bpDiaLow})`);
      }

      const p = parseInt(rec.pulse);
      if (!isNaN(p) && effectiveThresholds.pulseHigh !== undefined && p >= effectiveThresholds.pulseHigh) {
        issues.push(`頻脈 ${rec.pulse} bpm (基準 ≥${effectiveThresholds.pulseHigh})`);
      }
      if (!isNaN(p) && effectiveThresholds.pulseLow !== undefined && p <= effectiveThresholds.pulseLow) {
        issues.push(`徐脈 ${rec.pulse} bpm (基準 ≤${effectiveThresholds.pulseLow})`);
      }

      const s = parseFloat(rec.spo2);
      if (!isNaN(s) && effectiveThresholds.spo2Low !== undefined && s <= effectiveThresholds.spo2Low && rec.spo2 !== '') {
        issues.push(`SpO₂低下 ${rec.spo2}% (基準 ≤${effectiveThresholds.spo2Low}%)`);
      }

      if (issues.length > 0) {
        alerts.push({ resident: res, record: rec, issues });
      }
    });

    return alerts;
  }, [records, residents, effectiveThresholds]);

  // Chart data: Temperature distribution for today
  const chartData = useMemo(() => {
    const bins = [
      { name: '35.0-', count: 0 },
      { name: '36.0-', count: 0 },
      { name: '36.5-', count: 0 },
      { name: '37.0-', count: 0 },
      { name: '37.5+', count: 0 },
    ];

    records.filter(r => r.date === getTodayJstString()).forEach(r => {
      const t = parseFloat(r.temperature);
      if (t >= 37.5) bins[4].count++;
      else if (t >= 37.0) bins[3].count++;
      else if (t >= 36.5) bins[2].count++;
      else if (t >= 36.0) bins[1].count++;
      else bins[0].count++;
    });

    return bins;
  }, [records]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white px-5 py-4 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">全体サマリーダッシュボード</h2>
          <p className="text-xs text-slate-500">
            {facilityName ? <span className="font-semibold text-blue-700">{facilityName}</span> : '施設'} の本日のバイタル概況
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => exportVitalRecordsToCSV(records, residents, facilityName)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-sm transition-all active:scale-[0.98]"
            title="現在の全バイタル記録をCSV形式でダウンロード"
          >
            <Download size={14} className="text-blue-600" />
            <span>全データCSV出力</span>
          </button>
          <div className="text-xs text-slate-400 font-mono bg-slate-50 px-2.5 py-1 rounded border">
            本日: {getTodayJstString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">本日の入力済</p>
            <p className="text-2xl font-bold">{stats.todayCount} <span className="text-sm font-normal text-slate-400">/ {residents.length} 名</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="bg-red-100 p-3 rounded-lg text-red-600">
            <Thermometer size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">発熱 ({effectiveThresholds.tempHigh.toFixed(1)}℃↑)</p>
            <p className="text-2xl font-bold text-red-600">{stats.highTemp} <span className="text-sm font-normal text-slate-400">名</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">高血圧 ({effectiveThresholds.bpSysHigh}/{effectiveThresholds.bpDiaHigh}↑)</p>
            <p className="text-2xl font-bold text-orange-600">{stats.highBP} <span className="text-sm font-normal text-slate-400">名</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-lg text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">要注意 (SpO₂ {effectiveThresholds.spo2Low}↓)</p>
            <p className="text-2xl font-bold text-slate-800">{stats.lowSpO2} <span className="text-sm font-normal text-slate-400">名</span></p>
          </div>
        </div>
      </div>

      {/* 本日の異常値・要注意アラート一覧 */}
      {abnormalAlertList.length > 0 ? (
        <div className="bg-white rounded-xl border-2 border-red-200 shadow-sm overflow-hidden">
          <div className="bg-red-50/80 px-5 py-3.5 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-600" />
                本日のバイタル異常値・アラート対象者 ({abnormalAlertList.length} 名)
              </h3>
            </div>
            <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              マスタ基準超過
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {abnormalAlertList.map(({ resident, record, issues }) => (
              <div key={resident.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    #{resident.roomNumber}
                  </span>
                  <div>
                    <span className="font-bold text-slate-900 text-base">{resident.name} 様</span>
                    {record.note && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">特記事項: {record.note}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {issues.map((issue, idx) => (
                    <span key={idx} className="text-xs font-black text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                      {issue}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : stats.todayCount > 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-800 text-xs sm:text-sm font-semibold">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <span>本日入力済みのバイタル記録（{stats.todayCount}名）において、設定マスタの異常値閾値を超過した項目はありません。全員が設定基準値内です。</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-slate-800">本日の体温分布</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 4 ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-lg font-bold mb-4 text-slate-800">システムの活用方法</h3>
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-600 shrink-0">1</div>
              <div>
                <p className="font-semibold text-sm">一括入力</p>
                <p className="text-xs text-slate-500">朝の忙しい時間でも、登録された利用者の数値をリスト形式で素早く入力できます。テンキー入力とタブキーを活用すると便利です。</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-600 shrink-0">2</div>
              <div>
                <p className="font-semibold text-sm">自動仕分け</p>
                <p className="text-xs text-slate-500">入力内容は自動保存され、個人別の履歴として蓄積されます。マスタで名前や順序を変更しても、履歴データと連動します。</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-600 shrink-0">3</div>
              <div>
                <p className="font-semibold text-sm">レポート作成</p>
                <p className="text-xs text-slate-500">受診時やご家族への報告用に、個人別履歴画面からいつでも綺麗なフォーマットで印刷またはPDF出力が可能です。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
