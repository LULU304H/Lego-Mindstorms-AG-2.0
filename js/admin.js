(function () {
  'use strict';
  if (!window.Arena) return;
  const A = window.Arena, sb = A.sb, esc = A.esc;
  A.verbose = true; // Admins sehen die echten Fehlermeldungen
  const $ = (s, r) => (r || document).querySelector(s);
  const q = async p => { const r = await p; if (r.error) throw r.error; return r.data; };
  const opt = o => Array.isArray(o) ? o : [o, o];
  const fo = f => typeof f.options === 'function' ? f.options() : (f.options || []);
  const genTag = () => {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', g = n => [...crypto.getRandomValues(new Uint8Array(n))].map(x => a[x % a.length]).join('');
    return g(4) + '-' + g(4) + '-' + g(4);
  };
  const show = (f, v) => {
    if (f.type === 'checkbox') return v ? 'Ja' : 'Nein';
    if (f.type === 'select') { const o = fo(f).map(opt).find(x => x[0] == v); return esc(o ? o[1] : v); }
    if (f.type === 'date' && v) return esc(new Date(v + 'T00:00').toLocaleDateString('de-DE'));
    if (f.type === 'color' && v) return '<i class="dot" style="background:' + esc(v) + '"></i>' + esc(v);
    return esc(v);
  };
  const input = (f, v) => {
    const id = 'f_' + f.k, req = f.req ? ' required' : '';
    if (f.type === 'textarea') return '<textarea id="' + id + '" rows="3"' + req + '>' + esc(v) + '</textarea>';
    if (f.type === 'select') return '<select id="' + id + '"' + req + '>' + fo(f).map(opt).map(o => '<option value="' + esc(o[0]) + '"' + (o[0] == v ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
    if (f.type === 'checkbox') return '<input id="' + id + '" type="checkbox"' + (v ? ' checked' : '') + '>';
    const t = f.type === 'tag' ? 'text' : f.type || 'text';
    return '<input id="' + id + '" type="' + t + '" value="' + esc(v) + '"' + req + (f.type === 'tag' ? ' minlength="8"' : '') + (t === 'number' ? ' step="1"' : '') + '>';
  };
  const read = (f, dlg) => {
    const el = $('#f_' + f.k, dlg);
    if (f.type === 'checkbox') return el.checked;
    if (f.type === 'number') return el.value === '' ? 0 : +el.value;
    const v = el.value.trim(); return v === '' ? null : v;
  };

  async function crud(view, c) {
    if (c.init) await c.init(c);
    let rows = [];
    view.innerHTML = '<div class="bar-h"><h1 class="pg-h">' + c.title + '</h1><button class="btn pri" id="new" type="button">' + c.newLabel + '</button></div><div id="list"></div><dialog id="dlg"></dialog>';
    const list = $('#list', view), dlg = $('#dlg', view);

    const draw = () => {
      const cols = c.fields.filter(f => f.list);
      list.innerHTML = rows.length ? '<div class="scroll"><table class="tbl"><thead><tr>' + cols.map(f => '<th>' + f.label + '</th>').join('') + '<th></th></tr></thead><tbody>' +
        rows.map((r, i) => '<tr>' + cols.map(f => '<td>' + show(f, r[f.k]) + '</td>').join('') + '<td class="act"><button class="btn sm" data-e="' + i + '" type="button">Bearbeiten</button> <button class="btn sm del" data-d="' + i + '" type="button">Löschen</button></td></tr>').join('') +
        '</tbody></table></div>' : '<p class="empty">' + c.empty + '</p>';
    };
    const load = async () => {
      try {
        let b = sb.from(c.table).select(c.select || '*');
        (c.order || []).forEach(o => { b = b.order(o[0], { ascending: o[1] }); });
        rows = (await q(b)).map(c.load || (r => r)); draw();
      } catch (e) { A.fail(e, c.title + ' laden'); list.innerHTML = '<p class="empty">Die Liste konnte nicht geladen werden: ' + esc(e.message) + '</p>'; }
    };

    const open = r => {
      const rec = r || c.defaults || {};
      dlg.innerHTML = '<form id="fm"><h2 class="dlg-h">' + (r ? 'Bearbeiten' : c.newLabel) + '</h2>' + c.fields.map(f => {
        const v = f.type === 'tag' && !rec[f.k] ? genTag() : rec[f.k];
        return '<label class="fld' + (f.type === 'checkbox' ? ' chk' : '') + '"><span>' + f.label + '</span>' + input(f, v) + (f.hint ? '<small>' + f.hint + '</small>' : '') + (f.type === 'tag' ? '<button class="btn sm" type="button" data-gen>Neuen Tag erzeugen</button>' : '') + '</label>';
      }).join('') + '<p class="form-msg" id="msg" role="alert" hidden></p><div class="dlg-act"><button class="btn" type="button" data-x>Abbrechen</button><button class="btn pri" type="submit">Speichern</button></div></form>';
      dlg.showModal();
      dlg.onclick = e => {
        if (e.target.closest('[data-x]')) dlg.close();
        const g = e.target.closest('[data-gen]'); if (g) g.closest('label').querySelector('input').value = genTag();
      };
      $('#fm', dlg).onsubmit = async e => {
        e.preventDefault();
        const msg = $('#msg', dlg), btn = $('[type=submit]', dlg);
        msg.hidden = true; btn.disabled = true;
        const raw = {}; c.fields.forEach(f => { raw[f.k] = read(f, dlg); });
        const out = Object.assign({}, raw); c.fields.filter(f => f.virtual).forEach(f => { delete out[f.k]; });
        try {
          if (c.before) await c.before(out, raw, r);
          const t = sb.from(c.table);
          const res = await q((r ? t.update(out).eq('id', r.id) : t.insert(out)).select().single());
          if (c.after) await c.after(res.id, raw);
          dlg.close(); A.toast('Gespeichert.'); load();
        } catch (er) {
          msg.textContent = er.code === '23505' ? 'Diesen Eintrag gibt es schon, zum Beispiel ein Team, das in dieser Rangliste schon steht.' : 'Speichern hat nicht geklappt: ' + (er.message || er);
          msg.hidden = false; btn.disabled = false;
        }
      };
    };

    list.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.e != null) return open(rows[+b.dataset.e]);
      if (b.dataset.d != null) {
        const r = rows[+b.dataset.d];
        if (!confirm('„' + c.name(r) + '“ wirklich löschen? Das lässt sich nicht rückgängig machen.' + (c.delNote || ''))) return;
        try { await q(sb.from(c.table).delete().eq('id', r.id)); A.toast('Gelöscht.'); load(); } catch (er) { A.fail(er, 'Löschen'); }
      }
    };
    $('#new', view).onclick = () => open(null);
    await load();
  }
  async function page(id, title, c) {
    const view = await A.mount(id, { title, admin: true });
    if (view) await crud(view, Object.assign({ title }, c));
  }
  window.Admin = { page, crud, genTag, q };
})();
