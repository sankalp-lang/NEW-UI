/* ============================================================
   PolicyOS · Tara - embedded document viewer (App.pdf)
   No real PDFs in the prototype: we synthesize a paginated, page-numbered
   document from a policy's own content (summary → parameters → rules → governance)
   or from an uploaded circular's clauses. Every answer/redline that quotes a page
   uses App.pdf.cite(...) to drop a clickable chip that opens that exact page in a
   small window with the cited clause highlighted. One source of truth for "show me
   where it says that, on which page".
   ============================================================ */
(function () {
  const App = window.App;
  const cache = {};
  const key = (kind, id) => kind + ':' + id;
  const findCircular = (id) => (DB.incomingCirculars || []).concat(DB.circulars || []).find(c => c.id === id);
  const matches = (a, anchor) => a && (a === anchor || String(a).indexOf(anchor) >= 0 || String(anchor).indexOf(a) >= 0);

  function policyDoc(p) {
    const owner = App.emp(p.owner);
    return {
      kind: 'policy', title: p.name, file: p.name.replace(/[^a-z0-9]+/gi, '_') + '.pdf',
      pages: [
        { heading: '1. Purpose & Scope', blocks: [
          { type: 'p', text: p.summary || (p.name + ' governs ' + String(p.sub || '').toLowerCase() + ' decisions across the organisation.') },
          { type: 'p', text: 'Maintained in PolicyOS. Owner: ' + (owner ? owner.name : p.owner) + '. Version ' + p.version + ', last updated ' + p.updated + '. Subject to periodic and event-driven review.' }
        ] },
        { heading: '2. Eligibility & Key Parameters', blocks:
          Object.entries(p.facts || {}).map(([k, v], i) => ({ type: 'kv', anchor: k, n: '2.' + (i + 1), text: k, val: v })) },
        { heading: '3. Decision Rules', blocks:
          (p.rules || []).map((r, i) => ({ type: 'rule', anchor: r, n: '3.' + (i + 1), text: r })) },
        { heading: '4. Governance, Exceptions & Review', blocks: [
          { type: 'p', text: 'Exceptions require L2 approval and must be logged. Material changes follow the maker–checker workflow in PolicyOS Approvals.' },
          { type: 'p', text: 'This policy is reviewed at least annually, or whenever a regulatory change affects its parameters.' }
        ] }
      ]
    };
  }

  function circularDoc(c) {
    const pages = [];
    const ensure = n => { while (pages.length < n) pages.push({ heading: '', blocks: [], _cl: [] }); return pages[n - 1]; };
    ensure(1); pages[0].heading = '1. Background'; pages[0].blocks.push({ type: 'p', text: c.summary });
    (c.clauses || []).forEach(cl => { const pg = ensure(cl.page); pg.blocks.push({ type: 'clause', anchor: cl.id, n: cl.ref, text: cl.text }); pg._cl.push(cl); });
    pages.forEach((pg, i) => { if (i === 0 || !pg._cl) return; if (pg._cl.length === 1) pg.heading = pg._cl[0].ref + ' - ' + pg._cl[0].topic; else if (pg._cl.length > 1) pg.heading = pg._cl.map(x => x.ref).join(' · ') + ' - multiple provisions'; });
    while (pages.length < (c.pages || pages.length)) pages.push({ heading: '(continued)', blocks: [{ type: 'p', text: '…' }] });
    return { kind: 'circular', title: c.title, file: c.file || (c.ref.replace(/[^a-z0-9]+/gi, '_') + '.pdf'), pages };
  }

  function amendmentDoc(a) {
    const pages = [];
    pages.push({ heading: '1. Background', blocks: [{ type: 'p', text: a.regulator + ' ' + a.ref + ' · ' + a.date }, { type: 'p', text: a.summary }] });
    const blocks = (a.changes || []).map(ch => ({ type: 'clause', anchor: ch.id, n: ch.clauseRef, text: ch.section + ' - ' + (ch.isNew ? 'shall introduce: ' : 'shall be: ') + ch.suggested + '. ' + ch.rationale }));
    if (!blocks.length) blocks.push({ type: 'p', text: a.scope || 'Informational circular - review for awareness. No mandated policy-parameter changes have been mapped to your library.' });
    pages.push({ heading: '2. Directions', blocks: blocks });
    return { kind: 'amendment', title: a.title, file: a.ref.replace(/[^a-z0-9]+/gi, '_') + '.pdf', pages: pages };
  }

  function build(kind, id) {
    const k = key(kind, id); if (cache[k]) return cache[k];
    let d = null;
    if (kind === 'policy') { const p = App.policy(id); if (p) d = policyDoc(p); }
    else if (kind === 'circular') { const c = findCircular(id); if (c) d = circularDoc(c); }
    else if (kind === 'amendment') { const a = (DB.amendments || []).find(x => x.id === id); if (a) d = amendmentDoc(a); }
    if (!d) d = { kind: kind, title: 'Document', file: 'document.pdf', pages: [{ heading: 'Document', blocks: [{ type: 'p', text: 'Not available in this deployment.' }] }] };
    cache[k] = d; return d;
  }

  function pageOf(doc, anchor) {
    if (anchor == null || anchor === '') return 1;
    if (typeof anchor === 'number') return Math.max(1, Math.min(doc.pages.length, anchor));
    for (let i = 0; i < doc.pages.length; i++) { if ((doc.pages[i].blocks || []).some(b => matches(b.anchor, anchor))) return i + 1; }
    return doc.pages.length >= 2 ? 2 : 1; // default to the parameters page
  }

  function blockHTML(b, hl) {
    const on = hl && matches(b.anchor, hl) ? ' is-hl' : '';
    if (b.type === 'kv') return `<div class="pdfpg__kv${on}"><span class="pdfpg__n">${App.esc(b.n || '')}</span><span class="pdfpg__k">${App.esc(b.text)}</span><span class="pdfpg__v">${App.esc(b.val)}</span></div>`;
    if (b.type === 'rule') return `<div class="pdfpg__rule${on}"><span class="pdfpg__n">${App.esc(b.n || '')}</span><code>${App.esc(b.text)}</code></div>`;
    if (b.type === 'clause') return `<div class="pdfpg__clause${on}"><span class="pdfpg__n">${App.esc(b.n || '')}</span><span>${App.esc(b.text)}</span></div>`;
    return `<p class="pdfpg__p${on}">${App.esc(b.text)}</p>`;
  }

  function pageHTML(doc, idx, hl) {
    const pg = doc.pages[idx - 1] || { heading: '', blocks: [] };
    return `<div class="pdfpg">
      <div class="pdfpg__rh"><span>${App.esc(doc.file)}</span><span>Page ${idx} of ${doc.pages.length}</span></div>
      <div class="pdfpg__title">${App.esc(doc.title)}</div>
      ${pg.heading ? `<div class="pdfpg__sec">${App.esc(pg.heading)}</div>` : ''}
      ${(pg.blocks || []).map(b => blockHTML(b, hl)).join('')}
    </div>`;
  }

  const PDF = {
    build, pageOf,
    meta(kind, id) { const d = build(kind, id); return { title: d.title, file: d.file, pages: d.pages.length }; },

    // fill a host element with a paginated viewer (page + nav); re-renders itself on nav
    renderInto(hostId, kind, id, opts) {
      opts = opts || {};
      const host = document.getElementById(hostId); if (!host) return;
      const doc = build(kind, id);
      const hl = (opts.anchor != null && typeof opts.anchor !== 'number') ? opts.anchor : null;
      let page = opts.page != null ? opts.page : pageOf(doc, opts.anchor);
      page = Math.max(1, Math.min(doc.pages.length, page));
      const showHl = (hl && (doc.pages[page - 1].blocks || []).some(b => matches(b.anchor, hl))) ? hl : null;
      const a = hl ? `'${String(hl).replace(/'/g, "\\'")}'` : 'null';
      const fb = opts.fullBtn ? ',fullBtn:true' : '';
      const nav = `<div class="pdfnav">
        <button class="btn btn--sm" ${page <= 1 ? 'disabled' : ''} onclick="App.pdf.renderInto('${hostId}','${kind}','${id}',{page:${page - 1},anchor:${a}${fb}})">‹ Prev</button>
        <span class="pdfnav__pg">Page ${page} / ${doc.pages.length}</span>
        <button class="btn btn--sm" ${page >= doc.pages.length ? 'disabled' : ''} onclick="App.pdf.renderInto('${hostId}','${kind}','${id}',{page:${page + 1},anchor:${a}${fb}})">Next ›</button>
      </div>`;
      const fullRow = opts.fullBtn ? `<div class="pdf-fullrow"><button class="btn btn--sm" onclick="App.pdf.openFull('${kind}','${id}',{page:${page},anchor:${a}})">⤢ View full page</button></div>` : '';
      host.innerHTML = `<div class="pdfviewer">${pageHTML(doc, page, showHl)}${fullRow}${nav}</div>`;
    },

    // small floating window (used by citation chips, from anywhere)
    _win() {
      let w = document.getElementById('pdfWin');
      if (!w) {
        w = document.createElement('div'); w.id = 'pdfWin'; w.className = 'pdfwin';
        w.innerHTML = '<div class="pdfwin__h">' + App.icon('file') + '<span class="pdfwin__t" id="pdfWinTitle"></span><span class="pdfwin__cite" id="pdfWinCite"></span><div style="flex:1"></div><button class="modal__x" onclick="App.pdf.close()" aria-label="Close">' + App.icon('x') + '</button></div><div class="pdfwin__b" id="pdfWinBody"></div>';
        document.body.appendChild(w);
      }
      return w;
    },
    open(opts) {
      opts = opts || {};
      const doc = build(opts.kind, opts.id); const w = PDF._win(); w.classList.add('show');
      const pg = opts.page != null ? opts.page : pageOf(doc, opts.anchor);
      document.getElementById('pdfWinTitle').textContent = doc.title;
      document.getElementById('pdfWinCite').textContent = (opts.kind === 'circular' ? 'Circular' : 'Policy') + ' · p.' + Math.max(1, Math.min(doc.pages.length, pg));
      PDF.renderInto('pdfWinBody', opts.kind, opts.id, { page: opts.page, anchor: opts.anchor });
    },
    openCite(kind, id, a) { const n = Number(a); PDF.open({ kind: kind, id: id, anchor: (a !== '' && a != null && !isNaN(n) && String(n) === String(a)) ? n : a }); },
    close() { ['pdfWin', 'pdfFull'].forEach(function (idd) { const w = document.getElementById(idd); if (w) w.classList.remove('show'); }); },

    // full-screen page view (opened from the "View full page" button in an inline viewer)
    _full() {
      let w = document.getElementById('pdfFull');
      if (!w) {
        w = document.createElement('div'); w.id = 'pdfFull'; w.className = 'pdffull';
        w.innerHTML = '<div class="pdffull__panel"><div class="pdffull__h">' + App.icon('file') + '<span class="pdffull__t" id="pdfFullTitle"></span><div style="flex:1"></div><button class="modal__x" onclick="App.pdf.closeFull()" aria-label="Close">' + App.icon('x') + '</button></div><div class="pdffull__b" id="pdfFullBody"></div></div>';
        w.addEventListener('click', function (e) { if (e.target === w) PDF.closeFull(); });
        document.body.appendChild(w);
      }
      return w;
    },
    openFull(kind, id, opts) {
      opts = opts || {}; const doc = build(kind, id); const w = PDF._full(); w.classList.add('show');
      const t = document.getElementById('pdfFullTitle'); if (t) t.textContent = doc.title;
      PDF.renderInto('pdfFullBody', kind, id, { page: opts.page, anchor: opts.anchor });
    },
    closeFull() { const w = document.getElementById('pdfFull'); if (w) w.classList.remove('show'); },

    // inline clickable citation chip - "📄 Personal Loan Credit Policy · p.2"
    cite(kind, id, anchorOrPage, label) {
      const doc = build(kind, id); const pg = pageOf(doc, anchorOrPage);
      const lab = label || (doc.title.length > 28 ? doc.title.slice(0, 26) + '…' : doc.title);
      const a = String(anchorOrPage == null ? '' : anchorOrPage).replace(/'/g, "\\'");
      return `<button class="cite" onclick="App.pdf.openCite('${kind}','${id}','${a}')" title="Open ${App.esc(doc.file)} at page ${pg}">${App.icon('file')} ${App.esc(lab)} · p.${pg}</button>`;
    }
  };
  App.pdf = PDF;
})();

/* ============================================================
   App.versions - policy version history + working compare
   (mirrors the production Versions / VersionSelectionModal / CompareModal flow:
    a version trail, a From/To picker, and a rule-by-rule diff)
   ============================================================ */
(function () {
  const App = window.App;
  const V = {
    // rule text with its first number shifted (older versions had looser thresholds)
    _olderRule(r, k) {
      return String(r).replace(/(\d+(?:\.\d+)?)/, function (m) {
        const num = parseFloat(m);
        if (num >= 100) return String(Math.max(0, num - 20 * k));
        if (num < 1) return Math.max(0, num + 0.05 * k).toFixed(2);
        return String(Math.max(0, num - k));
      });
    },
    // version trail for a policy (curated p.versions if present, else synthesized). Oldest → newest; last = current/Active.
    list(pid) {
      const p = App.policy(pid); if (!p) return [];
      if (p.versions && p.versions.length) return p.versions;
      const m = /v(\d+)\.(\d+)/.exec(p.version || 'v1.0'); const maj = m ? +m[1] : 1, min = m ? +m[2] : 0;
      const n = Math.min(3, min + 1);
      const older = ['02 Jan 2026', '16 Mar 2026'];   // oldest → most-recent superseded (chronological)
      const rl = p.rules || [];
      // rule indices that actually contain a number - those are the ones we can diff between versions
      const numIdx = rl.map(function (r, i) { return /\d/.test(r) ? i : -1; }).filter(function (i) { return i >= 0; });
      const primary = numIdx.length ? numIdx[0] : (rl.length ? 0 : -1);
      const secondary = numIdx.length > 1 ? numIdx[1] : primary;
      const out = [];
      for (let k = n - 1; k >= 0; k--) {
        const cur = k === 0;
        const rules = rl.map(function (r, ri) {
          if (cur) return r;
          if (ri === primary) return V._olderRule(r, k);            // always shift the first numeric rule
          if (ri === secondary && secondary !== primary && k >= 2) return V._olderRule(r, k - 1);
          return r;
        });
        out.push({ v: 'v' + maj + '.' + Math.max(0, min - k), date: cur ? p.updated : (older[n - 1 - k] || '02 Jan 2026'), status: cur ? 'Active' : 'Superseded', rules: rules });
      }
      return out;
    },
    // inline version-trail chips (newest first, current highlighted) - clicking opens the compare modal
    chipsHtml(pid) {
      const vs = V.list(pid); if (!vs.length) return '';
      const cur = vs[vs.length - 1].v;
      return vs.slice().reverse().map(function (x) {
        return `<button class="btn btn--sm${x.v === cur ? ' btn--primary' : ''}" title="${x.date} · ${x.status}" onclick="App.versions.open('${pid}','${x.v}')"><span class="mono">${x.v}</span>${x.v === cur ? ' · current' : ''}</button>`;
      }).join(' ');
    },
    // version history + From/To rule diff (the "options of versions and changes between them")
    open(pid, focusV) {
      const p = App.policy(pid); if (!p) return;
      const vs = V.list(pid);
      if (vs.length < 2) {
        App.openModal({ title: 'Version history · ' + p.name, sub: p.version, body: `<p class="muted">This policy has a single version (${App.esc(p.version)}); there is nothing to compare yet.</p>`, footer: `<button class="btn" onclick="App.closeModal()">Close</button>` });
        return;
      }
      const toV = focusV && vs.some(function (x) { return x.v === focusV; }) ? focusV : vs[vs.length - 1].v;
      const fromIdx = Math.max(0, vs.findIndex(function (x) { return x.v === toV; }) - 1);
      const fromV = vs[fromIdx].v;
      App.state.verCmp = { pid: pid };
      const sel = function (id, val) { return `<select class="select" id="${id}" onchange="App.versions._rerender()">${vs.map(function (x) { return `<option value="${x.v}" ${x.v === val ? 'selected' : ''}>${x.v} · ${x.date} · ${x.status}</option>`; }).join('')}</select>`; };
      App.openModal({
        title: 'Version history · ' + p.name, sub: vs.length + ' versions · compare the rules between any two', lg: true,
        body: `<div class="row gap-8" style="align-items:flex-end;flex-wrap:wrap;margin-bottom:14px">
            <div class="field" style="margin:0;min-width:210px"><label>From</label>${sel('vcFrom', fromV)}</div>
            <button class="btn" title="Swap" onclick="App.versions._swap()">${App.icon('layers')}</button>
            <div class="field" style="margin:0;min-width:210px"><label>To</label>${sel('vcTo', toV)}</div>
          </div>
          <div id="vcDiff">${V._diffHtml(pid, fromV, toV)}</div>`,
        footer: `<button class="btn" onclick="App.closeModal()">Close</button>`
      });
    },
    _swap() { const f = document.getElementById('vcFrom'), t = document.getElementById('vcTo'); if (f && t) { const tmp = f.value; f.value = t.value; t.value = tmp; V._rerender(); } },
    _rerender() { const s = App.state.verCmp; if (!s) return; const f = (document.getElementById('vcFrom') || {}).value, t = (document.getElementById('vcTo') || {}).value; const d = document.getElementById('vcDiff'); if (d) d.innerHTML = V._diffHtml(s.pid, f, t); },
    _diffHtml(pid, fromV, toV) {
      const vs = V.list(pid); const A = vs.find(function (x) { return x.v === fromV; }), B = vs.find(function (x) { return x.v === toV; });
      if (!A || !B) return '<p class="muted">Select two versions to compare.</p>';
      const n = Math.max(A.rules.length, B.rules.length); let changed = 0; let rows = '';
      for (let i = 0; i < n; i++) {
        const a = A.rules[i] || '—', b = B.rules[i] || '—'; const diff = a !== b; if (diff) changed++;
        rows += `<tr><td class="mono muted" style="font-size:11.5px">${i + 1}</td>
          <td style="font-size:12.5px"><span class="${diff ? 'diff-del' : ''}">${App.esc(a)}</span></td>
          <td style="font-size:12.5px"><span class="${diff ? 'diff-add' : ''}">${App.esc(b)}</span></td></tr>`;
      }
      const banner = changed
        ? `<div class="info-banner" style="margin:0 0 12px">${App.icon('alert')} <span><strong>${changed} rule${changed === 1 ? '' : 's'} changed</strong> between ${App.esc(fromV)} and ${App.esc(toV)}.</span></div>`
        : `<div class="info-banner" style="margin:0 0 12px">${App.icon('check')} <span>No rule differences between ${App.esc(fromV)} and ${App.esc(toV)}.</span></div>`;
      return banner + `<div class="table-wrap"><table class="tbl"><thead><tr><th style="width:34px">#</th><th>${App.esc(fromV)} (rules)</th><th>${App.esc(toV)} (rules)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
  };
  App.versions = V;
})();
