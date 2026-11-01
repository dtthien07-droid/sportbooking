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
// Đảm bảo ở đầu file đã require bcrypt:
const bcrypt = require('bcrypt'); // hoặc require('bcryptjs')

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Luôn dùng .trim() để tránh lỗi khoảng trắng vô hình
        const cleanEmail = email ? email.trim().toLowerCase() : '';
        const cleanPassword = password ? password.trim() : '';

        // 2. Tìm tài khoản trong Database theo Email
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [cleanEmail]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng!' });
        }

        const user = users[0];

        // 3. ĐIỂM SỬA CHÍNH: Dùng bcrypt.compare thay vì so sánh dấu ===
        const isMatch = await bcrypt.compare(cleanPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng!' });
        }

        // 4. Đăng nhập thành công -> Trả về thông tin user
        delete user.password_hash;
        return res.status(200).json({
            message: 'Đăng nhập thành công!',
            user: user
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Lỗi máy chủ!' });
    }
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

// ============================================================================
// LOGIC TỰ ĐỘNG ĐỒNG BỘ: TÍNH TRẠNG THÁI THEO GIỜ THỰC & CHÍNH SÁCH HOÀN TIỀN (ĐIỀU 5)
// ============================================================================

// Hàm chuẩn hóa thông tin đơn hàng, tính trạng thái động và tiền hoàn
function processBookingItem(booking) {
    const statusRaw = (booking.status || '').toLowerCase();
    const price = Number(booking.total_price || booking.totalPrice || booking.paid_amount || booking.paidDeposit || 0);

    // 1. Trường hợp đơn đã hủy
    if (statusRaw === 'cancelled' || statusRaw === 'đã hủy' || statusRaw === 'da huy') {
        return {
            ...booking,
            display_status: 'Đã hủy',
            status_code: 'CANCELLED',
            can_cancel: false,
            refund_percent: booking.refund_percent || 0,
            refund_amount: booking.refund_amount || 0,
            refund_label: 'Đã hủy đơn'
        };
    }

    const now = new Date();

    // Chuẩn hóa ngày thi đấu YYYY-MM-DD
    let rawDate = booking.booking_date || booking.bookingDate || booking.date || '';
    let dateStr = '';
    if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().split('T')[0];
    } else if (typeof rawDate === 'string') {
        if (rawDate.includes('/')) {
            const parts = rawDate.split('/');
            if (parts.length === 3) dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (rawDate.includes('T')) {
            dateStr = rawDate.split('T')[0];
        } else {
            dateStr = rawDate;
        }
    }

    const startStr = booking.start_time || booking.startTime || '00:00';
    const endStr = booking.end_time || booking.endTime || '23:59';

    const startDateTime = new Date(`${dateStr}T${startStr.length === 5 ? startStr + ':00' : startStr}`);
    const endDateTime = new Date(`${dateStr}T${endStr.length === 5 ? endStr + ':00' : endStr}`);

    // 2. Kiểm tra nếu đã qua giờ kết thúc (ví dụ sau 15:00 là 15:01) -> Hoàn thành
    if (now >= endDateTime) {
        return {
            ...booking,
            display_status: 'Hoàn thành',
            status_code: 'COMPLETED',
            can_cancel: false,
            refund_percent: 0,
            refund_amount: 0,
            refund_label: 'Trận đấu đã kết thúc'
        };
    }

    // 3. Trong khung giờ thi đấu (ví dụ 14:00 - 15:00) -> Đang trong trận (Cấm hủy)
    if (now >= startDateTime && now < endDateTime) {
        return {
            ...booking,
            display_status: 'Đang trong trận',
            status_code: 'IN_PROGRESS',
            can_cancel: false,
            refund_percent: 0,
            refund_amount: 0,
            refund_label: 'Đang trong trận đấu'
        };
    }

    // 4. Trước khung giờ thi đấu -> Sắp tới (Tính tiền hoàn theo Điều 5)
    const diffHours = (startDateTime - now) / (1000 * 60 * 60);
    let refundPercent = 0;
    let refundLabel = 'Không hoàn cọc (0%)';

    if (diffHours >= 24) {
        // Trước 24 giờ: Hoàn 100%
        refundPercent = 100;
        refundLabel = '100% Hoàn tiền';
    } else if (diffHours >= 6 && diffHours < 24) {
        // Từ 6 đến 24 giờ: Hoàn 50%
        refundPercent = 50;
        refundLabel = '50% Hoàn tiền';
    } else {
        // Dưới 6 giờ / Sát giờ: Không hoàn cọc (0%)
        refundPercent = 0;
        refundLabel = 'Không hoàn cọc (0%)';
    }

    const refundAmount = Math.round((price * refundPercent) / 100);

    return {
        ...booking,
        display_status: 'Sắp tới',
        status_code: 'UPCOMING',
        can_cancel: true,
        refund_percent: refundPercent,
        refund_amount: refundAmount,
        refund_label: refundLabel
    };
}

// API LẤY DANH SÁCH LỊCH SỬ ĐẶT SÂN
app.get('/api/bookings', (req, res) => {
    const { user_id } = req.query;
    let sql = 'SELECT * FROM bookings';
    const params = [];

    if (user_id) {
        sql += ' WHERE user_id = ?';
        params.push(user_id);
    }
    sql += ' ORDER BY id DESC';

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('Lỗi lấy danh sách bookings:', err);
            return res.status(500).json({ error: err.message });
        }
        const processedList = (results || []).map(b => processBookingItem(b));
        res.json(processedList);
    });
});

