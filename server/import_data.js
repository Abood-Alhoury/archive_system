import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const csvFilePath = path.resolve(__dirname, 'archive.csv');

// أولاً: إنشاء الجدول إذا لم يكن موجوداً
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      archive_number TEXT,
      applicant_name TEXT,
      university TEXT,
      equivalence_decision_number TEXT,
      equivalence_decision_date TEXT,
      eligibility_decision_number TEXT,
      eligibility_decision_date TEXT,
      pdf_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error("❌ خطأ في إنشاء الجدول:", err.message);
      return;
    }
    console.log("✅ الجدول جاهز (أو تم إنشاؤه).");

    // ثانياً: قراءة ملف CSV والبدء بالاستيراد
    fs.readFile(csvFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error("❌ لم يتم العثور على ملف archive.csv في مجلد server");
        return;
      }

      const cleanData = data.replace(/^\uFEFF/, '');
      const lines = cleanData.split(/\r?\n/);
      const delimiter = lines[0].includes(';') ? ';' : ',';

      let successCount = 0;
      db.run('BEGIN TRANSACTION');

      const stmt = db.prepare(`
        INSERT INTO transactions (
          archive_number, applicant_name, equivalence_decision_number, 
          equivalence_decision_date, university
        ) VALUES (?, ?, ?, ?, ?)
      `);

      lines.slice(1).forEach((line) => {
        if (line.trim() === '') return;
        const columns = line.split(delimiter);
        if (columns.length >= 2) {
          stmt.run([
            (columns[0] || '').trim(),
            (columns[1] || '').trim(),
            (columns[2] || '').trim(),
            (columns[3] || '').trim(),
            (columns[4] || '').trim()
          ]);
          successCount++;
        }
      });

      stmt.finalize();
      db.run('COMMIT', () => {
        console.log(`✅ انتهت العملية! تم استيراد ${successCount} سجل بنجاح.`);
        db.close();
      });
    });
  });
});