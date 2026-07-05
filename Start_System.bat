@echo off
echo جاري تشغيل نظام أرشيف مجلس التعليم العالي... الرجاء الانتظار ثواني قليلة.

:: تشغيل الخادم (Backend)
cd server
start "Archive Backend" cmd /k "npm run dev"

:: العودة للمجلد الرئيسي ثم الدخول للواجهة (Frontend)
cd ..
cd client
start "Archive Frontend" cmd /k "npm run dev -- --host"

:: الانتظار 4 ثواني ريثما تعمل الخوادم
timeout /t 4

:: فتح واجهة النظام تلقائياً في متصفح جوجل كروم أو المتصفح الافتراضي
start http://localhost:5173