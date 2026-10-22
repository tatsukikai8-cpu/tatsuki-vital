import { VitalRecord, Resident } from '../types';
import { getTodayJstString } from './dateUtils';

/**
 * CSV値のエスケープ処理
 * カンマ、ダブルクォート、改行を含む場合はダブルクォートで囲み、内部のダブルクォートを二重化
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 全バイタル記録をCSV形式に変換し、ブラウザのBlob APIを用いてダウンロードする
 *
 * @param records バイタル記録の配列
 * @param residents 利用者マスタ情報（居室番号などの補完用）
 * @param facilityName 施設名（ファイル名・出力用）
 */
export function exportVitalRecordsToCSV(
  records: VitalRecord[],
  residents: Resident[] = [],
  facilityName: string = 'VitalSign'
): { success: boolean; count: number; filename: string } {
  const residentMap = new Map<string, Resident>();
  residents.forEach(r => residentMap.set(r.id, r));

  // 日付降順、同日の場合は部屋番号順にソート
  const sortedRecords = [...records].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    const resA = residentMap.get(a.residentId);
    const resB = residentMap.get(b.residentId);
    const roomA = resA?.roomNumber || '';
    const roomB = resB?.roomNumber || '';
    return roomA.localeCompare(roomB, undefined, { numeric: true });
  });

  // ヘッダー定義
  const headers = [
    '日付',
    '居室番号',
    '利用者ID',
    '利用者氏名',
    '利用状態',
    '体温(℃)',
    '血圧 上(mmHg)',
    '血圧 下(mmHg)',
    '脈拍(bpm)',
    'SpO2(%)',
    '朝食 主食(/10)',
    '朝食 副食(/10)',
    '昼食 主食(/10)',
    '昼食 副食(/10)',
    '夕食 主食(/10)',
    '夕食 副食(/10)',
    '排便回数',
    '特記事項・メモ'
  ];

  const rows: string[][] = [headers];

  for (const record of sortedRecords) {
    const resident = residentMap.get(record.residentId);
    const roomNumber = resident?.roomNumber || '';
    const residentName = record.residentName || resident?.name || '';
    const status = record.isAbsent ? '利用なし(不在)' : '利用中(通常)';

    rows.push([
      record.date || '',
      roomNumber,
      record.residentId || '',
      residentName,
      status,
      record.temperature ?? '',
      record.systolic ?? '',
      record.diastolic ?? '',
      record.pulse ?? '',
      record.spo2 ?? '',
      record.mealMorning?.main !== undefined ? String(record.mealMorning.main) : '',
      record.mealMorning?.side !== undefined ? String(record.mealMorning.side) : '',
      record.mealNoon?.main !== undefined ? String(record.mealNoon.main) : '',
      record.mealNoon?.side !== undefined ? String(record.mealNoon.side) : '',
      record.mealNight?.main !== undefined ? String(record.mealNight.main) : '',
      record.mealNight?.side !== undefined ? String(record.mealNight.side) : '',
      record.bowelCount ?? '',
      record.note ?? ''
    ]);
  }

  // CSVテキスト生成（CRLF区切り）
  const csvContent = rows
    .map(row => row.map(escapeCsvValue).join(','))
    .join('\r\n');

  // Excel等で日本語文字化けを防ぐためUTF-8 BOMを付加
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

  // ファイル名作成: バイタル記録_[施設名]_[日付].csv
  const cleanFacility = facilityName.replace(/[\\/:*?"<>|]/g, '_').trim() || 'バイタル';
  const today = getTodayJstString();
  const filename = `${cleanFacility}_バイタル記録_${today}.csv`;

  // ダウンロードリンクを生成してクリック
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // URLオブジェクトの解放
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  return {
    success: true,
    count: sortedRecords.length,
    filename
  };
}
