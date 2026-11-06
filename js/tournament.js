(function () {
  'use strict';
  const chk = async p => { const r = await p; if (r.error) throw r.error; return r.data; };
  const STATUS = { DRAFT: 'Entwurf', ACTIVE: 'Aktiv', FINISHED: 'Beendet', CANCELLED: 'Abgesagt' };
  const MST = { SCHEDULED: 'Geplant', LIVE: 'Läuft', FINISHED: 'Beendet', CANCELLED: 'Abgesagt' };
  const FORMAT = { ROUND_ROBIN: 'Jeder gegen jeden', KO: 'K.o.-Turnier' };
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const parse = r => { const m = /^(\d+)\s*:\s*(\d+)$/.exec(r || ''); return m ? [+m[1], +m[2]] : [0, 0]; };
  const roundNo = r => { const m = /^Runde (\d+)$/.exec(r || ''); return m ? +m[1] : ({ Viertelfinale: 90, Halbfinale: 91, Finale: 92 }[r] || 99); };
  const sort = ms => ms.slice().sort((a, b) => roundNo(a.round) - roundNo(b.round) || (a.bracket_index == null ? 0 : a.bracket_index) - (b.bracket_index == null ? 0 : b.bracket_index) || String(a.date).localeCompare(String(b.date)) || String(a.time || '').localeCompare(String(b.time || '')));
  const rname = (r, R) => r === R ? 'Finale' : r === R - 1 ? 'Halbfinale' : r === R - 2 ? 'Viertelfinale' : 'Runde ' + r;
  const teamsOf = c => (c.participating_team_ids || []).map((id, i) => ({ id, name: (c.participating_team_names || [])[i] }));

  function row(comp, m) {
    return {
      id: m.id || uuid(), competition_id: comp.id, competition_name: comp.name, date: comp.date, time: comp.time || null, arena: null,
      team1_id: m.t1 ? m.t1.id : null, team1_name: m.t1 ? m.t1.name : null, team2_id: m.t2 ? m.t2.id : null, team2_name: m.t2 ? m.t2.name : null,
      round: m.round, bracket_index: m.i == null ? null : m.i, next_match_id: m.next || null, best_of: m.best_of || 1,
      status: m.bye ? 'FINISHED' : 'SCHEDULED', outcome: m.bye ? (m.t1 ? 'team1' : 'team2') : null, result: m.bye ? 'Freilos' : null
    };
  }
  // Auslosung: Jeder gegen jeden (Kreismethode) oder K.o.-Baum mit Freilosen
  function generate(comp, teams) {
    if (comp.format !== 'KO') {
      const t = shuffle(teams); if (t.length % 2) t.push(null);
      const n = t.length, out = [];
      for (let r = 0; r < n - 1; r++) {
        for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) out.push({ round: 'Runde ' + (r + 1), t1: a, t2: b, i: out.length }); }
        t.splice(1, 0, t.pop());
      }
      return out.map(m => row(comp, m));
    }
    const size = Math.pow(2, Math.ceil(Math.log2(Math.max(2, teams.length)))), R = Math.log2(size), rd = [];
    for (let r = 1; r <= R; r++) rd.push(Array.from({ length: size / Math.pow(2, r) }, (_, i) => ({ id: uuid(), i, round: rname(r, R), best_of: r === R ? comp.final_best_of : r === R - 1 ? comp.semifinal_best_of : 1, t1: null, t2: null, next: null })));
    rd.forEach((ms, ri) => ms.forEach((m, i) => { if (ri < R - 1) m.next = rd[ri + 1][i >> 1].id; }));
    const s = shuffle(teams), slots = Array(size).fill(null);
    for (let k = 0; k < size / 2 && s.length; k++) slots[2 * k] = s.shift();
    for (let k = 0; k < size / 2 && s.length; k++) slots[2 * k + 1] = s.shift();
    rd[0].forEach((m, i) => { m.t1 = slots[2 * i]; m.t2 = slots[2 * i + 1]; });
    if (R > 1) rd[0].forEach((m, i) => { if (!m.t1 !== !m.t2) { m.bye = true; rd[1][i >> 1][i % 2 === 0 ? 't1' : 't2'] = m.t1 || m.t2; } });
    return rd.reduce((a, b) => a.concat(b), []).map(m => row(comp, m));
  }

  function standings(comp, ms, teams) {
    const T = {};
    teams.forEach(t => { T[t.id] = { team_id: t.id, team_name: t.name, played: 0, wins: 0, draws: 0, losses: 0, diff: 0 }; });
    ms.filter(m => m.status === 'FINISHED' && m.result !== 'Freilos' && m.team1_id && m.team2_id).forEach(m => {
      const a = T[m.team1_id], b = T[m.team2_id]; if (!a || !b) return;
      const p = parse(m.result); a.played++; b.played++; a.diff += p[0] - p[1]; b.diff += p[1] - p[0];
      if (m.outcome === 'team1') { a.wins++; b.losses++; } else if (m.outcome === 'team2') { b.wins++; a.losses++; } else { a.draws++; b.draws++; }
    });
    return Object.keys(T).map(k => T[k]).map(t => Object.assign(t, { points: t.wins * comp.points_win + t.draws * comp.points_draw + t.losses * comp.points_loss }))
      .sort((p, q) => q.points - p.points || q.diff - p.diff || p.team_name.localeCompare(q.team_name, 'de'));
  }

  function box(m, esc, withComp) {
    const done = m.status === 'FINISHED' && m.result !== 'Freilos', sc = parse(m.result);
    const t = n => n ? esc(n) : '<i>Noch offen</i>';
    const when = [m.date ? new Date(m.date + 'T00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }) : '', m.time ? m.time.slice(0, 5) + ' Uhr' : '', m.arena || ''].filter(Boolean).join(', ');
    const note = m.result === 'Freilos' ? 'Freilos' : m.status === 'LIVE' ? 'Läuft jetzt' : m.status === 'CANCELLED' ? 'Abgesagt' : when;
    return '<' + (withComp && m.competition_id ? 'a href="competition.html?id=' + m.competition_id + '"' : 'div') + ' class="mt"><small>' + esc((m.round || '') + (withComp && m.competition_name ? ', ' + m.competition_name : '')) + '</small>' +
      '<div class="' + (done && m.outcome === 'team1' ? 'w' : '') + '"><span>' + t(m.team1_name) + '</span><b>' + (done ? sc[0] : '–') + '</b></div>' +
      '<div class="' + (done && m.outcome === 'team2' ? 'w' : '') + '"><span>' + t(m.team2_name) + '</span><b>' + (done ? sc[1] : '–') + '</b></div>' +
      '<small>' + esc(note) + '</small></' + (withComp && m.competition_id ? 'a' : 'div') + '>';
  }

  // Ergebnis eintragen; im K.o.-Turnier rückt der Sieger ins nächste Spiel vor
  async function setResult(sb, comp, m, ms, s1, s2) {
    if (comp.ranking_applied) throw new Error('Die Punkte sind schon in die Rangliste übernommen. Nimm das zuerst zurück.');
    if (!m.team1_id || !m.team2_id) throw new Error('Dieses Spiel hat noch nicht beide Teams.');
    const ko = comp.format === 'KO';
    if (ko && s1 === s2) throw new Error('Im K.o.-Turnier gibt es kein Unentschieden.');
    const nxt = ko && m.next_match_id ? ms.find(x => x.id === m.next_match_id) : null;
    if (nxt && nxt.status === 'FINISHED') throw new Error('Das nächste Spiel ist schon gespielt. Ändere zuerst dessen Ergebnis.');
    const outcome = s1 > s2 ? 'team1' : s2 > s1 ? 'team2' : 'draw';
    await chk(sb.from('matches').update({ result: s1 + ':' + s2, outcome, status: 'FINISHED' }).eq('id', m.id));
    if (ko) {
      const w = outcome === 'team1' ? [m.team1_id, m.team1_name] : [m.team2_id, m.team2_name];
      if (nxt) { const side = m.bracket_index % 2 === 0 ? 'team1' : 'team2'; const u = {}; u[side + '_id'] = w[0]; u[side + '_name'] = w[1]; await chk(sb.from('matches').update(u).eq('id', nxt.id)); }
      else await chk(sb.from('competitions').update({ winner_team_id: w[0], winner_team_name: w[1] }).eq('id', comp.id));
    }
  }

  const boards = c => ['Robot', 'Sumo', 'Speed'].indexOf(c.type) >= 0 ? [c.type, 'Overall'] : ['Overall'];
  async function shift(sb, comp, deltas, sign) {
    if (!deltas.length) return;
    for (const b of boards(comp)) {
      const ex = await chk(sb.from('rankings').select('*').eq('leaderboard', b).in('team_id', deltas.map(d => d.team_id)));
      const by = {}; ex.forEach(r => { by[r.team_id] = r; });
      const rows = deltas.map(d => {
        const r = by[d.team_id] || {}, f = k => Math.max(0, (r[k] || 0) + sign * d[k]);
        return { leaderboard: b, team_id: d.team_id, team_name: d.team_name, points: f('points'), wins: f('wins'), draws: f('draws'), losses: f('losses') };
      });
      await chk(sb.from('rankings').upsert(rows, { onConflict: 'leaderboard,team_id' }));
    }
  }
  async function apply(sb, comp, ms) {
    if (ms.some(m => m.status !== 'FINISHED' && m.status !== 'CANCELLED')) throw new Error('Es sind noch Spiele offen. Trage zuerst alle Ergebnisse ein.');
    const st = standings(comp, ms, teamsOf(comp));
    const wid = comp.format === 'KO' ? comp.winner_team_id : (st[0] || {}).team_id;
    if (!wid) throw new Error('Es gibt noch keinen Sieger.');
    const deltas = st.map(t => ({ team_id: t.team_id, team_name: t.team_name, points: t.points + (t.team_id === wid ? comp.points_winner_bonus : 0), wins: t.wins, draws: t.draws, losses: t.losses }));
    await shift(sb, comp, deltas, 1);
    await chk(sb.from('competitions').update({ ranking_applied: true, ranking_snapshot: deltas, winner_team_id: wid, winner_team_name: st.find(t => t.team_id === wid).team_name, status: 'FINISHED' }).eq('id', comp.id));
  }
  async function undo(sb, comp) {
    await shift(sb, comp, comp.ranking_snapshot || [], -1);
    await chk(sb.from('competitions').update({ ranking_applied: false, ranking_snapshot: [] }).eq('id', comp.id));
  }

  window.Tournament = { STATUS, MST, FORMAT, parse, sort, teamsOf, generate, standings, box, setResult, apply, undo };
})();
