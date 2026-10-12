(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');

  /* 실제 평균 c, 리뷰 n개에서 표시 별점 target(반올림 기준 target-0.05 이상)에 닿으려면
     평균 m인 새 리뷰가 몇 개 필요한가. 불가능하면 Infinity, 이미 넘으면 0 */
  function need(c, n, target, m) {
    var t = target - 0.05;
    if (c >= t) return 0;
    if (m <= t) return Infinity;
    return Math.ceil((n * (t - c)) / (m - t) - 1e-9);
  }
  /* 표시 별점이 target 아래로 떨어지기 전까지 버틸 수 있는 1점 리뷰 수 */
  function cushion(c, n, target) {
    var t = target - 0.05;
    if (c < t) return 0;
    return Math.max(0, Math.floor((n * (c - t)) / (t - 1) + 1e-9));
  }
  var fmt = function (k) { return k === Infinity ? '도달 불가' : k.toLocaleString('en-US') + '개'; };
  var round1 = function (x) { return Math.round(x * 10) / 10; };

  T.bind(form, function () {
    var r = +form.rating.value, n = Math.round(+form.count.value), target = +form.target.value, m = +form.newAvg.value, pm = +form.perMonth.value || 0;
    if (!(r >= 1 && r <= 5 && n >= 1)) throw new Error('별점(1~5)과 리뷰 수를 확인해 주세요.');
    return T.call('review-calc', {}).then(function () {
      var lo = Math.max(1, r - 0.05), hi = Math.min(5, r + 0.05);
      var mid = need(r, n, target, m), best = need(hi, n, target, m), worst = need(lo, n, target, m);
      var html = '';
      if (mid === 0 && r >= target) {
        var cu = cushion(r, n, target);
        html += '<div class="tool-verdict is-good">이미 ' + target.toFixed(1) + '점 이상입니다</div>' +
          '<div class="tool-stats"><div><span>' + target.toFixed(1) + '점을 지키며 버틸 수 있는 1점 리뷰</span><b>약 ' + cu + '개</b></div>' +
          '<div><span>1점 리뷰 1개가 달리면</span><b>' + round1((r * n + 1) / (n + 1)).toFixed(1) + '점</b></div>' +
          '<div><span>1점 1개를 만회하려면 5점</span><b>' + (r >= 5 ? '—' : Math.ceil((r - 1) / (5 - r) - 1e-9) + '개') + '</b></div></div>';
      } else {
        html += '<div class="tool-verdict ' + (mid === Infinity ? 'is-bad' : 'is-good') + '">' + target.toFixed(1) + '점까지 ' + (mid === Infinity ? '이 조건으로는 도달할 수 없습니다' : '평균 ' + m.toFixed(1) + '점짜리 새 리뷰 약 ' + fmt(mid) + ' 필요') + '</div>';
        if (mid !== Infinity) {
          html += '<div class="tool-stats">' +
            '<div><span>필요한 새 리뷰 (가장 가능성 높은 값)</span><b>' + fmt(mid) + '</b></div>' +
            '<div><span>실제 별점 범위에 따른 폭</span><b>' + fmt(best) + ' ~ ' + fmt(worst) + '</b></div>' +
            '<div><span>달성 시 총 리뷰 수</span><b>' + (n + mid).toLocaleString('en-US') + '개</b></div>' +
            (pm > 0 ? '<div><span>지금 속도로 걸리는 기간</span><b>약 ' + Math.ceil(mid / pm) + '개월</b></div>' : '') +
            '<div><span>1점 리뷰 1개가 달리면</span><b>' + round1((r * n + 1) / (n + 1)).toFixed(1) + '점</b></div>' +
            '<div><span>1점 1개를 만회하려면 5점</span><b>' + (r >= 5 ? '—' : Math.ceil((r - 1) / (5 - r) - 1e-9) + '개') + '</b></div></div>';
        } else {
          html += '<p class="body-sm">새 리뷰 평균이 목표보다 낮으면 리뷰가 아무리 늘어도 목표에 닿지 않습니다. 목표를 낮추거나, 낮은 별점의 원인(대기 시간·응대·청결 등)부터 해결해야 합니다.</p>';
        }
      }
      var rows = [4.0, 4.3, 4.5, 4.7, 4.8, 4.9].map(function (t) {
        var a = need(r, n, t, 5), b = need(r, n, t, 4.8);
        return '<tr><th>' + t.toFixed(1) + '점</th><td>' + (a === 0 ? '달성' : fmt(a)) + '</td><td>' + (b === 0 ? '달성' : fmt(b)) + '</td></tr>';
      }).join('');
      html += '<h3 class="h3">목표 별점별 한눈에 보기</h3><table class="tool-table tool-table-plain"><tr><th>목표</th><th>새 리뷰 전부 5점</th><th>새 리뷰 평균 4.8</th></tr>' + rows + '</table>';
      html += '<div class="callout">⚠️ 리뷰를 조건으로 할인·서비스를 주거나, 만족한 손님에게만 골라서 요청하는 것은 구글 정책 위반입니다. 숫자를 올리는 가장 안전한 방법은 모든 손님에게 똑같이, 만족한 순간 바로 요청하는 것입니다 — <a href="/tools/review-link/">리뷰 링크·QR 만들기</a></div>';
      html += '<p class="tool-fine">구글은 별점을 단순 평균 후 반올림해 표시하는 것으로 알려져 있으며, 삭제·필터링된 리뷰가 있으면 실제 숫자와 차이가 날 수 있습니다. 옐프는 추천 리뷰만 평균에 넣기 때문에 이 계산이 맞지 않습니다.</p>';
      T.show(out, html);
    });
  });
})();
