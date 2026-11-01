/* SportBooking - auth.js
 * Đồng bộ hóa toàn bộ cây thư mục 17 màn hình hệ thống SportBooking
 */
(function () {
  // 1. Cấu hình ánh xạ chính xác tất cả các file HTML trong thư mục
  const PAGES = {
    signup: 'dang-ky.html',
    login: 'dang-nhap.html',
    home: 'trangchu-user.html',
    search: 'tim-san.html',
    bookingHistory: 'lich-su-dat-san.html',
    orderDetail: 'chi-tiet-don-dat-san.html',
    confirmBooking: 'xac-nhan-dat-san.html',
    payment: 'thanh-toan.html',
    bookingSuccess: 'dat-san-thanh-cong.html',
    expiredBooking: 'het-han-giu-cho.html',
    cancelConfirmModal: 'xac-nhan-huy-san.html',
    cancelBookingRequest: 'huy-dat-san.html',
    matchmaking: 'tim-doi-choi.html',
    matchmakingStatus: 'tim-doi-choi-status.html',
    matchmakingProposal: 'de-xuat-ghep-doi.html',
    matchmakingSuccess: 'ghep-doi-thanh-cong.html',
    matchmakingTimeout: 'het-han-tim-doi.html',
    notifications: 'thong-bao.html',
    profile: 'ho-so-ca-nhan.html',
    terms: 'dieu-khoan-su-dung.html',
    privacy: 'chinh-sach-bao-mat.html',
    admin: 'admin.html'
  };

  const USERS_KEY = 'sb_users';
  const SESSION_KEY = 'sb_session';
  const NOTIF_KEY = 'sport_notifications';

  // Tài khoản Admin mặc định
  const ADMIN = {
    fullName: 'Quản trị viên',
    phone: '0988888888',
    email: 'admin@sportbooking.vn',
    password: 'Admin@123'
  };

  const read = (storage, key, def) => {
    try {
      return JSON.parse(storage.getItem(key)) ?? def;
    } catch (e) {
      return def;
    }
  };

  const write = (storage, key, val) => {
    try {
      storage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  };

  async function hash(text) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return btoa(unescape(encodeURIComponent(text)));
    }
  }

  const normPhone = p => (p || '').replace(/[\s.\-]/g, '').replace(/^\+84/, '0');
  const isPhone = p => /^0\d{9}$/.test(normPhone(p));
  const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const users = () => read(localStorage, USERS_KEY, []);
  const homeOf = u => (u && u.role === 'admin' ? PAGES.admin : PAGES.home);

  async function seedAdmin() {
    const list = users();
    if (list.some(u => u.role === 'admin')) return;
    list.push({
      id: 1,
      fullName: ADMIN.fullName,
      phone: ADMIN.phone,
      email: ADMIN.email,
      passwordHash: await hash(ADMIN.password),
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    write(localStorage, USERS_KEY, list);
  }

  function toast(msg, ok) {
    let t = document.getElementById('sb-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'sb-toast';
      t.style.cssText =
        'position:fixed;top:92px;left:50%;transform:translateX(-50%);z-index:99999;padding:12px 24px;border-radius:12px;color:#fff;font:500 14px "Be Vietnam Pro",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);max-width:90vw;text-align:center;transition:opacity .3s;';
      document.body.appendChild(t);
    }
    t.style.background = ok ? '#006b2c' : '#ba1a1a';
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.style.opacity = '0'), 3500);
  }

  function setBusy(btn, text) {
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined align-middle animate-spin text-[18px]">refresh</span> ${text}`;
  }

  /* ---------- API Công khai (Window.SportAuth) ---------- */
  window.SportAuth = {
    PAGES,
    goToSignup() {
      location.href = PAGES.signup;
    },
    goToLogin() {
      location.href = PAGES.login;
    },
    getUser() {
      return read(sessionStorage, SESSION_KEY, null) ||
             read(localStorage, SESSION_KEY, null) ||
             read(localStorage, 'currentUser', null) ||
             read(localStorage, 'current_user', null);
    },
    logout() {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('current_user');
      toast('Đã đăng xuất tài khoản.', true);
      setTimeout(() => (location.href = PAGES.login), 600);
    },
    requireLogin() {
      if (!this.getUser()) location.href = PAGES.login;
    },
    requireRole(role) {
      const u = this.getUser();
      if (!u) location.href = PAGES.login;
      else if (u.role !== role) location.href = homeOf(u);
    }
  };

  /* ---------- 2. Đồng bộ Khung Xem Nhanh Thông Báo trên Header ---------- */
  function setupNotificationDropdown() {
    const notifBtn = document.querySelector('#btnToggleNotifDropdown, button[aria-label="Thông báo"], a[aria-label="Thông báo"]');
    if (!notifBtn) return;

    let notifs = read(localStorage, NOTIF_KEY, [
      {
        id: 'notif-1',
        title: 'Ghép đối thành công!',
        content: 'Bạn đã được ghép thành công với Lê Hoàng Nam lúc 20:00.',
        time: '10 phút trước',
        unread: true,
        link: PAGES.matchmakingSuccess,
        icon: 'sports_tennis',
        color: 'text-primary'
      },
      {
        id: 'notif-2',
        title: 'Nhắc lịch thi đấu hôm nay',
        content: 'Bạn có lịch đấu lúc 20:00 - 21:00 tối nay tại CLB Ngôi Sao.',
        time: '35 phút trước',
        unread: true,
        link: `${PAGES.orderDetail}?id=SB-89201`,
        icon: 'alarm',
        color: 'text-secondary'
      },
      {
        id: 'notif-3',
        title: 'Hết hạn tìm kiếm đối thủ',
        content: 'Yêu cầu tìm đối ca 20:00 đã hết hạn. Bấm để gia hạn.',
        time: '1 giờ trước',
        unread: true,
        link: PAGES.matchmakingTimeout,
        icon: 'hourglass_disabled',
        color: 'text-error'
      }
    ]);

    const unreadCount = notifs.filter(n => n.unread).length;
    const parent = notifBtn.parentElement;
    parent.classList.add('relative');
    notifBtn.setAttribute('type', 'button');
    notifBtn.style.cursor = 'pointer';

    let badge = notifBtn.querySelector('#badgeQuickCount, span.rounded-full');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'badgeQuickCount';
      badge.className = 'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-error text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-sm border-2 border-white pointer-events-none';
      notifBtn.appendChild(badge);
    }
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    let popover = document.getElementById('sbQuickNotifPopover');
    if (!popover) {
      popover = document.createElement('div');
      popover.id = 'sbQuickNotifPopover';
      popover.className = 'hidden absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 flex-col z-50 overflow-hidden';
      
      const itemsHtml = notifs.slice(0, 4).map(n => `
        <div class="p-3 hover:bg-gray-50 transition-colors flex items-start gap-3 cursor-pointer ${n.unread ? 'bg-green-50/40' : ''}" onclick="window.location.href='${n.link || PAGES.notifications}'">
          <div class="w-9 h-9 rounded-xl bg-gray-100 ${n.color || 'text-primary'} flex items-center justify-center shrink-0 mt-0.5">
            <span class="material-symbols-outlined text-[20px]">${n.icon || 'notifications'}</span>
          </div>
          <div class="flex-1 min-w-0 flex flex-col gap-0.5 text-xs">
            <div class="flex items-baseline justify-between">
              <span class="font-bold text-gray-800 truncate">${n.title}</span>
              <span class="text-[10px] text-gray-400 shrink-0">${n.time}</span>
            </div>
            <p class="text-gray-500 line-clamp-2">${n.content}</p>
          </div>
        </div>
      `).join('');

      popover.innerHTML = `
        <div class="p-3.5 pb-2 border-b bg-gray-50 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="text-xs font-bold text-gray-800">Thông báo</h3>
            <span class="px-2 py-0.5 rounded-full bg-red-100 text-error text-[10px] font-bold">${unreadCount} chưa đọc</span>
          </div>
          <a href="${PAGES.notifications}" class="text-[11px] text-primary font-bold hover:underline">Hộp thư đầy đủ</a>
        </div>
        <div class="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
          ${itemsHtml}
        </div>
        <div class="p-2.5 bg-gray-50 text-center border-t">
          <a class="inline-flex items-center justify-center gap-1 text-xs font-bold text-primary hover:underline" href="${PAGES.notifications}">
            <span>Xem tất cả thông báo</span>
            <span class="material-symbols-outlined text-[15px]">chevron_right</span>
          </a>
        </div>
      `;
      parent.appendChild(popover);
    }

    notifBtn.onclick = function (e) {
      e.stopPropagation();
      e.preventDefault();
      popover.classList.toggle('hidden');
      popover.classList.toggle('flex');
    };

    document.addEventListener('click', function (e) {
      if (!parent.contains(e.target)) {
        popover.classList.add('hidden');
        popover.classList.remove('flex');
      }
    });
  }

  /* ---------- 3. Đồng bộ Giao diện Header User (Không nền cam, chữ User màu #9d4300) ---------- */
  function syncHeaderUserUI() {
    const userContainer = document.getElementById('userHeaderArea');
    if (!userContainer) return;

    const user = window.SportAuth.getUser();

    if (user) {
      const displayName = user.fullName || user.name || user.username || 'Khách vãng lai';
      const firstLetter = displayName.trim().charAt(0).toUpperCase();
      const roleText = (user.role === 'admin' || user.is_admin) ? 'Admin' : 'User';

      userContainer.innerHTML = `
        <div id="userProfileTrigger" class="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-xl hover:bg-gray-100 transition-all group" title="Bấm để xem hồ sơ cá nhân">
          <div class="w-9 h-9 rounded-full bg-[#e8f5e9] text-primary font-bold text-sm flex items-center justify-center shrink-0 border border-green-200 group-hover:scale-105 transition-transform">
            ${firstLetter}
          </div>
          <div class="flex flex-col text-left">
            <span id="headerUsername" class="text-sm font-bold text-gray-900 leading-tight truncate max-w-[130px]">
              ${displayName}
            </span>
            <span id="headerUserRole" style="color: #9d4300 !important; font-weight: 700 !important; font-size: 11px !important; background: transparent !important; padding: 0 !important;">
              ${roleText}
            </span>
          </div>
          <button id="sbHeaderLogoutBtn" type="button" title="Đăng xuất" class="ml-1 p-1 text-gray-400 hover:text-error hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center cursor-pointer">
            <span class="material-symbols-outlined text-[19px]">logout</span>
          </button>
        </div>
      `;

      document.getElementById('userProfileTrigger')?.addEventListener('click', function (e) {
        if (e.target.closest('#sbHeaderLogoutBtn')) return;
        window.location.href = PAGES.profile;
      });

      document.getElementById('sbHeaderLogoutBtn')?.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) {
          window.SportAuth.logout();
        }
      });
    } else {
      userContainer.innerHTML = `
        <div class="flex items-center gap-2">
          <a href="${PAGES.login}" class="px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
            Đăng nhập
          </a>
          <a href="${PAGES.signup}" class="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-container transition-colors shadow-sm">
            Đăng ký
          </a>
        </div>
      `;
    }
  }

  /* ---------- 4. Xử lý Đăng ký ---------- */
  async function handleSignup(form) {
    const v = n => (form.elements[n]?.value || '').trim();
    const fullName = v('fullName'),
      phone = normPhone(v('phoneNumber')),
      email = v('email').toLowerCase();
    const pass = form.elements.password?.value || '',
      confirm = form.elements.confirmPassword?.value || '';

    // Kiểm tra điều kiện tick đồng ý điều khoản
    const termsConfirmed = window.isTermsAccepted === true ||
                           document.getElementById('termsConfirmedInput')?.value === 'true' ||
                           form.elements.termsAgree?.checked ||
                           form.elements.agreeTerms?.checked;

    if (!termsConfirmed) {
      toast('Vui lòng mở và đọc xác nhận Điều khoản & Chính sách bảo mật trước khi tiếp tục!');
      document.getElementById('btnOpenTermsPopup')?.click();
      document.getElementById('btnOpenLegalModal')?.click();
      return;
    }

    if (fullName.length < 2) return toast('Vui lòng nhập họ và tên.');
    if (!isPhone(phone)) return toast('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).');
    if (email && !isEmail(email)) return toast('Email không hợp lệ.');
    if (pass.length < 8) return toast('Mật khẩu phải có tối thiểu 8 ký tự.');
    if (pass !== confirm) return toast('Mật khẩu và xác nhận mật khẩu không khớp.');

    await seedAdmin();
    const list = users();
    if (list.some(u => u.phone === phone)) return toast('Số điện thoại này đã được đăng ký.');
    if (email && list.some(u => u.email === email)) return toast('Email này đã được đăng ký.');

    const btn = document.getElementById('submitBtn');
    setBusy(btn, 'Đang tạo tài khoản...');

    const newUser = {
      id: Date.now(),
      fullName,
      phone,
      email,
      passwordHash: await hash(pass),
      role: 'user',
      createdAt: new Date().toISOString()
    };
    list.push(newUser);
    write(localStorage, USERS_KEY, list);

    // Sau khi đăng ký thành công: Thông báo và chuyển hướng thẳng về trang đăng nhập
    toast('Đăng ký tài khoản thành công! Đang chuyển về trang đăng nhập...', true);
    setTimeout(() => {
      location.href = `${PAGES.login}?phone=${encodeURIComponent(phone)}`;
    }, 1000);
  }

  /* ---------- 5. Xử lý Đăng nhập ---------- */
  async function handleLogin() {
    const account = (document.getElementById('accountInput')?.value || '').trim();
    const pass = document.getElementById('passwordInput')?.value || '';
    const remember = document.getElementById('rememberMe')?.checked || false;
    const btn = document.getElementById('submitButton') || document.querySelector('button[type="submit"]');

    if (!account) return toast('Vui lòng nhập số điện thoại hoặc email.');
    if (!pass) return toast('Vui lòng nhập mật khẩu.');

    await seedAdmin();
    const key = isEmail(account) ? account.toLowerCase() : normPhone(account);
    const user = users().find(u => u.phone === key || (u.email && u.email === key));

    if (!user) return toast('Tài khoản chưa tồn tại. Vui lòng đăng ký trước!');
    if (user.passwordHash !== (await hash(pass))) return toast('Mật khẩu không chính xác.');

    setBusy(btn, 'ĐANG ĐĂNG NHẬP...');

    const session = {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role || 'user'
    };

    write(remember ? localStorage : sessionStorage, SESSION_KEY, session);
    localStorage.setItem('currentUser', JSON.stringify(session));

    toast(`Xin chào ${user.fullName}! Đăng nhập thành công.`, true);
    setTimeout(() => (location.href = homeOf(session)), 800);
  }

  /* ---------- 6. Khởi tạo khi DOM tải xong ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    seedAdmin();
    syncHeaderUserUI();
    setupNotificationDropdown();

    // Lắng nghe submit form
    document.addEventListener('submit', e => {
      if (e.target.id === 'signupForm') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleSignup(e.target);
      }
      if (e.target.id === 'loginForm') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleLogin();
      }
    }, true);

    // Tự động điền số điện thoại nếu được chuyển sang từ trang Đăng ký
    const accInput = document.getElementById('accountInput');
    if (accInput) {
      const p = new URLSearchParams(location.search).get('phone');
      if (p) {
        accInput.value = p;
        document.getElementById('passwordInput')?.focus();
      }
    }

    // Lắng nghe sự kiện click: Bấm "Đăng ký" chuyển về trang đăng ký
    document.addEventListener('click', function (e) {
      // 1. Kiểm tra các nút/liên kết điều hướng Đăng ký cụ thể
      const signupTrigger = e.target.closest('#btnToSignup, #btnRegister, #goToSignup, #linkToSignup, .btn-to-signup, a[href*="dang-ky"]');
      if (signupTrigger) {
        if (!signupTrigger.getAttribute('href') || signupTrigger.getAttribute('href') === '#' || signupTrigger.tagName === 'BUTTON') {
          e.preventDefault();
          location.href = PAGES.signup;
        }
        return;
      }

      // 2. Kiểm tra bất kỳ thẻ a hoặc button nào chứa chữ "Đăng ký" (trừ nút submit của chính form đăng ký)
      const btn = e.target.closest('a, button');
      if (btn && !btn.closest('#signupForm') && btn.id !== 'submitBtn') {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text === 'đăng ký' || text === 'đăng ký ngay' || text.includes('chưa có tài khoản') || text.includes('tạo tài khoản')) {
          e.preventDefault();
          location.href = PAGES.signup;
        }
      }

      // 3. Tiện ích: bấm các nút/link "Đăng nhập" trên trang đăng ký để quay về trang đăng nhập
      const loginTrigger = e.target.closest('#btnToLogin, #btnLogin, #goToLogin, #linkToLogin, .btn-to-login, a[href*="dang-nhap"]');
      if (loginTrigger) {
        if (!loginTrigger.getAttribute('href') || loginTrigger.getAttribute('href') === '#' || loginTrigger.tagName === 'BUTTON') {
          e.preventDefault();
          location.href = PAGES.login;
        }
      }
    });
  });
})();

// --- HÀM LẤY ẢNH CHUẨN ĐỒNG BỘ CHO MỌI TRANG ---
const FALLBACK_SPORT_IMAGES = {
  badminton: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80",
  soccer: "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80",
  pickleball: "https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?w=800&q=80"
};

function getFacilityImage(fac) {
  if (fac && fac.image_url && fac.image_url.trim() !== '') {
    return fac.image_url.trim();
  }
  const lowerName = (fac?.name || '').toLowerCase();
  let sport = 'badminton';
  if (lowerName.includes('bóng') || lowerName.includes('đá')) sport = 'soccer';
  else if (lowerName.includes('pickleball')) sport = 'pickleball';
  return FALLBACK_SPORT_IMAGES[sport];
}

// Bỏ mục "Tìm đối chơi" khỏi thanh Header Menu
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('header nav a').forEach(link => {
    const text = (link.textContent || '').trim().toLowerCase();
    const href = (link.getAttribute('href') || '').toLowerCase();
    if (text.includes('tìm đối') || href.includes('tim-doi-choi')) {
      link.remove();
    }
  });
});

/**
 * MODAL DUY NHẤT: GỘP ĐIỀU KHOẢN & CHÍNH SÁCH BẢO MẬT
 * - Thiết kế 2 khối độc lập, không bị đè nội dung
 * - Bắt buộc cuộn chạm đáy mới mở khóa ô Checkbox
 * - Chỉ tick bên trong Popup, tự động cập nhật trạng thái ra ngoài form
 */
