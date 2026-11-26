// Matt's review page: lists reasons from /api/review and approves or hides each one.
(function () {
  var NAMES = { '01': 'Enabot EBO', '02': 'Miko 3', '03': 'Loona', '04': 'Sony aibo', '05': 'Casio Moflin',
    '06': 'Ropet', '07': 'Eilik', '08': 'EMO', '09': 'Reachy Mini', '10': 'ElliQ' };
  var status = document.getElementById('rv-status');
  var table = document.querySelector('.rv');
  var body = table.querySelector('tbody');

  function td(text, cls) {
    var c = document.createElement('td');
    c.textContent = text;
    if (cls) c.className = cls;
    return c;
  }

  function choice(row, value, label, buttons) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', row.status === value ? 'true' : 'false');
    b.addEventListener('click', function () {
      b.disabled = true;
      fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, status: value })
      }).then(function (res) {
        if (!res.ok) throw new Error();
        row.status = value;
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        status.textContent = NAMES[row.robot] + ' reason ' + (value === 'approved' ? 'approved.' : 'hidden.');
      }).catch(function () {
        status.textContent = 'That didn’t save. Reload the page and try again.';
      }).then(function () { b.disabled = false; });
    });
    buttons.push(b);
    return b;
  }

  fetch('/api/review').then(function (res) {
    return res.json().then(function (data) {
      if (!res.ok) throw new Error(data.error || 'Couldn’t load ratings.');
      return data;
    });
  }).then(function (data) {
    var waiting = data.rows.filter(function (r) { return r.status === 'pending'; }).length;
    status.textContent = data.total + ' ratings in all. ' + data.rows.length + ' with a reason, ' + waiting + ' waiting for you.';
    data.rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.appendChild(td('CBA-' + row.robot + ' ' + NAMES[row.robot]));
      tr.appendChild(td(row.rating + ' / 10'));
      tr.appendChild(td(row.reason, 'reason'));
      tr.appendChild(td(row.day + (row.status === 'pending' ? ' · waiting' : '')));
      var cell = document.createElement('td');
      var buttons = [];
      cell.appendChild(choice(row, 'approved', 'Approve', buttons));
      cell.appendChild(choice(row, 'hidden', 'Hide', buttons));
      tr.appendChild(cell);
      body.appendChild(tr);
    });
    table.hidden = !data.rows.length;
  }).catch(function (err) {
    status.textContent = err.message;
  });
})();
