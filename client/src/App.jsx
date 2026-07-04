import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Search, 
  FilePlus, 
  Upload, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Download, 
  Printer, 
  Eye, 
  Trash2,
  Edit,
  Plus,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  X,
  Lock,
  LogOut
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  // Simple Session State
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('archive_admin_session') === 'active';
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  const [activeTab, setActiveTab] = useState('list');
  const [stats, setStats] = useState({ total: 0, withPdf: 0, withoutPdf: 0 });
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  
  // Search parameters
  const [searchParams, setSearchParams] = useState({
    name: '',
    archive_number: '',
    university: ''
  });
  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);

  // Forms
  const [formData, setFormData] = useState({
    applicant_name: '',
    archive_number: '',
    university: '',
    equivalence_decision_number: '',
    equivalence_decision_date: '',
    eligibility_decision_number: '',
    eligibility_decision_date: ''
  });
  // Selected file for upload
  const [selectedFile, setSelectedFile] = useState(null);

  // Modal control
  const [editMode, setEditMode] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // UI feedback
  const [notification, setNotification] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Load initial data if logged in
  useEffect(() => {
    if (isLoggedIn) {
      fetchStats();
      fetchTransactions();
    }
  }, [offset, activeTab, isLoggedIn]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({
        ...searchParams,
        limit,
        offset
      });
      const res = await fetch(`${API_BASE}/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.data);
        setTotalCount(data.total);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDetails = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/transactions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTx(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Simple login handler
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginForm.username === 'admin' && loginForm.password === '123456') {
      setIsLoggedIn(true);
      localStorage.setItem('archive_admin_session', 'active');
      showNotification('تم تسجيل الدخول بنجاح');
    } else {
      showNotification('اسم المستخدم أو كلمة المرور غير صحيحة!', 'error');
    }
  };

  // Simple logout handler
  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('archive_admin_session');
    showNotification('تم تسجيل الخروج');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setOffset(0);
    fetchTransactions();
  };

  const handleSearchReset = () => {
    setSearchParams({ name: '', archive_number: '', university: '' });
    setOffset(0);
    setTimeout(fetchTransactions, 50);
  };

  // Submit form (includes sequential file upload if selected)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.applicant_name || !formData.archive_number || !formData.university) {
      showNotification('الاسم، رقم الأرشيف، واسم الجامعة هي حقول إلزامية!', 'error');
      return;
    }

    try {
      const url = editMode ? `${API_BASE}/transactions/${selectedTxId}` : `${API_BASE}/transactions`;
      const method = editMode ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (res.ok) {
        const txId = editMode ? selectedTxId : data.id;

        // If a file was selected, upload it now
        if (selectedFile) {
          await uploadFileDirectly(txId, selectedFile);
        }

        showNotification(editMode ? 'تم تحديث بيانات المعاملة بنجاح' : 'تم تسجيل المعاملة بنجاح');
        setModalOpen(false);
        resetForm();
        fetchStats();
        fetchTransactions();
      } else {
        showNotification(data.message, 'error');
      }
    } catch (err) {
      showNotification('حدث خطأ أثناء الاتصال بالخادم', 'error');
    }
  };

  // Internal helper to upload file
  const uploadFileDirectly = async (txId, file) => {
    const fileData = new FormData();
    fileData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/transactions/${txId}/upload`, {
        method: 'POST',
        body: fileData
      });
      const data = await res.json();
      if (!res.ok) {
        showNotification(`فشل رفع الملف: ${data.message}`, 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('حدث خطأ أثناء رفع الملف الرقمي للمعاملة', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      applicant_name: '',
      archive_number: '',
      university: '',
      equivalence_decision_number: '',
      equivalence_decision_date: '',
      eligibility_decision_number: '',
      eligibility_decision_date: ''
    });
    setSelectedFile(null);
    setEditMode(false);
    setSelectedTxId(null);
  };

  const handleEditClick = (row) => {
    setFormData({
      applicant_name: row.applicant_name || '',
      archive_number: row.archive_number || '',
      university: row.university || '',
      equivalence_decision_number: row.equivalence_decision_number || '',
      equivalence_decision_date: row.equivalence_decision_date || '',
      eligibility_decision_number: row.eligibility_decision_number || '',
      eligibility_decision_date: row.eligibility_decision_date || ''
    });
    setSelectedTxId(row.id);
    setSelectedFile(null);
    setEditMode(true);
    setModalOpen(true);
  };

  const handleDeleteClick = async (id) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه المعاملة والملف المرتبط بها نهائياً؟')) return;
    try {
      const res = await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message);
        fetchStats();
        fetchTransactions();
      } else {
        showNotification(data.message, 'error');
      }
    } catch (err) {
      showNotification('خطأ في الاتصال بالخادم لحذف المعاملة', 'error');
    }
  };

  // PDF File validation helper for direct uploads
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size <= 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showNotification('حجم الملف كبير جداً! الحد الأقصى المسموح به لرفع الملف هو 5 ميغابايت (5MB).', 'error');
      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    // Validate type PDF
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      showNotification('الملف غير صالح. يرجى اختيار ملف بصيغة PDF فقط.', 'error');
      e.target.value = '';
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handlePdfUpload = async (e, id) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate maximum file size <= 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showNotification('حجم الملف كبير جداً! الحد الأقصى المسموح به لرفع الملف هو 5 ميغابايت (5MB).', 'error');
      e.target.value = '';
      return;
    }

    // Validate file type (PDF only)
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      showNotification('الملف غير صالح. يرجى اختيار ملف بصيغة PDF فقط.', 'error');
      e.target.value = '';
      return;
    }

    setUploadProgress('جاري الرفع...');
    await uploadFileDirectly(id, file);
    setUploadProgress(null);
    fetchDetails(id);
    fetchStats();
    fetchTransactions();
  };

  const openDetails = (row) => {
    fetchDetails(row.id);
    setDetailModalOpen(true);
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams(searchParams);
    window.location.href = `${API_BASE}/export/csv?${params.toString()}`;
    showNotification('جاري تحميل التقرير بصيغة Excel (CSV)...');
  };

  const handlePrint = () => {
    window.print();
  };

  // Login page layout if not logged in
  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <form onSubmit={handleLoginSubmit} className="login-card">
          <img src="/logo2.png" alt="وزارة التعليم العالي" className="login-logo" onError={(e) => e.target.style.display='none'} />
          <h1 className="login-title">أرشيف مجلس التعليم العالي</h1>
          <p className="login-subtitle">الدخول الموحد للوحة التحكم وإدارة القرارات</p>
          
          <div className="form-group">
            <label className="form-label">اسم المستخدم</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="أدخل اسم المستخدم"
              required 
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">كلمة المرور</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="أدخل كلمة المرور"
              required 
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px', padding: '14px' }}>
            <Lock size={18} />
            تسجيل الدخول
          </button>
          
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.8rem', color: '#888' }}>
            الجمهورية العربية السورية © 2026
          </div>
        </form>
        
        {notification && (
          <div className={`alert alert-${notification.type}`} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, margin: 0 }}>
            {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            {notification.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar banner logo and navigators */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logo2.png" alt="شعار الوزارة" className="sidebar-logo" onError={(e) => e.target.style.display='none'} />
          <div>
            <h2 className="sidebar-title">أرشيف مجلس التعليم العالي</h2>
            <p className="sidebar-subtitle">نظام إدارة وأرشفة المعاملات</p>
          </div>
        </div>

        <ul className="sidebar-menu">
          <li>
            <div 
              className={`sidebar-item ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => { setActiveTab('list'); setOffset(0); }}
            >
              <LayoutDashboard size={20} />
              <span>لوحة التحكم والأرشيف</span>
            </div>
          </li>
          <li>
            <div 
              className="sidebar-item"
              onClick={() => { resetForm(); setModalOpen(true); }}
            >
              <FilePlus size={20} />
              <span>إضافة معاملة جديدة</span>
            </div>
          </li>
        </ul>

        <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textAlign: 'center', marginBottom: '12px' }}>
            الجمهورية العربية السورية
            <br />
            وزارة التعليم العالي والبحث العلمي
          </div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none' }}>
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main dashboard view */}
      <main className="main-content">
        <header className="navbar">
          <h1 className="page-title">لوحة التحكم وأرشفة المعاملات</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              التاريخ: {new Date().toLocaleDateString('ar-SY')}
            </span>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
              <LogOut size={14} />
              خروج
            </button>
          </div>
        </header>

        <div className="dashboard-grid fade-in">
          {/* Stats Bar */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-info">
                <span className="stat-val">{stats.total}</span>
                <span className="stat-lbl">إجمالي المعاملات المسجلة</span>
              </div>
              <div className="stat-icon-wrapper">
                <FolderOpen size={24} />
              </div>
            </div>

            <div className="stat-card archived">
              <div className="stat-info">
                <span className="stat-val">{stats.withPdf}</span>
                <span className="stat-lbl">معاملات مرفوعة رقمياً (PDF)</span>
              </div>
              <div className="stat-icon-wrapper">
                <CheckCircle size={24} />
              </div>
            </div>

            <div className="stat-card pending">
              <div className="stat-info">
                <span className="stat-val">{stats.withoutPdf}</span>
                <span className="stat-lbl">معاملات غير مؤرشفة رقمياً</span>
              </div>
              <div className="stat-icon-wrapper">
                <Clock size={24} />
              </div>
            </div>
          </div>

          {/* Search Box Filters */}
          <form onSubmit={handleSearchSubmit} className="search-box">
            <div className="search-grid">
              <div className="form-group">
                <label className="form-label">اسم الطالب</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ابحث بالاسم الكامل..."
                  value={searchParams.name}
                  onChange={(e) => setSearchParams({ ...searchParams, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">رقم الأرشيف</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ابحث برقم الأرشيف..."
                  value={searchParams.archive_number}
                  onChange={(e) => setSearchParams({ ...searchParams, archive_number: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">اسم الجامعة</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ابحث بالجامعة..."
                  value={searchParams.university}
                  onChange={(e) => setSearchParams({ ...searchParams, university: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={handleSearchReset}>
                تفريغ الفلاتر
              </button>
              <button type="submit" className="btn btn-primary">
                <Search size={16} />
                بحث وتصفية
              </button>
              <button type="button" className="btn btn-accent" onClick={handleExportCSV}>
                <Download size={16} />
                تصدير النتائج لملف Excel
              </button>
            </div>
          </form>

          {/* Results Table view */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">سجلات الأرشيف الرقمي المتاحة ({totalCount} سجل)</h3>
              <button className="btn btn-primary" onClick={() => { resetForm(); setModalOpen(true); }} style={{ padding: '8px 16px' }}>
                <Plus size={16} />
                إضافة معاملة جديدة
              </button>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>رقم الأرشيف</th>
                      <th>اسم الطالب</th>
                      <th>اسم الجامعة</th>
                      <th>رقم قرار المعادلة</th>
                      <th>تاريخ قرار المعادلة</th>
                      <th>ملف الـ PDF</th>
                      <th style={{ width: '220px' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length > 0 ? (
                      transactions.map((row) => (
                        <tr key={row.id}>
                          <td style={{ fontWeight: 'bold' }}>{row.archive_number}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--primary-green)' }}>{row.applicant_name}</td>
                          <td>{row.university}</td>
                          <td>{row.equivalence_decision_number || '---'}</td>
                          <td>{row.equivalence_decision_date || '---'}</td>
                          <td>
                            {row.pdf_path ? (
                              <a 
                                href={`http://localhost:5000${row.pdf_path}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="badge badge-archived" 
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                              >
                                <FileText size={12} />
                                عرض الـ PDF
                              </a>
                            ) : (
                              <span className="badge badge-reviewer" style={{ background: '#fef2f2', color: '#ef4444', border: 'none' }}>
                                غير مرفوع
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => openDetails(row)}>
                                <Eye size={12} />
                                عرض
                              </button>
                              <button className="btn btn-accent" style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#fff' }} onClick={() => handleEditClick(row)}>
                                <Edit size={12} />
                                تعديل
                              </button>
                              <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleDeleteClick(row.id)}>
                                <Trash2 size={12} />
                                حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          لا توجد أي معاملات مسجلة في قاعدة البيانات حالياً.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalCount > limit && (
                <div className="pagination">
                  <button 
                    className="btn btn-secondary" 
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                  >
                    <ChevronRight size={16} />
                    السابق
                  </button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    عرض {offset + 1} - {Math.min(offset + limit, totalCount)} من أصل {totalCount}
                  </span>
                  <button 
                    className="btn btn-secondary" 
                    disabled={offset + limit >= totalCount}
                    onClick={() => setOffset(offset + limit)}
                  >
                    التالي
                    <ChevronLeft size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* -------------------- ADD / EDIT MODAL -------------------- */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '700px', maxHeight: '95vh', overflowY: 'auto' }}>
            <div className="card-header">
              <h3 className="card-title">
                {editMode ? 'تعديل بيانات المعاملة' : 'إضافة معاملة جديدة للأرشيف'}
              </h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => { setModalOpen(false); resetForm(); }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">اسم الطالب الكامل (إلزامي)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="الاسم الثلاثي الكامل"
                    required
                    value={formData.applicant_name}
                    onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">رقم الأرشيف (إلزامي - يسمح بالتكرار)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="مثال: 1205"
                    required
                    value={formData.archive_number}
                    onChange={(e) => setFormData({ ...formData, archive_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">اسم الجامعة المانحة (إلزامي)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="الجامعة أو المعهد"
                    required
                    value={formData.university}
                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">رقم قرار المعادلة (اختياري)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="رقم القرار..."
                    value={formData.equivalence_decision_number}
                    onChange={(e) => setFormData({ ...formData, equivalence_decision_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">تاريخ صدور قرار المعادلة (اختياري)</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={formData.equivalence_decision_date}
                    onChange={(e) => setFormData({ ...formData, equivalence_decision_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">رقم قرار الأهلية (اختياري)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="رقم القرار الأهلية..."
                    value={formData.eligibility_decision_number}
                    onChange={(e) => setFormData({ ...formData, eligibility_decision_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">تاريخ صدور قرار الأهلية (اختياري)</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={formData.eligibility_decision_date}
                    onChange={(e) => setFormData({ ...formData, eligibility_decision_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Upload PDF input inside Add/Edit forms directly */}
              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-gold)' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Upload size={16} style={{ color: 'var(--accent-gold-dark)' }} />
                  <span>رفع وثيقة القرار والملفات (PDF فقط - الحد الأقصى 5MB)</span>
                </label>
                <input 
                  type="file" 
                  accept=".pdf" 
                  className="form-input"
                  onChange={handleFileChange}
                  style={{ background: '#fff', padding: '8px' }}
                />
                {selectedFile && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--primary-green)', fontWeight: 'bold' }}>
                    ملف مجهز للرفع: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
                {editMode && !selectedFile && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    * اترك الحقل فارغاً إذا كنت لا ترغب في استبدال ملف الـ PDF الحالي.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setModalOpen(false); resetForm(); }}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary">
                  {editMode ? 'حفظ التعديلات' : 'تسجيل وحفظ المعاملة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- DETAIL VIEW & UPLOADER MODAL -------------------- */}
      {detailModalOpen && selectedTx && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '800px' }}>
            <div className="card-header">
              <h3 className="card-title">تفاصيل ملف وأرشيف المعاملة: {selectedTx.applicant_name}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={handlePrint} style={{ padding: '8px 12px' }}>
                  <Printer size={14} />
                  طباعة
                </button>
                <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => { setDetailModalOpen(false); setSelectedTx(null); }}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="card-body">
              <div id="printable-report">
                {/* Academic/Transaction details grid */}
                <div className="card" style={{ marginBottom: '20px' }}>
                  <div className="card-body">
                    <div className="detail-info-grid">
                      <div className="detail-item">
                        <span className="detail-lbl">اسم الطالب طالب التعادل</span>
                        <span className="detail-val">{selectedTx.applicant_name}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-lbl">رقم الأرشيف المجلد</span>
                        <span className="detail-val">{selectedTx.archive_number}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-lbl">الجامعة المانحة للشهادة</span>
                        <span className="detail-val">{selectedTx.university}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-lbl">رقم قرار المعادلة</span>
                        <span className="detail-val">{selectedTx.equivalence_decision_number || '---'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-lbl">تاريخ صدور قرار المعادلة</span>
                        <span className="detail-val">{selectedTx.equivalence_decision_date || '---'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-lbl">رقم قرار الأهلية</span>
                        <span className="detail-val">{selectedTx.eligibility_decision_number || '---'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-lbl">تاريخ صدور قرار الأهلية</span>
                        <span className="detail-val">{selectedTx.eligibility_decision_date || '---'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PDF management uploader and view */}
                <div className="card">
                  <div className="card-header" style={{ padding: '10px 16px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>ملف الـ PDF المرفق بالمعاملة</h4>
                  </div>
                  <div className="card-body" style={{ padding: '16px' }}>
                    {selectedTx.pdf_path ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="file-item">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={18} className="upload-icon" />
                            <span>الملف الرقمي للمعادلة والقرارات:</span>
                          </div>
                          <a 
                            href={`http://localhost:5000${selectedTx.pdf_path}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            <Eye size={12} />
                            فتح واستعراض ملف PDF
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-warning" style={{ margin: 0 }}>
                        <AlertCircle size={20} />
                        لا يوجد ملف PDF مرفق بهذه المعاملة حتى الآن. يرجى استخدام أداة الرفع أدناه لتخزينه.
                      </div>
                    )}

                    {/* PDF Uploader area */}
                    <div style={{ marginTop: '24px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                      <label className="form-label" style={{ marginBottom: '8px' }}>رفع أو استبدال ملف الـ PDF الرقمي المعاملة:</label>
                      <div className="upload-zone">
                        <Upload size={24} className="upload-icon" />
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>أفلت ملف PDF أو انقر للرفع</span>
                        <input 
                          type="file" 
                          accept=".pdf" 
                          id="upload-file-tx"
                          style={{ display: 'none' }}
                          onChange={(e) => handlePdfUpload(e, selectedTx.id)}
                        />
                        <label htmlFor="upload-file-tx" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer' }}>
                          اختر الملف
                        </label>
                      </div>
                      
                      {uploadProgress && (
                        <div style={{ color: 'var(--accent-gold-dark)', fontSize: '0.85rem', fontWeight: 'bold', marginTop: '10px', textAlign: 'center' }}>
                          {uploadProgress}
                        </div>
                      )}
                      
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                        ملاحظة هامة: يجب أن يكون الملف بصيغة PDF فقط وحجمه لا يتجاوز 5 ميغابايت (5MB).
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating System notification toast */}
      {notification && (
        <div className={`alert alert-${notification.type}`} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, margin: 0 }}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {notification.message}
        </div>
      )}
    </div>
  );
}