(function setupCombinedLegalModal() {
  function createModal() {
    if (document.getElementById('combinedLegalModal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'combinedLegalModal';
    modalDiv.className = 'fixed inset-0 z-[9999] hidden items-center justify-center bg-black/60 backdrop-blur-sm p-4';

    modalDiv.innerHTML = `
      <div class="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[88vh] overflow-hidden">
        
        <!-- Header Popup -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#f1f3ff] shrink-0">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-primary text-[26px]">verified_user</span>
            <div>
              <h3 class="font-bold text-base text-gray-900 leading-tight">Điều khoản sử dụng & Chính sách bảo mật</h3>
              <p class="text-[11px] text-gray-500">Vui lòng cuộn chuột đọc đến cuối văn bản để mở khóa xác nhận</p>
            </div>
          </div>
          <button id="btnCloseCombinedModal" type="button" class="w-8 h-8 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors cursor-pointer">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- Thân Popup: Cuộn độc lập, chia 2 phần rõ rệt không đè nhau -->
        <div class="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 leading-relaxed" id="scrollableTermsContent" style="max-height: 60vh;">
          
          <!-- KHỐI 1: ĐIỀU KHOẢN SỬ DỤNG DỊCH VỤ -->
          <div class="p-5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-gray-200">
              <span class="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
              <h4 class="font-bold text-base text-primary uppercase tracking-wide">Phần I: Điều khoản sử dụng dịch vụ</h4>
            </div>
            
            <p><strong>1. Chấp thuận điều khoản:</strong> Bằng việc tạo tài khoản hoặc sử dụng dịch vụ SportBooking, bạn đồng ý tuân thủ toàn bộ các quy định đặt giữ chỗ, thanh toán và văn hóa giao lưu thể thao.</p>
            <p><strong>2. Cơ chế khóa giữ chỗ (Slot-locking 10 phút):</strong> Hệ thống tự động khóa giữ chỗ trong 10 phút khi bạn chọn sân để thực hiện thanh toán. Nếu quá 10 phút chưa hoàn tất, slot sân sẽ tự động giải phóng.</p>
            <p><strong>3. Chính sách hủy sân và hoàn cọc:</strong></p>
            <ul class="list-disc pl-5 space-y-1 text-xs sm:text-sm">
              <li><strong>Trước 24 giờ:</strong> Hoàn 100% tiền cọc về tài khoản nguồn.</li>
              <li><strong>Từ 6 đến 24 giờ:</strong> Hoàn 50% tiền cọc (50% hỗ trợ phí duy trì cho chủ sân).</li>
              <li><strong>Dưới 6 giờ hoặc không có mặt (No-show):</strong> Không hỗ trợ hoàn cọc.</li>
              <li><strong>Thời tiết bất khả kháng:</strong> Sân ngoài trời gặp mưa bão ngập lụt được quyền dời lịch hoặc nhận hoàn tiền 100%.</li>
            </ul>
            <p><strong>4. Trách nhiệm người chơi:</strong> Đến đúng giờ, sử dụng đúng sân con và bồi thường nếu cố ý gây hư hại tài sản (thảm sàn, lưới, hệ thống chiếu sáng).</p>
          </div>

          <!-- KHỐI 2: CHÍNH SÁCH BẢO MẬT & DỮ LIỆU CÁ NHÂN -->
          <div class="p-5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-gray-200">
              <span class="w-2.5 h-2.5 rounded-full bg-secondary inline-block"></span>
              <h4 class="font-bold text-base text-secondary uppercase tracking-wide">Phần II: Chính sách bảo vệ dữ liệu cá nhân</h4>
            </div>
            
            <p class="text-xs text-primary font-semibold italic">Tuân thủ nghiêm ngặt Nghị định số 13/2023/NĐ-CP của Chính phủ về Bảo vệ dữ liệu cá nhân.</p>
            <p><strong>1. Dữ liệu thu thập:</strong> Họ và tên, số điện thoại, địa chỉ email, môn thể thao ưa thích và lịch sử giao dịch đặt sân.</p>
            <p><strong>2. Mục đích sử dụng:</strong> Xác nhận đặt chỗ, cấp mã đơn hàng, điều phối lịch thi đấu, hỗ trợ chăm sóc khách hàng 24/7 và phục vụ tính năng tìm đối chơi MatchMaker.</p>
            <p><strong>3. Cam kết bảo mật:</strong> Không bán hoặc chia sẻ thông tin cho bên thứ ba vì mục đích tiếp thị khi chưa có sự đồng ý của bạn. Mã hóa truyền tải an toàn SSL 256-bit.</p>
            <p><strong>4. Quyền của chủ thể dữ liệu:</strong> Bạn có quyền truy cập, chỉnh sửa hoặc yêu cầu xóa bỏ tài khoản và dữ liệu cá nhân bất kỳ lúc nào.</p>
          </div>

          <!-- ĐIỂM ĐÁNH DẤU CHẠM ĐÁY -->
          <div id="termsBottomMarker" class="p-3 bg-green-50 rounded-xl text-center text-xs text-primary font-bold border border-green-200 flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]">task_alt</span>
            <span>Bạn đã đọc hết nội dung! Bây giờ bạn có thể tick xác nhận bên dưới.</span>
          </div>
        </div>

        <!-- Chân Popup: Chỉ mở khóa khi cuộn chạm đáy -->
        <div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <label class="flex items-center gap-2.5 select-none cursor-not-allowed opacity-50 transition-all" id="labelModalCheckbox">
            <input type="checkbox" id="modalAgreeCheckbox" disabled class="w-5 h-5 rounded text-primary focus:ring-0 accent-primary cursor-pointer">
            <span class="text-xs sm:text-sm font-semibold text-gray-500" id="modalAgreeText">Cuộn xuống dưới cùng để mở tick</span>
          </label>

          <button id="btnConfirmLegalRead" type="button" disabled class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gray-300 text-gray-500 font-bold text-sm transition-all cursor-not-allowed">
            Đồng ý & Xác nhận
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modalDiv);

    const scrollContainer = document.getElementById('scrollableTermsContent');
    const modalCheckbox = document.getElementById('modalAgreeCheckbox');
    const labelCheckbox = document.getElementById('labelModalCheckbox');
    const modalAgreeText = document.getElementById('modalAgreeText');
    const btnConfirm = document.getElementById('btnConfirmLegalRead');
    const btnClose = document.getElementById('btnCloseCombinedModal');

    // Bắt sự kiện cuộn chạm đáy
    scrollContainer.addEventListener('scroll', function () {
      const isBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 25;
      
      if (isBottom && modalCheckbox.disabled) {
        modalCheckbox.disabled = false;
        labelCheckbox.classList.remove('cursor-not-allowed', 'opacity-50');
        labelCheckbox.classList.add('cursor-pointer');
        modalAgreeText.textContent = 'Tôi đã đọc và đồng ý toàn bộ điều khoản & chính sách trên';
        modalAgreeText.classList.remove('text-gray-500');
        modalAgreeText.classList.add('text-gray-900', 'font-bold');
      }
    });

    // Mở khóa nút bấm khi đã tick
    modalCheckbox.addEventListener('change', function () {
      if (this.checked) {
        btnConfirm.disabled = false;
        btnConfirm.className = 'w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm shadow-sm transition-all cursor-pointer';
      } else {
        btnConfirm.disabled = true;
        btnConfirm.className = 'w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gray-300 text-gray-500 font-bold text-sm transition-all cursor-not-allowed';
      }
    });

    // Bấm xác nhận trong Popup
    btnConfirm.addEventListener('click', function () {
      window.isTermsAccepted = true;

      // 1. Cập nhật hidden input của form
      const hiddenInput = document.getElementById('termsConfirmedInput');
      if (hiddenInput) {
        hiddenInput.value = 'true';
        hiddenInput.dispatchEvent(new Event('change'));
      }

      // 2. Cập nhật checkbox ẩn nếu có
      const formCheckbox = document.getElementById('agreeTerms') || document.getElementById('termsAgree');
      if (formCheckbox) {
        formCheckbox.disabled = false;
        formCheckbox.checked = true;
        formCheckbox.dispatchEvent(new Event('change'));
      }

      // 3. Cập nhật giao diện nút bấm và badge ngoài trang đăng ký
      const statusBadge = document.getElementById('termsStatusBadge');
      if (statusBadge) {
        statusBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-100 text-primary text-[11px] font-bold';
        statusBadge.innerHTML = '<span class="material-symbols-outlined text-[14px]">check_circle</span><span>Đã xác nhận</span>';
      }

      const openBtn = document.getElementById('btnOpenLegalModal') || document.getElementById('btnOpenTermsPopup');
      if (openBtn) {
        openBtn.className = 'px-4 py-2 rounded-xl bg-green-100 text-primary font-bold text-xs transition-all flex items-center justify-center gap-1 shrink-0';
        openBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">verified</span><span>Đã đọc & Đồng ý</span>';
      }

      closeModal();
    });

    btnClose.addEventListener('click', closeModal);
    modalDiv.addEventListener('click', function (e) {
      if (e.target === modalDiv) closeModal();
    });
  }

  function openModal() {
    createModal();
    const modal = document.getElementById('combinedLegalModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = document.getElementById('combinedLegalModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    }
  }

  // Bắt sự kiện bấm vào nút mở điều khoản trên trang
  document.addEventListener('click', function (e) {
    const trigger = e.target.closest('#btnOpenLegalModal, #btnOpenTermsPopup, .open-terms-trigger');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      openModal();
    }
  });
})();

/**
 * =========================================================================
 * SPORTBOOKING - AUTH & CENTRAL NOTIFICATION SYSTEM (auth.js)
 * Tự động đồng bộ Chuông & Thông báo nhanh trên TẤT CẢ các trang
 * =========================================================================
 */

// 1. LẤY THÔNG TIN USER ĐANG ĐĂNG NHẬP
function getActiveUser() {
    try {
        return JSON.parse(sessionStorage.getItem('sb_session')) ||
               JSON.parse(localStorage.getItem('sb_session')) ||
               JSON.parse(localStorage.getItem('currentUser')) ||
               JSON.parse(localStorage.getItem('current_user')) || null;
    } catch (e) {
        return null;
    }
}

// 2. KHÓA LƯU TRỮ THÔNG BÁO RIÊNG BIỆT THEO TỪNG TÀI KHOẢN
function getUserNotifKey() {
    const user = getActiveUser();
    const uid = user ? (user.id || user.phone || user.username || 'user') : 'guest';
    return `sb_notifs_user_${uid}`;
}

// 3. LẤY DANH SÁCH THÔNG BÁO THỰC TẾ
function getUserNotifications() {
    const key = getUserNotifKey();
    const user = getActiveUser();
    let notifs = [];

    try {
        notifs = JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
        notifs = [];
    }

    // Nếu tài khoản mới chưa có thông báo nào thì tự động tạo 1 thông báo chào mừng
    if (notifs.length === 0 && user) {
        notifs = [
            {
                id: 'notif_welcome_' + Date.now(),
                title: 'Chào mừng bạn đến với SportBooking!',
                desc: `Xin chào ${user.fullName || user.name || 'bạn'}, chúc bạn có những trận đấu thể thao tuyệt vời. Đặt sân ngay để nhận ưu đãi!`,
                time: 'Vừa xong',
                read: false,
                icon: 'celebration',
                color: 'text-primary bg-primary/10'
            }
        ];
        localStorage.setItem(key, JSON.stringify(notifs));
    }

    return notifs;
}

// 4. HÀM THÊM THÔNG BÁO MỚI (DÙNG KHI ĐẶT SÂN / GHÉP ĐỐI THÀNH CÔNG)
window.addNotification = function(data) {
    const key = getUserNotifKey();
    let notifs = getUserNotifications();

    const newNotif = {
        id: 'notif_' + Date.now(),
        title: data.title || 'Thông báo mới',
        desc: data.desc || '',
        time: 'Vừa xong',
        read: false, // Mặc định là chưa đọc -> chuông hiện chấm đỏ
        icon: data.icon || 'sports_soccer',
        color: data.color || 'text-primary bg-primary/10',
        createdAt: new Date().toISOString()
    };

    notifs.unshift(newNotif);
    localStorage.setItem(key, JSON.stringify(notifs));
    renderGlobalNotification();
};

// 5. HÀM ĐÁNH DẤU TẤT CẢ LÀ ĐÃ ĐỌC
window.markAllNotificationsRead = function() {
    const key = getUserNotifKey();
    let notifs = getUserNotifications();
    notifs.forEach(n => n.read = true);
    localStorage.setItem(key, JSON.stringify(notifs));
    renderGlobalNotification();
};

// 6. TỰ ĐỘNG VẼ CHUÔNG & KHUNG XEM NHANH ĐỒNG BỘ TRÊN MỌI TRANG
function renderGlobalNotification() {
    let container = document.getElementById('notifDropdownContainer');
    
    // Tự động tìm chuông nếu chưa có container ID
    if (!container) {
        const header = document.querySelector('header');
        if (header) {
            const oldBell = header.querySelector('a[href*="thong-bao"], button[aria-label*="Thông báo"]');
            if (oldBell) {
                const wrapper = document.createElement('div');
                wrapper.className = 'relative';
                wrapper.id = 'notifDropdownContainer';
                oldBell.parentNode.replaceChild(wrapper, oldBell);
                container = wrapper;
            }
        }
    }

    if (!container) return;

    const notifs = getUserNotifications();
    const unreadCount = notifs.filter(n => !n.read).length;

    // Giao diện đồng bộ chuẩn xác 100%
    container.innerHTML = `
        <!-- NÚT CHUÔNG ĐỒNG BỘ -->
        <button aria-label="Thông báo" id="btnToggleNotifDropdown" class="relative p-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-center outline-none" type="button">
            <span class="material-symbols-outlined text-[24px] align-middle" style="font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;">notifications</span>
            ${unreadCount > 0 ? `<span class="absolute top-2 right-2 w-2 h-2 bg-error rounded-full animate-pulse" id="badgeQuickCount"></span>` : ''}
        </button>

        <!-- KHUNG XEM NHANH THÔNG BÁO (POPOVER) -->
        <div class="hidden absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 flex-col z-50 overflow-hidden" id="quickNotifPopover">
            
            <!-- HEADER -->
            <div class="p-3.5 border-b border-gray-100 bg-surface-container-lowest flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <h3 class="text-sm font-bold text-on-surface">Thông báo</h3>
                    <span class="px-2 py-0.5 rounded-full ${unreadCount > 0 ? 'bg-red-100 text-error' : 'bg-gray-100 text-gray-500'} text-[10px] font-bold" id="badgePopoverUnread">
                        ${unreadCount} chưa đọc
                    </span>
                </div>
                <button type="button" onclick="window.markAllNotificationsRead()" class="text-xs text-primary font-bold hover:underline cursor-pointer">
                    Đã đọc tất cả
                </button>
            </div>

            <!-- DANH SÁCH THÔNG BÁO THỰC TẾ -->
            <div class="max-h-[340px] overflow-y-auto divide-y divide-gray-100" id="quickNotifList">
                ${notifs.length === 0 ? `
                    <div class="py-8 text-center text-gray-400 text-xs">
                        <span class="material-symbols-outlined text-3xl mb-1 text-gray-300">notifications_off</span>
                        <p>Chưa có thông báo nào</p>
                    </div>
                ` : notifs.map(n => `
                    <div onclick="window.location.href='thong-bao.html'" class="p-3.5 hover:bg-surface-container-low transition-colors flex items-start gap-3 cursor-pointer ${n.read ? 'bg-white opacity-80' : 'bg-green-50/50'}">
                        <div class="w-10 h-10 rounded-xl ${n.color || 'bg-primary/10 text-primary'} flex items-center justify-center shrink-0 mt-0.5">
                            <span class="material-symbols-outlined text-[20px]">${n.icon || 'notifications'}</span>
                        </div>
                        <div class="flex-1 min-w-0 flex flex-col gap-0.5 text-xs">
                            <div class="flex items-baseline justify-between">
                                <span class="font-bold text-on-surface truncate">${n.title}</span>
                                <span class="text-[10px] text-gray-400 shrink-0 ml-1">${n.time || ''}</span>
                            </div>
                            <p class="text-gray-600 line-clamp-2 leading-relaxed mt-0.5">${n.desc}</p>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- FOOTER -->
            <div class="p-2.5 bg-surface-container-low text-center border-t border-gray-100">
                <a class="inline-flex items-center justify-center gap-1 text-xs font-bold text-primary hover:text-primary-container transition-colors cursor-pointer" href="thong-bao.html">
                    <span>Xem tất cả thông báo</span>
                    <span class="material-symbols-outlined text-[15px]">chevron_right</span>
                </a>
            </div>
        </div>
    `;

    // Gắn sự kiện đóng mở popover
    const btn = document.getElementById('btnToggleNotifDropdown');
    const popover = document.getElementById('quickNotifPopover');

    if (btn && popover) {
        btn.onclick = (e) => {
            e.stopPropagation();
            popover.classList.toggle('hidden');
            popover.classList.toggle('flex');
        };

        document.onclick = (e) => {
            if (!container.contains(e.target)) {
                popover.classList.add('hidden');
                popover.classList.remove('flex');
            }
        };

        document.onkeydown = (e) => {
            if (e.key === 'Escape') {
                popover.classList.add('hidden');
                popover.classList.remove('flex');
            }
        };
    }
}

// 7. ĐỒNG BỘ HEADER USER TRÊN MỌI TRANG
function syncHeaderUserInfo() {
    const userContainer = document.getElementById('userHeaderArea');
    if (!userContainer) return;

    const user = getActiveUser();

    if (user) {
        const displayName = user.fullName || user.full_name || user.name || user.phone || 'Người dùng';
        const firstLetter = displayName.trim().charAt(0).toUpperCase();
        const roleText = (user.role === 'admin' || user.is_admin) ? 'Admin' : 'Thành viên';

        userContainer.innerHTML = `
            <div id="userProfileTrigger" class="flex items-center gap-2 cursor-pointer p-1 rounded-xl hover:bg-gray-100 transition-all group" title="Bấm để xem hồ sơ cá nhân" onclick="window.location.href='ho-so-ca-nhan.html'">
                <div class="w-8 h-8 rounded-full bg-green-100 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-green-300 shadow-xs group-hover:scale-105 transition-transform">
                    ${firstLetter}
                </div>
                <div class="flex flex-col text-left">
                    <span id="headerUsername" class="text-xs font-bold text-gray-900 leading-tight truncate max-w-[130px]">
                        ${displayName}
                    </span>
                    <span id="headerUserRole" style="color: #9d4300 !important; font-weight: 700 !important; font-size: 10px !important;">
                        ${roleText}
                    </span>
                </div>
                <button onclick="event.stopPropagation(); handleLogout()" type="button" title="Đăng xuất" class="ml-1 p-1 text-gray-400 hover:text-error hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center cursor-pointer">
                    <span class="material-symbols-outlined text-[18px]">logout</span>
                </button>
            </div>
        `;
    } else {
        userContainer.innerHTML = `
            <div class="flex items-center gap-2">
                <a href="dang-nhap.html" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                    Đăng nhập
                </a>
                <a href="dang-ky.html" class="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm">
                    Đăng ký
                </a>
            </div>
        `;
    }
}

function handleLogout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        sessionStorage.removeItem('sb_session');
        localStorage.removeItem('sb_session');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('current_user');
        window.location.href = 'dang-nhap.html';
    }
}

// 8. TỰ ĐỘNG CHẠY KHI BẤT KỲ TRANG NÀO TẢI XONG
document.addEventListener('DOMContentLoaded', () => {
    syncHeaderUserInfo();
    renderGlobalNotification();
});
/**
 * auth.js - QUẢN LÝ TÀI KHOẢN, HEADER VÀ HỆ THỐNG THÔNG BÁO TỰ ĐỘNG
 */

// 1. HÀM TÍNH THỜI GIAN TƯƠNG ĐỐI (30 phút trước, 2 giờ trước...)
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Vừa xong';

    let timeNum = null;
    if (typeof timestamp === 'number') {
        timeNum = timestamp;
    } else if (typeof timestamp === 'string') {
        // Tự bóc tách timestamp từ id cũ dạng 'notif_1730384920000'
        if (timestamp.startsWith('notif_')) {
            timeNum = parseInt(timestamp.replace('notif_', ''), 10);
        } else if (!isNaN(Number(timestamp))) {
            timeNum = Number(timestamp);
        } else {
            const parsed = Date.parse(timestamp);
            if (!isNaN(parsed)) timeNum = parsed;
        }
    }

    if (!timeNum || isNaN(timeNum)) return 'Vừa xong';

    const diffSeconds = Math.floor((Date.now() - timeNum) / 1000);

    if (diffSeconds < 60) return 'Vừa xong';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} phút trước`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} giờ trước`;
    if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 86400)} ngày trước`;

    const d = new Date(timeNum);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// 2. LẤY TÀI KHOẢN ĐANG ĐĂNG NHẬP
function getLoggedInUser() {
    try {
        return JSON.parse(sessionStorage.getItem('sb_session')) ||
               JSON.parse(localStorage.getItem('sb_session')) ||
               JSON.parse(localStorage.getItem('currentUser')) ||
               JSON.parse(localStorage.getItem('current_user')) || null;
    } catch (e) { return null; }
}

// 3. THÊM THÔNG BÁO MỚI (LƯU KÈM TIMESTAMP CHUẨN ĐỂ ĐẾM THỜI GIAN)
function pushNotificationToAccount(notif) {
    const user = getLoggedInUser();
    const uid = user ? (user.id || user.phone || 'user') : 'guest';
    const key = `sb_notifs_user_${uid}`;

    let notifs = [];
    try { notifs = JSON.parse(localStorage.getItem(key)) || []; } catch(e) {}

    const now = Date.now();
    notifs.unshift({
        id: 'notif_' + now,
        title: notif.title || 'Thông báo mới',
        desc: notif.desc || '',
        createdAt: now, // Mốc thời gian thực để tính "30 phút trước"
        read: false,
        icon: notif.icon || 'notifications',
        color: notif.color || 'text-primary bg-primary/10'
    });

    localStorage.setItem(key, JSON.stringify(notifs));
    loadUserNotifications();
}

// 4. NẠP VÀ HIỂN THỊ THÔNG BÁO CÓ THỜI GIAN TỰ TÍNH THEO THỰC TẾ
function loadUserNotifications() {
    const user = getLoggedInUser();
    const uid = user ? (user.id || user.phone || 'user') : 'guest';
    const key = `sb_notifs_user_${uid}`;

    let notifs = [];
    try { notifs = JSON.parse(localStorage.getItem(key)) || []; } catch(e) {}

    if (notifs.length === 0 && user) {
        const welcomeTime = Date.now() - 30 * 60 * 1000; // Mặc định 30 phút trước
        notifs = [
            {
                id: 'notif_' + welcomeTime,
                title: 'Chào mừng bạn đến với SportBooking!',
                desc: `Xin chào ${user.fullName || user.name || 'bạn'}, chúc bạn có những trận đấu thể thao tuyệt vời!`,
                createdAt: welcomeTime,
                read: false,
                icon: 'celebration',
                color: 'text-primary bg-primary/10'
            }
        ];
        localStorage.setItem(key, JSON.stringify(notifs));
    }

    const unreadCount = notifs.filter(n => !n.read).length;
    const badgeCount = document.getElementById('badgeQuickCount') || document.getElementById('notifBadge');
    const badgeUnread = document.getElementById('badgePopoverUnread') || document.getElementById('notifUnreadCount');
    const listContainer = document.getElementById('quickNotifList') || document.getElementById('notifList');

    if (badgeCount) {
        if (unreadCount > 0) badgeCount.classList.remove('hidden');
        else badgeCount.classList.add('hidden');
    }

    if (badgeUnread) {
        badgeUnread.textContent = `${unreadCount} chưa đọc`;
        badgeUnread.className = `px-2 py-0.5 rounded-full ${unreadCount > 0 ? 'bg-red-100 text-error' : 'bg-gray-100 text-gray-500'} text-[10px] font-bold`;
    }

    if (listContainer) {
        if (notifs.length === 0) {
            listContainer.innerHTML = `
                <div class="py-8 text-center text-gray-400 text-xs">
                    <span class="material-symbols-outlined text-3xl mb-1 text-gray-300">notifications_off</span>
                    <p>Chưa có thông báo nào</p>
                </div>
            `;
        } else {
            listContainer.innerHTML = notifs.map(n => {
                // Tự động tính "X phút trước" từ createdAt hoặc id
                const timeAgoText = formatTimeAgo(n.createdAt || n.id || n.time);

                return `
                    <div onclick="window.location.href='thong-bao.html'" class="p-3.5 hover:bg-surface-container-low transition-colors flex items-start gap-3 cursor-pointer ${n.read ? 'bg-white opacity-85' : 'bg-green-50/50'}">
                        <div class="w-10 h-10 rounded-xl ${n.color || 'bg-primary/10 text-primary'} flex items-center justify-center shrink-0 mt-0.5">
                            <span class="material-symbols-outlined text-[20px]">${n.icon || 'notifications'}</span>
                        </div>
                        <div class="flex-1 min-w-0 flex flex-col gap-0.5 text-xs">
                            <div class="flex items-baseline justify-between">
                                <span class="font-bold text-on-surface truncate">${n.title}</span>
                                <span class="text-[10px] text-gray-400 shrink-0 ml-1 font-medium">${timeAgoText}</span>
                            </div>
                            <p class="text-gray-600 line-clamp-2 leading-relaxed mt-0.5">${n.desc}</p>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// 5. ĐÁNH DẤU TẤT CẢ ĐÃ ĐỌC
function markAllNotificationsAsRead() {
    const user = getLoggedInUser();
    const uid = user ? (user.id || user.phone || 'user') : 'guest';
    const key = `sb_notifs_user_${uid}`;

    let notifs = [];
    try { notifs = JSON.parse(localStorage.getItem(key)) || []; } catch(e) {}
    notifs.forEach(n => n.read = true);
    localStorage.setItem(key, JSON.stringify(notifs));
    loadUserNotifications();
}

// 6. ĐỒNG BỘ HEADER USER VÀ NÚT ĐĂNG XUẤT CHUẨN ẢNH
function syncHeaderUserInfo() {
    const userContainer = document.getElementById('userHeaderArea');
    if (!userContainer) return;

    const user = getLoggedInUser();

    if (user) {
        const displayName = user.fullName || user.full_name || user.name || user.phone || 'Trúc Lam';
        const firstLetter = displayName.trim().charAt(0).toUpperCase();
        const roleText = (user.role === 'admin' || user.is_admin) ? 'Admin' : 'Thành viên';

        userContainer.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity" onclick="window.location.href='ho-so-ca-nhan.html'" title="Xem hồ sơ cá nhân">
                    <div class="w-9 h-9 rounded-full bg-emerald-100 text-primary font-bold text-sm flex items-center justify-center shrink-0 border border-emerald-300">
                        ${firstLetter}
                    </div>
                    <div class="flex flex-col text-left">
                        <span id="headerUsername" class="text-sm font-bold text-slate-900 leading-tight">
                            ${displayName}
                        </span>
                        <span id="headerUserRole" class="text-xs font-bold leading-tight" style="color: #9d4300;">
                            ${roleText}
                        </span>
                    </div>
                </div>

                <button onclick="handleLogout()" type="button" title="Đăng xuất" class="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center outline-none">
                    <span class="material-symbols-outlined text-[20px]">logout</span>
                </button>
            </div>
        `;
    } else {
        userContainer.innerHTML = `
            <div class="flex items-center gap-2">
                <a href="dang-nhap.html" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                    Đăng nhập
                </a>
                <a href="dang-ky.html" class="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm">
                    Đăng ký
                </a>
            </div>
        `;
    }
}

// 7. HÀM ĐĂNG XUẤT
function handleLogout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) {
        sessionStorage.removeItem('sb_session');
        localStorage.removeItem('sb_session');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('current_user');
        localStorage.removeItem('sb_current_user');
        window.location.href = 'dang-nhap.html';
    }
}

// 8. TỰ ĐỘNG KHỞI CHẠY KHI MỞ TRANG
document.addEventListener('DOMContentLoaded', () => {
    syncHeaderUserInfo();
    loadUserNotifications();
});


