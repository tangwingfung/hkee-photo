const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// 在雲端環境中使用 /tmp 目錄來存放檔案，這是允許寫入的。
const uploadDir = '/tmp/uploads';
const logDir = '/tmp/logs';

// 確保資料夾存在
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// 建立日誌資料夾
const logDir = './logs';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

// 日誌檔案路徑（每天一個檔案）
const getLogFilePath = () => {
    const today = new Date().toISOString().slice(0, 8); // YYYY-MM-DD
    return path.join(logDir, `phone-${today}.log`);
};

// 記錄電話號碼到日誌檔案
function logPhoneNumber(phone, ip, userAgent) {
    const logFile = getLogFilePath();
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const logEntry = `[${timestamp}] 電話: ${phone} | IP: ${ip} | 裝置: ${userAgent}\n`;
    
    fs.appendFile(logFile, logEntry, (err) => {
        if (err) {
            console.error('寫入日誌失敗:', err);
        } else {
            console.log('📝 已記錄電話:', phone);
        }
    });
}

// 設定照片儲存方式
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 10000) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// 中間件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// 儲存照片資料的陣列
let photos = [];

// ========== API 路由 ==========

// 記錄電話號碼（不驗證，直接記錄）
app.post('/api/log-phone', (req, res) => {
    const { phone } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '未知';
    
    console.log('收到電話記錄請求, 電話:', phone, 'IP:', ip);
    
    if (!phone) {
        return res.status(400).json({ success: false, error: '請輸入手機號碼' });
    }
    
    // 記錄到日誌檔案
    logPhoneNumber(phone, ip, userAgent);
    
    // 直接回傳成功，不進行驗證
    res.json({ success: true, message: '已記錄' });
});

// 獲取所有照片
app.get('/api/photos', (req, res) => {
    console.log('GET /api/photos - 返回照片數量:', photos.length);
    res.json({ success: true, photos });
});

// 上傳照片
app.post('/api/upload', upload.array('photos', 30), (req, res) => {
    console.log('收到上傳請求, 檔案數量:', req.files?.length);
    
    const files = req.files;
    if (!files || files.length === 0) {
        console.log('沒有接收到檔案');
        return res.status(400).json({ success: false, error: '沒有上傳檔案' });
    }

    const newPhotos = [];
    for (const file of files) {
        const photo = {
            id: Date.now() + Math.random(),
            filename: file.filename,
            originalName: file.originalname,
            title: file.originalname.replace(/\.[^/.]+$/, '').substring(0, 20),
            desc: `上傳於 ${new Date().toLocaleString()}`,
            url: `/uploads/${file.filename}`,
            uploadDate: new Date()
        };
        newPhotos.push(photo);
        photos.unshift(photo);
        console.log('儲存照片:', photo.filename);
    }

    res.json({ success: true, photos: newPhotos });
});

// 刪除單張照片
app.delete('/api/photos/:id', (req, res) => {
    const id = parseFloat(req.params.id);
    const photoIndex = photos.findIndex(p => p.id === id);

    if (photoIndex === -1) {
        return res.status(404).json({ success: false, error: '照片不存在' });
    }

    const photo = photos[photoIndex];
    const filePath = path.join(uploadDir, photo.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('刪除檔案:', photo.filename);
    }

    photos.splice(photoIndex, 1);
    res.json({ success: true });
});

// 清空所有照片
app.delete('/api/photos', (req, res) => {
    const { password } = req.body;
    console.log('收到清空請求, 密碼:', password);
    
    if (password !== '23939955') {
        console.log('密碼錯誤');
        return res.status(401).json({ success: false, error: '密碼錯誤' });
    }

    for (const photo of photos) {
        const filePath = path.join(uploadDir, photo.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    photos = [];
    console.log('已清空所有照片');
    res.json({ success: true });
});


// 只在本地開發時監聽埠號
if (process.env.NODE_ENV !== 'production') {
    // 修改前可能是 app.listen(PORT, ...)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 伺服器啟動成功！`);
    console.log(`📁 照片會儲存在: ${uploadDir}`);
    // ... 其他 console.log
});

// 匯出 app 給 Vercel 使用
module.exports = app;
