(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');

  /* hard: 넘으면 등록이 안 되는 한도 / 아니면 넘어도 되지만 잘려 보이는 권장 길이 */
  var CFG = {
    google: { double: true, a: { name: '광고 제목', limit: 30, max: 15, min: 3, hard: true }, b: { name: '광고 설명', limit: 90, max: 4, min: 2, hard: true } },
    meta: { double: false, a: { name: '기본 문구', limit: 125, max: 5, min: 1, hard: false, note: '125자를 넘으면 "더 보기"로 접힙니다' }, b: { name: '광고 제목', limit: 40, max: 5, min: 1, hard: false, note: '40자를 넘으면 폰에서 잘립니다' } },
    gbp: { double: false, a: { name: '게시물 본문', limit: 1500, max: 1, min: 1, hard: true, note: '앞 100자 정도만 미리보기에 보입니다' }, b: { name: '비즈니스 설명', limit: 750, max: 1, min: 0, hard: true, note: '앞 250자가 검색 미리보기에 보입니다' } },
  };

  function isWide(cp) {
    return (cp >= 0x1100 && cp <= 0x11FF) || (cp >= 0x3000 && cp <= 0x303F) || (cp >= 0x3040 && cp <= 0x30FF) || (cp >= 0x3130 && cp <= 0x318F) ||
      (cp >= 0x3400 && cp <= 0x9FFF) || (cp >= 0xAC00 && cp <= 0xD7A3) || (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0xFF00 && cp <= 0xFF60) || (cp >= 0xFFE0 && cp <= 0xFFE6);
  }
  function len(s, dbl) {
    var n = 0;
    for (var ch of s) n += dbl && isWide(ch.codePointAt(0)) ? 2 : 1;
    return n;
  }
  /* 구글 광고 편집 정책에서 흔히 거절되는 것들 */
  function issues(s, kind, platform) {
    var out = [];
    if (platform !== 'google') return out;
    if (kind === 'a' && /!/.test(s)) out.push('제목에는 느낌표를 쓸 수 없습니다');
    if (/!{2,}|\?{2,}|\.{4,}/.test(s)) out.push('같은 문장부호 반복은 거절됩니다');
    if (/\p{Extended_Pictographic}/u.test(s)) out.push('이모지는 쓸 수 없습니다');
    if (/\b[A-Z]{4,}\b/.test(s.replace(/\b(LA|NY|NJ|BBQ|USA|AYCE|HVAC|CPA|DDS|DMD|OC)\b/g, ''))) out.push('강조용 전체 대문자는 거절될 수 있습니다');
    if (/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(s)) out.push('전화번호는 문구 대신 전화번호 확장 기능에 넣으세요');
    if (/(최고|1등|최저가|No\.?\s?1|#1|best in)/i.test(s)) out.push('최상급 표현은 근거(수상·출처)가 없으면 거절될 수 있습니다');
    return out;
  }

  function sync() {
    var c = CFG[form.platform.value];
    document.getElementById('lab-a').textContent = c.a.name + (c.a.max > 1 ? ' — 한 줄에 하나씩 (최대 ' + c.a.max + '개, ' + c.a.limit + '자)' : ' (' + c.a.limit + '자)');
    document.getElementById('lab-b').textContent = c.b.name + (c.b.max > 1 ? ' — 한 줄에 하나씩 (최대 ' + c.b.max + '개, ' + c.b.limit + '자)' : ' (' + c.b.limit + '자)');
  }
  form.platform.addEventListener('change', sync);
  sync();

  function block(kind, text, c, platform) {
    var spec = c[kind];
    var lines = spec.max > 1 ? text.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) : (text.trim() ? [text.trim()] : []);
    if (!lines.length) return { html: '', bad: 0, lines: lines };
    var bad = 0;
    var rows = lines.map(function (l, i) {
      var n = len(l, c.double), over = n > spec.limit, iss = issues(l, kind, platform);
      if (over || iss.length) bad++;
      var status = over ? (spec.hard ? '❌ ' + (n - spec.limit) + '자 초과' : '⚠️ ' + (n - spec.limit) + '자 초과') : iss.length ? '⚠️ 확인 필요' : '✅';
      return '<tr><td>' + (i + 1) + '</td><td>' + T.esc(l) + (iss.length ? '<br><small class="is-warn">' + iss.map(T.esc).join(' · ') + '</small>' : '') + '</td><td class="' + (over ? (spec.hard ? 'is-bad' : 'is-warn') : 'is-good') + '"><b>' + n + '</b>/' + spec.limit + '<br><small>' + status + '</small></td></tr>';
    }).join('');
    var head = '<h3 class="h3">' + spec.name + ' ' + lines.length + '개' + (lines.length > spec.max ? ' <small class="is-bad">— 최대 ' + spec.max + '개까지만 쓰입니다</small>' : '') + (lines.length < spec.min ? ' <small class="is-warn">— 최소 ' + spec.min + '개가 필요합니다</small>' : '') + '</h3>';
    return { html: head + (spec.note ? '<p class="tool-fine">' + spec.note + '</p>' : '') + '<table class="tool-table tool-table-plain tool-copy-table">' + rows + '</table>', bad: bad, lines: lines };
  }

  T.bind(form, function () {
    var platform = form.platform.value, c = CFG[platform];
    if (!form.a.value.trim() && !form.b.value.trim()) throw new Error('확인할 문구를 한 줄 이상 넣어 주세요.');
    return T.call('ad-copy-check', {}).then(function () {
      var A = block('a', form.a.value, c, platform), B = block('b', form.b.value, c, platform);
      var html = '<div class="tool-verdict ' + (A.bad + B.bad ? 'is-bad' : 'is-good') + '">' + (A.bad + B.bad ? '고칠 문구 ' + (A.bad + B.bad) + '개' : '모두 규격 안에 있습니다') + '</div>' + A.html + B.html;
      if (platform === 'google' && A.lines.length) {
        html += '<h3 class="h3">검색 결과 미리보기 (예시 조합)</h3><div class="ad-preview"><span class="ad-preview-tag">스폰서</span><div class="ad-preview-h">' + T.esc(A.lines.slice(0, 3).join(' | ')) + '</div><div class="ad-preview-d">' + T.esc(B.lines.slice(0, 2).join(' ')) + '</div></div>' +
          '<p class="tool-fine">구글은 제목·설명을 자동으로 조합해 보여주므로, 어느 제목이 어느 설명과 붙어도 말이 되게 쓰세요. 제목은 8~10개 이상 넣는 것을 권장합니다.</p>';
      }
      T.show(out, html);
    });
  });
})();
