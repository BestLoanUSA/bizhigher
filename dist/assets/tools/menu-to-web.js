(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');

  /* 긴 변 1568px로 줄여 JPEG로 — 전송량과 비용을 함께 줄인다 */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var max = 1568, w = img.naturalWidth, h = img.naturalHeight, r = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * r); c.height = Math.round(h * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { reject(new Error('사진을 읽지 못했습니다. JPG·PNG 사진으로 다시 시도해 주세요.')); };
      img.src = URL.createObjectURL(file);
    });
  }

  function render(sections) {
    var plain = '', html = '', ld = { '@context': 'https://schema.org', '@type': 'Menu', hasMenuSection: [] };
    sections.forEach(function (s) {
      plain += '■ ' + s.name + '\n';
      html += '<section class="menu-section">\n  <h2>' + T.esc(s.name) + '</h2>\n  <ul>\n';
      var sec = { '@type': 'MenuSection', name: s.name, hasMenuItem: [] };
      s.items.forEach(function (i) {
        var label = i.name + (i.nameEn ? ' (' + i.nameEn + ')' : '');
        plain += '- ' + label + (i.price ? '  ' + i.price : '') + (i.desc ? '\n  ' + i.desc : '') + '\n';
        html += '    <li><strong>' + T.esc(i.name) + '</strong>' + (i.nameEn ? ' <span lang="en">' + T.esc(i.nameEn) + '</span>' : '') + (i.price ? ' <span class="price">' + T.esc(i.price) + '</span>' : '') + (i.desc ? '<br><small>' + T.esc(i.desc) + '</small>' : '') + '</li>\n';
        var it = { '@type': 'MenuItem', name: label };
        var p = (i.price || '').replace(/[^0-9.]/g, '');
        if (p) it.offers = { '@type': 'Offer', price: p, priceCurrency: 'USD' };
        if (i.desc) it.description = i.desc;
        sec.hasMenuItem.push(it);
      });
      html += '  </ul>\n</section>\n';
      plain += '\n';
      ld.hasMenuSection.push(sec);
    });
    return { plain: plain.trim(), html: html.trim(), ld: '<script type="application/ld+json">' + JSON.stringify(ld) + '</script>' };
  }

  T.bind(form, function () {
    var f = form.photo.files && form.photo.files[0];
    var text = form.text.value;
    if (!f && text.trim().length < 5) throw new Error('메뉴판 사진을 올리거나 메뉴를 붙여 넣어 주세요.');
    return (f ? shrink(f) : Promise.resolve('')).then(function (b64) {
      return T.call('menu-to-web', { image: b64 || undefined, mediaType: 'image/jpeg', text: text });
    }).then(function (d) {
      var sections = d.sections || [];
      if (!sections.length) throw new Error('메뉴를 읽지 못했습니다. 더 밝고 또렷한 사진으로 다시 시도해 주세요.');
      var r = render(sections);
      var count = sections.reduce(function (a, s) { return a + s.items.length; }, 0);
      T.show(out, '<h2 class="h2-left">메뉴 ' + count + '개를 옮겼습니다</h2>' +
        (d.unreadable ? '<div class="callout">⚠️ 읽기 어려운 항목이 ' + d.unreadable + '개 있었습니다. 가격이 빈 항목은 직접 확인해 채워 주세요.</div>' : '') +
        T.copyBlock('텍스트 메뉴 (구글 프로필·배달 앱·SNS용)', r.plain) +
        T.copyBlock('웹사이트용 HTML', r.html) +
        T.copyBlock('검색엔진용 구조화 데이터 (선택)', r.ld) +
        '<p class="tool-fine">AI가 사진을 읽은 결과입니다. 가격·이름이 맞는지 꼭 확인한 뒤 올리세요. 웹사이트에는 사진·PDF 대신 이런 텍스트 메뉴를 올려야 검색에 잡힙니다 — <a href="/blog/online-menu-guide/">온라인 메뉴 가이드</a></p>');
    });
  });
})();
