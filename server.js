const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 設定目錄
const uploadDir = '/tmp/uploads';
const logDir = '/tmp/logs';

// ... 其他設定 ...

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ⭐⭐⭐ 在這裡加入圖片服務路由 ⭐⭐⭐
app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(uploadDir, filename);
    
    console.log('📸 圖片請求:', filename);
    
    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        console.log('❌ 圖片不存在:', filepath);
        res.status(404).json({ error: '圖片不存在' });
    }
});

// 測試路由
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: '伺服器正常運作' });
});

// 其他 API 路由（log-phone, photos, upload, delete...）
// ...

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 伺服器啟動成功！`);
});
