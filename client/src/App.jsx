import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Search, FilePlus, Upload, FileText, CheckCircle, 
  Clock, AlertCircle, Download, Printer, Eye, Trash2, Edit, Plus, 
  FolderOpen, ChevronRight, ChevronLeft, X, Lock, LogOut, BookOpen
} from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:5000/api`;

const decisionCategories = {
  "أمور عامة": [], 
  "طلاب": ["أمور طلابية عامة", "أمور خاصة بالطلاب"],
  "البحث العلمي": ["طلاب دراسات عليا", "معيدين وموفدين", "أعضاء هيئة تدريسية"],
  "جامعات خاصة": ["عامة", "طلاب"]
};

export default function App() {
  const [userRole, setUserRole] = useState(() => localStorage.getItem('archive_user_role'));
  const [activeSection, setActiveSection] = useState(() => localStorage.getItem('archive_active_section') || 'transactions');
  
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [notification, setNotification] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // ===================== حالات قسم المعادلات =====================
  const [stats, setStats] = useState({ total: 0, withPdf: 0, withoutPdf: 0 });
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchParams, setSearchParams] = useState({ name: '', archive_number: '', university: '' });
  
  const [formData, setFormData] = useState({
    applicant_name: '', archive_number: '', university: '',
    equivalence_decision_number: '', equivalence_decision_date: '',
    eligibility_decision_number: '', eligibility_decision_date: '', pdf_path: ''
  });
  const [editMode, setEditMode] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const limit = 15;

  // ===================== حالات قسم القرارات =====================
  const [decStats, setDecStats] = useState({ total: 0, withPdf: 0, withoutPdf: 0 });
  const [decisions, setDecisions] = useState([]);
  const [decTotalCount, setDecTotalCount] = useState(0);
  const [decOffset, setDecOffset] = useState(0);
  const [decSearchParams, setDecSearchParams] = useState({ decision_number: '', decision_year: '', session_number: '', description: '', main_category: '', sub_category: '' });
  
  const [decFormData, setDecFormData] = useState({
    decision_number: '', decision_year: '', session_number: '', description: '', main_category: '', sub_category: '', pdf_path: ''
  });
  const [decEditMode, setDecEditMode] = useState(false);
  const [decSelectedId, setDecSelectedId] = useState(null);
  const [decModalOpen, setDecModalOpen] = useState(false);
  const [decSelectedTx, setDecSelectedTx] = useState(null);
  const [decDetailModalOpen, setDecDetailModalOpen] = useState(false);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'viewer') {
      if (activeSection === 'transactions') { fetchStats(); fetchTransactions(); }
    }
    if (userRole === 'admin' || userRole === 'decisions_user') {
      if (activeSection === 'decisions') { fetchDecStats(); fetchDecisions(); }
    }
  }, [offset, decOffset, activeSection, userRole]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginForm.username === 'admin' && loginForm.password === '123456') {
      setUserRole('admin'); localStorage.setItem('archive_user_role', 'admin');
      setActiveSection('transactions'); localStorage.setItem('archive_active_section', 'transactions');
      showNotification('تم تسجيل الدخول بصلاحيات الإدارة الكاملة');
    } else if (loginForm.username === 'employee' && loginForm.password === '0000') {
      setUserRole('viewer'); localStorage.setItem('archive_user_role', 'viewer');
      setActiveSection('transactions'); localStorage.setItem('archive_active_section', 'transactions');
      showNotification('تم تسجيل الدخول بصلاحيات الاستعلام فقط');
    } else if (loginForm.username === 'leena' && loginForm.password === '13579') {
      setUserRole('decisions_user'); localStorage.setItem('archive_user_role', 'decisions_user');
      setActiveSection('decisions'); localStorage.setItem('archive_active_section', 'decisions');
      showNotification('تم تسجيل الدخول إلى إدارة القرارات (حساب لينا)');
    } else {
      showNotification('اسم المستخدم أو كلمة المرور غير صحيحة!', 'error');
    }
  };

  const handleLogout = () => {
    setUserRole(null); localStorage.removeItem('archive_user_role');
    setLoginForm({ username: '', password: '' });
    showNotification('تم تسجيل الخروج');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showNotification('حجم الملف كبير جداً! الحد الأقصى 10MB.', 'error'); e.target.value = ''; setSelectedFile(null); return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showNotification('يرجى اختيار ملف بصيغة PDF فقط.', 'error'); e.target.value = ''; setSelectedFile(null); return;
    }
    setSelectedFile(file);
  };

  const switchSection = (section) => {
    setActiveSection(section);
    localStorage.setItem('archive_active_section', section);
  };

  const handlePrint = () => window.print();

  // ==============================================================
  // ------------------ دوال قسم المعادلات -----------------------
  // ==============================================================
  const fetchStats = async () => {
    try { const res = await fetch(`${API_BASE}/stats`); if (res.ok) setStats(await res.json()); } catch (err) {}
  };
  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({ ...searchParams, limit, offset });
      const res = await fetch(`${API_BASE}/transactions?${params.toString()}`);
      if (res.ok) { const data = await res.json(); setTransactions(data.data); setTotalCount(data.total); }
    } catch (err) {}
  };
  const fetchDetails = async (id) => {
    try { const res = await fetch(`${API_BASE}/transactions/${id}`); if (res.ok) setSelectedTx(await res.json()); } catch (err) {}
  };

  const handleSearchSubmit = (e) => { e.preventDefault(); setOffset(0); fetchTransactions(); };
  const handleSearchReset = () => { setSearchParams({ name: '', archive_number: '', university: '' }); setOffset(0); setTimeout(fetchTransactions, 50); };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (userRole !== 'admin') return;
    if (!formData.applicant_name || !formData.archive_number || !formData.university) {
      showNotification('الاسم، رقم الأرشيف، واسم الجامعة هي حقول إلزامية!', 'error'); return;
    }
    try {
      const url = editMode ? `${API_BASE}/transactions/${selectedTxId}` : `${API_BASE}/transactions`;
      const res = await fetch(url, { method: editMode ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (res.ok) {
        const txId = editMode ? selectedTxId : data.id;
        if (selectedFile) {
          const fileData = new FormData(); fileData.append('archive_number', formData.archive_number); fileData.append('applicant_name', formData.applicant_name); fileData.append('equivalence_decision_date', formData.equivalence_decision_date); fileData.append('file', selectedFile);
          await fetch(`${API_BASE}/transactions/${txId}/upload`, { method: 'POST', body: fileData });
        }
        showNotification(editMode ? 'تم التحديث بنجاح' : 'تم التسجيل بنجاح');
        setModalOpen(false); resetForm(); fetchStats(); fetchTransactions();
      } else { showNotification(data.message, 'error'); }
    } catch (err) { showNotification('خطأ في الاتصال', 'error'); }
  };

  const handleDeletePdf = async (id) => {
    if (userRole !== 'admin' || !window.confirm('هل أنت متأكد من رغبتك في حذف ملف الـ PDF الحالي نهائياً؟')) return;
    try {
      const res = await fetch(`${API_BASE}/transactions/${id}/pdf`, { method: 'DELETE' });
      if (res.ok) { showNotification('تم حذف الملف'); setFormData({ ...formData, pdf_path: null }); setSelectedFile(null); if (selectedTx && selectedTx.id === id) fetchDetails(id); fetchStats(); fetchTransactions(); }
    } catch (err) {}
  };

  const handleDeleteClick = async (id) => {
    if (userRole !== 'admin' || !window.confirm('هل أنت متأكد من رغبتك في حذف هذه المعاملة والملف المرتبط بها نهائياً؟')) return;
    try {
      const res = await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) { showNotification('تم الحذف'); fetchStats(); fetchTransactions(); }
    } catch (err) {}
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams(searchParams);
    window.location.href = `${API_BASE}/export/csv?${params.toString()}`;
    showNotification('جاري تحميل تقرير المعادلات بصيغة Excel...');
  };

  const resetForm = () => {
    setFormData({ applicant_name: '', archive_number: '', university: '', equivalence_decision_number: '', equivalence_decision_date: '', eligibility_decision_number: '', eligibility_decision_date: '', pdf_path: '' });
    setSelectedFile(null); setEditMode(false); setSelectedTxId(null);
  };
  const handleEditClick = (row) => { setFormData(row); setSelectedTxId(row.id); setSelectedFile(null); setEditMode(true); setModalOpen(true); };


  // ==============================================================
  // ------------------ دوال قسم القرارات (لينا) -------------------
  // ==============================================================
  const fetchDecStats = async () => {
    try { const res = await fetch(`${API_BASE}/decisions/stats`); if (res.ok) setDecStats(await res.json()); } catch (err) {}
  };
  const fetchDecisions = async () => {
    try {
      const params = new URLSearchParams({ ...decSearchParams, limit, offset: decOffset });
      const res = await fetch(`${API_BASE}/decisions?${params.toString()}`);
      if (res.ok) { const data = await res.json(); setDecisions(data.data); setDecTotalCount(data.total); }
    } catch (err) {}
  };
  const fetchDecDetails = async (id) => {
    try { const res = await fetch(`${API_BASE}/decisions/${id}`); if (res.ok) setDecSelectedTx(await res.json()); } catch (err) {}
  };

  const handleDecSearchSubmit = (e) => { e.preventDefault(); setDecOffset(0); fetchDecisions(); };
  const handleDecSearchReset = () => { setDecSearchParams({ decision_number: '', decision_year: '', session_number: '', description: '', main_category: '', sub_category: '' }); setDecOffset(0); setTimeout(fetchDecisions, 50); };

  const handleDecExportCSV = () => {
    const params = new URLSearchParams(decSearchParams);
    window.location.href = `${API_BASE}/decisions/export/csv?${params.toString()}`;
    showNotification('جاري تحميل تقرير القرارات بصيغة Excel...');
  };

  const handleDecFormSubmit = async (e) => {
    e.preventDefault();
    if (userRole !== 'admin' && userRole !== 'decisions_user') return;
    
    if (decFormData.main_category && decisionCategories[decFormData.main_category].length > 0 && !decFormData.sub_category) {
       showNotification('يرجى اختيار التصنيف الفرعي!', 'error');
       return;
    }

    try {
      const url = decEditMode ? `${API_BASE}/decisions/${decSelectedId}` : `${API_BASE}/decisions`;
      const res = await fetch(url, { method: decEditMode ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decFormData) });
      const data = await res.json();
      if (res.ok) {
        const txId = decEditMode ? decSelectedId : data.id;
        if (selectedFile) {
          const fileData = new FormData(); 
          fileData.append('decision_number', decFormData.decision_number); 
          fileData.append('decision_year', decFormData.decision_year); 
          fileData.append('session_number', decFormData.session_number); 
          fileData.append('main_category', decFormData.main_category); 
          fileData.append('file', selectedFile);
          
          await fetch(`${API_BASE}/decisions/${txId}/upload`, { method: 'POST', body: fileData });
        }
        showNotification(decEditMode ? 'تم تحديث القرار بنجاح' : 'تم تسجيل القرار بنجاح');
        setDecModalOpen(false); resetDecForm(); fetchDecStats(); fetchDecisions();
      } else { showNotification(data.message, 'error'); }
    } catch (err) { showNotification('خطأ في الاتصال', 'error'); }
  };

  const handleDecDeletePdf = async (id) => {
    if (!window.confirm('حذف ملف الـ PDF الخاص بالقرار نهائياً؟')) return;
    try {
      const res = await fetch(`${API_BASE}/decisions/${id}/pdf`, { method: 'DELETE' });
      if (res.ok) { showNotification('تم حذف وثيقة القرار'); setDecFormData({ ...decFormData, pdf_path: null }); setSelectedFile(null); fetchDecStats(); fetchDecisions(); }
    } catch (err) {}
  };

  const handleDecDeleteClick = async (id) => {
    if (!window.confirm('حذف هذا القرار نهائياً؟')) return;
    try {
      const res = await fetch(`${API_BASE}/decisions/${id}`, { method: 'DELETE' });
      if (res.ok) { showNotification('تم الحذف'); fetchDecStats(); fetchDecisions(); }
    } catch (err) {}
  };

  const resetDecForm = () => {
    setDecFormData({ decision_number: '', decision_year: '', session_number: '', description: '', main_category: '', sub_category: '', pdf_path: '' });
    setSelectedFile(null); setDecEditMode(false); setDecSelectedId(null);
  };
  
  const handleDecEditClick = (row) => { 
    setDecFormData({
      decision_number: row.decision_number || '', decision_year: row.decision_year || '', 
      session_number: row.session_number || '', description: row.description || '', 
      main_category: row.main_category || '', sub_category: row.sub_category || '', 
      pdf_path: row.pdf_path || ''
    }); 
    setDecSelectedId(row.id); setSelectedFile(null); setDecEditMode(true); setDecModalOpen(true); 
  };


  // ===================== شاشة تسجيل الدخول =====================
  if (!userRole) {
    return (
      <div className="login-container">
        <form onSubmit={handleLoginSubmit} className="login-card">
          <img src="/logo2.png" alt="وزارة التعليم العالي" className="login-logo" onError={(e) => e.target.style.display='none'} />
          <h1 className="login-title">أرشيف مجلس التعليم العالي</h1>
          <p className="login-subtitle">نظام الإدارة الموحد للقرارات والمعادلات</p>
          <div className="form-group"><label className="form-label">اسم المستخدم</label><input type="text" className="form-input" required value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">كلمة المرور</label><input type="password" className="form-input" required value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} /></div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px', padding: '14px' }}><Lock size={18} /> دخول للنظام</button>
        </form>
        {notification && <div className={`alert alert-${notification.type}`} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, margin: 0 }}>{notification.message}</div>}
      </div>
    );
  }

  // ===================== الواجهة الرئيسية =====================
  return (
    <div className="app-container">
      {/* القائمة الجانبية */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logo2.png" alt="شعار" className="sidebar-logo" onError={(e) => e.target.style.display='none'} />
          <div><h2 className="sidebar-title">أرشيف المجلس</h2><p className="sidebar-subtitle">
            {userRole === 'admin' ? 'المدير العام' : userRole === 'decisions_user' ? 'إدارة القرارات (لينا)' : 'نافذة الاستعلام'}
          </p></div>
        </div>

        <ul className="sidebar-menu">
          {/* قسم المعادلات */}
          {(userRole === 'admin' || userRole === 'viewer') && (
            <>
              <li style={{ padding: '10px 16px', fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 'bold', marginTop: '10px' }}>أرشيف المعادلات</li>
              <li><div className={`sidebar-item ${activeSection === 'transactions' ? 'active' : ''}`} onClick={() => switchSection('transactions')}><LayoutDashboard size={20} /> <span>استعراض المعادلات</span></div></li>
              {userRole === 'admin' && <li><div className="sidebar-item" onClick={() => { resetForm(); switchSection('transactions'); setModalOpen(true); }}><FilePlus size={20} /> <span>إضافة معاملة جديدة</span></div></li>}
            </>
          )}

          {/* قسم القرارات */}
          {(userRole === 'admin' || userRole === 'decisions_user') && (
            <>
              <li style={{ padding: '10px 16px', fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 'bold', marginTop: '10px' }}>أرشيف القرارات</li>
              <li><div className={`sidebar-item ${activeSection === 'decisions' ? 'active' : ''}`} onClick={() => switchSection('decisions')}><BookOpen size={20} /> <span>استعراض القرارات</span></div></li>
              {(userRole === 'admin' || userRole === 'decisions_user') && <li><div className="sidebar-item" onClick={() => { resetDecForm(); switchSection('decisions'); setDecModalOpen(true); }}><FilePlus size={20} /> <span>إضافة قرار جديد</span></div></li>}
            </>
          )}
        </ul>
        <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none' }}><LogOut size={16} /> تسجيل الخروج</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="navbar">
          <h1 className="page-title">{activeSection === 'transactions' ? 'لوحة التحكم وأرشفة المعاملات' : 'إدارة وأرشفة قرارات مجلس التعليم العالي'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: userRole === 'admin' ? 'var(--primary-green)' : '#888' }}>
              مرحباً: {userRole === 'admin' ? 'المدير' : userRole === 'decisions_user' ? 'لينا (القرارات)' : 'موظف الأرشيف'}
            </span>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
              <LogOut size={14} /> خروج
            </button>
          </div>
        </header>

        {/* -------------------------------------------------------------
            شاشة المعادلات
        ------------------------------------------------------------- */}
        {activeSection === 'transactions' && (
          <div className="dashboard-grid fade-in">
            <div className="stats-row">
              <div className="stat-card"><div className="stat-info"><span className="stat-val">{stats.total}</span><span className="stat-lbl">إجمالي المعاملات</span></div><div className="stat-icon-wrapper"><FolderOpen size={24} /></div></div>
              <div className="stat-card archived"><div className="stat-info"><span className="stat-val">{stats.withPdf}</span><span className="stat-lbl">مؤرشفة رقمياً (PDF)</span></div><div className="stat-icon-wrapper"><CheckCircle size={24} /></div></div>
              <div className="stat-card pending"><div className="stat-info"><span className="stat-val">{stats.withoutPdf}</span><span className="stat-lbl">غير مؤرشفة رقمياً</span></div><div className="stat-icon-wrapper"><Clock size={24} /></div></div>
            </div>

            <form onSubmit={handleSearchSubmit} className="search-box">
              <div className="search-grid">
                <div className="form-group"><label className="form-label">اسم الطالب</label><input type="text" className="form-input" placeholder="ابحث بالاسم..." value={searchParams.name} onChange={(e) => setSearchParams({ ...searchParams, name: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">رقم الأرشيف</label><input type="text" className="form-input" placeholder="ابحث برقم الأرشيف..." value={searchParams.archive_number} onChange={(e) => setSearchParams({ ...searchParams, archive_number: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">الجامعة</label><input type="text" className="form-input" placeholder="ابحث بالجامعة..." value={searchParams.university} onChange={(e) => setSearchParams({ ...searchParams, university: e.target.value })} /></div>
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
                {userRole === 'admin' && <button className="btn btn-primary" onClick={() => { resetForm(); setModalOpen(true); }} style={{ padding: '8px 16px' }}><Plus size={16} /> إضافة معاملة</button>}
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="data-table">
                    <thead><tr><th>رقم الأرشيف</th><th>اسم الطالب</th><th>الجامعة</th><th>رقم القرار</th><th>تاريخ القرار</th><th>الملف</th><th style={{ width: '220px' }}>الإجراءات</th></tr></thead>
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
                              {row.pdf_path && row.pdf_path !== '' ? <a href={`http://${window.location.hostname}:5000${row.pdf_path}`} target="_blank" rel="noreferrer" className="badge badge-archived" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}><FileText size={12} /> عرض</a> : <span className="badge badge-reviewer" style={{ background: '#fef2f2', color: '#ef4444', border: 'none' }}>غير مرفوع</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => { fetchDetails(row.id); setDetailModalOpen(true); }}><Eye size={12} /> عرض</button>
                                {userRole === 'admin' && (
                                  <>
                                    <button className="btn btn-accent" style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#fff' }} onClick={() => handleEditClick(row)}><Edit size={12} /> تعديل</button>
                                    <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleDeleteClick(row.id)}><Trash2 size={12} /> حذف</button>
                                  </>
                                )}
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
        )}

        {/* -------------------------------------------------------------
            شاشة القرارات
        ------------------------------------------------------------- */}
        {activeSection === 'decisions' && (
          <div className="dashboard-grid fade-in">
            <div className="stats-row">
              <div className="stat-card"><div className="stat-info"><span className="stat-val">{decStats.total}</span><span className="stat-lbl">إجمالي القرارات</span></div><div className="stat-icon-wrapper"><BookOpen size={24} /></div></div>
              <div className="stat-card archived"><div className="stat-info"><span className="stat-val">{decStats.withPdf}</span><span className="stat-lbl">مؤرشفة رقمياً (PDF)</span></div><div className="stat-icon-wrapper"><CheckCircle size={24} /></div></div>
              <div className="stat-card pending"><div className="stat-info"><span className="stat-val">{decStats.withoutPdf}</span><span className="stat-lbl">غير مؤرشفة رقمياً</span></div><div className="stat-icon-wrapper"><Clock size={24} /></div></div>
            </div>

            {/* 🔴 تم إعادة شريط البحث (الفلترة) ليكون منسجماً مع التصميم الأصلي */}
            <form onSubmit={handleDecSearchSubmit} className="search-box">
              <div className="search-grid">
                <div className="form-group"><label className="form-label">رقم القرار</label><input type="text" className="form-input" value={decSearchParams.decision_number} onChange={(e) => setDecSearchParams({ ...decSearchParams, decision_number: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">سنة القرار</label><input type="text" className="form-input" placeholder="مثال: 2026" value={decSearchParams.decision_year} onChange={(e) => setDecSearchParams({ ...decSearchParams, decision_year: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">رقم الجلسة</label><input type="text" className="form-input" value={decSearchParams.session_number} onChange={(e) => setDecSearchParams({ ...decSearchParams, session_number: e.target.value })} /></div>
                
                <div className="form-group">
                  <label className="form-label">التصنيف الرئيسي</label>
                  <select className="form-input" value={decSearchParams.main_category} onChange={(e) => setDecSearchParams({ ...decSearchParams, main_category: e.target.value, sub_category: '' })}>
                    <option value="">-- الكل --</option>
                    {Object.keys(decisionCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                {decSearchParams.main_category && decisionCategories[decSearchParams.main_category].length > 0 && (
                  <div className="form-group">
                    <label className="form-label">التصنيف الفرعي</label>
                    <select className="form-input" value={decSearchParams.sub_category} onChange={(e) => setDecSearchParams({ ...decSearchParams, sub_category: e.target.value })}>
                      <option value="">-- الكل --</option>
                      {decisionCategories[decSearchParams.main_category].map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                  </div>
                )}
                
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">بحث بكلمة من الوصف أو الموضوع</label><input type="text" className="form-input" value={decSearchParams.description} onChange={(e) => setDecSearchParams({ ...decSearchParams, description: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleDecSearchReset}>تفريغ الفلاتر</button>
                <button type="submit" className="btn btn-primary"><Search size={16} /> بحث وتصفية</button>
                <button type="button" className="btn btn-accent" onClick={handleDecExportCSV}><Download size={16} /> تصدير Excel</button>
              </div>
            </form>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">سجلات قرارات المجلس المتاحة ({decTotalCount} سجل)</h3>
                <button className="btn btn-primary" onClick={() => { resetDecForm(); setDecModalOpen(true); }} style={{ padding: '8px 16px' }}><Plus size={16} /> إضافة قرار جديد</button>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="data-table">
                    <thead><tr><th>رقم القرار</th><th>السنة</th><th>رقم الجلسة</th><th>التصنيف</th><th>الموضوع / الوصف</th><th>الوثيقة</th><th style={{ width: '220px' }}>الإجراءات</th></tr></thead>
                    <tbody>
                      {decisions.length > 0 ? (
                        decisions.map((row) => (
                          <tr key={row.id}>
                            <td style={{ fontWeight: 'bold' }}>{row.decision_number}</td>
                            <td>{row.decision_year}</td>
                            <td>{row.session_number}</td>
                            <td>
                              <div style={{ fontSize: '0.85rem' }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--primary-green)' }}>{row.main_category || '---'}</div>
                                {row.sub_category && <div style={{ color: '#666' }}>{row.sub_category}</div>}
                              </div>
                            </td>
                            <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.description}</td>
                            <td>
                              {row.pdf_path && row.pdf_path !== '' ? <a href={`http://${window.location.hostname}:5000${row.pdf_path}`} target="_blank" rel="noreferrer" className="badge badge-archived" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}><FileText size={12} /> عرض</a> : <span className="badge badge-reviewer" style={{ background: '#fef2f2', color: '#ef4444', border: 'none' }}>بدون مرفق</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => { fetchDecDetails(row.id); setDetailModalOpen(true); }}><Eye size={12} /> عرض</button>
                                <button className="btn btn-accent" style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#fff' }} onClick={() => handleDecEditClick(row)}><Edit size={12} /> تعديل</button>
                                <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleDecDeleteClick(row.id)}><Trash2 size={12} /> حذف</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>لا توجد قرارات مسجلة.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {decTotalCount > limit && (
                  <div className="pagination">
                    <button className="btn btn-secondary" disabled={decOffset === 0} onClick={() => setOffset(Math.max(0, decOffset - limit))}><ChevronRight size={16} /> السابق</button>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>عرض {decOffset + 1} - {Math.min(decOffset + limit, decTotalCount)} من أصل {decTotalCount}</span>
                    <button className="btn btn-secondary" disabled={decOffset + limit >= decTotalCount} onClick={() => setOffset(decOffset + limit)}>التالي <ChevronLeft size={16} /></button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* -------------------------------------------------------------
          نوافذ المودال (للقرارات والمعادلات)
      ------------------------------------------------------------- */}
      
      {/* 1. مودال إضافة/تعديل القرارات */}
      {decModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '700px' }}>
            <div className="card-header"><h3 className="card-title">{decEditMode ? 'تعديل بيانات القرار' : 'إضافة قرار مجلس جديد'}</h3><button className="btn btn-secondary" onClick={() => setDecModalOpen(false)}><X size={16} /></button></div>
            <form onSubmit={handleDecFormSubmit} className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* 🔴 الصف الأول: رقم القرار والسنة */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">رقم القرار (إلزامي)</label><input type="text" className="form-input" required value={decFormData.decision_number} onChange={(e) => setDecFormData({ ...decFormData, decision_number: e.target.value })} /></div>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">سنة القرار (إلزامي)</label><input type="number" className="form-input" required value={decFormData.decision_year} onChange={(e) => setDecFormData({ ...decFormData, decision_year: e.target.value })} /></div>
              </div>
              
              {/* 🔴 الصف الثاني: الجلسة والتصنيفات في نفس السطر (بقي التعديل الأنيق هنا فقط) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">رقم الجلسة</label><input type="text" className="form-input" value={decFormData.session_number} onChange={(e) => setDecFormData({ ...decFormData, session_number: e.target.value })} /></div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">التصنيف الرئيسي (إلزامي)</label>
                  <select className="form-input" required value={decFormData.main_category} onChange={(e) => setDecFormData({ ...decFormData, main_category: e.target.value, sub_category: '' })}>
                    <option value="">-- اختر التصنيف --</option>
                    {Object.keys(decisionCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">التصنيف الفرعي</label>
                  {decFormData.main_category && decisionCategories[decFormData.main_category].length > 0 ? (
                    <select className="form-input" required value={decFormData.sub_category} onChange={(e) => setDecFormData({ ...decFormData, sub_category: e.target.value })}>
                      <option value="">-- اختر الفرع --</option>
                      {decisionCategories[decFormData.main_category].map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                  ) : (
                    <select className="form-input" disabled style={{ backgroundColor: '#f3f4f6', color: '#9ca3af' }}>
                      <option>-- لا يوجد فروع --</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">موضوع أو وصف القرار</label><textarea className="form-input" rows="3" required value={decFormData.description} onChange={(e) => setDecFormData({ ...decFormData, description: e.target.value })}></textarea></div>
              
              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-gold)' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><Upload size={16} style={{ color: 'var(--accent-gold-dark)' }}/><span>إرفاق وثيقة القرار (PDF)</span></label>
                {decEditMode && decFormData.pdf_path && decFormData.pdf_path !== '' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="alert alert-success" style={{ margin: 0, padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 'bold' }}>✅ يوجد ملف PDF مرفق لهذا القرار حالياً.</span></div>
                    <button type="button" className="btn btn-danger" onClick={() => handleDecDeletePdf(decSelectedId)} style={{ alignSelf: 'flex-start' }}><Trash2 size={16} /> حذف الملف المرفق</button>
                  </div>
                ) : (
                  <><input type="file" accept=".pdf" className="form-input" onChange={handleFileChange} style={{ background: '#fff', padding: '8px' }} />{selectedFile && <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--primary-green)', fontWeight: 'bold' }}>ملف جاهز للرفع: {selectedFile.name}</div>}</>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}><button type="button" className="btn btn-secondary" onClick={() => setDecModalOpen(false)}>إلغاء</button><button type="submit" className="btn btn-primary">{decEditMode ? 'حفظ التعديلات' : 'تسجيل وحفظ'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* 2. مودال عرض تفاصيل القرارات */}
      {decDetailModalOpen && decSelectedTx && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '800px' }}>
            <div className="card-header"><h3 className="card-title">تفاصيل قرار رقم: {decSelectedTx.decision_number}</h3><button className="btn btn-secondary" onClick={() => setDecDetailModalOpen(false)}><X size={16} /></button></div>
            <div className="card-body">
              <div className="detail-info-grid" style={{ marginBottom: '20px' }}>
                <div className="detail-item"><span className="detail-lbl">رقم القرار</span><span className="detail-val">{decSelectedTx.decision_number}</span></div>
                <div className="detail-item"><span className="detail-lbl">السنة</span><span className="detail-val">{decSelectedTx.decision_year}</span></div>
                <div className="detail-item"><span className="detail-lbl">الجلسة</span><span className="detail-val">{decSelectedTx.session_number || '---'}</span></div>
                <div className="detail-item"><span className="detail-lbl">التصنيف الرئيسي</span><span className="detail-val">{decSelectedTx.main_category || '---'}</span></div>
                <div className="detail-item"><span className="detail-lbl">التصنيف الفرعي</span><span className="detail-val">{decSelectedTx.sub_category || '---'}</span></div>
                
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}><span className="detail-lbl">الموضوع والوصف</span><span className="detail-val" style={{ whiteSpace: 'pre-wrap' }}>{decSelectedTx.description}</span></div>
              </div>
              <div className="card">
                <div className="card-header" style={{ padding: '10px 16px' }}><h4 style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>وثيقة الـ PDF</h4></div>
                <div className="card-body" style={{ padding: '16px' }}>
                  {decSelectedTx.pdf_path && decSelectedTx.pdf_path !== '' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><a href={`http://${window.location.hostname}:5000${decSelectedTx.pdf_path}`} target="_blank" rel="noreferrer" className="btn btn-primary"><Eye size={16} /> فتح واستعراض وثيقة القرار</a></div>
                  ) : <div className="alert alert-warning"><AlertCircle size={20} /> لا يوجد ملف PDF مرفق لهذا القرار.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. مودال إضافة/تعديل المعادلات */}
      {modalOpen && userRole === 'admin' && (
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

              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-gold)' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Upload size={16} style={{ color: 'var(--accent-gold-dark)' }} />
                  <span>إدارة وثيقة المعادلة (PDF فقط)</span>
                </label>
                
                {editMode && formData.pdf_path && formData.pdf_path !== '' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="alert alert-success" style={{ margin: 0, padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold' }}>✅ يوجد ملف PDF مرفق حالياً.</span>
                      <a href={`http://${window.location.hostname}:5000${formData.pdf_path}`} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
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
                    {editMode && (!formData.pdf_path || formData.pdf_path === '') && !selectedFile && <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>* لا يوجد وثيقة حالياً، اختر ملفاً للرفع.</div>}
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

      {/* 4. مودال عرض تفاصيل المعادلات */}
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
                      <div className="detail-item"><span className="detail-lbl">تاريخ المعادلة</span><span className="detail-val">{selectedTx.equivalence_decision_date || '---'}</span></div>
                      <div className="detail-item"><span className="detail-lbl">رقم قرار الأهلية</span><span className="detail-val">{selectedTx.eligibility_decision_number || '---'}</span></div>
                      <div className="detail-item"><span className="detail-lbl">تاريخ قرار الأهلية</span><span className="detail-val">{selectedTx.eligibility_decision_date || '---'}</span></div>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header" style={{ padding: '10px 16px' }}><h4 style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>وثيقة الـ PDF</h4></div>
                  <div className="card-body" style={{ padding: '16px' }}>
                    {selectedTx.pdf_path && selectedTx.pdf_path !== '' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <a href={`http://${window.location.hostname}:5000${selectedTx.pdf_path}`} target="_blank" rel="noreferrer" className="btn btn-primary"><Eye size={16} /> فتح واستعراض</a>
                        {userRole === 'admin' && (
                          <button className="btn btn-danger" onClick={() => handleDeletePdf(selectedTx.id)}><Trash2 size={16} /> حذف الوثيقة</button>
                        )}
                      </div>
                    ) : (
                      <div className="alert alert-warning"><AlertCircle size={20} /> لا يوجد ملف PDF مرفق. {userRole === 'admin' && 'لتتمكن من إضافة ملف، استخدم خيار "تعديل" لهذه المعاملة.'}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {notification && <div className={`alert alert-${notification.type}`} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, margin: 0 }}>{notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />} {notification.message}</div>}
    </div>
  );
}