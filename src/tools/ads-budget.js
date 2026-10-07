(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  var usd = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  T.bind(form, function () {
    var c = +form.customers.value, ticket = +form.ticket.value, cpc = +form.cpc.value, cvr = +form.cvr.value / 100, margin = +form.margin.value / 100, rep = +form.repeat.value || 1;
    if (!(c > 0 && ticket > 0 && cpc > 0 && cvr > 0 && margin > 0)) throw new Error('숫자를 모두 0보다 크게 넣어 주세요.');
    var clicks = Math.ceil(c / cvr);
    var budget = clicks * cpc;
    var cac = budget / c;
    var revenue = c * ticket;
    var profit1 = revenue * margin - budget;
    var ltvProfit = c * ticket * rep * margin - budget;
    var breakevenCvr = cpc / (ticket * margin) * 100;
    var html = '<h2 class="h2-left">계산 결과</h2><div class="tool-stats">' +
      '<div><span>필요한 월 클릭</span><b>' + clicks.toLocaleString('en-US') + '회</b></div>' +
      '<div><span>필요한 월 광고비</span><b>' + usd(budget) + '</b></div>' +
      '<div><span>손님 1명 데려오는 비용</span><b>' + usd(cac) + '</b></div>' +
      '<div><span>첫 방문 기준 이익</span><b class="' + (profit1 >= 0 ? 'is-good' : 'is-bad') + '">' + usd(profit1) + '</b></div>' +
      '<div><span>1년 재방문 포함 이익</span><b class="' + (ltvProfit >= 0 ? 'is-good' : 'is-bad') + '">' + usd(ltvProfit) + '</b></div>' +
      '<div><span>손익분기 전환율</span><b>' + breakevenCvr.toFixed(1) + '%</b></div></div>';
    html += '<div class="callout">' + (profit1 >= 0
      ? '✅ 첫 방문만으로도 광고비를 회수하는 구조입니다. 실제 CPC·전환율을 4주 테스트로 확인한 뒤 예산을 늘리세요.'
      : ltvProfit >= 0
        ? '🟡 첫 방문만으로는 적자지만, 재방문까지 보면 남는 구조입니다. 단골이 되는 업종이라면 시도할 만합니다.'
        : '🔴 지금 숫자로는 광고비가 이익보다 큽니다. 전환율(전화·예약 버튼, 리뷰)을 먼저 높이거나 객단가가 높은 상품으로 광고하세요.') + '</div>';
    html += '<p class="tool-fine">예산이 너무 작으면 구글이 학습할 데이터가 부족합니다. 처음엔 월 $300 안팎으로 4주 테스트하는 방법을 권합니다 — <a href="/blog/google-ads-small-budget-guide/">최소 예산 설계 가이드</a></p>';
    T.show(out, html);
  });
})();
