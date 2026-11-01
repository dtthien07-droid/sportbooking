const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname, { index: false }));

// Trang mặc định: Dẫn vào đăng nhập
app.get('/', (req, res) => {
    res.redirect('/dang-nhap.html');
});

// CẤU HÌNH GỬI EMAIL TỰ ĐỘNG
const EMAIL_CONFIG = {
    user: 'your-email@gmail.com',
    pass: 'your-16-char-app-password'
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_CONFIG.user,
        pass: EMAIL_CONFIG.pass
    }
});

// CẤU HÌNH KẾT NỐI TIDB CLOUD
const db = mysql.createPool({
    host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2E2iD6hpijCUELF.root',
    password: 'NBWKpLMOIGU0NlEt',
    database: 'test',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Lỗi kết nối TiDB Cloud:', err.message);
        return;
    }
    console.log('✅ Đã kết nối thành công tới Database TiDB Cloud (MySQL)!');
    connection.release();
});

// API TEST DATABASE
app.get('/api/test-db', (req, res) => {
    db.query('SELECT COUNT(*) AS total_facilities FROM facilities', (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({
            success: true,
            message: 'Kết nối Database MySQL hoạt động bình thường!',
            total_facilities: results[0].total_facilities
        });
    });
});

// API LẤY DANH SÁCH 29 CỤM SÂN (LẤY TRỰC TIẾP TỪ BẢNG FACILITIES)
app.get('/api/facilities', (req, res) => {
    const { q, district, area, sport } = req.query;
    let sql = 'SELECT * FROM facilities WHERE 1=1';
    const params = [];

    if (q) {
        sql += ' AND (name LIKE ? OR address LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
    }

    const targetArea = district || area;
    if (targetArea) {
        sql += ' AND (district_name LIKE ? OR district LIKE ?)';
        params.push(`%${targetArea.replace('cau-giay', 'Cầu Giấy').replace('tay-ho', 'Tây Hồ').replace('dong-da', 'Đống Đa')}%`, `%${targetArea}%`);
    }

    if (sport && sport !== 'all') {
        sql += ' AND (sport = ? OR sport_name LIKE ?)';
        const sportKeyword = sport === 'soccer' ? 'soccer' : (sport === 'badminton' ? 'badminton' : 'pickleball');
        params.push(sportKeyword, `%${sport}%`);
    }

    sql += ' ORDER BY id ASC';

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('Lỗi truy vấn facilities:', err);
            return res.status(500).json({ error: err.message });
        }
        const mapped = (results || []).map(f => ({
            ...f,
            area: f.district_name || f.district || 'Hà Nội',
            district_name: f.district_name || f.district || 'Hà Nội',
            opening_time: f.open_time || '06:00',
            closing_time: f.close_time || '23:00',
            base_price: f.price_min || 100000,
            price: f.price_min || 100000,
            rating: f.rating || 4.5,
            google_maps_url: f.map_link || 'https://maps.google.com'
        }));
        res.json(mapped);
    });
});

