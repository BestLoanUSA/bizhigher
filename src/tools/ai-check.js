(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  T.bind(form, function () {
    return T.call('ai-check', { business: form.business.value, city: form.city.value, category: form.category.value, lang: form.lang.value }).then(function (d) {
      var html = '<div class="tool-verdict ' + (d.mentioned ? 'is-good' : 'is-bad') + '">' +
        (d.mentioned ? '✅ AI 답변에 우리 가게가 나왔습니다' : '❌ AI 답변에 우리 가게가 나오지 않았습니다') + '</div>' +
        '<p class="tool-fine">질문: “' + T.esc(d.question) + '”</p>' +
        T.copyBlock('AI 답변', d.answer || '(답변 없음)');
      if (d.sources && d.sources.length) {
        html += '<h3 class="h3">AI가 참고한 출처</h3><ul class="tool-sources">' + d.sources.map(function (s) {
          return '<li><a href="' + T.esc(s.url) + '" target="_blank" rel="noopener nofollow">' + T.esc(s.title) + '</a></li>';
        }).join('') + '</ul><p class="tool-fine">AI는 이런 출처에 반복해서 등장하는 가게를 추천합니다. 여기 우리 가게가 없다면, 이 사이트들에 등록·언급되는 것이 첫걸음입니다.</p>';
      }
      html += '<div class="callout">💡 AI 답변은 물을 때마다 조금씩 달라집니다. 한 번 결과보다 매달 같은 질문으로 반복 확인하는 것이 정확합니다.</div>';
      T.show(out, html);
    });
  });
})();
