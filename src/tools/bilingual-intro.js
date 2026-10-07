(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  T.bind(form, function () {
    return T.call('bilingual-intro', { intro: form.intro.value, bizType: form.bizType.value, city: form.city.value, bizName: form.bizName.value }).then(function (d) {
      var html = '<h2 class="h2-left">소개문</h2>' +
        T.copyBlock('English (' + (d.en || '').length + '/750자)', d.en || '') +
        T.copyBlock('한국어 (' + (d.ko || '').length + '/750자)', d.ko || '');
      if (d.keywords && d.keywords.length) html += '<p class="body-sm"><b>손님이 검색할 만한 영어 표현:</b> ' + d.keywords.map(T.esc).join(' · ') + '</p>';
      html += '<p class="tool-fine">구글 프로필에는 언어별 설명 칸이 하나뿐입니다. 현지 손님이 많다면 영어, 한인 손님 위주라면 한국어를 넣고, 나머지는 웹사이트·옐프에 활용하세요.</p>';
      T.show(out, html);
    });
  });
})();
