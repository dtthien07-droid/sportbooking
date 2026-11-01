require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());

const cookieParser = require('cookie-parser');

app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname, { index: false }));

// Trang mặc định
app.get('/', (req, res) => {
  if (req.cookies.token) {
    res.redirect('/trangchu-user.html');   // đã đăng nhập
  } else {
    res.redirect('/dang-nhap.html');       // chưa đăng nhập
  }
});
// =========================================================================
// 1. CẤU HÌNH GỬI EMAIL TỰ ĐỘNG QUA GMAIL (NODEMAILER)
// =========================================================================
// 💡 HƯỚNG DẪN LẤY MẬT KHẨU ỨNG DỤNG GMAIL (16 ký tự):
// 1. Vào Tài khoản Google của bạn -> Bảo mật (Security) -> Bật Xác minh 2 bước.
// 2. Tìm mục "Mật khẩu ứng dụng" (App Passwords).
// 3. Đặt tên là "SportBooking" rồi bấm Tạo -> Google sẽ cấp 1 mã 16 chữ cái (VD: abcd efgh ijkl mnop).
// 4. Dán email của bạn vào EMAIL_USER và mã 16 chữ vào EMAIL_PASS bên dưới:
const EMAIL_CONFIG = {
    user: 'your-email@gmail.com',         // 👈 Thay bằng Gmail của bạn (dùng để gửi thư)
    pass: 'your-16-char-app-password'    // 👈 Thay bằng Mật khẩu ứng dụng 16 ký tự của Google
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_CONFIG.user,
        pass: EMAIL_CONFIG.pass
    }
});

// Kiểm tra kết nối dịch vụ Email khi khởi động server
transporter.verify((error, success) => {
    if (error) {
        console.warn('⚠️ Cảnh báo dịch vụ gửi Email: Chưa cấu hình đúng Gmail hoặc Mật khẩu ứng dụng.');
        console.warn('👉 Chi tiết: Điền EMAIL_CONFIG.user và EMAIL_CONFIG.pass trong file server.js để gửi mail thật.');
    } else {
        console.log('✅ Hệ thống Email (Nodemailer) đã sẵn sàng gửi thư!');
    }
});


// =========================================================================
// 2. CẤU HÌNH KẾT NỐI DATABASE MYSQL (TỰ ĐỘNG RECONNECT TRÁNH RỚT MẠNG)
// =========================================================================
const db = mysql.createPool({
    host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '2E2iD6hpijCUELF.root',
    password: 'ThOX2MSY0A5LNZo2',
    database: 'test',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
});

// Kiểm tra kết nối ban đầu
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Lỗi kết nối TiDB Cloud:', err.message);
        return;
    }
    console.log('✅ Đã kết nối thành công tới Database TiDB Cloud (MySQL)!');
    connection.release(); // Trả kết nối về bể chờ
});


// =========================================================================
// 3. API KIỂM TRA TRẠNG THÁI MÁY CHỦ & DATABASE
// =========================================================================
app.get('/api/test-db', (req, res) => {
    db.query('SELECT COUNT(*) AS total_facilities FROM facilities', (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({
            success: true,
            message: 'Kết nối Database MySQL hoạt động bình thường!',
            total_facilities: results[0].total_facilities
        });
    });
});

