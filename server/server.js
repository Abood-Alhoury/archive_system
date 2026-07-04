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
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json());

// Setup uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve files statically
app.use('/uploads', express.static(uploadsDir));

// --- Multer Configuration with Validations ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Sanitize function to remove system restricted characters (\ / : * ? " < > |)
    const sanitize = (val) => {
      if (!val) return '';
      return String(val).replace(/[\\\/:\*\?"<>\|]/g, '').trim();
    };

    const archiveNum = sanitize(req.body.archive_number) || 'unknown';
    const applicantName = sanitize(req.body.applicant_name) || 'unknown';
    const decDate = sanitize(req.body.equivalence_decision_date);

    let baseName = `${archiveNum}-${applicantName}`;
    if (decDate) {
      baseName += `-${decDate}`;
    }

    cb(null, `${baseName}.pdf`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB Limit
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype === 'application/pdf';

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('الملفات المسموح برفعها هي بصيغة PDF فقط!'));
    }
  }
});

// --- API Routes (Simplified, No Authentication Required) ---

// 1. Stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في جلب إحصائيات النظام' });
  }
});

// 2. Transactions List & Search
app.get('/api/transactions', async (req, res) => {
  const { name, archive_number, university, limit, offset } = req.query;
  try {
    const results = await db.searchTransactions(
      { name, archive_number, university },
      parseInt(limit) || 20,
      parseInt(offset) || 0
    );
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في خادم البحث والاستعلام' });
  }
});

// 3. Get Transaction Details by ID
app.get('/api/transactions/:id', async (req, res) => {
  try {
    const tx = await db.getTransactionById(req.params.id);
    if (!tx) {
      return res.status(404).json({ message: 'المعاملة المطلوبة غير موجودة' });
    }
    res.json(tx);
  } catch (error) {
    res.status(500).json({ message: 'خطأ في جلب تفاصيل المعاملة' });
  }
});

// 4. Create Transaction
app.post('/api/transactions', async (req, res) => {
  const { archive_number, applicant_name, university } = req.body;
  
  if (!archive_number || !applicant_name || !university) {
    return res.status(400).json({ message: 'حقول (رقم الأرشيف، اسم الطالب، والجامعة) إلزامية لتسجيل المعاملة.' });
  }

  try {
    const newId = await db.createTransaction(req.body);
    res.status(201).json({ message: 'تم تسجيل المعاملة بنجاح', id: newId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في خادم تسجيل المعاملة' });
  }
});

// 5. Update Transaction
app.put('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const { archive_number, applicant_name, university } = req.body;

  if (!archive_number || !applicant_name || !university) {
    return res.status(400).json({ message: 'حقول (رقم الأرشيف، اسم الطالب، والجامعة) إلزامية لتعديل المعاملة.' });
  }

  try {
    const changes = await db.updateTransaction(id, req.body);
    if (changes === 0) {
      return res.status(404).json({ message: 'المعاملة غير موجودة' });
    }
    res.json({ message: 'تم تحديث بيانات المعاملة بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ أثناء تحديث بيانات المعاملة' });
  }
});

// 6. Delete Transaction
app.delete('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const tx = await db.getTransactionById(id);
    if (tx && tx.pdf_path) {
      // Try to delete physical PDF file if it exists
      const fullPath = path.join(__dirname, tx.pdf_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    await db.deleteTransaction(id);
    res.json({ message: 'تم حذف المعاملة والملف المرتبط بها بنجاح' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'خطأ في حذف المعاملة' });
  }
});

// 7. Upload PDF Attachment per Transaction
app.post('/api/transactions/:id/upload', (req, res) => {
  const { id } = req.params;
  
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'يرجى اختيار ملف PDF للرفع' });
    }

    try {
      // Get old transaction to delete old PDF if replaced
      const oldTx = await db.getTransactionById(id);
      if (oldTx && oldTx.pdf_path) {
        const oldFilePath = path.join(__dirname, oldTx.pdf_path);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      const relativePath = `/uploads/${req.file.filename}`;
      await db.updateTransactionPdf(id, relativePath);

      res.status(201).json({
        message: 'تم رفع وثيقة المعاملة وحفظها بنجاح',
        pdf_path: relativePath
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'حدث خطأ أثناء حفظ الملف في قاعدة البيانات' });
    }
  });
});

// 8. Export to CSV (Excel compatible, Arabic supported)
app.get('/api/export/csv', async (req, res) => {
  const { name, archive_number, university } = req.query;
  try {
    const results = await db.searchTransactions(
      { name, archive_number, university },
      10000, 
      0
    );

    const headers = [
      'رقم الأرشيف',
      'اسم الطالب',
      'الجامعة',
      'رقم قرار المعادلة',
      'تاريخ صدور قرار المعادلة',
      'رقم قرار الأهلية',
      'تاريخ صدور قرار الأهلية',
      'حالة المرفق'
    ];

    const csvRows = results.data.map(row => [
      `"${(row.archive_number || '').replace(/"/g, '""')}"`,
      `"${(row.applicant_name || '').replace(/"/g, '""')}"`,
      `"${(row.university || '').replace(/"/g, '""')}"`,
      `"${(row.equivalence_decision_number || '').replace(/"/g, '""')}"`,
      `"${row.equivalence_decision_date || ''}"`,
      `"${(row.eligibility_decision_number || '').replace(/"/g, '""')}"`,
      `"${row.eligibility_decision_date || ''}"`,
      `"${row.pdf_path ? 'مرفوع' : 'غير مرفوع'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=equivalency_archive_report.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'حدث خطأ أثناء تصدير البيانات' });
  }
});

// Run server
app.listen(PORT, () => {
  console.log(`Server is running in development mode on http://localhost:${PORT}`);
});
