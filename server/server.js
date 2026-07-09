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
// السماح بالوصول لمجلد المرفقات (بما فيها المجلدات الفرعية)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🔴 إنشاء المجلدات تلقائياً إذا لم تكن موجودة 🔴
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const decisionsDir = path.join(__dirname, 'uploads', 'decisions');
if (!fs.existsSync(decisionsDir)) {
  fs.mkdirSync(decisionsDir); // إنشاء مجلد القرارات المستقل
}

// 🔴 إعدادات الرفع والتسمية الذكية للملفات 🔴
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (req.body.decision_number) {
      // توجيه ملفات القرارات إلى مجلدها الخاص
      cb(null, 'uploads/decisions/'); 
    } else {
      // توجيه ملفات المعادلات إلى المجلد العام (كما كانت القديمة)
      cb(null, 'uploads/'); 
    }
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const { archive_number, applicant_name, decision_number, decision_year, session_number, main_category } = req.body;
    
    if (decision_number) {
       // معالجة القيم الفارغة في حال لم يدخل الموظف رقم جلسة
       const safeSession = session_number ? String(session_number).trim() : 'بدون_جلسة';
       const safeCat = main_category ? String(main_category).trim() : 'بدون_تصنيف';
       
       // تسمية الملف تماماً كما طلبت: 1-2026-2-طلاب
       // تم استبدال المسافات أو الرموز الممنوعة في الويندوز إن وجدت
       let fileName = `${decision_number}-${decision_year}-${safeSession}-${safeCat}`.replace(/[\\/:"*?<>|]/g, '-');
       
       // إضافة طابع زمني صغير لمنع الكاش وتحديث الملف فوراً عند التعديل
       cb(null, `${fileName}-${Date.now()}${ext}`);
    } 
    else if (archive_number && applicant_name) {
       // كود تسمية ملفات المعادلات القديم 100% (لم يمس)
       const safeName = applicant_name.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim().replace(/\s+/g, '-');
       cb(null, `student-${archive_number}-${safeName}-${Date.now()}${ext}`);
    } else {
       cb(null, `doc-${Date.now()}${ext}`);
    }
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('يسمح فقط برفع ملفات PDF!'));
  }
});


