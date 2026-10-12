(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  var customRow = document.getElementById('custom-row');
  form.preset.addEventListener('change', function () { customRow.hidden = form.preset.value !== 'custom|custom'; });

  /* 소문자·하이픈으로 정리 — GA4는 대소문자를 구분하므로 "Flyer"와 "flyer"가 따로 집계되는 일을 막는다 */
  function slug(s) {
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9가-힣_\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
  function qrSvg(url) {
    if (!window.qrcode) return '';
    var q = window.qrcode(0, 'M'); q.addData(url); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  T.bind(form, function () {
    var raw = form.url.value.trim();
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
    var u;
    try { u = new URL(raw); } catch (e) { throw new Error('웹사이트 주소를 확인해 주세요.'); }
    var p = form.preset.value.split('|');
    var source = p[0] === 'custom' ? slug(form.source.value) : p[0];
    var medium = p[0] === 'custom' ? slug(form.medium.value) : p[1];
    var campaign = slug(form.campaign.value);
    if (!source || !medium || !campaign) throw new Error('광고 출처·종류·캠페인 이름을 모두 채워 주세요.');
    return T.call('utm-builder', {}).then(function () {
      u.searchParams.set('utm_source', source);
      u.searchParams.set('utm_medium', medium);
      u.searchParams.set('utm_campaign', campaign);
      var c = slug(form.content.value);
      if (c) u.searchParams.set('utm_content', c); else u.searchParams.delete('utm_content');
      var link = u.toString();
      var printy = ['qr', 'print', 'offline'].indexOf(medium) >= 0;
      var html = '<h2 class="h2-left">추적 링크</h2>' + T.copyBlock('광고에 넣을 링크', link);
      if (printy) {
        var svg = qrSvg(link);
        html += '<div class="tool-qr-wrap"><div class="tool-qr">' + svg + '</div><div class="tool-qr-actions"><button type="button" class="btn btn-ghost btn-small" id="dl-qr">QR 이미지 저장 (SVG)</button><p class="tool-fine">전단·포스터·신문 광고에 이 QR을 넣으면, 스캔해서 들어온 손님이 이 광고 몫으로 따로 집계됩니다.</p></div></div>';
        setTimeout(function () {
          var b = document.getElementById('dl-qr');
          if (b) b.onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); a.download = 'utm-qr-' + campaign + '.svg'; a.click(); };
        }, 0);
      }
      if (medium === 'offline') html += '<div class="callout">📻 라디오처럼 말로 읽는 광고는 긴 링크를 쓸 수 없습니다. 웹사이트에 짧은 전용 주소(예: mystore.com/radio)를 만들고, 그 주소가 위 링크로 이동하도록 설정하세요.</div>';
      html += '<h3 class="h3">들어간 값</h3><table class="tool-table tool-table-plain"><tr><th>utm_source</th><td>' + T.esc(source) + '</td></tr><tr><th>utm_medium</th><td>' + T.esc(medium) + '</td></tr><tr><th>utm_campaign</th><td>' + T.esc(campaign) + '</td></tr>' + (c ? '<tr><th>utm_content</th><td>' + T.esc(c) + '</td></tr>' : '') + '</table>';
      html += '<p class="tool-fine">GA4 → 보고서 → 획득 → 트래픽 획득에서 "세션 소스/매체"로 보면 광고별 방문이 나뉘어 보입니다. 구글 광고는 계정을 GA4와 연결하면 자동 추적(gclid)되므로, 구글 검색 광고에는 이 링크가 꼭 필요하지는 않습니다.</p>';
      T.show(out, html);
    });
  });
})();
