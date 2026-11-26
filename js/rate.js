// Rate the robots: sends one rating per card to /api/rate and shows each robot's average and approved reasons.
// Nothing is stored in the browser; the edit ticket for "Change my answer" lives only in this page's memory.
(function () {
  var tickets = {};

  function showResults(data) {
    document.querySelectorAll('.rate-card').forEach(function (card) {
      var robot = card.querySelector('.rate-form').dataset.robot;
      var r = data[robot];
      var avg = card.querySelector('.avg');
      var said = card.querySelector('.said');
      avg.textContent = r && r.n
        ? 'Average so far: ' + r.avg + ' out of 10, from ' + r.n + (r.n === 1 ? ' rating' : ' ratings')
        : 'No ratings yet.';
      said.textContent = '';
      (r ? r.reasons : []).forEach(function (text) {
        var li = document.createElement('li');
        li.textContent = '“' + text + '”';
        said.appendChild(li);
      });
      said.hidden = !said.children.length;
    });
  }

  function load() {
    fetch('/api/rate').then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      if (data) showResults(data);
    }).catch(function () {});
  }

  document.querySelectorAll('.rate-form').forEach(function (form) {
    var card = form.closest('.rate-card');
    var robot = form.dataset.robot;
    var send = form.querySelector('.send');
    var hint = form.querySelector('.hint');
    var reason = form.elements.reason;
    var count = form.querySelector('.count');
    var thanks = card.querySelector('.thanks');

    form.addEventListener('change', function (e) {
      if (e.target.name !== 'rating') return;
      send.disabled = false;
      hint.textContent = 'You picked ' + e.target.value + ' out of 10.';
    });
    reason.addEventListener('input', function () {
      count.textContent = reason.value.length + ' / 400';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var picked = form.querySelector('input[name="rating"]:checked');
      if (!picked) return;
      send.disabled = true;
      hint.textContent = 'Sending…';
      fetch('/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robot: robot,
          rating: Number(picked.value),
          reason: reason.value,
          website: form.elements.website.value,
          replace: tickets[robot]
        })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || 'That didn’t send. Please try again.');
          return body;
        });
      }).then(function (body) {
        if (body.id) tickets[robot] = { id: body.id, token: body.token };
        card.querySelector('.thanks-text').textContent = 'You rated ' + card.dataset.name + ' a ' + picked.value + ' out of 10.';
        card.querySelector('.thanks-note').textContent = reason.value.trim()
          ? 'I’ll read your reason before it appears here.'
          : 'The average above now includes your rating.';
        hint.textContent = '';
        form.hidden = true;
        thanks.hidden = false;
        thanks.focus();
        send.disabled = false;
        load();
      }).catch(function (err) {
        send.disabled = false;
        hint.textContent = err.message;
      });
    });

    card.querySelector('.change').addEventListener('click', function () {
      thanks.hidden = true;
      form.hidden = false;
      hint.textContent = 'Pick a new number, then send it again.';
      (form.querySelector('input[name="rating"]:checked') || form.querySelector('input[name="rating"]')).focus();
    });
  });

  load();
})();