// =========================================================================
// 4. API TEST GỬI THỬ EMAIL VỀ HÒM THƯ CÁ NHÂN
// Truy cập: http://localhost:3000/api/test-email?to=dtthien07@gmail.com
// =========================================================================
app.get('/api/test-email', async (req, res) => {
    const toEmail = req.query.to || 'dtthien07@gmail.com';
    try {
        await transporter.sendMail({
            from: `"SportBooking Vietnam" <${EMAIL_CONFIG.user}>`,
            to: toEmail,
            subject: '✅ [SportBooking] Thử nghiệm gửi email xác nhận đặt sân thành công',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
                    <h2 style="color: #006b2c;">Chào mừng bạn đến với SportBooking!</h2>
                    <p>Hệ thống gửi email tự động từ máy chủ của bạn đã hoạt động chuẩn xác.</p>
                    <p>Thư thử nghiệm gửi tới hòm thư cá nhân: <strong>${toEmail}</strong></p>
                </div>
            `
        });
        res.json({ success: true, message: `Đã gửi email thử nghiệm thành công tới ${toEmail}!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================================
// 5. API GỬI EMAIL XÁC NHẬN ĐẶT SÂN THÀNH CÔNG (CHI TIẾT VÉ & QR CODE)
// Front-end gọi API này ngay sau khi đặt cọc / thanh toán thành công
// =========================================================================
app.post('/api/send-booking-email', async (req, res) => {
    const {
        customerEmail,
        customerName,
        customerPhone,
        orderId,
        venueName,
        courtNumber,
        address,
        timeSlot,
        date,
        totalPrice,
        depositPaid,
        remainingAmount,
        isMatchMaker
    } = req.body;

    const recipient = customerEmail || 'dtthien07@gmail.com';
    const bookingCode = orderId || ('#SB-' + Math.floor(10000 + Math.random() * 90000));
    const finalVenue = venueName || 'Sân Pickleball X20';
    const finalCourt = courtNumber || 'Sân Acrylic 01';
    const finalDate = date || '01/11/2026';
    const finalTime = timeSlot || '13:00 - 14:00';
    const finalDeposit = depositPaid || '152.000đ';
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SPORTBOOKING-${bookingCode.replace('#', '')}`;

    const emailHtml = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 24px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, #006b2c 0%, #00873a 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
            .badge { display: inline-block; background-color: #dcfce7; color: #166534; font-weight: bold; font-size: 12px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px; }
            .content { padding: 28px 24px; }
            .ticket-card { background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; margin: 20px 0; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
            .label { color: #64748b; font-weight: 500; }
            .value { color: #0f172a; font-weight: 700; text-align: right; }
            .qr-box { text-align: center; margin: 24px 0; padding: 16px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; }
            .qr-img { width: 140px; height: 140px; border-radius: 8px; }
            .footer { background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; }
            .btn { display: inline-block; background-color: #006b2c; color: #ffffff !important; text-decoration: none; font-weight: bold; padding: 12px 28px; border-radius: 10px; margin-top: 16px; }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Header -->
            <div class="header">
                <span class="badge">ĐÃ XÁC NHẬN GIỮ SÂN</span>
                <h1 style="margin: 0; font-size: 24px; font-weight: 800;">ĐẶT SÂN THÀNH CÔNG!</h1>
                <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Mã đặt sân: <strong>${bookingCode}</strong></p>
            </div>

            <!-- Content -->
            <div class="content">
                <p style="font-size: 15px; color: #334155; margin-top: 0;">
                    Xin chào <strong>${customerName || 'Quý khách'}</strong>,<br>
                    Lịch đặt sân của bạn đã được xác nhận chính thức trên hệ thống SportBooking. Dưới đây là thông tin chi tiết:
                </p>

                <!-- Ticket Card -->
                <div class="ticket-card">
                    <div style="font-size: 16px; font-weight: 800; color: #006b2c; margin-bottom: 12px;">
                        🏟️ ${finalVenue}
                    </div>
                    <div class="row">
                        <span class="label">Vị trí sân:</span>
                        <span class="value">${finalCourt}</span>
                    </div>
                    <div class="row">
                        <span class="label">Ngày chơi:</span>
                        <span class="value">${finalDate}</span>
                    </div>
                    <div class="row">
                        <span class="label">Khung giờ:</span>
                        <span class="value" style="color: #006b2c;">${finalTime}</span>
                    </div>
                    <div class="row">
                        <span class="label">Địa chỉ sân:</span>
                        <span class="value" style="max-width: 60%;">${address || 'Hà Nội'}</span>
                    </div>
                    <div class="row">
                        <span class="label">Người đặt:</span>
                        <span class="value">${customerName || 'Trúc Lam'} (${customerPhone || '0838491234'})</span>
                    </div>
                    <div class="row">
                        <span class="label">Số tiền đã cọc/trả:</span>
                        <span class="value" style="color: #166534; font-size: 16px;">${finalDeposit}</span>
                    </div>
                    ${isMatchMaker ? `
                    <div class="row" style="background-color: #fff7ed; padding: 8px; border-radius: 6px;">
                        <span class="label" style="color: #c2410c;">Chế độ ghép đối:</span>
                        <span class="value" style="color: #c2410c;">ĐANG BẬT TÌM ĐỐI THỦ</span>
                    </div>` : ''}
                </div>

                <!-- QR Check-in Box -->
                <div class="qr-box">
                    <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #334155;">MÃ QR CHECK-IN TỰ ĐỘNG TẠI QUẦY SÂN</p>
                    <img src="${qrCodeUrl}" alt="Mã QR check-in" class="qr-img">
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">Xuất trình mã này cho lễ tân khi đến sân để nhận slot nhanh chóng.</p>
                </div>

                <div style="text-align: center;">
                    <a href="http://localhost:3000/chi-tiet-don-dat-san.html?id=${bookingCode.replace('#', '')}" class="btn">
                        Xem chi tiết đơn & Quản lý lịch
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p style="margin: 0 0 6px 0;">Cần hỗ trợ gấp? Hotline hỗ trợ: <strong>1900 6868</strong> (8:00 - 22:00 hàng ngày)</p>
                <p style="margin: 0;">© 2026 SportBooking Vietnam. Nền tảng đặt sân thể thao thông minh hàng đầu.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const mailOptions = {
            from: `"SportBooking Vietnam" <${EMAIL_CONFIG.user}>`,
            to: recipient,
            subject: `✅ Xác nhận đặt sân thành công [${bookingCode}] - ${finalVenue}`,
            html: emailHtml
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✉️ Đã gửi email xác nhận đặt sân tới: ${recipient} (Message ID: ${info.messageId})`);

        res.json({
            success: true,
            message: `Email xác nhận đã gửi thành công về hòm thư ${recipient}!`,
            messageId: info.messageId
        });
    } catch (err) {
        console.error('❌ Lỗi khi gửi email:', err);
        res.status(500).json({
            success: false,
            error: 'Không thể gửi email. Vui lòng kiểm tra lại cấu hình EMAIL_CONFIG trong server.js.',
            details: err.message
        });
    }
});

// =========================================================================
// 6. API LẤY DANH SÁCH CỤM SÂN (Lọc theo Môn, Khu vực, Từ khóa tìm kiếm)
// =========================================================================
app.get('/api/facilities', (req, res) => {
    const { q, district, area, sport } = req.query;
    
    let sql = `
        SELECT DISTINCT
            f.id, f.name, f.address, f.area, f.phone,
            TIME_FORMAT(f.opening_time, '%H:%i') AS opening_time,
            TIME_FORMAT(f.closing_time, '%H:%i') AS closing_time,
            f.base_price, f.peak_surcharge,
            (f.base_price + f.peak_surcharge) AS peak_price,
            f.rating, f.google_maps_url, f.amenities, f.image_url,
            s.id AS sport_id, s.name AS sport_name
        FROM facilities f
        LEFT JOIN courts c ON f.id = c.facility_id
        LEFT JOIN sports s ON c.sport_id = s.id
        WHERE f.is_active = TRUE
    `;
    const params = [];

    if (q) {
        sql += ` AND (f.name LIKE ? OR f.address LIKE ?)`;
        params.push(`%${q}%`, `%${q}%`);
    }

    const targetArea = district || area;
    if (targetArea) {
        sql += ` AND f.area LIKE ?`;
        params.push(`%${targetArea.replace('cau-giay', 'Cầu Giấy').replace('tay-ho', 'Tây Hồ').replace('dong-da', 'Đống Đa')}%`);
    }

    if (sport && sport !== 'all') {
        sql += ` AND (s.name LIKE ? OR c.description LIKE ?)`;
        const sportKeyword = sport === 'soccer' ? '%bóng%' : (sport === 'badminton' ? '%cầu lông%' : '%pickleball%');
        params.push(sportKeyword, sportKeyword);
    }

    sql += ` ORDER BY f.id ASC`;

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('Lỗi truy vấn facilities:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// =========================================================================
// 7. API LẤY CHI TIẾT 1 CƠ SỞ THỂ THAO
// =========================================================================
app.get('/api/facilities/:id', (req, res) => {
    const facilityId = req.params.id;

    const sqlFacility = `
        SELECT DISTINCT
            f.id, f.name, f.address, f.area, f.phone,
            TIME_FORMAT(f.opening_time, '%H:%i') AS opening_time,
            TIME_FORMAT(f.closing_time, '%H:%i') AS closing_time,
            f.base_price, f.peak_surcharge,
            (f.base_price + f.peak_surcharge) AS peak_price,
            f.rating, f.google_maps_url, f.amenities, f.image_url,
            s.name AS sport_name
        FROM facilities f
        LEFT JOIN courts c ON f.id = c.facility_id
        LEFT JOIN sports s ON c.sport_id = s.id
        WHERE (f.id = ? OR f.name LIKE ?) AND f.is_active = TRUE
        LIMIT 1
    `;

    const searchKeyword = `%${facilityId.replace(/-/g, ' ').replace('san bong ', '').replace('clb ', '')}%`;

    db.query(sqlFacility, [facilityId, searchKeyword], (err, facilityResults) => {
        if (err) return res.status(500).json({ error: err.message });
        if (facilityResults.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy cơ sở!' });
        }

        const facility = facilityResults[0];

        const sqlCourts = `
            SELECT id, name, description
            FROM courts
            WHERE facility_id = ? AND is_active = TRUE
            ORDER BY name ASC
        `;
        db.query(sqlCourts, [facility.id], (courtErr, courtsResults) => {
            if (courtErr) {
                facility.sub_courts = [];
            } else {
                facility.sub_courts = courtsResults;
            }
            res.json(facility);
        });
    });
});

// =========================================================================
// 8. API LẤY DANH SÁCH KHUNG GIỜ VÀ GIÁ CỦA 1 CƠ SỞ
// =========================================================================
app.get('/api/facilities/:id/slots', (req, res) => {
    const facilityId = req.params.id;
    const sql = `
        SELECT id, facility_id,
               TIME_FORMAT(start_time, '%H:%i') AS start_time,
               TIME_FORMAT(end_time, '%H:%i') AS end_time,
               price, is_peak
        FROM time_slots
        WHERE facility_id = ? AND is_active = TRUE
        ORDER BY start_time ASC
    `;
    db.query(sql, [facilityId], (err, results) => {
        if (err) {
            console.error('Lỗi truy vấn time_slots:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// =========================================================================
// 9. API ĐĂNG KÝ TÀI KHOẢN MỚI
// =========================================================================
app.post('/api/auth/register', (req, res) => {
    const { full_name, email, phone, password } = req.body;

    if (!full_name || !email || !phone || !password) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ tên, email, SĐT và mật khẩu!' });
    }

    const checkUserSql = 'SELECT id FROM users WHERE email = ? OR phone = ?';
    db.query(checkUserSql, [email, phone], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        if (users.length > 0) {
            return res.status(400).json({ error: 'Email hoặc số điện thoại này đã được đăng ký tài khoản!' });
        }

        const insertSql = `
            INSERT INTO users (id, full_name, email, phone, password_hash, role)
            VALUES (UUID(), ?, ?, ?, ?, 'USER')
        `;
        db.query(insertSql, [full_name, email, phone, password], (insertErr) => {
            if (insertErr) return res.status(500).json({ error: insertErr.message });
            res.status(201).json({ success: true, message: 'Đăng ký tài khoản thành công!' });
        });
    });
});

// =========================================================================
// 10. API ĐĂNG NHẬP TÀI KHOẢN
// =========================================================================
app.post('/api/auth/login', (req, res) => {
    const { emailOrPhone, password } = req.body;

    if (!emailOrPhone || !password) {
        return res.status(400).json({ error: 'Vui lòng nhập tài khoản (Email/SĐT) và mật khẩu!' });
    }

    const loginSql = `
        SELECT id, full_name, email, phone, role
        FROM users
        WHERE (email = ? OR phone = ?) AND password_hash = ?
    `;
    db.query(loginSql, [emailOrPhone, emailOrPhone, password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
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

// =========================================================================
// 11. KHỞI CHẠY SERVER BACKEND
// =========================================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📧 Test gửi mail tại: http://localhost:${PORT}/api/test-email?to=dtthien07@gmail.com`);
});


