(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  var place = null, lastQuery = '';

  /* 리뷰 별점 계산기와 같은 식 — 표시 별점 target(반올림 기준 target-0.05)까지 평균 m인 새 리뷰 몇 개 */
  function need(c, n, target, m) {
    var t = target - 0.05;
    if (c >= t) return 0;
    if (m <= t) return Infinity;
    return Math.ceil((n * (t - c)) / (m - t) - 1e-9);
  }
  var num = function (x) { return x.toLocaleString('en-US'); };
  var star = function (r) { return r == null ? '—' : r.toFixed(1); };

  function render(d) {
    var me = d.me, list = d.competitors || [];
    if (!list.length) throw new Error('비교할 가게를 찾지 못했습니다. 키워드를 더 일반적인 말로 바꿔 보세요.');
    var top3 = list.slice(0, 3);
    var avg3 = Math.round(top3.reduce(function (a, x) { return a + x.count; }, 0) / top3.length);
    var maxCount = Math.max.apply(null, list.map(function (x) { return x.count; }).concat([me.count]));
    var byCount = list.slice().sort(function (a, b) { return b.count - a.count; });
    var myRankByCount = 1 + list.filter(function (x) { return x.count > me.count; }).length;
    var leaderRated = list.filter(function (x) { return x.rating != null && x.count >= 10; }).sort(function (a, b) { return b.rating - a.rating; })[0];

    var gapAvg = Math.max(0, avg3 - me.count);
    var html = '<h2 class="h2-left">“' + T.esc(d.keyword) + '” 주변 ' + d.radiusMi + '마일 — ' + T.esc(me.name) + '</h2>' +
      '<div class="tool-stats">' +
      '<div><span>우리 가게</span><b>★ ' + star(me.rating) + ' · ' + num(me.count) + '개</b></div>' +
      '<div><span>리뷰 수 순위 (' + (list.length + 1) + '곳 중)</span><b class="' + (myRankByCount <= 3 ? 'is-good' : 'is-bad') + '">' + myRankByCount + '위</b></div>' +
      '<div><span>지도 상위 3곳 평균 리뷰</span><b>' + num(avg3) + '개</b></div>' +
      '<div><span>상위 3곳 평균까지</span><b class="' + (gapAvg ? 'is-bad' : 'is-good') + '">' + (gapAvg ? num(gapAvg) + '개 부족' : '이미 넘음') + '</b></div>' +
      (me.rank ? '<div><span>이 키워드 지도 순위</span><b>' + me.rank + '위</b></div>' : '<div><span>이 키워드 상위 10곳</span><b class="is-bad">목록 밖</b></div>') +
      '</div>';

    var rows = [Object.assign({ isMe: true }, me)].concat(list).sort(function (a, b) { return (a.rank || 99) - (b.rank || 99); }).map(function (x) {
      var w = maxCount ? Math.max(2, Math.round((x.count / maxCount) * 100)) : 0;
      return '<tr' + (x.isMe ? ' class="is-me"' : '') + '><td>' + (x.rank || '—') + '</td><th>' + T.esc(x.name) + (x.isMe ? ' <span class="tool-req">우리 가게</span>' : '') + '</th><td>★ ' + star(x.rating) + '</td><td class="cmp-bar-cell"><span class="cmp-bar" style="width:' + w + '%"></span><b>' + num(x.count) + '</b></td></tr>';
    }).join('');
    html += '<h3 class="h3">지도 순서대로 비교</h3><table class="tool-table tool-table-plain cmp-table"><tr><th>지도</th><th>가게</th><th>별점</th><th>리뷰 수</th></tr>' + rows + '</table>';

    var tips = [];
    if (gapAvg) tips.push('상위 3곳 평균만큼 리뷰를 모으려면 <b>' + num(gapAvg) + '개</b>가 더 필요합니다. 6개월 안에 따라잡으려면 한 달에 약 <b>' + num(Math.max(1, Math.ceil(gapAvg / 6))) + '개</b>씩 새 리뷰가 들어와야 합니다.');
    if (byCount[0] && byCount[0].count > me.count) tips.push('리뷰가 가장 많은 <b>' + T.esc(byCount[0].name) + '</b>와는 <b>' + num(byCount[0].count - me.count) + '개</b> 차이입니다.');
    if (leaderRated && me.rating != null && leaderRated.rating > me.rating) {
      var k = need(me.rating, me.count, Math.round(leaderRated.rating * 10) / 10, 4.8);
      tips.push('별점이 가장 높은 <b>' + T.esc(leaderRated.name) + '</b>(★ ' + star(leaderRated.rating) + ')만큼 별점을 올리려면 평균 4.8점짜리 새 리뷰 약 <b>' + (k === Infinity ? '— (새 리뷰 평균보다 높은 목표)' : num(k) + '개') + '</b>가 필요합니다 — <a href="/tools/review-calc/">리뷰 별점 계산기</a>로 자세히 보기');
    }
    if (!tips.length) tips.push('리뷰 수와 별점 모두 주변 상위권입니다. 지금 속도를 유지하고, 최근 리뷰가 꾸준히 들어오는지 확인하세요.');
    html += '<h3 class="h3">무엇을 해야 할까요</h3><ul class="tool-sources">' + tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
    html += '<div class="callout">💡 리뷰 수만큼 중요한 것이 <b>최근 리뷰</b>입니다. 리뷰가 많아도 몇 달째 새 리뷰가 없으면 손님과 구글 모두 "지금은 덜 찾는 가게"로 봅니다. 리뷰를 조건으로 할인을 주거나 만족한 손님에게만 골라 요청하는 것은 구글 정책 위반이니, 모든 손님에게 똑같이 요청하세요 — <a href="/tools/review-link/">리뷰 링크·QR 만들기</a></div>' +
      '<p class="tool-fine">구글 지도(Google Maps) 데이터 기준 · 같은 키워드라도 검색하는 위치·시간에 따라 순서가 바뀔 수 있습니다</p>';
    T.show(out, html);
  }

  function run() {
    return T.call('competitor-reviews', { step: 'run', placeId: place.id, lat: place.lat, lng: place.lng, keyword: form.keyword.value, radius: form.radius.value, business: place.name }).then(render);
  }
  function pick(c) {
    place = c;
    var btn = form.querySelector('button[type=submit]'), msg = form.querySelector('.tool-msg'), label = btn.textContent;
    btn.disabled = true; btn.textContent = btn.getAttribute('data-busy');
    run().catch(function (e) { msg.textContent = e.message; msg.className = 'tool-msg is-error'; }).then(function () { btn.disabled = false; btn.textContent = label; });
  }

  T.bind(form, function () {
    var q = form.query.value.trim();
    if (place && q === lastQuery) return run();
    lastQuery = q; place = null;
    return T.call('competitor-reviews', { step: 'find', query: q }).then(function (d) {
      var cands = d.candidates || [];
      if (!cands.length) throw new Error('가게를 찾지 못했습니다. 간판의 영어 이름과 도시를 함께 넣어 보세요.');
      if (cands.length === 1) { place = cands[0]; return run(); }
      T.show(out, '<h2 class="h2-left">어느 가게인가요?</h2><div class="tool-pick">' + cands.map(function (c, i) {
        return '<button type="button" class="tool-pick-item" data-i="' + i + '"><b>' + T.esc(c.name) + '</b><span>' + T.esc(c.address) + '</span></button>';
      }).join('') + '</div>');
      out.querySelectorAll('.tool-pick-item').forEach(function (b) { b.onclick = function () { pick(cands[+b.getAttribute('data-i')]); }; });
    });
  });
})();
