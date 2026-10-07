(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  var place = null, lastQuery = '';

  function cls(v) { return v === -1 ? 'r-na' : v === 0 ? 'r-out' : v <= 3 ? 'r-top' : v <= 10 ? 'r-mid' : 'r-low'; }

  function render(d) {
    var mid = (d.grid.length - 1) / 2;
    var cells = d.grid.map(function (row, r) {
      return row.map(function (v, c) {
        return '<span class="rank-cell ' + cls(v) + (r === mid && c === mid ? ' is-center' : '') + '" title="' + (v > 0 ? v + '위' : v === 0 ? '20위 밖' : '조회 실패') + '">' + (v > 0 ? v : v === 0 ? '20+' : '–') + '</span>';
      }).join('');
    }).join('');
    var pct = Math.round((d.top3 / d.total) * 100);
    var html = '<h2 class="h2-left">“' + T.esc(d.keyword) + '” 지도 순위 — ' + T.esc(place.name) + '</h2>' +
      '<div class="tool-stats">' +
      '<div><span>상위 3위 안 지점</span><b class="' + (pct >= 50 ? 'is-good' : pct >= 20 ? 'is-warn' : 'is-bad') + '">' + d.top3 + ' / ' + d.total + ' (' + pct + '%)</b></div>' +
      '<div><span>보이는 곳 평균 순위</span><b>' + (d.avg != null ? d.avg + '위' : '—') + '</b></div>' +
      '<div><span>20위 밖 지점</span><b class="' + (d.outside ? 'is-bad' : 'is-good') + '">' + d.outside + '곳</b></div></div>' +
      '<div class="rank-wrap"><div class="rank-compass">북 ↑</div><div class="rank-grid" style="grid-template-columns:repeat(' + d.grid.length + ',1fr)">' + cells + '</div>' +
      '<p class="tool-fine">가운데 테두리 칸이 가게 위치입니다. 칸 사이 간격 약 ' + (d.radiusMi / mid).toFixed(2) + '마일, 전체 반경 ' + d.radiusMi + '마일</p>' +
      '<div class="rank-legend"><span class="rank-cell r-top">1–3</span>지도 상단 3곳 <span class="rank-cell r-mid">4–10</span>스크롤 필요 <span class="rank-cell r-low">11–20</span>거의 안 보임 <span class="rank-cell r-out">20+</span>목록 밖</div></div>';
    if (d.leaders && d.leaders.length) {
      html += '<h3 class="h3">가게 위치에서 검색하면 상위 3곳</h3><ol class="tool-sources">' + d.leaders.map(function (l) {
        return '<li>' + T.esc(l.name) + (l.isYou ? ' <b class="is-good">(우리 가게)</b>' : '') + '</li>';
      }).join('') + '</ol>';
    }
    html += '<div class="callout">💡 가게에서 멀어질수록 순위가 떨어지는 것은 정상입니다(거리가 순위 요소). 바로 옆 지점에서도 3위 밖이라면 거리보다 <b>관련성·인지도</b>(카테고리, 리뷰 수와 최신성, 프로필 완성도)를 먼저 손봐야 합니다.</div>' +
      '<p class="tool-fine">구글 Places 데이터로 계산한 근사치입니다. 실제 구글 지도 앱은 검색하는 사람의 기록·광고에 따라 조금씩 다르게 보일 수 있습니다.</p>';
    T.show(out, html);
  }

  function run() {
    return T.call('local-rank', { step: 'run', placeId: place.id, lat: place.lat, lng: place.lng, keyword: form.keyword.value, radius: form.radius.value, business: place.name }).then(render);
  }

  function pick(c) {
    place = c;
    var btn = form.querySelector('button[type=submit]'), msg = form.querySelector('.tool-msg');
    btn.disabled = true; var label = btn.textContent; btn.textContent = btn.getAttribute('data-busy');
    run().catch(function (e) { msg.textContent = e.message; msg.className = 'tool-msg is-error'; }).then(function () { btn.disabled = false; btn.textContent = label; });
  }

  T.bind(form, function () {
    var q = form.query.value.trim();
    if (place && q === lastQuery) return run();
    lastQuery = q; place = null;
    return T.call('local-rank', { step: 'find', query: q }).then(function (d) {
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
