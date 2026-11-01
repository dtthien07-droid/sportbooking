/* SportBooking - auth.js
 * Đồng bộ hóa toàn bộ hệ thống SportBooking qua Database MySQL & Realtime Header
 */
(function () {
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

  const SESSION_KEY = 'sb_session';

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

  function toast(msg, ok = false) {
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
    }
  };

  /* ---------- XỬ LÝ ĐĂNG KÝ (GỬI LÊN DATABASE MYSQL) ---------- */
  async function handleSignup(form) {
    const v = n => (form.elements[n]?.value || '').trim();
    const fullName = v('fullName') || v('full_name') || form.querySelector('input[placeholder*="họ tên" i], input[placeholder*="Họ và tên" i]')?.value.trim() || '';
    const phone = v('phoneNumber') || v('phone') || form.querySelector('input[type="tel"]')?.value.trim() || '';
    const email = (v('email') || form.querySelector('input[type="email"]')?.value || '').trim().toLowerCase();
    const pass = form.elements.password?.value || form.querySelector('input[type="password"]')?.value || '';
    const confirm = form.elements.confirmPassword?.value || '';

    // Kiểm tra điều khoản
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

    if (!fullName || fullName.length < 2) return toast('Vui lòng nhập họ và tên đầy đủ.');
    if (!phone || phone.length < 9) return toast('Vui lòng nhập số điện thoại hợp lệ.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Email không hợp lệ.');
    if (pass.length < 6) return toast('Mật khẩu phải có tối thiểu 6 ký tự.');
    if (confirm && pass !== confirm) return toast('Mật khẩu và xác nhận mật khẩu không khớp.');

    const btn = document.getElementById('submitBtn') || form.querySelector('button[type="submit"]');
    setBusy(btn, 'Đang tạo tài khoản...');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email: email,
          phone: phone,
          password: pass
        })
      });

      const data = await res.json();

      if (data.success) {
        toast('Đăng ký tài khoản thành công! Đang chuyển về trang đăng nhập...', true);
        setTimeout(() => {
          location.href = `${PAGES.login}?account=${encodeURIComponent(email || phone)}`;
        }, 1000);
      } else {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Đăng ký';
        }
        toast(data.error || 'Đăng ký tài khoản thất bại!');
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Đăng ký';
      }
      toast('Không thể kết nối đến máy chủ Backend!');
    }
  }

  /* ---------- XỬ LÝ ĐĂNG NHẬP (TRUY VẤN TỪ DATABASE MYSQL) ---------- */
  async function handleLogin(form) {
    const accInput = document.getElementById('accountInput') || form?.querySelector('input[type="text"], input[type="email"]') || document.querySelector('input[name="emailOrPhone"]');
    const passInput = document.getElementById('passwordInput') || form?.querySelector('input[type="password"]');
    const remember = document.getElementById('rememberMe')?.checked || false;
    const btn = document.getElementById('submitButton') || form?.querySelector('button[type="submit"]') || document.querySelector('button[type="submit"]');

    const emailOrPhone = (accInput ? accInput.value : '').trim();
    const password = passInput ? passInput.value : '';

    if (!emailOrPhone) return toast('Vui lòng nhập số điện thoại hoặc email.');
    if (!password) return toast('Vui lòng nhập mật khẩu.');

    setBusy(btn, 'ĐANG ĐĂNG NHẬP...');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone, password })
      });

      const data = await res.json();

      if (data.success) {
        const sessionUser = {
          id: data.user.id,
          fullName: data.user.full_name,
          name: data.user.full_name,
          email: data.user.email,
          phone: data.user.phone,
          role: data.user.role || 'user'
        };

        write(remember ? localStorage : sessionStorage, SESSION_KEY, sessionUser);
        localStorage.setItem('currentUser', JSON.stringify(sessionUser));
        localStorage.setItem('sb_session', JSON.stringify(sessionUser));

        toast(`Xin chào ${sessionUser.fullName}! Đăng nhập thành công.`, true);
        setTimeout(() => {
          location.href = sessionUser.role === 'admin' ? PAGES.admin : PAGES.home;
        }, 800);
      } else {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'ĐĂNG NHẬP';
        }
        toast(data.error || 'Tài khoản hoặc mật khẩu không chính xác!');
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'ĐĂNG NHẬP';
      }
      toast('Không thể kết nối đến máy chủ Backend!');
    }
  }

  /* ---------- KHỞI TẠO VÀ LẮNG NGHE SỰ KIỆN ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    // Tự động điền tài khoản nếu có param trên URL
    const accInput = document.getElementById('accountInput') || document.querySelector('input[type="text"], input[type="email"]');
    if (accInput) {
      const p = new URLSearchParams(location.search).get('account') || new URLSearchParams(location.search).get('phone');
      if (p) {
        accInput.value = p;
        const passInput = document.getElementById('passwordInput') || document.querySelector('input[type="password"]');
        passInput?.focus();
      }
    }

    // Bắt sự kiện submit form duy nhất
    document.addEventListener('submit', function (e) {
      const target = e.target;
      const isSignup = target.id === 'signupForm' || target.action.includes('register') || window.location.pathname.includes('dang-ky');
      const isLogin = target.id === 'loginForm' || target.action.includes('login') || window.location.pathname.includes('dang-nhap');

      if (isSignup) {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleSignup(target);
      } else if (isLogin) {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleLogin(target);
      }
    }, true);

    // Xử lý chuyển trang giữa Đăng ký và Đăng nhập
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('a, button');
      if (!btn) return;
      const text = (btn.textContent || '').trim().toLowerCase();
      if ((text === 'đăng ký' || text === 'đăng ký ngay' || text.includes('chưa có tài khoản')) && !btn.closest('#signupForm') && btn.id !== 'submitBtn') {
        if (!btn.getAttribute('href') || btn.getAttribute('href') === '#' || btn.tagName === 'BUTTON') {
          e.preventDefault();
          location.href = PAGES.signup;
        }
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

/* =========================================================================
 * MODAL GỘP: ĐIỀU KHOẢN SỬ DỤNG & CHÍNH SÁCH BẢO MẬT
 * ========================================================================= */
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
            <p class="text-xs text-primary font-semibold italic">Tuân thủ nghiêm ngặt Nghị định số 13/2023/NĐ-CP của Chính phủ về Bảo vệ dữ liệu cá nhân.</p>
            <p><strong>1. Dữ liệu thu thập:</strong> Họ và tên, số điện thoại, địa chỉ email, môn thể thao ưa thích và lịch sử giao dịch đặt sân.</p>
            <p><strong>2. Mục đích sử dụng:</strong> Xác nhận đặt chỗ, cấp mã đơn hàng, điều phối lịch thi đấu và hỗ trợ khách hàng 24/7.</p>
            <p><strong>3. Cam kết bảo mật:</strong> Không bán hoặc chia sẻ thông tin cho bên thứ ba. Mã hóa truyền tải an toàn SSL 256-bit.</p>
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
      const formCheckbox = document.getElementById('agreeTerms') || document.getElementById('termsAgree');
      if (formCheckbox) {
        formCheckbox.disabled = false;
        formCheckbox.checked = true;
        formCheckbox.dispatchEvent(new Event('change'));
      }
      const statusBadge = document.getElementById('termsStatusBadge');
      if (statusBadge) {
        statusBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-100 text-primary text-[11px] font-bold';
        statusBadge.innerHTML = '<span class="material-symbols-outlined text-[14px]">check_circle</span><span>Đã xác nhận</span>';
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

/* =========================================================================
 * ĐỒNG BỘ HEADER USER & THÔNG BÁO CHO MỌI MÀN HÌNH
 * ========================================================================= */
function getLoggedInUser() {
  try {
    return JSON.parse(sessionStorage.getItem('sb_session')) ||
           JSON.parse(localStorage.getItem('sb_session')) ||
           JSON.parse(localStorage.getItem('currentUser')) ||
           JSON.parse(localStorage.getItem('current_user')) || null;
  } catch (e) {
    return null;
  }
}

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
        <button onclick="handleHeaderLogout()" type="button" title="Đăng xuất" class="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center outline-none">
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

function handleHeaderLogout() {
  if (confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) {
    sessionStorage.removeItem('sb_session');
    localStorage.removeItem('sb_session');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('current_user');
    window.location.href = 'dang-nhap.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  syncHeaderUserInfo();
});