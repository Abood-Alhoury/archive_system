import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) console.error('خطأ في الاتصال بقاعدة البيانات:', err);
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_name TEXT,
    archive_number TEXT,
    university TEXT,
    equivalence_decision_number TEXT,
    equivalence_decision_date TEXT,
    eligibility_decision_number TEXT,
    eligibility_decision_date TEXT,
    pdf_path TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS council_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_number TEXT,
    decision_year TEXT,
    session_number TEXT,
    description TEXT,
    pdf_path TEXT
  )`);

  // 🔴 إضافة أعمدة التصنيف برمجياً بدون حذف البيانات السابقة 🔴
  db.run(`ALTER TABLE council_decisions ADD COLUMN main_category TEXT`, (err) => { /* يتجاهل الخطأ إذا كان العمود موجوداً */ });
  db.run(`ALTER TABLE council_decisions ADD COLUMN sub_category TEXT`, (err) => { /* يتجاهل الخطأ إذا كان العمود موجوداً */ });
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err); else resolve(this);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err); else resolve(row);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err); else resolve(rows);
  });
});


// ==============================================================
// --- القسم الأول: وظائف المعادلات (محمي وممنوع التعديل عليه) ---
// ==============================================================
export const getStats = async () => {
  const total = await get('SELECT COUNT(*) as c FROM transactions');
  const withPdf = await get("SELECT COUNT(*) as c FROM transactions WHERE pdf_path IS NOT NULL AND pdf_path != ''");
  const withoutPdf = await get("SELECT COUNT(*) as c FROM transactions WHERE pdf_path IS NULL OR pdf_path = ''");
  return { total: total.c, withPdf: withPdf.c, withoutPdf: withoutPdf.c };
};

export const searchTransactions = async (filters, limit, offset) => {
  let query = "SELECT * FROM transactions WHERE 1=1";
  let params = [];
  if (filters.name) { query += " AND applicant_name LIKE ?"; params.push('%' + filters.name + '%'); }
  if (filters.archive_number) { query += " AND archive_number LIKE ?"; params.push('%' + filters.archive_number + '%'); }
  if (filters.university) { query += " AND university LIKE ?"; params.push('%' + filters.university + '%'); }
  
  let countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  query += " ORDER BY id DESC LIMIT ? OFFSET ?"; params.push(limit, offset);
  
  const data = await all(query, params);
  const countRes = await get(countQuery, params.slice(0, -2));
  return { data, total: countRes.total };
};

export const getTransactionById = (id) => get('SELECT * FROM transactions WHERE id = ?', [id]);

export const createTransaction = async (data) => {
  const sql = `INSERT INTO transactions 
    (applicant_name, archive_number, university, equivalence_decision_number, equivalence_decision_date, eligibility_decision_number, eligibility_decision_date, pdf_path) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    data.applicant_name, data.archive_number, data.university,
    data.equivalence_decision_number, data.equivalence_decision_date,
    data.eligibility_decision_number, data.eligibility_decision_date, data.pdf_path
  ];
  const res = await run(sql, params);
  return res.lastID;
};

export const updateTransaction = async (id, data) => {
  const sql = `UPDATE transactions SET 
    applicant_name = ?, archive_number = ?, university = ?, 
    equivalence_decision_number = ?, equivalence_decision_date = ?, 
    eligibility_decision_number = ?, eligibility_decision_date = ? 
    WHERE id = ?`;
  const params = [
    data.applicant_name, data.archive_number, data.university,
    data.equivalence_decision_number, data.equivalence_decision_date,
    data.eligibility_decision_number, data.eligibility_decision_date, id
  ];
  const res = await run(sql, params);
  return res.changes;
};

export const updateTransactionPdf = async (id, pdfPath) => {
  await run('UPDATE transactions SET pdf_path = ? WHERE id = ?', [pdfPath, id]);
};

export const deleteTransaction = async (id) => {
  await run('DELETE FROM transactions WHERE id = ?', [id]);
};


// ==============================================================
// --- القسم الثاني: وظائف قرارات مجلس التعليم العالي ---
// ==============================================================
export const checkDecisionExists = async (decision_number, decision_year, excludeId = null) => {
  let sql = 'SELECT id FROM council_decisions WHERE decision_number = ? AND decision_year = ?';
  let params = [decision_number, decision_year];
  
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  
  const row = await get(sql, params);
  return row !== undefined; 
};

export const getDecisionsStats = async () => {
  const total = await get('SELECT COUNT(*) as c FROM council_decisions');
  const withPdf = await get("SELECT COUNT(*) as c FROM council_decisions WHERE pdf_path IS NOT NULL AND pdf_path != ''");
  const withoutPdf = await get("SELECT COUNT(*) as c FROM council_decisions WHERE pdf_path IS NULL OR pdf_path = ''");
  return { total: total.c, withPdf: withPdf.c, withoutPdf: withoutPdf.c };
};

export const searchDecisions = async (filters, limit, offset) => {
  let query = "SELECT * FROM council_decisions WHERE 1=1";
  let params = [];
  
  if (filters.decision_number) { query += " AND decision_number LIKE ?"; params.push('%' + filters.decision_number + '%'); }
  if (filters.decision_year) { query += " AND decision_year = ?"; params.push(filters.decision_year); }
  if (filters.session_number) { query += " AND session_number LIKE ?"; params.push('%' + filters.session_number + '%'); }
  if (filters.description) { query += " AND description LIKE ?"; params.push('%' + filters.description + '%'); }
  // 🔴 دعم الفلترة حسب التصنيف الجديد 🔴
  if (filters.main_category) { query += " AND main_category = ?"; params.push(filters.main_category); }
  if (filters.sub_category) { query += " AND sub_category = ?"; params.push(filters.sub_category); }
  
  let countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  query += " ORDER BY id DESC LIMIT ? OFFSET ?"; params.push(limit, offset);
  
  const data = await all(query, params);
  const countRes = await get(countQuery, params.slice(0, -2));
  return { data, total: countRes.total };
};

export const getDecisionById = (id) => get('SELECT * FROM council_decisions WHERE id = ?', [id]);

// 🔴 إضافة التصنيفات إلى دوال الإدخال والتعديل 🔴
export const createDecision = async (data) => {
  const sql = `INSERT INTO council_decisions (decision_number, decision_year, session_number, description, pdf_path, main_category, sub_category) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [data.decision_number, data.decision_year, data.session_number, data.description, data.pdf_path, data.main_category, data.sub_category];
  const res = await run(sql, params);
  return res.lastID;
};

export const updateDecision = async (id, data) => {
  const sql = `UPDATE council_decisions SET decision_number = ?, decision_year = ?, session_number = ?, description = ?, main_category = ?, sub_category = ? WHERE id = ?`;
  const params = [data.decision_number, data.decision_year, data.session_number, data.description, data.main_category, data.sub_category, id];
  const res = await run(sql, params);
  return res.changes;
};

export const updateDecisionPdf = async (id, pdfPath) => {
  await run('UPDATE council_decisions SET pdf_path = ? WHERE id = ?', [pdfPath, id]);
};

export const deleteDecision = async (id) => {
  await run('DELETE FROM council_decisions WHERE id = ?', [id]);
};