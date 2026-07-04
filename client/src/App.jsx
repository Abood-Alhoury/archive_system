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
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('archive_admin_session') === 'active';
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  const [activeTab, setActiveTab] = useState('list');
  const [stats, setStats] = useState({ total: 0, withPdf: 0, withoutPdf: 0 });
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  
  const [searchParams, setSearchParams] = useState({ name: '', archive_number: '', university: '' });
  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);

  const [formData, setFormData] = useState({
    applicant_name: '',
    archive_number: '',
    university: '',
    equivalence_decision_number: '',
    equivalence_decision_date: '',
    eligibility_decision_number: '',
    eligibility_decision_date: '',
    pdf_path: ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [notification, setNotification] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

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
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({ ...searchParams, limit, offset });
      const res = await fetch(`${API_BASE}/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.data);
        setTotalCount(data.total);
      }
    } catch (err) { console.error(err); }
  };

  const fetchDetails = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/transactions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTx(data);
      }
    } catch (err) { console.error(err); }
  };

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

        if (selectedFile) {
          await uploadFileDirectly(
            txId, selectedFile, formData.archive_number, formData.applicant_name, formData.equivalence_decision_date
          );
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

  const uploadFileDirectly = async (txId, file, archive_number, applicant_name, equivalence_decision_date) => {
    const fileData = new FormData();
    fileData.append('archive_number', archive_number || '');
    fileData.append('applicant_name', applicant_name || '');
    fileData.append('equivalence_decision_date', equivalence_decision_date || '');
    fileData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/transactions/${txId}/upload`, {
        method: 'POST',
        body: fileData
      });
      const data = await res.json();
      if (!res.ok) showNotification(`فشل رفع الملف: ${data.message}`, 'error');
    } catch (err) {
      showNotification('حدث خطأ أثناء رفع الملف الرقمي للمعاملة', 'error');
    }
  };

  // 🔴 الدالة الجديدة لحذف وثيقة الـ PDF 🔴
  const handleDeletePdf = async (id) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف ملف الـ PDF الحالي نهائياً؟')) return;
    try {
      const res = await fetch(`${API_BASE}/transactions/${id}/pdf`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message);
        setFormData({ ...formData, pdf_path: null }); // لتحديث الواجهة وإخفاء زر الحذف
        setSelectedFile(null); // تفريغ الملف المختار مسبقاً إن وجد
        if (selectedTx && selectedTx.id === id) fetchDetails(id);
        fetchStats();
        fetchTransactions();
      } else {
        showNotification(data.message, 'error');
      }
    } catch (err) {
      showNotification('خطأ في الاتصال بالخادم أثناء حذف الملف', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      applicant_name: '', archive_number: '', university: '',
      equivalence_decision_number: '', equivalence_decision_date: '',
      eligibility_decision_number: '', eligibility_decision_date: '', pdf_path: ''
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
      eligibility_decision_date: row.eligibility_decision_date || '',
      pdf_path: row.pdf_path || ''
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showNotification('حجم الملف كبير جداً! الحد الأقصى المسموح به 5MB.', 'error');
      e.target.value = '';
      setSelectedFile(null);
      return;
    }
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      showNotification('يرجى اختيار ملف بصيغة PDF فقط.', 'error');
      e.target.value = '';
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
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

  const handlePrint = () => window.print();

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <form onSubmit={handleLoginSubmit} className="login-card">
          <img src="/logo2.png" alt="وزارة التعليم العالي" className="login-logo" onError={(e) => e.target.style.display='none'} />
          <h1 className="login-title">أرشيف مجلس التعليم العالي</h1>
          <p className="login-subtitle">الدخول الموحد للوحة التحكم وإدارة القرارات</p>
          
          <div className="form-group">
            <label className="form-label">اسم المستخدم</label>
            <input type="text" className="form-input" placeholder="أدخل اسم المستخدم" required value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label">كلمة المرور</label>
            <input type="password" className="form-input" placeholder="أدخل كلمة المرور" required value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px', padding: '14px' }}>
            <Lock size={18} /> تسجيل الدخول
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
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
            <div className={`sidebar-item ${activeTab === 'list' ? 'active' : ''}`} onClick={() => { setActiveTab('list'); setOffset(0); }}>
              <LayoutDashboard size={20} /> <span>لوحة التحكم والأرشيف</span>
            </div>
          </li>
          <li>
            <div className="sidebar-item" onClick={() => { resetForm(); setModalOpen(true); }}>
              <FilePlus size={20} /> <span>إضافة معاملة جديدة</span>
            </div>
          </li>
        </ul>

        <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textAlign: 'center', marginBottom: '12px' }}>الجمهورية العربية السورية</div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none' }}>
            <LogOut size={16} /> تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="navbar">
          <h1 className="page-title">لوحة التحكم وأرشفة المعاملات</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
              <LogOut size={14} /> خروج
            </button>
          </div>
        </header>

        <div className="dashboard-grid fade-in">
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-info"><span className="stat-val">{stats.total}</span><span className="stat-lbl">إجمالي المعاملات</span></div>
              <div className="stat-icon-wrapper"><FolderOpen size={24} /></div>
            </div>
            <div className="stat-card archived">
              <div className="stat-info"><span className="stat-val">{stats.withPdf}</span><span className="stat-lbl">مؤرشفة رقمياً (PDF)</span></div>
              <div className="stat-icon-wrapper"><CheckCircle size={24} /></div>
            </div>
            <div className="stat-card pending">
              <div className="stat-info"><span className="stat-val">{stats.withoutPdf}</span><span className="stat-lbl">غير مؤرشفة رقمياً</span></div>
              <div className="stat-icon-wrapper"><Clock size={24} /></div>
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="search-box">
            <div className="search-grid">
              <div className="form-group">
                <label className="form-label">اسم الطالب</label>
                <input type="text" className="form-input" placeholder="ابحث بالاسم..." value={searchParams.name} onChange={(e) => setSearchParams({ ...searchParams, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">رقم الأرشيف</label>
                <input type="text" className="form-input" placeholder="ابحث برقم الأرشيف..." value={searchParams.archive_number} onChange={(e) => setSearchParams({ ...searchParams, archive_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">الجامعة</label>
                <input type="text" className="form-input" placeholder="ابحث بالجامعة..." value={searchParams.university} onChange={(e) => setSearchParams({ ...searchParams, university: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={handleSearchReset}>تفريغ الفلاتر</button>
              <button type="submit" className="btn btn-primary"><Search size={16} /> بحث وتصفية</button>
              <button type="button" className="btn btn-accent" onClick={handleExportCSV}><Download size={16} /> تصدير Excel</button>
            </div>
          </form>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">سجلات الأرشيف المتاحة ({totalCount} سجل)</h3>
              <button className="btn btn-primary" onClick={() => { resetForm(); setModalOpen(true); }} style={{ padding: '8px 16px' }}><Plus size={16} /> إضافة معاملة</button>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>رقم الأرشيف</th>
                      <th>اسم الطالب</th>
                      <th>الجامعة</th>
                      <th>رقم القرار</th>
                      <th>تاريخ القرار</th>
                      <th>الملف</th>
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
                              <a href={`http://localhost:5000${row.pdf_path}`} target="_blank" rel="noreferrer" className="badge badge-archived" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                <FileText size={12} /> عرض
                              </a>
                            ) : (
                              <span className="badge badge-reviewer" style={{ background: '#fef2f2', color: '#ef4444', border: 'none' }}>غير مرفوع</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => openDetails(row)}><Eye size={12} /> عرض</button>
                              <button className="btn btn-accent" style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#fff' }} onClick={() => handleEditClick(row)}><Edit size={12} /> تعديل</button>
                              <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleDeleteClick(row.id)}><Trash2 size={12} /> حذف</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>لا توجد سجلات.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalCount > limit && (
                <div className="pagination">
                  <button className="btn btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}><ChevronRight size={16} /> السابق</button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>عرض {offset + 1} - {Math.min(offset + limit, totalCount)} من أصل {totalCount}</span>
                  <button className="btn btn-secondary" disabled={offset + limit >= totalCount} onClick={() => setOffset(offset + limit)}>التالي <ChevronLeft size={16} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* --- نافذة الإضافة والتعديل --- */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '700px', maxHeight: '95vh', overflowY: 'auto' }}>
            <div className="card-header">
              <h3 className="card-title">{editMode ? 'تعديل بيانات المعاملة' : 'إضافة معاملة جديدة'}</h3>
              <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => { setModalOpen(false); resetForm(); }}><X size={16} /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-grid">
                <div className="form-group"><label className="form-label">اسم الطالب (إلزامي)</label><input type="text" className="form-input" required value={formData.applicant_name} onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">رقم الأرشيف (إلزامي)</label><input type="text" className="form-input" required value={formData.archive_number} onChange={(e) => setFormData({ ...formData, archive_number: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">الجامعة (إلزامي)</label><input type="text" className="form-input" required value={formData.university} onChange={(e) => setFormData({ ...formData, university: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">رقم القرار (اختياري)</label><input type="text" className="form-input" value={formData.equivalence_decision_number} onChange={(e) => setFormData({ ...formData, equivalence_decision_number: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">تاريخ القرار (اختياري)</label><input type="date" className="form-input" value={formData.equivalence_decision_date} onChange={(e) => setFormData({ ...formData, equivalence_decision_date: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">رقم قرار الأهلية (اختياري)</label><input type="text" className="form-input" value={formData.eligibility_decision_number} onChange={(e) => setFormData({ ...formData, eligibility_decision_number: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">تاريخ قرار الأهلية (اختياري)</label><input type="date" className="form-input" value={formData.eligibility_decision_date} onChange={(e) => setFormData({ ...formData, eligibility_decision_date: e.target.value })} /></div>
              </div>

              {/* 🔴 منطقة رفع وإدارة الـ PDF في التعديل 🔴 */}
              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-gold)' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Upload size={16} style={{ color: 'var(--accent-gold-dark)' }} />
                  <span>إدارة وثيقة القرار (PDF فقط)</span>
                </label>
                
                {editMode && formData.pdf_path ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="alert alert-success" style={{ margin: 0, padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold' }}>✅ يوجد ملف PDF مرفق حالياً.</span>
                      <a href={`http://localhost:5000${formData.pdf_path}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                        <Eye size={14} style={{ marginRight: '4px' }} /> استعراض
                      </a>
                    </div>
                    <button type="button" className="btn btn-danger" onClick={() => handleDeletePdf(selectedTxId)} style={{ alignSelf: 'flex-start' }}>
                      <Trash2 size={16} /> حذف ملف الـ PDF 
                    </button>
                  </div>
                ) : (
                  <>
                    <input type="file" accept=".pdf" className="form-input" onChange={handleFileChange} style={{ background: '#fff', padding: '8px' }} />
                    {selectedFile && <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--primary-green)', fontWeight: 'bold' }}>ملف مجهز للرفع: {selectedFile.name}</div>}
                    {editMode && !formData.pdf_path && !selectedFile && <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>* لا يوجد وثيقة حالياً، اختر ملفاً للرفع.</div>}
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setModalOpen(false); resetForm(); }}>إلغاء</button>
                <button type="submit" className="btn btn-primary">{editMode ? 'حفظ التعديلات' : 'تسجيل وحفظ'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- نافذة عرض التفاصيل --- */}
      {detailModalOpen && selectedTx && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '800px' }}>
            <div className="card-header">
              <h3 className="card-title">تفاصيل المعاملة: {selectedTx.applicant_name}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={handlePrint} style={{ padding: '8px 12px' }}><Printer size={14} /> طباعة</button>
                <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => { setDetailModalOpen(false); setSelectedTx(null); }}><X size={16} /></button>
              </div>
            </div>
            <div className="card-body">
              <div id="printable-report">
                <div className="card" style={{ marginBottom: '20px' }}>
                  <div className="card-body">
                    <div className="detail-info-grid">
                      <div className="detail-item"><span className="detail-lbl">اسم الطالب</span><span className="detail-val">{selectedTx.applicant_name}</span></div>
                      <div className="detail-item"><span className="detail-lbl">رقم الأرشيف</span><span className="detail-val">{selectedTx.archive_number}</span></div>
                      <div className="detail-item"><span className="detail-lbl">الجامعة</span><span className="detail-val">{selectedTx.university}</span></div>
                      <div className="detail-item"><span className="detail-lbl">رقم المعادلة</span><span className="detail-val">{selectedTx.equivalence_decision_number || '---'}</span></div>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header" style={{ padding: '10px 16px' }}><h4 style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>وثيقة الـ PDF</h4></div>
                  <div className="card-body" style={{ padding: '16px' }}>
                    {selectedTx.pdf_path ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <a href={`http://localhost:5000${selectedTx.pdf_path}`} target="_blank" rel="noreferrer" className="btn btn-primary"><Eye size={16} /> فتح واستعراض</a>
                        <button className="btn btn-danger" onClick={() => handleDeletePdf(selectedTx.id)}><Trash2 size={16} /> حذف الوثيقة</button>
                      </div>
                    ) : (
                      <div className="alert alert-warning"><AlertCircle size={20} /> لا يوجد ملف PDF مرفق. لتتمكن من إضافة ملف، استخدم خيار "تعديل" لهذه المعاملة.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className={`alert alert-${notification.type}`} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, margin: 0 }}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />} {notification.message}
        </div>
      )}
    </div>
  );
}