import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
// إتاحة مجلد المرفقات للقراءة
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// التأكد من وجود مجلد الرفع
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// إعدادات رفع الملفات (Multer)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const { archive_number, applicant_name, equivalence_decision_date } = req.body;
    
    let fileName = 'unknown';
    if (archive_number && applicant_name) {
       const safeName = applicant_name.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim().replace(/\s+/g, '-');
       const safeDate = (equivalence_decision_date || '').replace(/\//g, '-');
       fileName = `${archive_number}-${safeName}${safeDate ? '-' + safeDate : ''}`;
    } else {
       fileName = `doc-${Date.now()}`;
    }
    cb(null, `${fileName}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // الحد الأقصى 5 ميغابايت
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('يسمح فقط برفع ملفات PDF!'));
    }
  }
});

// --- مسارات الواجهة البرمجية (API Endpoints) ---

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const filters = {
      name: req.query.name,
      archive_number: req.query.archive_number,
      university: req.query.university
    };
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await db.searchTransactions(filters, limit, offset);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/transactions/:id', async (req, res) => {
  try {
    const tx = await db.getTransactionById(req.params.id);
    if (tx) res.json(tx);
    else res.status(404).json({ message: 'المعاملة غير موجودة' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const id = await db.createTransaction(req.body);
    res.status(201).json({ id, message: 'تم إنشاء المعاملة بنجاح' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const changes = await db.updateTransaction(req.params.id, req.body);
    if (changes) res.json({ message: 'تم تحديث المعاملة بنجاح' });
    else res.status(404).json({ message: 'المعاملة غير موجودة' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const tx = await db.getTransactionById(req.params.id);
    if (tx && tx.pdf_path) {
      const fullPath = path.join(__dirname, tx.pdf_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await db.deleteTransaction(req.params.id);
    res.json({ message: 'تم حذف المعاملة وملفاتها بنجاح' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/transactions/:id/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'لم يتم استلام أي ملف' });
    }
    const pdfPath = `/uploads/${req.file.filename}`;
    await db.updateTransactionPdf(req.params.id, pdfPath);
    res.json({ message: 'تم رفع الملف بنجاح', pdf_path: pdfPath });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// المسار الجديد: لحذف ملف الـ PDF فقط (بدون حذف بيانات المعاملة)
app.delete('/api/transactions/:id/pdf', async (req, res) => {
  try {
    const tx = await db.getTransactionById(req.params.id);
    if (tx && tx.pdf_path) {
      const fullPath = path.join(__dirname, tx.pdf_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath); // مسح الملف من المجلد
      }
      await db.updateTransactionPdf(req.params.id, null); // تفريغ الخانة في قاعدة البيانات
      res.json({ message: 'تم حذف وثيقة الـ PDF بنجاح' });
    } else {
      res.status(404).json({ message: 'لا يوجد ملف مرفق لحذفه' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// مسار تصدير ملفات Excel
app.get('/api/export/csv', async (req, res) => {
   try {
    const filters = {
      name: req.query.name,
      archive_number: req.query.archive_number,
      university: req.query.university
    };
    const result = await db.searchTransactions(filters, 10000, 0);
    
    let csv = 'رقم الأرشيف,اسم الطالب,الجامعة,رقم قرار المعادلة,تاريخ المعادلة,رقم الأهلية,تاريخ الأهلية\n';
    result.data.forEach(row => {
      csv += `"${row.archive_number}","${row.applicant_name}","${row.university}","${row.equivalence_decision_number || ''}","${row.equivalence_decision_date || ''}","${row.eligibility_decision_number || ''}","${row.eligibility_decision_date || ''}"\n`;
    });

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="archive_export.csv"');
    res.send('\uFEFF' + csv);
   } catch (err) {
     res.status(500).json({ message: err.message });
   }
});

app.listen(PORT, () => {
  console.log(`Server is running in development mode on http://localhost:${PORT}`);
});