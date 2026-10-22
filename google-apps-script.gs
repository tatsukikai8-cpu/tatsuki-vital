
/**
 * バイタル管理システム Backend for Google Sheets
 * 
 * 設定手順:
 * 1. Googleスプレッドシートを作成し、以下のシート名を用意します。
 *    - 「Database」: カラム A:日付, B:利用者名, C:体温, D:最高血圧, E:最低血圧, F:脈拍, G:SpO₂, H:食事朝主, I:食事朝副, J:食事昼主, K:食事昼副, L:食事晩主, M:食事晩副, N:排便, O:備考, P:利用無し
 */

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dbSheet = ss.getSheetByName('Database');
  const data = dbSheet.getDataRange().getValues();
  
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });

  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dbSheet = ss.getSheetByName('Database');
    
    const rowsToAdd = params.map(record => [
      record.date,
      record.residentName,
      record.temperature,
      record.systolic,
      record.diastolic,
      record.pulse,
      record.spo2,
      record.mealMorning.main,
      record.mealMorning.side,
      record.mealNoon.main,
      record.mealNoon.side,
      record.mealNight.main,
      record.mealNight.side,
      record.bowelCount,
      record.note,
      record.isAbsent ? 'TRUE' : 'FALSE' // 列P: 利用無しフラグ
    ]);
    
    dbSheet.getRange(dbSheet.getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', count: rowsToAdd.length }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
