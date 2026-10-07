/* /tools/ 공용 브라우저 스크립트 — 각 도구 페이지가 먼저 불러온다 */
(function () {
  var T = (window.BHTools = {});

  T.esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  /* 이용자 이메일(필수)·전화(선택) — 무료 도구의 대가. 한 번 입력하면 이 브라우저에 기억해 다음부터 자동 입력 */
  var LS = 'bh_tools_contact';
  function remembered() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } }
  function remember(c) { try { localStorage.setItem(LS, JSON.stringify(c)); } catch (e) {} }
  T.contact = function () {
    var f = document.getElementById('tool-form');
    var c = { email: f && f.email ? f.email.value.trim() : '', phone: f && f.phone ? f.phone.value.trim() : '' };
    if (c.email) remember(c);
    return c;
  };
  function leadBlock() {
    var c = remembered();
    var d = document.createElement('div');
    d.className = 'tool-lead';
    d.innerHTML = '<div class="tool-row"><div><label class="tool-label">이메일 <span class="tool-req">필수</span></label>' +
      '<input class="input" type="email" name="email" required maxlength="200" autocomplete="email" placeholder="you@example.com" value="' + T.esc(c.email || '') + '"></div>' +
      '<div><label class="tool-label">휴대폰 <span class="tool-opt">선택</span></label>' +
      '<input class="input" type="tel" name="phone" maxlength="40" autocomplete="tel" placeholder="(213) 555-0123" value="' + T.esc(c.phone || '') + '"></div></div>' +
      '<p class="tool-fine">이메일을 남기시면 도구를 무료로 쓰실 수 있습니다(도구별 하루 2회). 마케팅 팁과 BizHigher 소식을 보내드릴 수 있고, 언제든 수신 거부할 수 있습니다. 입력하신 가게 정보·결과는 저장하지 않습니다 · <a href="/privacy/">개인정보처리방침</a></p>';
    return d;
  }

  /* POST /api/tools/{tool} — 실패하면 사용자에게 보여줄 문장을 담아 throw */
  T.call = function (tool, body) {
    var c = T.contact();
    body = Object.assign({}, body, { email: c.email, phone: c.phone });
    return fetch('/api/tools/' + tool, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: '일시적인 오류가 발생했습니다.' }; });
    }).then(function (d) {
      if (!d || !d.ok) throw new Error((d && d.error) || '일시적인 오류가 발생했습니다.');
      if (window.gtag) window.gtag('event', 'tool_use', { tool_name: tool });
      return d;
    });
  };

  /* 폼 제출 공통 처리: 버튼 잠금 + 진행 문구 + 오류 표시 */
  T.bind = function (form, run) {
    var btn = form.querySelector('button[type=submit]');
    if (btn && !form.querySelector('.tool-lead')) form.insertBefore(leadBlock(), btn);
    var msg = form.querySelector('.tool-msg');
    var label = btn ? btn.textContent : '';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (btn) { btn.disabled = true; btn.textContent = btn.getAttribute('data-busy') || '만드는 중…'; }
      if (msg) { msg.textContent = ''; msg.className = 'tool-msg'; }
      Promise.resolve().then(run).catch(function (err) {
        if (msg) { msg.textContent = err.message || String(err); msg.className = 'tool-msg is-error'; }
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      });
    });
  };

  /* data-copy="선택자" 버튼 — 대상의 텍스트를 클립보드로 */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    var el = document.querySelector(b.getAttribute('data-copy'));
    if (!el) return;
    var text = el.value != null && el.tagName !== 'DIV' ? el.value : el.innerText;
    var done = function () { var t = b.textContent; b.textContent = '복사됨 ✓'; setTimeout(function () { b.textContent = t; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (x) {} ta.remove(); }
  });

  T.show = function (el, html) {
    el.innerHTML = html;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  var n = 0;
  /* 복사 가능한 결과 블록 */
  T.copyBlock = function (title, text) {
    n += 1;
    var id = 'tc' + n;
    return '<div class="tool-out"><div class="tool-out-head"><b>' + T.esc(title) + '</b><button type="button" class="btn btn-ghost btn-small" data-copy="#' + id + '">복사</button></div><div class="tool-out-body" id="' + id + '">' + T.esc(text).replace(/\n/g, '<br>') + '</div></div>';
  };
})();
