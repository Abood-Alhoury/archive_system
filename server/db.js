import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    
    // إنشاء جدول المعاملات إذا لم يكن موجوداً
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
    `);
  }
});

// Helper to run queries returning Promise
export const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// --- CRUD Database Operations ---

// 1. Get Dashboard Stats
export const getStats = async () => {
  const total = await dbGet('SELECT COUNT(*) as count FROM transactions');
  const withPdf = await dbGet('SELECT COUNT(*) as count FROM transactions WHERE pdf_path IS NOT NULL AND pdf_path != ""');
  
  return {
    total: total.count,
    withPdf: withPdf.count,
    withoutPdf: total.count - withPdf.count
  };
};

// 2. Search Transactions
export const searchTransactions = async (filters, limit = 100, offset = 0) => {
  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];

  if (filters.name) {
    query += ' AND applicant_name LIKE ?';
    params.push(`%${filters.name}%`);
  }
  if (filters.archive_number) {
    query += ' AND archive_number LIKE ?';
    params.push(`%${filters.archive_number}%`);
  }
  if (filters.university) {
    query += ' AND university LIKE ?';
    params.push(`%${filters.university}%`);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countResult = await dbGet(countQuery, params);

  query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await dbAll(query, params);
  return {
    total: countResult.count,
    data: rows
  };
};

// 3. Get transaction by ID
export const getTransactionById = (id) => {
  return dbGet('SELECT * FROM transactions WHERE id = ?', [id]);
};

// 4. Create transaction
export const createTransaction = async (data) => {
  const query = `
    INSERT INTO transactions (
      archive_number, applicant_name, university, 
      equivalence_decision_number, equivalence_decision_date, 
      eligibility_decision_number, eligibility_decision_date,
      pdf_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    data.archive_number,
    data.applicant_name,
    data.university,
    data.equivalence_decision_number || '',
    data.equivalence_decision_date || '',
    data.eligibility_decision_number || '',
    data.eligibility_decision_date || '',
    data.pdf_path || ''
  ];

  const result = await dbRun(query, params);
  return result.id;
};

// 5. Update transaction
export const updateTransaction = async (id, data) => {
  const query = `
    UPDATE transactions 
    SET archive_number = ?, 
        applicant_name = ?, 
        university = ?, 
        equivalence_decision_number = ?, 
        equivalence_decision_date = ?, 
        eligibility_decision_number = ?, 
        eligibility_decision_date = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const params = [
    data.archive_number,
    data.applicant_name,
    data.university,
    data.equivalence_decision_number || '',
    data.equivalence_decision_date || '',
    data.eligibility_decision_number || '',
    data.eligibility_decision_date || '',
    id
  ];

  const result = await dbRun(query, params);
  return result.changes;
};

// 6. Delete transaction
export const deleteTransaction = (id) => {
  return dbRun('DELETE FROM transactions WHERE id = ?', [id]);
};

// 7. Update transaction PDF path
export const updateTransactionPdf = (id, pdfPath) => {
  return dbRun('UPDATE transactions SET pdf_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [pdfPath, id]);
};