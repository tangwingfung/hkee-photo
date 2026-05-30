const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Cloudinary 設定 ==========
// 請將這三個值換成你自己的！
cloudinary.config({
    cloud_name: 'difjrdigs',     // 例如: 'dxm8nzxtr'
    api_key: '235722732873395',          // 例如: '123456789012345'
    api_secret: 'BRY7vZ2cCV66us-WWmKLHK3cDoc'     // 例如: 'abc123def456ghi789'
});

// ========== 使用記憶體儲存（直接上傳到 Cloudinary）==========
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

// 中間件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 儲存照片資訊的陣列（只存 Cloudinary URL）
let photos = [];

// ========== 日誌功能 ==========
const logDir = '/tmp/logs';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

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

// ========== 測試路由 ==========
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Render + Cloudinary 正常運作！' });
});

// ========== 電話記錄 ==========
app.post('/api/log-phone', (req, res) => {
    const { phone } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '未知';
    const userAgent = req.headers['user-agent'] || '未知';
    
    if (!phone) {
        return res.status(400).json({ success: false, error: '請輸入手機號碼' });
    }
    if (!/^\d{8}$/.test(phone)) {
        return res.status(400).json({ success: false, error: '請輸入正確的 8 位數字' });
    }
    
    logPhoneNumber(phone, ip, userAgent);
    res.json({ success: true });
});

// ========== 照片 API（使用 Cloudinary）==========

// 獲取所有照片
app.get('/api/photos', (req, res) => {
    console.log('📸 返回照片數量:', photos.length);
    res.json({ success: true, photos });
});

// 上傳照片到 Cloudinary
app.post('/api/upload', upload.array('photos', 30), async (req, res) => {
    const files = req.files;
    console.log('📤 上傳請求, 檔案數量:', files?.length);
    
    if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: '沒有上傳檔案' });
    }

    const newPhotos = [];
    
    for (const file of files) {
        try {
            // 將檔案轉換為 base64
            const base64 = file.buffer.toString('base64');
            const dataUri = `data:${file.mimetype};base64,${base64}`;
            
            console.log('☁️ 上傳到 Cloudinary...');
            
            // 上傳到 Cloudinary
            const result = await cloudinary.uploader.upload(dataUri, {
                folder: 'photo_album',
                transformation: [
                    { width: 800, height: 800, crop: 'limit' }
                ]
            });
            
            console.log('✅ Cloudinary 上傳成功:', result.secure_url);
            
            const photo = {
                id: Date.now() + Math.random(),
                public_id: result.public_id,
                title: file.originalname.replace(/\.[^/.]+$/, '').substring(0, 20),
                desc: `上傳於 ${new Date().toLocaleString()}`,
                url: result.secure_url,
                uploadDate: new Date()
            };
            newPhotos.push(photo);
            photos.unshift(photo);
            
        } catch (err) {
            console.error('❌ Cloudinary 上傳失敗:', err);
        }
    }
    
    if (newPhotos.length === 0) {
        return res.status(500).json({ success: false, error: '上傳失敗' });
    }
    
    res.json({ success: true, photos: newPhotos });
});

// 刪除單張照片（同時從 Cloudinary 刪除）
app.delete('/api/photos/:id', async (req, res) => {
    const id = parseFloat(req.params.id);
    const photoIndex = photos.findIndex(p => p.id === id);
    
    if (photoIndex === -1) {
        return res.status(404).json({ success: false, error: '照片不存在' });
    }
    
    const photo = photos[photoIndex];
    
    if (photo.public_id) {
        try {
            await cloudinary.uploader.destroy(photo.public_id);
            console.log('🗑️ 從 Cloudinary 刪除:', photo.public_id);
        } catch (err) {
            console.error('Cloudinary 刪除失敗:', err);
        }
    }
    
    photos.splice(photoIndex, 1);
    res.json({ success: true });
});

// 清空所有照片
app.delete('/api/photos', async (req, res) => {
    const { password } = req.body;
    if (password !== '1234') {
        return res.status(401).json({ success: false, error: '密碼錯誤' });
    }
    
    for (const photo of photos) {
        if (photo.public_id) {
            try {
                await cloudinary.uploader.destroy(photo.public_id);
            } catch (err) {
                console.error('刪除失敗:', photo.public_id);
            }
        }
    }
    
    photos = [];
    console.log('🗑️ 清空所有照片');
    res.json({ success: true });
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Render + Cloudinary 伺服器啟動成功！`);
    console.log(`🌐 端口: ${PORT}`);
    console.log(`☁️ 照片將儲存在 Cloudinary 雲端`);
});
