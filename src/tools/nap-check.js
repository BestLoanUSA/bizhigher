(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  var dig = function (s) { var d = String(s || '').replace(/\D/g, ''); return d.length === 11 && d[0] === '1' ? d.slice(1) : d; };
  var fmt = function (d) { return d && d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : d || '—'; };
  var row = function (label, ok, detail) {
    var cls = ok === true ? 'is-good' : ok === false ? 'is-bad' : 'is-warn';
    var ic = ok === true ? '✅' : ok === false ? '❌' : '⚠️';
    return '<tr><td>' + ic + '</td><th>' + label + '</th><td class="' + cls + '">' + detail + '</td></tr>';
  };

  T.bind(form, function () {
    var myPhone = dig(form.phone.value), myZip = (form.zip.value.match(/\d{5}/) || [''])[0];
    return T.call('nap-check', { business: form.business.value, location: form.location.value, website: form.website.value }).then(function (d) {
      var g = (d.google || [])[0];
      if (!g) throw new Error('구글 지도에서 가게를 찾지 못했습니다. 간판의 영어 이름으로 다시 시도해 보세요.');
      var gPhone = dig(g.phone), gZip = (g.address.match(/\b\d{5}\b/g) || []).pop() || '';
      var s = d.site;
      var rows = '';
      rows += row('구글 이름', null, T.esc(g.name) + ' <span class="tool-fine">(간판·웹사이트와 같은 표기인지 직접 확인하세요)</span>');
      rows += row('구글 주소', myZip ? gZip === myZip : null, T.esc(g.address) + (myZip ? (gZip === myZip ? '' : ' — 입력한 우편번호 ' + T.esc(myZip) + '와 다릅니다') : ''));
      rows += row('구글 전화', myPhone ? gPhone === myPhone : !!gPhone, gPhone ? fmt(gPhone) + (myPhone && gPhone !== myPhone ? ' — 입력한 번호 ' + fmt(myPhone) + '와 다릅니다' : '') : '등록된 전화번호가 없습니다');
      rows += row('구글 웹사이트', !!g.website, g.website ? T.esc(g.website) : '등록된 웹사이트가 없습니다');
      rows += row('구글 영업시간', g.hours.length ? true : false, g.hours.length ? T.esc(g.hours.join(' · ')) : '영업시간이 등록되지 않았습니다');
      if (s && s.reachable) {
        var ref = myPhone || gPhone;
        var phoneOk = s.phones.length ? s.phones.indexOf(ref) >= 0 : false;
        rows += row('웹사이트 전화', phoneOk, s.phones.length ? s.phones.map(fmt).join(', ') + (phoneOk ? '' : ' — 기준 번호 ' + fmt(ref) + '가 첫 화면에 없습니다') : '첫 화면에서 전화번호를 찾지 못했습니다');
        rows += row('누르면 전화 걸리는 버튼', s.hasTelLink, s.hasTelLink ? '있습니다 (tel: 링크)' : '없습니다 — 폰 손님은 번호를 눌러 바로 걸 수 있어야 합니다');
        var refZip = myZip || gZip;
        rows += row('웹사이트 주소(우편번호)', s.zips.length ? s.zips.indexOf(refZip) >= 0 : null, s.zips.length ? s.zips.join(', ') : '첫 화면에서 주소를 찾지 못했습니다');
        rows += row('업소 구조화 데이터', s.hasSchema, s.hasSchema ? 'LocalBusiness 계열 스키마가 있습니다' : '없습니다 — 검색엔진·AI가 업소 정보로 인식하기 어렵습니다');
      } else if (s) {
        rows += row('웹사이트', false, '열리지 않았습니다 (' + T.esc(s.error || s.status || '') + ')');
      }
      var q = encodeURIComponent(g.name + ' ' + form.location.value);
      var html = '<h2 class="h2-left">비교 결과</h2><table class="tool-table">' + rows + '</table>' +
        '<h3 class="h3">다른 곳도 직접 확인해 보세요</h3><div class="tool-links">' +
        '<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="https://www.yelp.com/search?find_desc=' + q + '">Yelp에서 보기</a>' +
        '<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="https://www.bing.com/maps?q=' + q + '">Bing 지도에서 보기</a>' +
        '<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="https://maps.apple.com/?q=' + q + '">애플 지도에서 보기</a></div>' +
        '<p class="tool-fine">구글 지도 데이터 기준(Google Maps). 웹사이트는 첫 화면만 확인합니다.</p>';
      T.show(out, html);
    });
  });
})();