// API LẤY CHI TIẾT 1 ĐƠN ĐẶT SÂN
app.get('/api/bookings/:id', (req, res) => {
    const bookingId = req.params.id;
    const sql = 'SELECT * FROM bookings WHERE id = ? OR booking_code = ? LIMIT 1';

    db.query(sql, [bookingId, bookingId], (err, results) => {
        if (err) {
            console.error('Lỗi lấy chi tiết booking:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!results || results.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy đơn đặt sân!' });
        }
        const bookingDetail = processBookingItem(results[0]);
        res.json(bookingDetail);
    });
});

// API THỰC HIỆN HỦY ĐẶT SÂN VÀ ĐỒNG BỘ TRỰC TIẾP VÀO DATABASE
app.post('/api/bookings/:id/cancel', (req, res) => {
    const bookingId = req.params.id;
    const sqlSelect = 'SELECT * FROM bookings WHERE id = ? OR booking_code = ? LIMIT 1';

    db.query(sqlSelect, [bookingId, bookingId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (!results || results.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt sân!' });
        }

        const booking = results[0];
        const processed = processBookingItem(booking);

        // Chặn nếu đang trong trận hoặc đã kết thúc
        if (!processed.can_cancel) {
            return res.status(400).json({
                success: false,
                message: 'Không thể hủy do trận đấu đang diễn ra hoặc đã kết thúc!'
            });
        }

        // Cập nhật trạng thái hủy vĩnh viễn vào Database
        const sqlUpdate = `
            UPDATE bookings 
            SET status = 'Đã hủy', 
                refund_amount = ?, 
                refund_percent = ?, 
                cancelled_at = NOW() 
            WHERE id = ? OR booking_code = ?
        `;

        db.query(sqlUpdate, [processed.refund_amount, processed.refund_percent, bookingId, bookingId], (updateErr) => {
            if (updateErr) {
                console.error('Lỗi cập nhật hủy đơn vào DB:', updateErr);
                return res.status(500).json({ success: false, message: updateErr.message });
            }

            res.json({
                success: true,
                message: 'Hủy đơn đặt sân thành công!',
                refund_amount: processed.refund_amount,
                refund_percent: processed.refund_percent,
                refund_label: processed.refund_label
            });
        });
    });
});

// KHỞI CHẠY SERVER BACKEND (LUÔN ĐẶT Ở CUỐI FILE)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server đang chạy tại port ${PORT}`);
});