const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Render 可以使用一般目錄
const uploadDir = './uploads';
const logDir = './logs';

// 確保目錄存在
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

console.log('✅ uploads 目錄:', uploadDir);
console.log('✅ logs 目錄:', logDir);

// 日誌功能
const getLogFilePath = () => {
    const today = new Date().toISOString().slice(0, 10);
    return path.join(logDir, `phone-${today}.log`);
};

function logPhoneNumber(phone, ip, userAgent) {
    const logFile = getLogFilePath();
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const logEntry = `[${timestamp}] 電話: ${phone} | IP: ${ip} | 裝置: ${userAgent}\n`;
    fs.appendFileSync(logFile, logEntry);
    console.log('📝 已記錄電話:', phone);
}

// 照片儲存設定
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
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
app.use('/uploads', express.static(uploadDir));

// 儲存照片的陣列
let photos = [];

// 載入已存在的照片
if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            photos.push({
                id: Date.now() + Math.random() * files.indexOf(file),
                filename: file,
                title: file.replace(/\.[^/.]+$/, '').substring(0, 20),
                desc: '現有照片',
                url: `/uploads/${file}`,
                uploadDate: new Date()
            });
        }
    }
    console.log(`📸 載入 ${photos.length} 張現有照片`);
}

// ========== 測試路由 ==========
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Render 伺服器正常運作！' });
});

// ========== API 路由 ==========

app.post('/api/log-phone', (req, res) => {
    const { phone } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '未知';
    const userAgent = req.headers['user-agent'] || '未知';
    
    console.log('📞 收到電話:', phone);
    
    if (!phone) {
        return res.status(400).json({ success: false, error: '請輸入手機號碼' });
    }
    if (!/^\d{8}$/.test(phone)) {
        return res.status(400).json({ success: false, error: '請輸入正確的 8 位數字' });
    }
    
    logPhoneNumber(phone, ip, userAgent);
    res.json({ success: true, message: '已記錄' });
});

app.get('/api/photos', (req, res) => {
    console.log('📸 返回照片數量:', photos.length);
    res.json({ success: true, photos });
});

app.post('/api/upload', upload.array('photos', 30), (req, res) => {
    const files = req.files;
    console.log('📤 上傳請求, 檔案數量:', files?.length);
    
    if (!files || files.length === 0) {
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
        console.log('✅ 儲存照片:', file.filename);
    }
    
    res.json({ success: true, photos: newPhotos });
});

app.delete('/api/photos/:id', (req, res) => {
    const id = parseFloat(req.params.id);
    const photoIndex = photos.findIndex(p => p.id === id);
    if (photoIndex === -1) {
        return res.status(404).json({ success: false, error: '照片不存在' });
    }
    
    // 刪除實體檔案
    const photo = photos[photoIndex];
    const filePath = path.join(uploadDir, photo.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    
    photos.splice(photoIndex, 1);
    console.log('🗑️ 刪除照片:', photo.filename);
    res.json({ success: true });
});

app.delete('/api/photos', (req, res) => {
    const { password } = req.body;
    if (password !== '1234') {
        return res.status(401).json({ success: false, error: '密碼錯誤' });
    }
    
    // 刪除所有實體檔案
    for (const photo of photos) {
        const filePath = path.join(uploadDir, photo.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    
    photos = [];
    console.log('🗑️ 清空所有照片');
    res.json({ success: true });
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Render 伺服器啟動成功！`);
    console.log(`🌐 端口: ${PORT}`);
    console.log(`📁 照片儲存: ${path.resolve(uploadDir)}`);
    console.log(`📝 日誌儲存: ${path.resolve(logDir)}`);
});
