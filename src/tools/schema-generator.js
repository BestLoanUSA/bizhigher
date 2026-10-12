(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  var DAYS = [['Monday', '월'], ['Tuesday', '화'], ['Wednesday', '수'], ['Thursday', '목'], ['Friday', '금'], ['Saturday', '토'], ['Sunday', '일']];
  var FOOD = ['Restaurant', 'CafeOrCoffeeShop', 'Bakery'];

  var box = document.getElementById('sg-hours');
  box.innerHTML = DAYS.map(function (d, i) {
    var weekend = i >= 5;
    return '<div class="sg-day" data-day="' + d[0] + '"><b>' + d[1] + '</b>' +
      '<input class="input" type="time" value="' + (weekend ? '11:00' : '10:00') + '" aria-label="' + d[1] + ' 여는 시간">' +
      '<span>~</span><input class="input" type="time" value="' + (weekend ? '22:00' : '21:00') + '" aria-label="' + d[1] + ' 닫는 시간">' +
      '<label class="sg-closed"><input type="checkbox"> 휴무</label></div>';
  }).join('');
  form.querySelector('.sg-copy-hours').onclick = function () {
    var rows = box.querySelectorAll('.sg-day'), src = rows[0].querySelectorAll('input');
    for (var i = 1; i < 5; i++) { var t = rows[i].querySelectorAll('input'); t[0].value = src[0].value; t[1].value = src[1].value; t[2].checked = src[2].checked; }
  };
  function syncFood() { document.getElementById('sg-food').hidden = FOOD.indexOf(form.type.value) < 0; }
  form.type.addEventListener('change', syncFood); syncFood();

  /* 같은 시간대인 요일을 하나로 묶는다 — 구글 권장 형식(OpeningHoursSpecification) */
  function hours() {
    var groups = {}, order = [];
    box.querySelectorAll('.sg-day').forEach(function (row) {
      var t = row.querySelectorAll('input');
      if (t[2].checked || !t[0].value || !t[1].value) return;
      var key = t[0].value + '-' + t[1].value;
      if (!groups[key]) { groups[key] = { '@type': 'OpeningHoursSpecification', dayOfWeek: [], opens: t[0].value, closes: t[1].value }; order.push(key); }
      groups[key].dayOfWeek.push(row.getAttribute('data-day'));
    });
    return order.map(function (k) { return groups[k]; });
  }
  function cleanUrl(u) {
    u = (u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { return new URL(u).toString(); } catch (e) { return ''; }
  }
  function e164(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    return d.length === 10 ? '+1-' + d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : '';
  }

  T.bind(form, function () {
    var name = form.name.value.trim(), street = form.street.value.trim(), city = form.city.value.trim();
    var state = form.state.value.trim().toUpperCase(), zip = form.zip.value.trim();
    if (!name || !street || !city || !state || !zip) throw new Error('상호와 주소(도로명·도시·주·우편번호)를 채워 주세요.');
    var warn = [];
    if (!/^[A-Z]{2}$/.test(state)) warn.push('주는 GA, CA처럼 영문 두 글자로 적어 주세요.');
    if (!/^\d{5}(-\d{4})?$/.test(zip)) warn.push('우편번호는 숫자 5자리로 적어 주세요.');
    var phone = e164(form.bizPhone.value);
    if (form.bizPhone.value.trim() && !phone) warn.push('전화번호를 10자리 미국 번호로 확인해 주세요.');
    if (!phone) warn.push('전화번호가 없으면 손님과 AI가 연락처를 찾기 어렵습니다 (권장).');
    var url = cleanUrl(form.url.value);
    if (!url) warn.push('웹사이트 주소를 넣는 것을 권장합니다.');
    var h = hours();
    if (!h.length) warn.push('영업시간이 비어 있습니다 (권장).');
    var image = cleanUrl(form.image.value);
    if (!image) warn.push('대표 사진 주소가 있으면 검색 결과에 더 잘 활용됩니다 (권장).');

    var type = form.type.value;
    var ld = { '@context': 'https://schema.org', '@type': type, name: name };
    if (form.altName.value.trim()) ld.alternateName = form.altName.value.trim();
    if (form.description.value.trim()) ld.description = form.description.value.trim();
    if (url) { ld.url = url; ld['@id'] = url.replace(/#.*$/, '') + '#business'; }
    if (phone) ld.telephone = phone;
    if (image) ld.image = image;
    if (form.priceRange.value) ld.priceRange = form.priceRange.value;
    ld.address = { '@type': 'PostalAddress', streetAddress: street, addressLocality: city, addressRegion: state, postalCode: zip, addressCountry: 'US' };
    if (h.length) ld.openingHoursSpecification = h;
    if (FOOD.indexOf(type) >= 0) {
      if (form.cuisine.value.trim()) ld.servesCuisine = form.cuisine.value.trim();
      var menu = cleanUrl(form.menu.value); if (menu) ld.hasMenu = menu;
      if (form.reservations.value) ld.acceptsReservations = form.reservations.value === 'true';
    }
    var same = form.sameAs.value.split('\n').map(cleanUrl).filter(Boolean);
    if (same.length) ld.sameAs = same;

    return T.call('schema-generator', { business: name }).then(function () {
      var code = '<script type="application/ld+json">\n' + JSON.stringify(ld, null, 2) + '\n</' + 'script>';
      var html = '<h2 class="h2-left">스키마 코드</h2>';
      if (warn.length) html += '<div class="callout">⚠️ ' + warn.map(T.esc).join('<br>⚠️ ') + '</div>';
      html += T.copyBlock('웹사이트 첫 페이지 <head> 안에 붙여 넣기', code);
      html += '<h3 class="h3">붙여 넣은 뒤 확인하기</h3><div class="tool-links">' +
        '<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="https://search.google.com/test/rich-results' + (url ? '?url=' + encodeURIComponent(url) : '') + '">구글 리치 결과 테스트</a>' +
        '<a class="btn btn-ghost btn-small" target="_blank" rel="noopener" href="https://validator.schema.org/' + (url ? '#url=' + encodeURIComponent(url) : '') + '">Schema Validator</a></div>' +
        '<ul class="tool-sources"><li><b>Wix</b>: 설정 → 사용자 지정 코드 → "Head"에 추가</li><li><b>Squarespace</b>: 설정의 코드 삽입(Code Injection) → Header</li><li><b>WordPress</b>: 헤더·푸터 코드 플러그인의 Header 칸</li></ul>' +
        '<p class="tool-fine">스키마의 이름·주소·전화번호는 구글 비즈니스 프로필과 글자 하나까지 같아야 합니다. 다르면 오히려 혼란을 줍니다 — <a href="/tools/nap-check/">가게 정보 일치 체크</a></p>';
      T.show(out, html);
    });
  });
})();
