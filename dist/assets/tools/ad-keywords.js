(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  /* 구글 광고에 그대로 붙여 넣는 표기: 구문검색 "키워드", 일치검색 [키워드] */
  var fmt = function (k) { return k.match === 'exact' ? '[' + k.kw + ']' : '"' + k.kw + '"'; };

  T.bind(form, function () {
    return T.call('ad-keywords', {
      bizType: form.bizType.value, area: form.area.value, services: form.services.value, lang: form.lang.value, bizName: form.bizName.value,
    }).then(function (d) {
      var groups = d.groups || [], negs = d.negatives || [];
      if (!groups.length) throw new Error('키워드를 만들지 못했습니다. 업종과 지역을 조금 더 구체적으로 적어 보세요.');
      var total = groups.reduce(function (a, g) { return a + g.keywords.length; }, 0);
      var html = '<h2 class="h2-left">키워드 ' + total + '개 · 제외 키워드 ' + negs.length + '개</h2>' +
        '<p class="tool-fine">각 그룹을 구글 광고의 "광고 그룹" 하나로 만들고, 아래 목록을 키워드 칸에 그대로 붙여 넣으세요. "따옴표"는 구문검색, [대괄호]는 일치검색입니다.</p>';
      groups.forEach(function (g) {
        html += T.copyBlock('광고 그룹 — ' + g.theme, g.keywords.map(fmt).join('\n'));
      });
      if (negs.length) {
        html += T.copyBlock('제외 키워드 (캠페인 수준에 추가)', negs.map(function (n) { return n.kw; }).join('\n'));
        html += '<table class="tool-table tool-table-plain"><tr><th>제외 키워드</th><th>왜 빼나요</th></tr>' + negs.map(function (n) {
          return '<tr><td>' + T.esc(n.kw) + '</td><td>' + T.esc(n.why) + '</td></tr>';
        }).join('') + '</table>';
      }
      if (d.tips && d.tips.length) html += '<div class="callout">💡 ' + d.tips.map(T.esc).join('<br>💡 ') + '</div>';
      html += '<p class="tool-fine">AI가 만든 초안입니다. 실제 검색량과 예상 클릭 단가는 구글 키워드 플래너에서 확인하고, 광고를 돌린 뒤 1~2주마다 "검색어 보고서"를 보며 제외 키워드를 추가하세요. 광고 문구는 <a href="/tools/ad-copy-check/">광고 문구 글자 수 체커</a>로 확인할 수 있습니다.</p>';
      T.show(out, html);
    });
  });
})();
