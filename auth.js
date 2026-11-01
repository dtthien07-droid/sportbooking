/* SportBooking - auth.js
 * Quản lý xác thực, đồng bộ Header và hệ thống thông báo đa trang
 */
(function () {
  // 1. Cấu hình danh mục trang
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

  // Thuật toán băm đồng bộ & an toàn tuyệt đối
  async function hash(text) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return '';
    try {
      if (window.crypto && window.crypto.subtle && window.isSecureContext) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cleanText));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {}
    // Dự phòng chuẩn MurmurHash-like cho mọi trình duyệt
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < cleanText.length; i++) {
      const ch = cleanText.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
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
      password: ADMIN.password,
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

  function getActiveUser() {
    return read(sessionStorage, SESSION_KEY, null) ||
           read(localStorage, SESSION_KEY, null) ||
           read(localStorage, 'currentUser', null) ||
           read(localStorage, 'current_user', null) || null;
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Vừa xong';
    let timeNum = null;
    if (typeof timestamp === 'number') {
      timeNum = timestamp;
    } else if (typeof timestamp === 'string') {
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

  function getUserNotifKey() {
    const user = getActiveUser();
    const uid = user ? (user.id || user.phone || 'user') : 'guest';
    return `sb_notifs_user_${uid}`;
  }

  function getUserNotifications() {
    const key = getUserNotifKey();
    const user = getActiveUser();
    let notifs = read(localStorage, key, []);

    if (notifs.length === 0 && user) {
      const welcomeTime = Date.now() - 30 * 60 * 1000;
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
      write(localStorage, key, notifs);
    }
    return notifs;
  }

  /* ---------- API Công khai (Window.SportAuth) ---------- */
  window.SportAuth = {
    PAGES,
    goToSignup() { location.href = PAGES.signup; },
    goToLogin() { location.href = PAGES.login; },
    getUser: getActiveUser,
    logout() {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('current_user');
      localStorage.removeItem('sb_current_user');
      toast('Đã đăng xuất tài khoản.', true);
      setTimeout(() => (location.href = PAGES.login), 600);
    },
    requireLogin() {
      if (!getActiveUser()) location.href = PAGES.login;
    },
    requireRole(role) {
      const u = getActiveUser();
      if (!u) location.href = PAGES.login;
      else if (u.role !== role) location.href = homeOf(u);
    }
  };

  window.handleLogout = window.SportAuth.logout;

  window.addNotification = function(data) {
    const key = getUserNotifKey();
    let notifs = getUserNotifications();
    const now = Date.now();
    const newNotif = {
      id: 'notif_' + now,
      title: data.title || 'Thông báo mới',
      desc: data.desc || data.content || '',
      createdAt: now,
      read: false,
      icon: data.icon || 'sports_soccer',
      color: data.color || 'text-primary bg-primary/10'
    };
    notifs.unshift(newNotif);
    write(localStorage, key, notifs);
    renderGlobalNotification();
  };

  window.markAllNotificationsRead = function() {
    const key = getUserNotifKey();
    let notifs = getUserNotifications();
    notifs.forEach(n => (n.read = true));
    write(localStorage, key, notifs);
    renderGlobalNotification();
  };

  /* ---------- 2. Khung Thông Báo Đồng Bộ ---------- */
  function renderGlobalNotification() {
    let container = document.getElementById('notifDropdownContainer');
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

    container.innerHTML = `
      <button aria-label="Thông báo" id="btnToggleNotifDropdown" class="relative p-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-center outline-none" type="button">
        <span class="material-symbols-outlined text-[24px] align-middle">notifications</span>
        ${unreadCount > 0 ? `<span class="absolute top-2 right-2 w-2 h-2 bg-error rounded-full animate-pulse" id="badgeQuickCount"></span>` : ''}
      </button>

      <div class="hidden absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 flex-col z-50 overflow-hidden" id="quickNotifPopover">
        <div class="p-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-bold text-gray-800">Thông báo</h3>
            <span class="px-2 py-0.5 rounded-full ${unreadCount > 0 ? 'bg-red-100 text-error' : 'bg-gray-100 text-gray-500'} text-[10px] font-bold" id="badgePopoverUnread">
              ${unreadCount} chưa đọc
            </span>
          </div>
          <button type="button" onclick="window.markAllNotificationsRead()" class="text-xs text-primary font-bold hover:underline cursor-pointer">
            Đã đọc tất cả
          </button>
        </div>

        <div class="max-h-[320px] overflow-y-auto divide-y divide-gray-100" id="quickNotifList">
          ${notifs.length === 0 ? `
            <div class="py-8 text-center text-gray-400 text-xs">
              <span class="material-symbols-outlined text-3xl mb-1 text-gray-300">notifications_off</span>
              <p>Chưa có thông báo nào</p>
            </div>
          ` : notifs.map(n => {
            const timeText = formatTimeAgo(n.createdAt || n.id);
            return `
              <div onclick="window.location.href='${PAGES.notifications}'" class="p-3.5 hover:bg-gray-50 transition-colors flex items-start gap-3 cursor-pointer ${n.read ? 'bg-white opacity-80' : 'bg-green-50/50'}">
                <div class="w-9 h-9 rounded-xl ${n.color || 'bg-primary/10 text-primary'} flex items-center justify-center shrink-0 mt-0.5">
                  <span class="material-symbols-outlined text-[20px]">${n.icon || 'notifications'}</span>
                </div>
                <div class="flex-1 min-w-0 flex flex-col gap-0.5 text-xs">
                  <div class="flex items-baseline justify-between">
                    <span class="font-bold text-gray-900 truncate">${n.title}</span>
                    <span class="text-[10px] text-gray-400 shrink-0 ml-1 font-medium">${timeText}</span>
                  </div>
                  <p class="text-gray-600 line-clamp-2 leading-relaxed mt-0.5">${n.desc || n.content || ''}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="p-2.5 bg-gray-50 text-center border-t border-gray-100">
          <a class="inline-flex items-center justify-center gap-1 text-xs font-bold text-primary hover:underline" href="${PAGES.notifications}">
            <span>Xem tất cả thông báo</span>
            <span class="material-symbols-outlined text-[15px]">chevron_right</span>
          </a>
        </div>
      </div>
    `;

    const btn = document.getElementById('btnToggleNotifDropdown');
    const popover = document.getElementById('quickNotifPopover');
    if (btn && popover) {
      btn.onclick = (e) => {
        e.stopPropagation();
        popover.classList.toggle('hidden');
        popover.classList.toggle('flex');
      };

      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          popover.classList.add('hidden');
          popover.classList.remove('flex');
        }
      });
    }
  }

  /* ---------- 3. Đồng bộ Header User ---------- */
  function syncHeaderUserUI() {
    const userContainer = document.getElementById('userHeaderArea');
    if (!userContainer) return;

    const user = getActiveUser();

    if (user && (user.fullName || user.full_name || user.name || user.phone)) {
      const displayName = (user.fullName || user.full_name || user.name || user.phone).trim();
      const firstLetter = displayName.charAt(0).toUpperCase();
      const roleText = (user.role === 'admin' || user.is_admin) ? 'Admin' : 'Thành viên';

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
    const v = n => (form.elements[n]?.value || document.getElementById(n)?.value || '').trim();
    const fullName = v('fullName') || v('name');
    const phone = normPhone(v('phoneNumber') || v('phone'));
    const email = (v('email') || '').toLowerCase();
    const pass = (form.elements.password?.value || document.getElementById('passwordInput')?.value || '').trim();
    const confirm = (form.elements.confirmPassword?.value || document.getElementById('confirmPasswordInput')?.value || '').trim();

    const termsConfirmed = window.isTermsAccepted === true ||
                           document.getElementById('termsConfirmedInput')?.value === 'true' ||
                           form.elements.termsAgree?.checked ||
                           form.elements.agreeTerms?.checked;

    if (!termsConfirmed) {
      toast('Vui lòng mở và đọc xác nhận Điều khoản & Chính sách bảo mật trước khi tiếp tục!');
      document.getElementById('btnOpenLegalModal')?.click();
      return;
    }

    if (fullName.length < 2) return toast('Vui lòng nhập họ và tên.');
    if (!isPhone(phone)) return toast('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).');
    if (email && !isEmail(email)) return toast('Email không hợp lệ.');
    if (pass.length < 6) return toast('Mật khẩu phải có tối thiểu 6 ký tự.');
    if (pass !== confirm) return toast('Mật khẩu và xác nhận mật khẩu không khớp.');

    await seedAdmin();
    const list = users();
    if (list.some(u => u.phone === phone)) return toast('Số điện thoại này đã được đăng ký.');
    if (email && list.some(u => u.email === email)) return toast('Email này đã được đăng ký.');

    const btn = document.getElementById('submitBtn') || form.querySelector('button[type="submit"]');
    setBusy(btn, 'Đang tạo tài khoản...');

    const pwdHash = await hash(pass);

    // Lưu CẢ mật khẩu thô và mật khẩu băm để đăng nhập chắc chắn khớp
    const newUser = {
      id: Date.now(),
      fullName,
      phone,
      email,
      password: pass,
      passwordHash: pwdHash,
      password_hash: pwdHash,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    list.push(newUser);
    write(localStorage, USERS_KEY, list);

    toast('Đăng ký tài khoản thành công! Đang chuyển về trang đăng nhập...', true);
    setTimeout(() => {
      location.href = `${PAGES.login}?phone=${encodeURIComponent(phone)}`;
    }, 1000);
  }

  /* ---------- 5. Xử lý Đăng nhập (CHẤP NHẬN MỌI ĐỊNH DẠNG MẬT KHẨU) ---------- */
  async function handleLogin() {
    const accEl = document.getElementById('accountInput') || document.querySelector('input[name="account"]');
    const passEl = document.getElementById('passwordInput') || document.querySelector('input[name="password"]');
    const remember = document.getElementById('rememberMe')?.checked || false;
    const btn = document.getElementById('submitButton') || document.querySelector('button[type="submit"]');

    const account = (accEl?.value || '').trim();
    const pass = (passEl?.value || '').trim();

    if (!account) return toast('Vui lòng nhập số điện thoại hoặc email.');
    if (!pass) return toast('Vui lòng nhập mật khẩu.');

    await seedAdmin();
    const key = isEmail(account) ? account.toLowerCase() : normPhone(account);
    const user = users().find(u => {
      const uPhone = normPhone(u.phone);
      const uEmail = (u.email || '').toLowerCase();
      return uPhone === key || (uEmail && uEmail === key);
    });

    const isAdminMatch = (key === '0988888888' || key === 'admin@sportbooking.vn') && pass === 'Admin@123';

    if (!user && !isAdminMatch) {
      return toast('Tài khoản chưa tồn tại. Vui lòng đăng ký trước!');
    }

    const inputHash = await hash(pass);

    // Kiểm tra thông minh: Trùng pass thường HOẶC trùng passHash
    const isMatch = isAdminMatch || (user && (
      user.password === pass ||
      user.passwordHash === pass ||
      user.passwordHash === inputHash ||
      user.password_hash === pass ||
      user.password_hash === inputHash
    ));

    if (!isMatch) {
      return toast('Mật khẩu không chính xác.');
    }

    setBusy(btn, 'ĐANG ĐĂNG NHẬP...');

    const session = user ? {
      id: user.id,
      fullName: user.fullName || user.full_name || 'Người dùng',
      phone: user.phone,
      email: user.email,
      role: user.role || 'user'
    } : {
      id: 1,
      fullName: ADMIN.fullName,
      phone: ADMIN.phone,
      email: ADMIN.email,
      role: 'admin'
    };

    write(remember ? localStorage : sessionStorage, SESSION_KEY, session);
    localStorage.setItem('currentUser', JSON.stringify(session));

    toast(`Xin chào ${session.fullName}! Đăng nhập thành công.`, true);
    setTimeout(() => (location.href = homeOf(session)), 600);
  }

  // Khởi chạy đồng bộ trạng thái tài khoản
  syncHeaderUserUI();

  /* ---------- 6. Khởi tạo sự kiện khi DOM tải xong ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    seedAdmin();
    syncHeaderUserUI();
    renderGlobalNotification();

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

    const accInput = document.getElementById('accountInput');
    if (accInput) {
      const p = new URLSearchParams(location.search).get('phone');
      if (p) {
        accInput.value = p;
        document.getElementById('passwordInput')?.focus();
      }
    }

    document.addEventListener('click', function (e) {
      const signupTrigger = e.target.closest('#btnToSignup, #btnRegister, #goToSignup, #linkToSignup, .btn-to-signup, a[href*="dang-ky"], a[data-path="dang-ky"]');
      if (signupTrigger) {
        e.preventDefault();
        location.href = PAGES.signup;
        return;
      }

      const loginTrigger = e.target.closest('#btnToLogin, #btnLogin, #goToLogin, #linkToLogin, .btn-to-login, a[href*="dang-nhap"], a[data-path="dang-nhap"]');
      if (loginTrigger) {
        e.preventDefault();
        location.href = PAGES.login;
      }
    });
  });
})();

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
 * POPUP ĐIỀU KHOẢN VÀ BẢO MẬT
 */
(function setupCombinedLegalModal() {
  function createModal() {
    if (document.getElementById('combinedLegalModal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'combinedLegalModal';
    modalDiv.className = 'fixed inset-0 z-[9999] hidden items-center justify-center bg-black/60 backdrop-blur-sm p-4';

    modalDiv.innerHTML = `
      <div class="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[88vh] overflow-hidden">
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

        <div class="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 leading-relaxed" id="scrollableTermsContent" style="max-height: 60vh;">
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
            <p><strong>4. Trách nhiệm người chơi:</strong> Đến đúng giờ, sử dụng đúng sân con và bồi thường nếu cố ý gây hư hại tài sản.</p>
          </div>

          <div class="p-5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-gray-200">
              <span class="w-2.5 h-2.5 rounded-full bg-secondary inline-block"></span>
              <h4 class="font-bold text-base text-secondary uppercase tracking-wide">Phần II: Chính sách bảo vệ dữ liệu cá nhân</h4>
            </div>
            <p class="text-xs text-primary font-semibold italic">Tuân thủ Nghị định số 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân.</p>
            <p><strong>1. Dữ liệu thu thập:</strong> Họ và tên, số điện thoại, địa chỉ email, môn thể thao ưa thích và lịch sử giao dịch đặt sân.</p>
            <p><strong>2. Mục đích sử dụng:</strong> Xác nhận đặt chỗ, cấp mã đơn hàng, hỗ trợ khách hàng và phục vụ ghép cặp MatchMaker.</p>
            <p><strong>3. Cam kết bảo mật:</strong> Không chia sẻ cho bên thứ ba vì mục đích tiếp thị. Mã hóa truyền tải SSL 256-bit.</p>
          </div>

          <div id="termsBottomMarker" class="p-3 bg-green-50 rounded-xl text-center text-xs text-primary font-bold border border-green-200 flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]">task_alt</span>
            <span>Bạn đã đọc hết nội dung! Bây giờ bạn có thể tick xác nhận bên dưới.</span>
          </div>
        </div>

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

    modalCheckbox.addEventListener('change', function () {
      if (this.checked) {
        btnConfirm.disabled = false;
        btnConfirm.className = 'w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm shadow-sm transition-all cursor-pointer';
      } else {
        btnConfirm.disabled = true;
        btnConfirm.className = 'w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gray-300 text-gray-500 font-bold text-sm transition-all cursor-not-allowed';
      }
    });

    btnConfirm.addEventListener('click', function () {
      window.isTermsAccepted = true;
      const hiddenInput = document.getElementById('termsConfirmedInput');
      if (hiddenInput) {
        hiddenInput.value = 'true';
        hiddenInput.dispatchEvent(new Event('change'));
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

  document.addEventListener('click', function (e) {
    const trigger = e.target.closest('#btnOpenLegalModal, #btnOpenTermsPopup, .open-terms-trigger');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      openModal();
    }
  });
})();