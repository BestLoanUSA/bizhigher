(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  var cands = [];

  function qrSvg(url) {
    if (!window.qrcode) return '';
    var q = window.qrcode(0, 'M'); q.addData(url); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  function render(c) {
    var link = 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(c.id);
    var svg = qrSvg(link);
    T.show(out,
      '<h2 class="h2-left">' + T.esc(c.name) + '</h2><p class="body-sm">' + T.esc(c.address) + '</p>' +
      T.copyBlock('리뷰 작성 바로가기 링크', link) +
      '<p class="tool-fine">문자·카톡·이메일 영수증에 붙여 넣으세요. 링크를 누르면 별점 화면이 바로 열립니다.</p>' +
      '<div class="tool-qr-wrap"><div class="tool-qr" id="qr">' + svg + '</div>' +
      '<div class="tool-qr-actions"><button type="button" class="btn btn-ghost btn-small" id="dl-qr">QR 이미지 저장</button>' +
      '<button type="button" class="btn btn-primary btn-small" id="print-poster">테이블 포스터 인쇄 (한/영)</button></div></div>' +
      '<div class="tool-poster" id="poster" aria-hidden="true"><div class="tp-card"><p class="tp-ko">오늘 방문, 어떠셨나요?</p><p class="tp-en">Enjoyed your visit?</p><div class="tp-qr">' + svg + '</div><p class="tp-ko2">카메라로 찍으면 구글 리뷰 화면이 열립니다</p><p class="tp-en2">Scan to leave us a Google review</p><p class="tp-name">' + T.esc(c.name) + '</p></div></div>' +
      '<div class="callout">⚠️ 리뷰를 조건으로 할인·서비스를 주거나, 만족한 손님에게만 골라서 요청하는 것은 구글 정책 위반입니다. 모든 손님에게 똑같이 요청하세요.</div>'
    );
    document.getElementById('dl-qr').onclick = function () {
      var blob = new Blob([svg], { type: 'image/svg+xml' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'google-review-qr.svg'; a.click();
    };
    document.getElementById('print-poster').onclick = function () { document.body.classList.add('print-poster'); window.print(); setTimeout(function () { document.body.classList.remove('print-poster'); }, 500); };
  }

  T.bind(form, function () {
    return T.call('review-link', { query: form.query.value }).then(function (d) {
      cands = d.candidates || [];
      if (!cands.length) throw new Error('가게를 찾지 못했습니다. 업체명을 영어 간판 이름으로, 도시를 함께 넣어 보세요.');
      if (cands.length === 1) return render(cands[0]);
      T.show(out, '<h2 class="h2-left">어느 가게인가요?</h2><div class="tool-pick">' + cands.map(function (c, i) {
        return '<button type="button" class="tool-pick-item" data-i="' + i + '"><b>' + T.esc(c.name) + '</b><span>' + T.esc(c.address) + '</span></button>';
      }).join('') + '</div>');
      out.querySelectorAll('.tool-pick-item').forEach(function (b) { b.onclick = function () { render(cands[+b.getAttribute('data-i')]); }; });
    });
  });
})();
