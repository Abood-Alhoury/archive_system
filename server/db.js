import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) console.error('خطأ في الاتصال بقاعدة البيانات:', err);
});

db.serialize(() => {
  // 1. جدول المعادلات (محمي 100%)
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

  // 2. جدول القرارات (مع إضافة حقل الحذف الناعم)
  db.run(`CREATE TABLE IF NOT EXISTS council_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decision_number TEXT,
    decision_year TEXT,
    session_number TEXT,
    description TEXT,
    pdf_path TEXT,
    main_category TEXT,
    sub_category TEXT,
    is_deleted INTEGER DEFAULT 0
  )`);
  
  // تحديث الجدول القديم إن كان موجوداً مسبقاً لإضافة الحقل الجديد دون أخطاء
  db.run(`ALTER TABLE council_decisions ADD COLUMN is_deleted INTEGER DEFAULT 0`, (err) => { /* سيتم تجاهل الخطأ إن كان العمود موجوداً مسبقاً */ });

  // 3. جدول التصنيفات الديناميكية
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    parent_id INTEGER,
    UNIQUE(name, parent_id)
  )`, () => {
    db.run(`INSERT OR IGNORE INTO categories (id, name, parent_id) VALUES 
      (1, 'أمور عامة', NULL), (2, 'طلاب', NULL), (3, 'البحث العلمي', NULL), (4, 'جامعات خاصة', NULL),
      (5, 'أمور طلابية عامة', 2), (6, 'أمور خاصة بالطلاب', 2), (7, 'طلاب دراسات عليا', 3), 
      (8, 'معيدين وموفدين', 3), (9, 'أعضاء هيئة تدريسية', 3), (10, 'عامة', 4), (11, 'طلاب', 4)`);
  });
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) { if (err) reject(err); else resolve(this); });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});

// ==============================================================
// --- القسم الأول: وظائف المعادلات (ممنوع التعديل عليه نهائياً) ---
// ==============================================================
export const getStats = async () => {
  const total = await get('SELECT COUNT(*) as c FROM transactions');
  const withPdf = await get("SELECT COUNT(*) as c FROM transactions WHERE pdf_path IS NOT NULL AND pdf_path != ''");
  const withoutPdf = await get("SELECT COUNT(*) as c FROM transactions WHERE pdf_path IS NULL OR pdf_path = ''");
  return { total: total.c, withPdf: withPdf.c, withoutPdf: withoutPdf.c };
};
export const searchTransactions = async (filters, limit, offset) => {
  let query = "SELECT * FROM transactions WHERE 1=1"; let params = [];
  if (filters.name) { query += " AND applicant_name LIKE ?"; params.push('%' + filters.name + '%'); }
  if (filters.archive_number) { query += " AND archive_number LIKE ?"; params.push('%' + filters.archive_number + '%'); }
  if (filters.university) { query += " AND university LIKE ?"; params.push('%' + filters.university + '%'); }
  let countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  query += " ORDER BY id DESC LIMIT ? OFFSET ?"; params.push(limit, offset);
  const data = await all(query, params); const countRes = await get(countQuery, params.slice(0, -2));
  return { data, total: countRes.total };
};
export const getTransactionById = (id) => get('SELECT * FROM transactions WHERE id = ?', [id]);
export const createTransaction = async (data) => {
  const sql = `INSERT INTO transactions (applicant_name, archive_number, university, equivalence_decision_number, equivalence_decision_date, eligibility_decision_number, eligibility_decision_date, pdf_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [data.applicant_name, data.archive_number, data.university, data.equivalence_decision_number, data.equivalence_decision_date, data.eligibility_decision_number, data.eligibility_decision_date, data.pdf_path];
  const res = await run(sql, params); return res.lastID;
};
export const updateTransaction = async (id, data) => {
  const sql = `UPDATE transactions SET applicant_name = ?, archive_number = ?, university = ?, equivalence_decision_number = ?, equivalence_decision_date = ?, eligibility_decision_number = ?, eligibility_decision_date = ? WHERE id = ?`;
  const params = [data.applicant_name, data.archive_number, data.university, data.equivalence_decision_number, data.equivalence_decision_date, data.eligibility_decision_number, data.eligibility_decision_date, id];
  const res = await run(sql, params); return res.changes;
};
export const updateTransactionPdf = async (id, pdfPath) => { await run('UPDATE transactions SET pdf_path = ? WHERE id = ?', [pdfPath, id]); };
export const deleteTransaction = async (id) => { await run('DELETE FROM transactions WHERE id = ?', [id]); };


// ==============================================================
// --- القسم الثاني: وظائف قرارات مجلس التعليم العالي (مع الحذف الناعم) ---
// ==============================================================
export const checkDecisionExists = async (decision_number, decision_year, excludeId = null) => {
  // 🔴 يتجاهل القرارات المحذوفة لكي يسمح لك بإدخال نفس الرقم إذا كنت قد حذفت القديم 🔴
  let sql = 'SELECT id FROM council_decisions WHERE decision_number = ? AND decision_year = ? AND (is_deleted = 0 OR is_deleted IS NULL)';
  let params = [decision_number, decision_year];
  if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
  const row = await get(sql, params); return row !== undefined; 
};

export const getDecisionsStats = async () => {
  // 🔴 الإحصائيات تتجاهل المحذوفات 🔴
  const total = await get('SELECT COUNT(*) as c FROM council_decisions WHERE is_deleted = 0 OR is_deleted IS NULL');
  const withPdf = await get("SELECT COUNT(*) as c FROM council_decisions WHERE (is_deleted = 0 OR is_deleted IS NULL) AND pdf_path IS NOT NULL AND pdf_path != ''");
  const withoutPdf = await get("SELECT COUNT(*) as c FROM council_decisions WHERE (is_deleted = 0 OR is_deleted IS NULL) AND (pdf_path IS NULL OR pdf_path = '')");
  return { total: total.c, withPdf: withPdf.c, withoutPdf: withoutPdf.c };
};

export const searchDecisions = async (filters, limit, offset) => {
  // 🔴 لا تعرض سوى القرارات غير المحذوفة 🔴
  let query = "SELECT * FROM council_decisions WHERE (is_deleted = 0 OR is_deleted IS NULL)";
  let params = [];
  if (filters.decision_number) { query += " AND decision_number LIKE ?"; params.push('%' + filters.decision_number + '%'); }
  if (filters.decision_year) { query += " AND decision_year = ?"; params.push(filters.decision_year); }
  if (filters.session_number) { query += " AND session_number LIKE ?"; params.push('%' + filters.session_number + '%'); }
  if (filters.description) { query += " AND description LIKE ?"; params.push('%' + filters.description + '%'); }
  if (filters.main_category) { query += " AND main_category = ?"; params.push(filters.main_category); }
  if (filters.sub_category) { query += " AND sub_category = ?"; params.push(filters.sub_category); }
  
  let countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  query += " ORDER BY id DESC LIMIT ? OFFSET ?"; params.push(limit, offset);
  
  const data = await all(query, params);
  const countRes = await get(countQuery, params.slice(0, -2));
  return { data, total: countRes.total };
};

export const getDecisionById = (id) => get('SELECT * FROM council_decisions WHERE id = ?', [id]);

export const createDecision = async (data) => {
  const sql = `INSERT INTO council_decisions (decision_number, decision_year, session_number, description, pdf_path, main_category, sub_category) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [data.decision_number, data.decision_year, data.session_number, data.description, data.pdf_path, data.main_category, data.sub_category];
  const res = await run(sql, params); return res.lastID;
};

export const updateDecision = async (id, data) => {
  const sql = `UPDATE council_decisions SET decision_number = ?, decision_year = ?, session_number = ?, description = ?, main_category = ?, sub_category = ? WHERE id = ?`;
  const params = [data.decision_number, data.decision_year, data.session_number, data.description, data.main_category, data.sub_category, id];
  const res = await run(sql, params); return res.changes;
};

export const updateDecisionPdf = async (id, pdfPath) => { await run('UPDATE council_decisions SET pdf_path = ? WHERE id = ?', [pdfPath, id]); };

// 🔴 1. دالة الحذف الناعم (تحديث الحقل فقط) 🔴
export const deleteDecision = async (id) => {
  await run('UPDATE council_decisions SET is_deleted = 1 WHERE id = ?', [id]);
};

// 🔴 2. دالة جلب قائمة المحذوفات لسلة المهملات 🔴
export const getDeletedDecisions = async () => {
  return await all('SELECT * FROM council_decisions WHERE is_deleted = 1 ORDER BY id DESC');
};

// 🔴 3. دالة استعادة القرار من سلة المهملات 🔴
export const restoreDecision = async (id) => {
  await run('UPDATE council_decisions SET is_deleted = 0 WHERE id = ?', [id]);
};

// 🔴 4. دالة الحذف النهائي والأبدي للقرار من قاعدة البيانات 🔴
export const hardDeleteDecision = async (id) => {
  await run('DELETE FROM council_decisions WHERE id = ?', [id]);
};

export const getAllCategories = () => all('SELECT * FROM categories ORDER BY id ASC');