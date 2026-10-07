(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  T.bind(form, function () {
    return T.call('gbp-post', { news: form.news.value, offer: form.offer.value, bizType: form.bizType.value, lang: form.lang.value, bizName: form.bizName.value }).then(function (d) {
      var html = '<h2 class="h2-left">게시물 초안</h2>';
      (d.posts || []).forEach(function (p) {
        html += '<div class="tool-post"><div class="tool-post-img">' + T.esc(p.imageText || '') + '</div><p class="tool-fine">' + T.esc(p.type || '') + ' · 버튼: ' + T.esc(p.cta || '') + '</p>';
        if (p.ko) html += T.copyBlock('한국어', p.ko);
        if (p.en) html += T.copyBlock('English', p.en);
        html += '</div>';
      });
      if (d.tip) html += '<div class="callout">📸 ' + T.esc(d.tip) + '</div>';
      html += '<p class="tool-fine">구글 비즈니스 프로필 → 업데이트 추가에 붙여 넣으세요. 게시물은 꾸준함이 중요합니다 — 주 1회를 권합니다.</p>';
      T.show(out, html);
    });
  });
})();