// API LẤY CHI TIẾT 1 CƠ SỞ
app.get('/api/facilities/:id', (req, res) => {
    const facilityId = req.params.id;
    const sqlFacility = 'SELECT * FROM facilities WHERE (id = ? OR name LIKE ?) LIMIT 1';
    const searchKeyword = `%${facilityId.replace(/-/g, ' ').replace('san bong ', '').replace('clb ', '')}%`;

    db.query(sqlFacility, [facilityId, searchKeyword], (err, facilityResults) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!facilityResults || facilityResults.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy cơ sở!' });
        }

        const raw = facilityResults[0];
        const facility = {
            ...raw,
            area: raw.district_name || raw.district || 'Hà Nội',
            district_name: raw.district_name || raw.district || 'Hà Nội',
            opening_time: raw.open_time || '06:00',
            closing_time: raw.close_time || '23:00',
            base_price: raw.price_min || 100000,
            price: raw.price_min || 100000,
            rating: raw.rating || 4.5,
            google_maps_url: raw.map_link || 'https://maps.google.com'
        };

        const sport = facility.sport || 'soccer';
        if (sport === 'soccer') {
            facility.sub_courts = [
                { id: 'c1', name: 'Sân cỏ 7 - Số 1', description: 'Mặt cỏ 50mm êm chân • Đèn cao áp 400W' },
                { id: 'c2', name: 'Sân cỏ 7 - Số 2', description: 'Kích thước chuẩn 30m x 50m • Lưới an toàn' },
                { id: 'c3', name: 'Sân cỏ 7 - Số 3', description: 'Sân đối kháng tiêu chuẩn' }
            ];
        } else if (sport === 'badminton') {
            facility.sub_courts = [
                { id: 'c1', name: 'Sân Thảm 01', description: 'Thảm PVC chống trượt 4.5mm • Đèn chống chói' },
                { id: 'c2', name: 'Sân Thảm 02', description: 'Trần cao 9m thoáng đãng • Ghế chờ riêng' },
                { id: 'c3', name: 'Sân Thảm 03', description: 'VIP Thi Đấu chuẩn BWF' }
            ];
        } else {
            facility.sub_courts = [
                { id: 'c1', name: 'Sân Acrylic 01', description: 'Sơn phủ 5 lớp giảm chấn • Kẻ line chuẩn' },
                { id: 'c2', name: 'Sân Acrylic 02', description: 'Có mái che • Đèn LED chuyên dụng' },
                { id: 'c3', name: 'Sân Acrylic 03', description: 'Sân Đôi VIP thi đấu' }
            ];
        }
        res.json(facility);
    });
});

// API LẤY KHUNG GIỜ VÀ GIÁ
app.get('/api/facilities/:id/slots', (req, res) => {
    const facilityId = req.params.id;
    db.query('SELECT * FROM facilities WHERE id = ? LIMIT 1', [facilityId], (err, results) => {
        const fac = (results && results[0]) ? results[0] : {};
        const openStr = fac.open_time || '06:00';
        const closeStr = fac.close_time || '23:00';
        const basePrice = fac.price_min || 100000;
        const peakPrice = Math.round((basePrice * 1.35) / 10000) * 10000;

        let startH = parseInt(openStr.split(':')[0], 10) || 6;
        let endH = parseInt(closeStr.split(':')[0], 10) || 23;
        if (endH <= startH) endH = 23;

        const slots = [];
        for (let h = startH; h < endH; h++) {
            const isPeak = (h >= 17 && h < 21);
            slots.push({
                id: `slot_${facilityId}_${h}`,
                facility_id: facilityId,
                start_time: String(h).padStart(2, '0') + ':00',
                end_time: String(h + 1).padStart(2, '0') + ':00',
                price: isPeak ? peakPrice : basePrice,
                is_peak: isPeak
            });
        }
        res.json(slots);
    });
});

// API AUTH REGISTER
app.post('/api/auth/register', (req, res) => {
    const { full_name, email, phone, password } = req.body;
    if (!full_name || !email || !phone || !password) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ tên, email, SĐT và mật khẩu!' });
    }
    const checkSql = 'SELECT id FROM users WHERE email = ? OR phone = ?';
    db.query(checkSql, [email, phone], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        if (users && users.length > 0) {
            return res.status(400).json({ error: 'Email hoặc số điện thoại này đã được đăng ký tài khoản!' });
        }
        const insertSql = 'INSERT INTO users (id, full_name, email, phone, password_hash, role) VALUES (UUID(), ?, ?, ?, ?, "USER")';
        db.query(insertSql, [full_name, email, phone, password], (insertErr) => {
            if (insertErr) return res.status(500).json({ error: insertErr.message });
            res.status(201).json({ success: true, message: 'Đăng ký tài khoản thành công!' });
        });
    });
});

// API AUTH LOGIN
app.post('/api/auth/login', (req, res) => {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
        return res.status(400).json({ error: 'Vui lòng nhập tài khoản (Email/SĐT) và mật khẩu!' });
    }
    const loginSql = 'SELECT id, full_name, email, phone, role FROM users WHERE (email = ? OR phone = ?) AND password_hash = ?';
    db.query(loginSql, [emailOrPhone, emailOrPhone, password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!results || results.length === 0) {
            return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác!' });
        }
        const user = results[0];
        res.json({
            success: true,
            message: 'Đăng nhập thành công!',
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });
    });
});

// KHỞI CHẠY SERVER BACKEND
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server đang chạy tại port ${PORT}`);
});