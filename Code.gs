/**
 * Backend Google Apps Script untuk "Catatan Keuangan Aditya".
 *
 * CARA PAKAI:
 * 1. Buat Google Spreadsheet baru.
 * 2. Buka menu Extensions > Apps Script.
 * 3. Hapus isi default, lalu tempel seluruh isi file ini.
 * 4. Klik Deploy > New deployment > pilih tipe "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Klik Deploy, salin URL Web App yang muncul.
 * 6. Tempel URL itu ke variabel APPS_SCRIPT_URL di file app.js.
 *
 * Sheet bernama "Catatan" akan dibuat otomatis saat pertama kali dipakai.
 */

const SHEET_NAME = 'Catatan';

function doGet(e) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  const entries = rows
    .filter((r) => r[0])
    .map((r) => ({
      id: String(r[0]),
      date: formatDate(r[1]),
      type: r[2],
      category: r[3],
      amount: r[4],
      note: r[5] || '',
    }));
  return jsonResponse({ ok: true, entries });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const sheet = getSheet();

  if (body.action === 'add') {
    const entry = body.entry;
    sheet.appendRow([entry.id, entry.date, entry.type, entry.category, entry.amount, entry.note || '']);
    return jsonResponse({ ok: true });
  }

  if (body.action === 'delete') {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(body.id)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, error: 'Aksi tidak dikenali' });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Keterangan']);
  }
  return sheet;
}

function formatDate(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
