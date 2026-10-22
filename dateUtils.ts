/**
 * 日本時間（Asia/Tokyo）の Date オブジェクトを取得します。
 */
export const getJstDate = (): Date => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
};

/**
 * 常に日本時間（Asia/Tokyo）の YYYY-MM-DD 形式で日付文字列を取得します。
 */
export const getTodayJstString = (): string => {
  const d = getJstDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dav = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dav}`;
};

/**
 * 日本時間の曜日インデックスを取得します
 */
export const getJstDayIndex = (dateStr: string): number => {
  const d = new Date(dateStr);
  // dateStr が "YYYY-MM-DD" の場合、その土地のローカル時刻として解釈されることが多いが、
  // 明示的に日本時間として扱う
  const jstDateStr = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return jstDateStr.getDay();
};
