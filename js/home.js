(async function () {
  if (!window.Arena) return;
  const A = window.Arena, sb = A.sb, esc = A.esc;
  const view = await A.mount('home', { title: 'Startseite' });
  if (!view) return;

  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in lokaler Zeit
  const showLb = A.on('leaderboards'), showMatch = A.on('matches'), showAbout = A.on('about');

  view.innerHTML =
    '<section class="hero sweep" id="hero"><div class="studs"></div>' +
      '<div id="comp"><div class="sk" style="height:58px;width:75%"></div><div class="sk" style="height:84px;margin-top:28px"></div></div>' +
      (showMatch ? '<div class="vs" id="vs"><div class="sk" style="height:120px"></div></div>' : '') +
    '</section>' +
    (showLb ? '<div class="grid2"><section class="panel"><h2>Robot Challenge</h2><ol class="lb" id="lb-Robot"></ol></section><section class="panel"><h2>Sumo Challenge</h2><ol class="lb" id="lb-Sumo"></ol></section></div>' : '') +
    (showAbout ? '<div class="about" id="about"></div>' : '');

  const hero = document.getElementById('hero');
  if (!showMatch) hero.style.gridTemplateColumns = 'minmax(0,1fr)';
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  });

  const none = Promise.resolve({ data: [] });
  const [comp, match, rk, about] = await Promise.all([
    sb.from('competitions').select('*').in('status', ['DRAFT', 'ACTIVE']).gte('date', today).order('date').order('time').limit(1),
    showMatch ? sb.from('matches').select('*').eq('status', 'SCHEDULED').gte('date', today).order('date').order('time').limit(1) : none,
    showLb ? sb.from('rankings').select('*').in('leaderboard', ['Robot', 'Sumo']).order('points', { ascending: false }) : none,
    showAbout ? sb.from('about_sections').select('*').order('sort_order') : none
  ]);
  [comp, match, rk, about].forEach(r => { if (r.error) A.fail(r.error, 'Startseite laden'); });

  // Nächster Wettbewerb mit Countdown
  const c = (comp.data || [])[0], box = document.getElementById('comp');
  if (!c) {
    box.innerHTML = '<h1>Noch kein Wettbewerb geplant</h1><p class="lead">Sobald ein Admin einen Wettbewerb anlegt, siehst du hier den Countdown.</p>';
  } else {
    box.innerHTML = '<h1>' + esc(c.name) + '</h1>' +
      '<p class="lead">Nächster Wettbewerb: ' + esc(A.type(c.type)) + ' am ' + esc(A.fmtDate(c.date)) + (c.time ? ' um ' + esc(c.time) + ' Uhr' : '') + (c.location ? ' in ' + esc(c.location) : '') + '.</p>' +
      '<div class="cd intro" id="cd" role="timer" aria-label="Countdown bis zum Wettbewerb"></div>';
    countdown(new Date(c.date + 'T' + (c.time || '00:00')).getTime() || new Date(c.date + 'T00:00').getTime());
  }

  function countdown(target) {
    const cd = document.getElementById('cd');
    const units = [['d', 'Tage'], ['h', 'Std'], ['m', 'Min'], ['s', 'Sek']];
    cd.innerHTML = units.map(u => '<div><b data-u="' + u[0] + '"></b><small>' + u[1] + '</small></div>').join('');
    const el = {};
    units.forEach(u => { el[u[0]] = cd.querySelector('[data-u="' + u[0] + '"]'); });
    const set = (k, v) => {
      const t = String(v).padStart(2, '0');
      if (el[k].textContent === t) return;
      el[k].textContent = t;
      el[k].classList.remove('tick'); void el[k].offsetWidth; el[k].classList.add('tick');
    };
    const run = () => {
      const s = Math.max(0, Math.floor((target - Date.now()) / 1000));
      set('d', Math.floor(s / 86400)); set('h', Math.floor(s % 86400 / 3600)); set('m', Math.floor(s % 3600 / 60)); set('s', s % 60);
    };
    run();
    setInterval(run, 1000);
    setTimeout(() => cd.classList.remove('intro'), 1500);
  }

  // Nächstes Spiel
  if (showMatch) {
    const m = (match.data || [])[0], vs = document.getElementById('vs');
    vs.innerHTML = '<h3>Nächstes Spiel</h3>' + (!m ? '<div class="empty">Noch kein Spiel geplant.</div>' :
      '<div class="row"><span class="t">' + esc(m.team1_name || 'Noch offen') + '</span><span class="x">VS</span><span class="t">' + esc(m.team2_name || 'Noch offen') + '</span></div>' +
      '<p class="when">' + esc([m.competition_name, A.fmtDate(m.date) + (m.time ? ', ' + m.time + ' Uhr' : ''), m.arena].filter(Boolean).join(', ')) + '</p>');
  }

  // Ranglisten: Top 10, Balken und Punkte laufen nach dem Laden ein
  if (showLb) {
    ['Robot', 'Sumo'].forEach(k => {
      const ol = document.getElementById('lb-' + k);
      const rows = (rk.data || []).filter(r => r.leaderboard === k).slice(0, 10);
      if (!rows.length) { ol.outerHTML = '<div class="empty">Noch keine Punkte vergeben.</div>'; return; }
      const max = Math.max(1, ...rows.map(r => r.points));
      ol.innerHTML = rows.map((r, i) =>
        '<li style="--d:' + i * 60 + 'ms" data-w="' + (r.points / max) + '"><span class="rk">' + (i + 1) + '</span>' +
        '<span>' + esc(r.team_name) + '<small class="wd">' + r.wins + ' Siege, ' + r.draws + ' Unentschieden, ' + r.losses + ' Niederlagen</small></span>' +
        '<span class="pt" data-n="' + r.points + '">0</span></li>').join('');
      requestAnimationFrame(() => requestAnimationFrame(() => ol.querySelectorAll('li').forEach(li => {
        li.style.setProperty('--w', li.dataset.w);
        const pt = li.querySelector('.pt');
        A.countUp(pt, Number(pt.dataset.n));
      })));
    });
  }

  // Über die AG
  if (showAbout) {
    const el = document.getElementById('about'), rows = about.data || [];
    if (!rows.length) el.remove();
    else el.innerHTML = rows.map(r => '<section class="panel"><h3>' + esc(r.title) + '</h3><p class="lead">' + esc(r.text) + '</p></section>').join('');
  }
})();
