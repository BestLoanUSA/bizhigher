(function () {
  var T = window.BHTools, form = document.getElementById('tool-form'), out = document.getElementById('tool-result');
  T.bind(form, function () {
    return T.call('review-reply', {
      review: form.review.value, stars: form.stars.value, lang: form.lang.value, bizType: form.bizType.value, bizName: form.bizName.value,
    }).then(function (d) {
      var html = '<h2 class="h2-left">답글 초안</h2>';
      (d.replies || []).forEach(function (r) {
        if (r.ko) html += T.copyBlock((r.tone || '') + ' · 한국어', r.ko);
        if (r.en) html += T.copyBlock((r.tone || '') + ' · English', r.en);
      });
      if (d.note) html += '<div class="callout">💡 ' + T.esc(d.note) + '</div>';
      html += '<p class="tool-fine">AI 초안입니다. 게시 전에 사실과 다른 부분이 없는지 꼭 읽어 보세요. 별점 1~3 리뷰는 공개 답글로 다투지 말고 전화·이메일로 따로 해결하는 것이 안전합니다.</p>';
      T.show(out, html);
    });
  });
})();
