(function () {
  'use strict';
  const app = document.getElementById('app');
  if (!window.supabase || !window.ARENA_CONFIG) {
    app.innerHTML = '<p style="padding:24px;font-family:sans-serif;color:#eee">Supabase konnte nicht geladen werden. Prüfe deine Internetverbindung und js/config.js.</p>';
    return;
  }
  const C = window.ARENA_CONFIG;
  const sb = window.supabase.createClient(C.url, C.key);
  // Im Entwicklungsmodus (localhost, Datei oder ?debug) zeigen Fehler die echte Supabase-Meldung.
  const dev = /^(localhost|127\.0\.0\.1)?$/.test(location.hostname) || /[?&]debug/.test(location.search);
  const Arena = window.Arena = { sb, dev, flags: {}, admin: false };
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    fold: '<path d="M15 5l-7 7 7 7"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    users: '<path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M21 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8"/><circle cx="9.5" cy="6.5" r="3.5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    out: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    user: '<path d="M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1"/><circle cx="12" cy="7" r="4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>'
  };
  const svg = n => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';
  // Neue Seiten werden hier eingetragen; "feature" verknüpft sie mit den Schaltern aus der Tabelle features.
  const NAV = [
    { id: 'home', href: 'index.html', label: 'Startseite', icon: 'home' },
    { id: 'competitions', href: 'competitions.html', label: 'Wettbewerbe', icon: 'flag', feature: 'competitions' },
    { id: 'matches', href: 'matches.html', label: 'Spiele', icon: 'list', feature: 'matches' },
    { id: 'leaderboards', href: 'leaderboards.html', label: 'Ranglisten', icon: 'trophy', feature: 'leaderboards' },
    { id: 'teams', href: 'teams.html', label: 'Teams', icon: 'users', feature: 'teams' },
    { id: 'team', href: 'team.html', label: 'Mein Team', icon: 'user', feature: 'teams' },
    { id: 'messages', href: 'messages.html', label: 'Nachrichten', icon: 'mail', feature: 'messages' }
  ];
  const ADMIN_NAV = [
    { id: 'dash', href: 'admin.html', label: 'Dashboard', icon: 'grid' },
    { id: 'teams', href: 'admin-teams.html', label: 'Teams', icon: 'users' },
    { id: 'competitions', href: 'admin-competitions.html', label: 'Wettbewerbe', icon: 'flag' },
    { id: 'matches', href: 'admin-matches.html', label: 'Spiele', icon: 'list' },
    { id: 'rankings', href: 'admin-rankings.html', label: 'Ranglisten', icon: 'trophy' },
    { id: 'requests', href: 'admin-requests.html', label: 'Anfragen', icon: 'inbox' },
    { id: 'messages', href: 'admin-messages.html', label: 'Nachrichten', icon: 'mail' },
    { id: 'site', href: 'index.html', label: 'Zur Seite', icon: 'home' },
    { id: 'logout', href: '#', label: 'Abmelden', icon: 'out', logout: true }
  ];

  const esc = Arena.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  Arena.on = k => !k || Arena.flags[k] !== false;
  Arena.type = t => ({ Robot: 'Robot Challenge', Sumo: 'Sumo Challenge', Speed: 'Speed Challenge' }[t] || 'Wettbewerb');
  Arena.fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  Arena.toast = (msg, bad) => {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' err' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.append(t);
    setTimeout(() => t.remove(), 4500);
  };
  Arena.fail = (e, what) => {
    console.error(what || 'Fehler', e);
    Arena.toast((dev || Arena.verbose) && e && e.message ? (what || 'Fehler') + ': ' + e.message : 'Das hat nicht geklappt. Bitte versuche es gleich noch einmal.', true);
  };
  Arena.countUp = (el, to, ms) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
    const t0 = performance.now(), dur = ms || 900;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  Arena.loadFlags = async () => {
    const r = await sb.from('features').select('key,enabled');
    if (r.error) { Arena.fail(r.error, 'Funktionen laden'); return; }
    r.data.forEach(f => { Arena.flags[f.key] = f.enabled; });
  };

  async function checkAdmin() {
    const s = await sb.auth.getSession();
    if (!s.data.session) return false;
    const r = await sb.rpc('is_admin');
    return r.data === true;
  }
  function track() {
    let id = ls.get('device_id');
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); ls.set('device_id', id); }
    sb.from('stat_events').insert({ type: 'page_view', device_id: id, path: location.pathname }).then(() => {}, () => {});
  }

  // Baut Header, Seitenleiste und Rahmen auf und gibt das <main>-Element der Seite zurück (oder null im Aufräum-Modus).
  Arena.mount = async function (page, opts) {
    opts = opts || {};
    const sub = opts.root === false;
    const LIST = opts.admin ? ADMIN_NAV : NAV;
    const cur = LIST.find(n => n.id === page);
    const title = opts.title || (cur && cur.label) || '';
    const nav = LIST.map(n => '<a href="' + n.href + '"' + (n.logout ? ' data-logout' : '') + ' data-feature="' + (n.feature || '') + '"' + (n.id === page ? ' aria-current="page"' : '') + '>' + svg(n.icon) + '<span class="lbl">' + n.label + '</span></a>').join('');
    app.innerHTML =
      '<a class="skip" href="#view">Zum Inhalt springen</a>' +
      '<div class="shell' + (ls.get('side_mini') === '1' ? ' mini' : '') + '" id="shell">' +
      '<aside class="side">' +
        '<a class="brand" href="index.html"><span class="logo">🤖</span><span class="lbl">Mindstorms AG</span></a>' +
        '<nav class="nav" aria-label="Hauptnavigation">' + nav + '</nav>' +
        '<button class="fold" id="fold" type="button" aria-label="Seitenleiste ein- oder ausklappen">' + svg('fold') + '<span class="lbl">Einklappen</span></button>' +
      '</aside>' +
      '<div class="scrim" id="scrim"></div>' +
      '<div class="col">' +
        '<header class="top' + (sub ? ' sub' : '') + '">' +
          '<button class="ib" id="menu" type="button" aria-label="' + (sub ? 'Zurück' : 'Menü öffnen') + '">' + svg(sub ? 'back' : 'menu') + '</button>' +
          '<a class="brand sm" href="index.html"><span class="logo">🤖</span>Mindstorms AG</a>' +
          '<h2 class="pt">' + esc(title) + '</h2>' +
        '</header>' +
        '<main id="view" tabindex="-1"></main>' +
      '</div></div>';
    document.title = (title ? title + ' – ' : '') + 'Mindstorms Arena';
    const shell = document.getElementById('shell');
    document.getElementById('fold').onclick = () => { shell.classList.toggle('mini'); ls.set('side_mini', shell.classList.contains('mini') ? '1' : '0'); };
    document.getElementById('menu').onclick = () => { if (sub) history.back(); else shell.classList.toggle('open'); };
    document.getElementById('scrim').onclick = () => shell.classList.remove('open');

    const res = await Promise.all([
      checkAdmin().catch(() => false),
      sb.from('site_config').select('value').eq('key', 'maintenance').maybeSingle().then(r => !!r.data && r.data.value === 'on', () => false),
      Arena.loadFlags()
    ]);
    Arena.admin = res[0];
    if (opts.admin && !Arena.admin) { location.replace('login.html'); return null; }
    if (!opts.admin) shell.querySelector('.nav').insertAdjacentHTML('beforeend', Arena.admin
      ? '<a href="admin.html">' + svg('shield') + '<span class="lbl">Admin</span></a>'
      : '<a href="login.html">' + svg('shield') + '<span class="lbl">Admin-Login</span></a>');
    if (res[1] && !Arena.admin) {
      document.body.insertAdjacentHTML('beforeend', '<div class="lock"><div><div class="logo big">🤖</div><h1>Wir räumen gerade auf</h1><p>Die Seite ist kurz nicht erreichbar. Schau später noch einmal vorbei.</p></div></div>');
      return null;
    }
    shell.querySelectorAll('.nav [data-feature]').forEach(a => { if (!Arena.on(a.dataset.feature)) a.remove(); });
    if (!opts.admin) track();
    return document.getElementById('view');
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-logout]')) return;
    e.preventDefault();
    sb.auth.signOut().then(() => { location.href = 'login.html'; });
  });
  Arena.checkAdmin = checkAdmin;
})();
