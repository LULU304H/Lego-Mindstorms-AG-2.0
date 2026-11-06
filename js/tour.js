(function () {
  'use strict';
  const A = window.Arena;
  const S = [
    ['Willkommen', 'Hier findest du alles zur LEGO Mindstorms AG: Wettbewerbe, Spiele, Ergebnisse und die Teams.'],
    ['Wettbewerbe und Spiele', 'Unter „Wettbewerbe“ siehst du Tabellen und Turnierbäume. Unter „Spiele“ stehen alle Begegnungen mit Terminen und Ergebnissen.'],
    ['Ranglisten und Historie', 'Die Ranglisten zeigen die Punkte der Teams. In der Historie findest du abgeschlossene Wettbewerbe mit ihren Siegern.'],
    ['Mein Team', 'Mit dem geheimen Team-Tag meldest du dein Team an. Dort verwaltest du Mitglieder, lädst Bilder und Projekte hoch, fragst die Teilnahme an und schreibst den Admins.'],
    ['Nachrichten und Open Chat', 'Die Admins schicken Neuigkeiten an alle. Im Open Chat können Teams miteinander schreiben.'],
    ['Regeln und Über die AG', 'Alle Regeln und Infos zur AG stehen in der Seitenleiste. Den Rundgang kannst du jederzeit mit dem Kompass oben noch einmal starten.']
  ];
  A.tour = function () {
    if (document.querySelector('.tour')) return;
    let i = 0;
    const o = document.createElement('div'); o.className = 'tour';
    o.innerHTML = '<div class="tcardx" role="dialog" aria-modal="true" aria-labelledby="tt"><span class="mute" id="tc"></span><h2 id="tt"></h2><p id="tx"></p><div class="dlg-act"><button class="btn" type="button" data-x>Beenden</button><button class="btn" type="button" data-p>Zurück</button><button class="btn pri" type="button" data-n>Weiter</button></div></div>';
    document.body.append(o);
    const q = s => o.querySelector(s);
    const show = () => {
      q('#tc').textContent = 'Schritt ' + (i + 1) + ' von ' + S.length; q('#tt').textContent = S[i][0]; q('#tx').textContent = S[i][1];
      q('[data-p]').hidden = i === 0; q('[data-n]').textContent = i === S.length - 1 ? 'Fertig' : 'Weiter';
    };
    const key = e => { if (e.key === 'Escape') close(); };
    const close = () => { o.remove(); document.removeEventListener('keydown', key); };
    o.onclick = e => {
      if (e.target === o || e.target.closest('[data-x]')) close();
      else if (e.target.closest('[data-p]') && i > 0) { i--; show(); }
      else if (e.target.closest('[data-n]')) { if (i === S.length - 1) close(); else { i++; show(); } }
    };
    document.addEventListener('keydown', key); show(); q('[data-n]').focus();
  };
})();