// ==============================================================
// --- مسارات الواجهة البرمجية لمعاملات الطلاب (ممنوع التعديل) ---
// ==============================================================
app.get('/api/stats', async (req, res) => {
  try { res.json(await db.getStats()); } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const filters = { name: req.query.name, archive_number: req.query.archive_number, university: req.query.university };
    res.json(await db.searchTransactions(filters, parseInt(req.query.limit) || 100, parseInt(req.query.offset) || 0));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/export/csv', async (req, res) => {
  try {
    const filters = { name: req.query.name, archive_number: req.query.archive_number, university: req.query.university };
    const result = await db.searchTransactions(filters, 100000, 0); 
    
    let csvContent = '\uFEFF'; 
    csvContent += 'رقم الأرشيف,اسم الطالب,الجامعة,رقم القرار,تاريخ القرار,رقم قرار الأهلية,تاريخ قرار الأهلية\n';
    
    result.data.forEach(row => {
      csvContent += `"${row.archive_number || ''}","${row.applicant_name || ''}","${row.university || ''}","${row.equivalence_decision_number || ''}","${row.equivalence_decision_date || ''}","${row.eligibility_decision_number || ''}","${row.eligibility_decision_date || ''}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=archive_export.csv');
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/transactions/:id', async (req, res) => {
  try {
    const tx = await db.getTransactionById(req.params.id);
    if (tx) res.json(tx); else res.status(404).json({ message: 'غير موجود' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/transactions', async (req, res) => {
  try { res.status(201).json({ id: await db.createTransaction(req.body), message: 'تم الحفظ' }); } 
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const changes = await db.updateTransaction(req.params.id, req.body);
    if (changes) res.json({ message: 'تم التحديث' }); else res.status(404).json({ message: 'غير موجود' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const tx = await db.getTransactionById(req.params.id);
    if (tx && tx.pdf_path) {
      const fullPath = path.join(__dirname, tx.pdf_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await db.deleteTransaction(req.params.id);
    res.json({ message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/transactions/:id/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'لم يتم استلام ملف' });
    const pdfPath = `/uploads/${req.file.filename}`;
    await db.updateTransactionPdf(req.params.id, pdfPath);
    res.json({ message: 'تم الرفع', pdf_path: pdfPath });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/transactions/:id/pdf', async (req, res) => {
  try {
    const tx = await db.getTransactionById(req.params.id);
    if (tx && tx.pdf_path) {
      const fullPath = path.join(__dirname, tx.pdf_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      await db.updateTransactionPdf(req.params.id, null);
      res.json({ message: 'تم حذف وثيقة الـ PDF' });
    } else res.status(404).json({ message: 'لا يوجد ملف' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});


// ==============================================================
// --- مسارات الواجهة البرمجية لقرارات المجلس ---
// ==============================================================
app.get('/api/decisions/stats', async (req, res) => {
  try { res.json(await db.getDecisionsStats()); } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/decisions', async (req, res) => {
  try {
    const filters = { 
      decision_number: req.query.decision_number, 
      decision_year: req.query.decision_year, 
      session_number: req.query.session_number,
      description: req.query.description,
      main_category: req.query.main_category,
      sub_category: req.query.sub_category
    };
    res.json(await db.searchDecisions(filters, parseInt(req.query.limit) || 100, parseInt(req.query.offset) || 0));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/decisions/export/csv', async (req, res) => {
  try {
    const filters = { 
      decision_number: req.query.decision_number, 
      decision_year: req.query.decision_year, 
      session_number: req.query.session_number,
      description: req.query.description,
      main_category: req.query.main_category,
      sub_category: req.query.sub_category
    };
    const result = await db.searchDecisions(filters, 100000, 0); 
    
    let csvContent = '\uFEFF'; 
    csvContent += 'رقم القرار,سنة القرار,رقم الجلسة,التصنيف الرئيسي,التصنيف الفرعي,الموضوع والوصف\n';
    
    result.data.forEach(row => {
      csvContent += `"${row.decision_number || ''}","${row.decision_year || ''}","${row.session_number || ''}","${row.main_category || ''}","${row.sub_category || ''}","${(row.description || '').replace(/"/g, '""')}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=decisions_export.csv');
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/decisions/:id', async (req, res) => {
  try {
    const dec = await db.getDecisionById(req.params.id);
    if (dec) res.json(dec); else res.status(404).json({ message: 'القرار غير موجود' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/decisions', async (req, res) => {
  try { 
    const exists = await db.checkDecisionExists(req.body.decision_number, req.body.decision_year);
    if (exists) {
      return res.status(400).json({ message: `القرار رقم ${req.body.decision_number} لسنة ${req.body.decision_year} مسجل مسبقاً في النظام ولا يمكن تكراره!` });
    }
    res.status(201).json({ id: await db.createDecision(req.body), message: 'تم حفظ القرار بنجاح' }); 
  } 
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.put('/api/decisions/:id', async (req, res) => {
  try {
    const exists = await db.checkDecisionExists(req.body.decision_number, req.body.decision_year, req.params.id);
    if (exists) {
      return res.status(400).json({ message: `خطأ: القرار رقم ${req.body.decision_number} لسنة ${req.body.decision_year} موجود مسبقاً لمعاملة أخرى!` });
    }
    const changes = await db.updateDecision(req.params.id, req.body);
    if (changes) res.json({ message: 'تم تحديث القرار بنجاح' }); else res.status(404).json({ message: 'القرار غير موجود' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/decisions/:id', async (req, res) => {
  try {
    const dec = await db.getDecisionById(req.params.id);
    if (dec && dec.pdf_path) {
      const fullPath = path.join(__dirname, dec.pdf_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await db.deleteDecision(req.params.id);
    res.json({ message: 'تم حذف القرار وملفاته بنجاح' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 🔴 حفظ مسار القرار في قاعدة البيانات ليشير إلى المجلد الجديد 🔴
app.post('/api/decisions/:id/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'لم يتم استلام أي ملف' });
    const pdfPath = `/uploads/decisions/${req.file.filename}`;
    await db.updateDecisionPdf(req.params.id, pdfPath);
    res.json({ message: 'تم رفع وثيقة القرار بنجاح', pdf_path: pdfPath });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/decisions/:id/pdf', async (req, res) => {
  try {
    const dec = await db.getDecisionById(req.params.id);
    if (dec && dec.pdf_path) {
      const fullPath = path.join(__dirname, dec.pdf_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      await db.updateDecisionPdf(req.params.id, null);
      res.json({ message: 'تم حذف وثيقة القرار (PDF) بنجاح' });
    } else res.status(404).json({ message: 'لا يوجد ملف مرفق' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running and listening on all interfaces at port ${PORT}`);
});