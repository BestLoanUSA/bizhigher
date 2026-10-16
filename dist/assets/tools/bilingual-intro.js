(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  function ring(label, len) {
    var pct = Math.min(100, Math.round((len / 750) * 100)), over = len > 750;
    return '<div class="lang-ring-item"><div class="lang-ring' + (over ? ' is-over' : '') + '" style="--p:' + pct + '"><div class="lang-ring-in">' + len + '</div></div>' +
      '<div class="lang-ring-label"><b>' + label + '</b><span>' + len + '/750자' + (over ? ' · 초과' : '') + '</span></div></div>';
  }

  T.bind(form, function () {
    return T.call('bilingual-intro', { intro: form.intro.value, bizType: form.bizType.value, city: form.city.value, bizName: form.bizName.value }).then(function (d) {
      var enLen = (d.en || '').length, koLen = (d.ko || '').length;
      var html = '<h2 class="h2-left">소개문</h2>' +
        '<div class="lang-rings">' + ring('English', enLen) + ring('한국어', koLen) + '</div>' +
        T.copyBlock('English', d.en || '') +
        T.copyBlock('한국어', d.ko || '');
      if (d.keywords && d.keywords.length) html += '<p class="body-sm"><b>손님이 검색할 만한 영어 표현:</b> ' + d.keywords.map(T.esc).join(' · ') + '</p>';
      html += '<p class="tool-fine">구글 프로필에는 언어별 설명 칸이 하나뿐입니다. 현지 손님이 많다면 영어, 한인 손님 위주라면 한국어를 넣고, 나머지는 웹사이트·옐프에 활용하세요.</p>';
      T.show(out, html);
    });
  });
})();
