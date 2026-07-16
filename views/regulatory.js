/* Regulatory - new releases from authorities → suggested policy changes, reviewed in a TWO-PDF editor.
   Left: the regulator's circular (PDF) with the driving clause highlighted.
   Right: the firm's policy as an EDITABLE PDF - the changed line is highlighted; Approve applies the suggested
   text in place, Reject keeps current; per-change comments. The output is NOT an in-app approval - the reviewer
   DOWNLOADS the revised policy PDF to sign and run through their own approval workflow.
   One release can touch many policies; one policy can collect changes from many releases. */
App.registerView('regulatory', {
  title: 'Regulatory',
  render(ctx) {
    if (!App.canAccessView('regulatory', ctx.user)) return App.lockedPage('Regulatory', 'Regulatory review is for administrators and policy managers.');
    return App.regulatoryView.editor ? App.regulatoryView._renderEditor() : App.regulatoryView._renderList(ctx);
  },
  mount(root) {
    if (App.regulatoryView.editor) { App.regulatoryView._mountEditor(); return; }
    const s = root.querySelector('#regSearch');
    if (s) s.oninput = () => { const q = (s.value || '').toLowerCase(); root.querySelectorAll('#regRelRow').forEach(r => { r.style.display = r.dataset.n.includes(q) ? '' : 'none'; }); };
  }
});

App.regulatoryView = {
  editor: null,        // { policyId, idx }
  _st: {},             // per-change state: { status:'pending'|'accepted'|'rejected'|'suggested', comment, suggestText, cmtOpen, sent }
  _audit: [],          // module audit trail (most-recent first)
  autorun: true,       // ON = every release auto-maps onto the affected policies (populates "Policies to review")
  _amd: {},            // per-release overrides: { decided:'pending'|'in'|'out', removed:{pid:1}, added:[changeObj] }
  _pickWf: null,       // workflow chosen in the send-for-approval dialog
  _relFilter: { auth: '', month: '' },  // release-feed filters (authority + month)

  _refresh() {
    const root = document.getElementById('viewRoot'); if (!root) return;
    const v = App.views['regulatory']; const ctx = { user: App.currentUser() };
    root.innerHTML = v.render(ctx); if (v.mount) v.mount(root, ctx);
  },
  _canEdit() { const r = App.currentUser().role; return r === 'admin' || r === 'policy_manager'; },
  // category scope: admin sees every affected policy; a policy manager sees only ones in their categories
  _inScope(pid) {
    const u = App.currentUser(); const p = App.policy(pid); if (!u || !p) return false;
    if (!App.catEnabled(p.category)) return false;
    if (u.role === 'admin') return true;
    return (u.categories || []).indexOf(p.category) >= 0;
  },

  /* ---------------- release feed: category label, sort key, visibility, card ---------------- */
  _relCategory(a) { return a.source === 'self' ? 'Self-uploaded' : a.regulator; },
  _dateVal(s) { const M = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 }; const m = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/.exec(s || ''); return m ? (+m[3]) * 372 + (M[m[2]] || 0) * 31 + (+m[1]) : 0; },
  _visibleRelease(a) {   // informational releases show to everyone; policy-bearing ones only if a change is in the user's scope
    const ch = this._effectiveChanges(a);
    if (!ch.length) return true;
    return ch.some(c => this._inScope(c.policyId));
  },
  _relAuthorities() { const seen = {}, out = []; (DB.amendments || []).forEach(a => { if (this._visibleRelease(a)) { const c = this._relCategory(a); if (!seen[c]) { seen[c] = 1; out.push(c); } } }); return out; },
  _relMonths() { const seen = {}, out = []; (DB.amendments || []).filter(a => this._visibleRelease(a)).slice().sort((x, y) => this._dateVal(y.date) - this._dateVal(x.date)).forEach(a => { const m = /[A-Za-z]{3}\s+\d{4}/.exec(a.date || ''); if (m && !seen[m[0]]) { seen[m[0]] = 1; out.push(m[0]); } }); return out; },
  _setRelFilter(key, val) { this._relFilter[key] = val; this._refresh(); },

  _relCardHtml(a, canEdit) {
    const st = this._amdSt(a.id);
    const pols = this._effectivePolicyIds(a).filter(pid => this._inScope(pid));
    const chCount = this._effectiveChanges(a).filter(c => this._inScope(c.policyId)).length;
    const cat = this._relCategory(a);
    const informational = chCount === 0;
    const dismissed = !this.autorun && st.decided === 'out';
    const chips = pols.map(pid => { const p = App.policy(pid);
      return `<span class="amd-pol${canEdit ? ' amd-pol--rm' : ''}"><button class="amd-pol__open" onclick="App.regulatoryView.openEditor('${pid}')">${App.icon('file')} ${p ? App.esc(p.name) : pid}</button>${canEdit ? `<button class="amd-pol__x" title="Remove this policy from the release" onclick="event.stopPropagation();App.regulatoryView._removePolicy('${a.id}','${pid}')">${App.icon('x')}</button>` : ''}</span>`;
    }).join('');
    const addBtn = canEdit ? `<button class="amd-addpol" onclick="App.regulatoryView._addPolicyModal('${a.id}')">${App.icon('plus')} Add policy</button>` : '';
    let decision = '';
    if (!this.autorun && canEdit && !informational) {
      if (st.decided === 'in') decision = `<div class="reg-rel__decide">${App.ui.pill('Moved to review', 'green', true)}<button class="btn btn--sm" onclick="App.regulatoryView._resetDecision('${a.id}')">Undo</button></div>`;
      else if (st.decided === 'out') decision = `<div class="reg-rel__decide">${App.ui.pill('Dismissed', 'gray', true)}<button class="btn btn--sm" onclick="App.regulatoryView._resetDecision('${a.id}')">Undo</button></div>`;
      else decision = `<div class="reg-rel__decide"><span class="muted" style="font-size:12px">Move this release into review?</span><button class="btn btn--sm chg-ok" onclick="App.regulatoryView._promote('${a.id}')">${App.icon('check')} Move to review</button><button class="btn btn--sm chg-no" onclick="App.regulatoryView._dismiss('${a.id}')">${App.icon('x')} Dismiss</button></div>`;
    }
    const countPill = informational ? App.ui.pill('Informational', 'gray', true) : App.ui.pill(chCount + ' change' + (chCount === 1 ? '' : 's') + ' · ' + pols.length + ' polic' + (pols.length === 1 ? 'y' : 'ies'), 'amber', true);
    return `<div class="reg-rel${dismissed ? ' is-dismissed' : ''}${!this.autorun && st.decided === 'in' ? ' is-inreview' : ''}" id="regRelRow" data-n="${App.esc((a.title + ' ' + a.ref + ' ' + cat).toLowerCase())}">
      <div class="reg-rel__h">${App.ui.pill(cat, 'blue')} <button class="reg-rel__title" title="Open circular PDF" onclick="App.pdf.openFull('amendment','${a.id}')">${App.esc(a.title)}</button><span class="muted" style="font-size:12px">· ${App.esc(a.ref)} · ${App.esc(a.date)}</span><div style="flex:1"></div>${countPill}<button class="btn btn--sm" style="margin-left:8px" onclick="App.pdf.openFull('amendment','${a.id}')">${App.icon('file')} View</button></div>
      <p class="reg-rel__sum">${App.esc(a.summary)}</p>
      ${informational ? `<div class="muted" style="font-size:12px">No policy changes mapped - open the circular to review for awareness.</div>` : `<div class="reg-rel__pols">${chips}${addBtn}</div>${decision}`}
    </div>`;
  },
  allReleasesModal() {
    const releases = (DB.amendments || []).filter(a => this._visibleRelease(a)).sort((x, y) => this._dateVal(y.date) - this._dateVal(x.date));
    const auths = this._relAuthorities();
    const rows = releases.map(a => { const cat = this._relCategory(a); const chs = this._effectiveChanges(a).filter(c => this._inScope(c.policyId)); const scope = chs.length ? (chs.length + ' change' + (chs.length === 1 ? '' : 's')) : 'Informational';
      return `<tr class="clickable" data-n="${App.esc((a.title + ' ' + a.ref + ' ' + cat).toLowerCase())}" data-auth="${App.esc(cat)}" onclick="App.pdf.openFull('amendment','${a.id}')">
        <td><div class="cell-strong" style="color:var(--brand-600)">${App.esc(a.title)}</div><div class="muted" style="font-size:12px">${App.esc(a.summary)}</div></td>
        <td>${App.ui.pill(cat, 'blue')}</td>
        <td><span class="mono" style="font-size:12px">${App.esc(a.ref)}</span></td>
        <td class="muted" style="font-size:12.5px">${App.esc(a.date)}</td>
        <td>${scope}</td>
        <td onclick="event.stopPropagation()"><button class="btn btn--sm" onclick="App.pdf.openFull('amendment','${a.id}')">${App.icon('file')} View</button></td>
      </tr>`; }).join('');
    App.openModal({
      title: 'All regulatory uploads', sub: releases.length + ' circulars from regulators and internal uploads', lg: true,
      body: `<div class="toolbar"><div class="search-input" style="flex:1">${App.icon('search')}<input id="allRelSearch" placeholder="Search circulars…" oninput="App.regulatoryView._filterAllRel()"/></div>
          <select class="select" id="allRelAuth" onchange="App.regulatoryView._filterAllRel()"><option value="">All authorities</option>${auths.map(x => `<option>${App.esc(x)}</option>`).join('')}</select></div>
        <div class="table-wrap" style="max-height:58vh;overflow:auto"><table class="tbl"><thead><tr><th>Circular</th><th>Authority</th><th>Reference</th><th>Date</th><th>Scope</th><th>Action</th></tr></thead><tbody id="allRelRows">${rows}</tbody></table></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>`
    });
  },
  _filterAllRel() {
    const q = ((document.getElementById('allRelSearch') || {}).value || '').toLowerCase();
    const au = (document.getElementById('allRelAuth') || {}).value || '';
    document.querySelectorAll('#allRelRows tr').forEach(tr => { tr.style.display = ((!q || (tr.dataset.n || '').indexOf(q) >= 0) && (!au || tr.dataset.auth === au)) ? '' : 'none'; });
  },

  /* ---------------- per-release override state ---------------- */
  _amdSt(id) { if (!this._amd[id]) this._amd[id] = { decided: 'pending', removed: {}, added: [] }; return this._amd[id]; },
  _included(a) { return this.autorun || this._amdSt(a.id).decided === 'in'; },  // is this release in the "Policies to review" queue?
  // the change set for one release after the reviewer's add/remove of affected policies
  _effectiveChanges(a) {
    const st = this._amdSt(a.id);
    const chs = (a.changes || []).filter(c => !st.removed[c.policyId]);
    return (st.added && st.added.length) ? chs.concat(st.added) : chs;
  },
  _effectivePolicyIds(a) { const seen = {}, out = []; this._effectiveChanges(a).forEach(c => { if (!seen[c.policyId]) { seen[c.policyId] = 1; out.push(c.policyId); } }); return out; },

  /* ---------------- aggregation ---------------- */
  // every suggested change across all releases (respects add/remove, ignores queue inclusion) - drives the editor + stats
  _allChanges() {
    const out = [];
    (DB.amendments || []).forEach(a => this._effectiveChanges(a).forEach(ch => { if (this._inScope(ch.policyId)) out.push(Object.assign({}, ch, { amendment: a })); }));
    return out;
  },
  _changesForPolicy(pid) { return this._allChanges().filter(c => c.policyId === pid); },
  _affectedPolicies() { const seen = {}, out = []; this._allChanges().forEach(c => { if (!seen[c.policyId]) { seen[c.policyId] = 1; out.push(c.policyId); } }); return out; },
  // policies that belong in the "Policies to review" queue (autorun ON = all; OFF = only releases moved in)
  _reviewPolicies() {
    const seen = {}, out = [];
    (DB.amendments || []).forEach(a => { if (!this._included(a)) return; this._effectivePolicyIds(a).forEach(pid => { if (!seen[pid] && this._inScope(pid)) { seen[pid] = 1; out.push(pid); } }); });
    return out;
  },
  _amendmentsForPolicy(pid) { const seen = {}, out = []; this._changesForPolicy(pid).forEach(c => { if (!seen[c.amendment.id]) { seen[c.amendment.id] = 1; out.push(c.amendment); } }); return out; },

  /* ---------------- autorun toggle + per-release decisions / policy add-remove ---------------- */
  _toggleAutorun() { this.autorun = !this.autorun; this._log('Auto-mapping ' + (this.autorun ? 'on' : 'off'), this.autorun ? 'Releases map onto policies automatically' : 'Reviewer decides which releases enter the queue'); this._refresh(); },
  _promote(id) { this._amdSt(id).decided = 'in'; const a = (DB.amendments || []).find(x => x.id === id); this._log('Moved release to review', a ? (a.ref + ' - ' + a.title) : id); this._refresh(); },
  _dismiss(id) { this._amdSt(id).decided = 'out'; const a = (DB.amendments || []).find(x => x.id === id); this._log('Dismissed release', a ? (a.ref + ' - ' + a.title) : id); this._refresh(); },
  _resetDecision(id) { this._amdSt(id).decided = 'pending'; this._refresh(); },
  _removePolicy(amdId, pid) {
    const st = this._amdSt(amdId); st.added = (st.added || []).filter(c => c.policyId !== pid); st.removed[pid] = 1;
    const a = (DB.amendments || []).find(x => x.id === amdId); const p = App.policy(pid);
    this._log('Removed affected policy', (p ? p.name : pid) + ' from ' + (a ? a.ref : amdId)); this._refresh();
  },
  _addPolicyModal(amdId) {
    const a = (DB.amendments || []).find(x => x.id === amdId); if (!a) return;
    const have = {}; this._effectivePolicyIds(a).forEach(pid => have[pid] = 1);
    const opts = DB.policies.filter(p => !have[p.id] && App.canEditPolicy(p, App.currentUser()));
    App.openModal({
      title: 'Add an affected policy', sub: a.regulator + ' · ' + a.ref + ' - pick a policy this release should also touch.',
      body: opts.length ? `<div class="reg-picklist">${opts.map(p => `<button class="reg-pick" onclick="App.regulatoryView._addPolicy('${amdId}','${p.id}')">${App.icon('file')}<div style="flex:1;text-align:left"><b>${App.esc(p.name)}</b><div class="muted" style="font-size:12px">${App.esc(p.category)} · ${App.esc(p.sub)}</div></div>${App.icon('plus')}</button>`).join('')}</div>`
        : App.ui.empty('file', 'No more policies to add', 'Every policy you can access is already mapped to this release.'),
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>`
    });
  },
  _addPolicy(amdId, pid) {
    const a = (DB.amendments || []).find(x => x.id === amdId); const p = App.policy(pid); if (!a || !p) return;
    const st = this._amdSt(amdId); delete st.removed[pid];
    const already = (a.changes || []).some(c => c.policyId === pid) || (st.added || []).some(c => c.policyId === pid);
    if (!already) {
      const fk = Object.keys(p.facts || {})[0] || 'Clause';
      st.added.push({ id: 'MAN-' + amdId + '-' + pid, policyId: pid, clauseRef: 'Manual review', section: fk,
        current: (p.facts && p.facts[fk]) || '(current)', suggested: (p.facts && p.facts[fk]) || '',
        rationale: 'Manually flagged for review against ' + a.regulator + ' ' + a.ref + '. Edit the policy directly, then send for approval.', manual: true });
    }
    this._log('Added affected policy', p.name + ' to ' + a.ref); App.closeModal(); this._refresh();
  },
  st(id) { if (!this._st[id]) this._st[id] = { status: 'pending', comment: '', suggestText: '', cmtOpen: false, sent: false }; return this._st[id]; },
  _log(action, detail) { const u = App.currentUser(); let ts = ''; try { ts = new Date().toLocaleString(); } catch (e) {} this._audit.unshift({ t: ts, user: u ? u.name : '-', role: u ? (DB.roleLabels[u.role] || u.role) : '', action: action, detail: detail || '' }); },
  _auditModal() {
    const rows = this._audit.map(e => `<tr><td class="muted" style="font-size:11.5px;white-space:nowrap">${App.esc(e.t)}</td><td><b style="font-weight:600">${App.esc(e.user)}</b> <span class="muted" style="font-size:11px">${App.esc(e.role)}</span></td><td>${App.esc(e.action)}</td><td class="muted" style="font-size:12.5px">${App.esc(e.detail)}</td></tr>`).join('');
    App.openModal({ title: 'Regulatory - audit log', sub: 'Every review action, time-stamped.', lg: true,
      body: this._audit.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table></div>` : App.ui.empty('clipboard', 'No activity yet', 'Review actions (approve, reject, suggest, download, send) will appear here.'),
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>` });
  },

  /* ---------------- list view ---------------- */
  _renderList(ctx) {
    const all = this._allChanges();
    const affected = this._affectedPolicies();
    const review = this._reviewPolicies();
    const resolved = all.filter(c => this.st(c.id).status !== 'pending').length;
    const stat = (n, label, ic) => `<div class="reg-stat"><div class="reg-stat__ic">${App.icon(ic)}</div><div><div class="reg-stat__n">${n}</div><div class="reg-stat__l">${label}</div></div></div>`;

    const canEdit = this._canEdit();
    // release feed: visible → filtered (authority + month) → sorted by date desc → first 10 shown, rest behind "see previous"
    const feed = (DB.amendments || []).filter(a => this._visibleRelease(a))
      .filter(a => !this._relFilter.auth || this._relCategory(a) === this._relFilter.auth)
      .filter(a => !this._relFilter.month || (a.date || '').indexOf(this._relFilter.month) >= 0)
      .sort((x, y) => this._dateVal(y.date) - this._dateVal(x.date));
    const PAGE = 10;
    const shownFeed = feed.slice(0, PAGE);
    const moreCount = feed.length - shownFeed.length;
    const rel = shownFeed.map(a => this._relCardHtml(a, canEdit)).join('');

    const polRows = review.map(pid => {
      const p = App.policy(pid); const chs = this._changesForPolicy(pid); const amds = this._amendmentsForPolicy(pid);
      const res = chs.filter(c => this.st(c.id).status !== 'pending').length; const done = res === chs.length;
      return `<div class="reg-polrow">
        <div style="flex:1"><div class="cell-strong">${p ? App.esc(p.name) : pid} <span class="muted" style="font-weight:450;font-size:12px">· ${p ? p.version : ''}</span></div>
          <div class="muted" style="font-size:12px;margin-top:2px">${chs.length} suggested change${chs.length === 1 ? '' : 's'} from ${amds.length} amendment${amds.length === 1 ? '' : 's'} - ${amds.map(a => a.ref).join(', ')}</div></div>
        ${done ? App.ui.pill('Reviewed', 'green', true) : App.ui.pill(res + '/' + chs.length + ' reviewed', 'gray')}
        <button class="btn btn--sm btn--primary" onclick="App.regulatoryView.openEditor('${pid}')">${App.icon('edit')} Review &amp; edit</button>
      </div>`;
    }).join('');

    return `<div class="page">
      <div class="page__head"><div><h1>Regulatory</h1><p>New releases from regulators, mapped to the exact policy changes they require. Review each change against the circular, edit the policy, then download the revised PDF to sign and route through your approval workflow.</p></div><div class="spacer"></div>
        ${this._canEdit() ? `<button class="btn" onclick="App.regulatoryView._auditModal()">${App.icon('clipboard')} Audit log</button> <button class="btn btn--primary" onclick="App.regulatoryView.uploadModal()">${App.icon('download')} Upload circular</button>` : ''}</div>
      <div class="info-banner">${App.icon('shield')} <span>One release can affect several policies, and one policy can collect changes from several releases. Approving a change edits the draft on the right - nothing is auto-filed; you download the signed PDF into your own approval workflow.</span></div>
      <div class="reg-stats">
        ${stat((DB.amendments || []).filter(a => this._visibleRelease(a)).length, 'new releases', 'alert')}
        ${stat(affected.length, 'policies affected', 'file')}
        ${stat(all.length, 'suggested changes', 'edit')}
        ${stat(resolved, 'reviewed', 'check')}
      </div>
      <h3 style="margin:18px 0 10px;font-size:15px">Policies to review</h3>
      <div class="card"><div class="card__body" style="padding:6px 16px">${polRows || App.ui.empty('check', this.autorun ? 'Nothing to review' : 'No releases in the queue', this.autorun ? 'New releases will map onto the affected policies here.' : 'Auto-mapping is off - move a release into review from the list below.')}</div></div>
      <div class="reg-relhead">
        <h3 style="font-size:15px;margin:0">New regulatory releases</h3>
        <div style="flex:1"></div>
        ${canEdit ? `<span class="reg-toggle__lbl">Auto-map to affected policies</span>
          <button class="switch${this.autorun ? ' is-on' : ''}" role="switch" aria-checked="${this.autorun}" title="${this.autorun ? 'On - releases map onto policies automatically' : 'Off - you decide which releases enter review'}" onclick="App.regulatoryView._toggleAutorun()"><span class="switch__dot"></span></button>` : ''}
      </div>
      ${canEdit && !this.autorun ? `<div class="info-banner" style="margin-top:0">${App.icon('info')} <span>Auto-mapping is <strong>off</strong>. Tick <strong>Move to review</strong> on a release to send its policies to the queue above, or <strong>Dismiss</strong> to skip it. You can also add or remove the affected policies on any release.</span></div>` : ''}
      <div class="toolbar">
        <div class="search-input" style="flex:1">${App.icon('search')}<input id="regSearch" placeholder="Search releases…"/></div>
        <select class="select" onchange="App.regulatoryView._setRelFilter('auth', this.value)">
          <option value="">All authorities</option>${this._relAuthorities().map(x => `<option${this._relFilter.auth === x ? ' selected' : ''}>${App.esc(x)}</option>`).join('')}
        </select>
        <select class="select" onchange="App.regulatoryView._setRelFilter('month', this.value)">
          <option value="">All dates</option>${this._relMonths().map(x => `<option${this._relFilter.month === x ? ' selected' : ''}>${App.esc(x)}</option>`).join('')}
        </select>
        ${(this._relFilter.auth || this._relFilter.month) ? `<button class="btn btn--sm" onclick="App.regulatoryView._relFilter={auth:'',month:''};App.regulatoryView._refresh()">Clear</button>` : ''}
      </div>
      ${rel.trim() ? rel : App.ui.empty('alert', 'No matching releases', 'Try clearing the authority or date filter.')}
      ${moreCount > 0 ? `<div style="text-align:center;margin-top:6px"><button class="btn" onclick="App.regulatoryView.allReleasesModal()">${App.icon('clock')} See previous uploads (${moreCount} more)</button></div>` : ''}
    </div>`;
  },

  /* ---------------- two-PDF editor ---------------- */
  openEditor(pid) { this.editor = { policyId: pid, idx: 0 }; const p = App.policy(pid); this._log('Opened review', p ? p.name : pid); this._refresh(); },
  _backToList() { this.editor = null; this._refresh(); },

  _renderEditor() {
    const pid = this.editor.policyId; const p = App.policy(pid);
    const chs = this._changesForPolicy(pid); const amds = this._amendmentsForPolicy(pid);
    if (this.editor.idx == null || this.editor.idx >= chs.length) this.editor.idx = 0;
    return `<div class="page">
      <div class="reg-bk" onclick="App.regulatoryView._backToList()">${App.icon('arrow')} Back to releases</div>
      <div class="page__head"><div>
        <h1>${p ? App.esc(p.name) : pid} <span class="muted" style="font-weight:450;font-size:15px">· ${p ? p.version : ''}</span></h1>
        <p>${chs.length} suggested change${chs.length === 1 ? '' : 's'} from ${amds.length} amendment${amds.length === 1 ? '' : 's'} (${amds.map(a => a.ref).join(', ')}). Approve to apply on the right, then download to sign.</p>
      </div></div>
      <div class="reg-step" id="regStep">${this._stepHtml(chs, this.editor.idx)}</div>
      <div class="reg-edit">
        <div class="reg-edit__pane"><div class="reg-edit__h">${App.icon('alert')} Regulation (source)</div><div class="reg-edit__b" id="regSrcPdf"></div></div>
        <div class="reg-edit__pane"><div class="reg-edit__h">${App.icon('file')} ${p ? App.esc(p.name) : pid} - editable draft</div><div class="reg-edit__b" id="regDocPdf">${this._policyPdfHtml(p, chs)}</div></div>
      </div>
      <div class="reg-bulkbar">
        <span class="muted" style="font-size:13px" id="regProg">${this._progText(chs)}</span>
        <div style="flex:1"></div>
        <button class="btn btn--sm" onclick="App.regulatoryView._auditModal()">${App.icon('clipboard')} Audit log</button>
        ${(App.sim && App.sim.paramsFor(pid)) ? `<button class="btn btn--sm" onclick="App.regulatoryView._simulate()">${App.icon('chart')} Simulate impact</button>` : ''}
        <button class="btn btn--sm" onclick="App.regulatoryView._downloadPdf()">${App.icon('download')} Download PDF</button>
        <button class="btn btn--sm" onclick="App.regulatoryView._downloadWord()">${App.icon('download')} Download Word</button>
        <button class="btn btn--sm btn--primary" onclick="App.regulatoryView._sendApproval()">${App.icon('send')} Send for approval</button>
      </div>
    </div>`;
  },
  _progText(chs) {
    const applied = chs.filter(c => { const st = this.st(c.id).status; return st === 'accepted' || st === 'suggested'; }).length;
    const res = chs.filter(c => this.st(c.id).status !== 'pending').length;
    return applied + ' to apply · ' + res + '/' + chs.length + ' reviewed';
  },

  _stepHtml(chs, i) {
    const ch = chs[i]; if (!ch) return '<p class="muted">No changes.</p>';
    const s = this.st(ch.id);
    const statusTxt = s.status === 'accepted' ? 'Approved - applied on the right' : s.status === 'suggested' ? 'Your wording applied on the right' : s.status === 'rejected' ? 'Rejected - kept current' : 'Pending review';
    return `<div class="reg-step__nav">
        <button class="btn btn--sm" ${i <= 0 ? 'disabled' : ''} onclick="App.regulatoryView._step(${i - 1})">‹ Prev</button>
        <span class="reg-step__pos">Change ${i + 1} of ${chs.length}</span>
        <button class="btn btn--sm" ${i >= chs.length - 1 ? 'disabled' : ''} onclick="App.regulatoryView._step(${i + 1})">Next ›</button>
      </div>
      <div class="reg-step__body">
        <div class="reg-step__sec"><b>${App.esc(ch.section)}</b>${ch.isNew ? ' <span class="tag">new clause</span>' : ''} <span class="chg__src">${App.esc(ch.amendment.regulator)} ${App.esc(ch.amendment.ref)} · ${App.esc(ch.clauseRef)}</span></div>
        <div class="redline">
          <div class="redline__row"><span class="redline__lbl">Current</span><span class="diff-del">${App.esc(ch.current)}</span></div>
          <div class="redline__row"><span class="redline__lbl">Suggested</span><span class="diff-add">${App.esc(ch.suggested)}</span></div>
        </div>
        <div class="sugg__why">${App.icon('sparkles')} <span>${App.esc(ch.rationale)}</span></div>
        <div class="reg-step__ctrl">
          <button class="btn btn--sm chg-ok${s.status === 'accepted' ? ' is-on' : ''}" onclick="App.regulatoryView._accept('${ch.id}')">${App.icon('check')} Approve change</button>
          <button class="btn btn--sm chg-no${s.status === 'rejected' ? ' is-on' : ''}" onclick="App.regulatoryView._reject('${ch.id}')">${App.icon('x')} Reject (keep current)</button>
          <button class="btn btn--sm" onclick="App.regulatoryView._toggleComment('${ch.id}')">${App.icon('chat')} Comment &amp; suggest${s.comment || s.suggestText ? ' ·' : ''}</button>
          <span class="chg__status">${statusTxt}</span>
        </div>
        ${s.cmtOpen || s.comment || s.suggestText || s.status === 'suggested' ? `<div class="reg-sug">
          <div class="login__label" style="margin-top:0">Suggest different wording <span class="muted" style="font-weight:400;text-transform:none">- applies to the policy on the right</span></div>
          <textarea class="textarea" rows="2" id="regSug-${ch.id}" oninput="App.regulatoryView._setSuggest('${ch.id}',this.value)">${App.esc(s.suggestText || ch.suggested)}</textarea>
          <div class="row gap-6" style="margin-top:6px"><button class="btn btn--sm chg-sug${s.status === 'suggested' ? ' is-on' : ''}" onclick="App.regulatoryView._applySuggestion('${ch.id}')">${App.icon('edit')} Apply my suggestion</button></div>
          <div class="login__label" style="margin-top:10px">Comment</div>
          <textarea class="textarea" rows="2" placeholder="Note for the signer / approval pack…" oninput="App.regulatoryView._setComment('${ch.id}',this.value)">${App.esc(s.comment)}</textarea>
        </div>` : ''}
      </div>`;
  },

  /* right pane: the policy as an EDITABLE pdf page; changed lines highlighted */
  _policyPdfHtml(p, chs) {
    if (!p) return '<p class="muted">Policy not available.</p>';
    const bySection = {}; chs.forEach(c => { if (!c.isNew) bySection[c.section] = c; });
    const isNew = chs.filter(c => c.isNew);
    let body = `<div class="pdfpg__rh"><span>${App.esc(p.name.replace(/[^a-z0-9]+/gi, '_'))}.pdf</span><span>Editable draft</span></div>
      <div class="pdfpg__title">${App.esc(p.name)}</div><div class="pdfpg__sec">Key parameters</div>`;
    Object.entries(p.facts || {}).forEach(([k, v]) => {
      const c = bySection[k];
      if (c) {
        const s = this.st(c.id); const val = s.status === 'accepted' ? c.suggested : s.status === 'suggested' ? (s.suggestText || c.suggested) : c.current;
        body += `<div class="pdfpg__kv chgline${s.status === 'accepted' ? ' is-accepted' : s.status === 'suggested' ? ' is-suggested' : ''}" id="line-${c.id}" data-cur="${App.esc(c.current)}" data-sug="${App.esc(c.suggested)}"><span class="pdfpg__n"></span><span class="pdfpg__k">${App.esc(k)}</span><span class="pdfpg__v val">${App.esc(val)}</span></div>`;
      } else {
        body += `<div class="pdfpg__kv"><span class="pdfpg__n"></span><span class="pdfpg__k">${App.esc(k)}</span><span class="pdfpg__v">${App.esc(v)}</span></div>`;
      }
    });
    if (isNew.length) {
      body += `<div class="pdfpg__sec">Added clauses</div>`;
      isNew.forEach(c => { const s = this.st(c.id); const val = s.status === 'accepted' ? c.suggested : s.status === 'suggested' ? (s.suggestText || c.suggested) : '(not yet added)';
        body += `<div class="pdfpg__clause chgline${s.status === 'accepted' ? ' is-accepted' : s.status === 'suggested' ? ' is-suggested' : ''}" id="line-${c.id}" data-cur="(not yet added)" data-sug="${App.esc(c.suggested)}"><span class="pdfpg__n">+</span><span class="val">${App.esc(val)}</span></div>`; });
    }
    body += `<div class="pdfpg__sec">Decision rules</div>`;
    (p.rules || []).forEach(r => { body += `<div class="pdfpg__rule"><span class="pdfpg__n"></span><code>${App.esc(r)}</code></div>`; });
    return `<div class="pdfviewer"><div class="pdfpg pdfpg--edit" contenteditable="true" spellcheck="false">${body}</div>
      <div class="pdfpg__editnote">${App.icon('edit')} This page is editable - approve changes from the left, or tweak the text directly, then download to sign.</div></div>`;
  },

  /* ---------------- interactions (targeted DOM, no full re-render → keeps edits + scroll) ---------------- */
  _mountEditor() {
    const chs = this._changesForPolicy(this.editor.policyId); const ch = chs[this.editor.idx || 0];
    if (ch && App.pdf) App.pdf.renderInto('regSrcPdf', 'amendment', ch.amendment.id, { anchor: ch.id });
    this._focusLine(ch && ch.id);
  },
  _focusLine(id) {
    const nodes = document.querySelectorAll('.chgline'); for (let i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-focus');
    if (id) { const el = document.getElementById('line-' + id); if (el) { el.classList.add('is-focus'); try { el.scrollIntoView({ block: 'center' }); } catch (e) {} } }
  },
  _step(i) {
    const chs = this._changesForPolicy(this.editor.policyId); i = Math.max(0, Math.min(chs.length - 1, i)); this.editor.idx = i;
    const step = document.getElementById('regStep'); if (step) step.innerHTML = this._stepHtml(chs, i);
    const ch = chs[i]; if (ch && App.pdf) App.pdf.renderInto('regSrcPdf', 'amendment', ch.amendment.id, { anchor: ch.id });
    this._focusLine(ch && ch.id);
  },
  _syncStep() {
    const chs = this._changesForPolicy(this.editor.policyId);
    const step = document.getElementById('regStep'); if (step) step.innerHTML = this._stepHtml(chs, this.editor.idx);
    const prog = document.getElementById('regProg'); if (prog) prog.textContent = this._progText(chs);
  },
  _chOf(id) { return this._allChanges().find(function (c) { return c.id === id; }); },
  _applyLine(id) {
    const s = this.st(id); const el = document.getElementById('line-' + id); if (!el) return;
    const v = el.querySelector('.val');
    if (v) v.textContent = (s.status === 'accepted' ? el.getAttribute('data-sug') : s.status === 'suggested' ? (s.suggestText || el.getAttribute('data-sug')) : el.getAttribute('data-cur')) || v.textContent;
    el.classList.toggle('is-accepted', s.status === 'accepted');
    el.classList.toggle('is-suggested', s.status === 'suggested');
  },
  _accept(id) { this.st(id).status = 'accepted'; this._applyLine(id); this._syncStep(); const c = this._chOf(id); if (c) this._log('Approved change', App.policy(c.policyId).name + ' · ' + c.section + ': ' + c.current + ' → ' + c.suggested + ' (' + c.amendment.ref + ')'); },
  _reject(id) { this.st(id).status = 'rejected'; this._applyLine(id); this._syncStep(); const c = this._chOf(id); if (c) this._log('Rejected change', App.policy(c.policyId).name + ' · ' + c.section + ' (' + c.amendment.ref + ')'); },
  _toggleComment(id) { this.st(id).cmtOpen = !this.st(id).cmtOpen; this._syncStep(); },
  _setComment(id, val) { this.st(id).comment = val; },
  _setSuggest(id, val) { this.st(id).suggestText = val; },
  _applySuggestion(id) { const s = this.st(id); if (!s.suggestText) { const c0 = this._chOf(id); s.suggestText = c0 ? c0.suggested : ''; } s.status = 'suggested'; this._applyLine(id); this._syncStep(); const c = this._chOf(id); if (c) this._log('Suggested wording', App.policy(c.policyId).name + ' · ' + c.section + ' → ' + s.suggestText); },

  /* ---------------- download the revised policy (to sign - NOT routed to Approvals) ---------------- */
  _revisedDocHtml(p) {
    let rows = ''; const host = document.getElementById('regDocPdf');
    const domLines = host ? host.querySelectorAll('.pdfpg__kv, .pdfpg__clause, .pdfpg__rule') : [];
    if (domLines && domLines.length) {
      for (let i = 0; i < domLines.length; i++) {
        const el = domLines[i];
        const k = el.querySelector ? el.querySelector('.pdfpg__k') : null;
        const v = el.querySelector ? (el.querySelector('.pdfpg__v') || el.querySelector('.val')) : null;
        const txt = (k && v) ? (k.textContent.trim() + ': ' + v.textContent.trim()) : el.textContent.trim();
        rows += '<div class="r">' + App.esc(txt) + '</div>';
      }
    } else { // fallback (e.g. headless): build from data with approved / suggested changes applied
      const self = this; const bySection = {}; this._changesForPolicy(p.id).forEach(c => { if (!c.isNew) bySection[c.section] = c; });
      const applied = function (c, fb) { const s = self.st(c.id); return s.status === 'accepted' ? c.suggested : s.status === 'suggested' ? (s.suggestText || c.suggested) : fb; };
      Object.entries(p.facts || {}).forEach(([k, v]) => { const c = bySection[k]; rows += '<div class="r">' + App.esc(k + ': ' + (c ? applied(c, v) : v)) + '</div>'; });
      this._changesForPolicy(p.id).filter(c => c.isNew).forEach(c => { const s = self.st(c.id); if (s.status === 'accepted' || s.status === 'suggested') rows += '<div class="r">+ ' + App.esc(s.status === 'suggested' ? (s.suggestText || c.suggested) : c.suggested) + '</div>'; });
    }
    const notes = this._changesForPolicy(p.id).filter(c => this.st(c.id).comment).map(c => '<li><b>' + App.esc(c.section) + ':</b> ' + App.esc(this.st(c.id).comment) + '</li>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + App.esc(p.name) + ' (revised draft)</title>'
      + '<style>body{font-family:Calibri,Arial,sans-serif;max-width:720px;margin:48px auto;color:#1c1a16;line-height:1.5}h1{font-size:22px}.r{padding:5px 0;border-bottom:1px solid #eee}.m{color:#6b665c}</style></head><body>'
      + '<h1>' + App.esc(p.name) + ' - revised draft (' + App.esc(p.version) + ')</h1>'
      + '<p class="m">Prepared in PolicyOS · Tara from regulatory amendments. Print to PDF, sign, and submit to the approval workflow.</p>'
      + rows + (notes ? '<h3>Reviewer comments</h3><ul>' + notes + '</ul>' : '')
      + '<hr><p class="m" style="font-size:12px">Signature: ____________________   Date: __________</p></body></html>';
  },
  _downloadWord() {
    const p = App.policy(this.editor.policyId); if (!p) return;
    const html = this._revisedDocHtml(p); this._log('Downloaded Word', p.name);
    try {
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const blob = new Blob([html], { type: 'application/msword' }); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = p.name.replace(/[^a-z0-9]+/gi, '_') + '_revised.doc';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      }
    } catch (e) {}
    App.toast('Revised policy downloaded (Word) - review, sign, then submit to your approval workflow', 'ok');
  },
  _downloadPdf() {
    const p = App.policy(this.editor.policyId); if (!p) return;
    const html = this._revisedDocHtml(p); this._log('Downloaded PDF', p.name);
    try {
      if (typeof window !== 'undefined' && window.open) {
        const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 350); }
      }
    } catch (e) {}
    App.toast('Opening print view - Save as PDF, sign, then submit to your approval workflow', 'ok');
  },
  /* impact of the regulatory changes on the test cohort: merge sim overrides from every change that is NOT rejected */
  _simOverride(pid) {
    const ov = {};
    this._changesForPolicy(pid).forEach(c => { if (c.sim && this.st(c.id).status !== 'rejected') Object.assign(ov, c.sim); });
    return ov;
  },
  _simulate() {
    const pid = this.editor.policyId; const p = App.policy(pid);
    if (!App.simView || !App.sim || !App.sim.paramsFor(pid)) { App.toast('This policy is not simulable', 'warn'); return; }
    const ov = this._simOverride(pid);
    this._log('Simulated impact', (p ? p.name : pid) + ' · regulatory change applied');
    App.simView.open(pid, ov, 'Regulatory impact');
  },
  /* Send for approval → first pick the approval workflow (from Approvals › Manage Workflows),
     so the change follows a defined level-by-level maker-checker chain. */
  _preferredWorkflow(p) {
    const wfs = DB.workflows || [];
    return (p && wfs.find(w => w.category === p.category)) || wfs[0] || null;
  },
  _wfChainHtml(w) {
    if (!w) return '<p class="muted">No workflow defined.</p>';
    return w.levels.map(l => {
      const who = l.users.map(uid => { const e = App.emp(uid); return e ? App.esc(e.name) : uid; }).join(', ');
      const crit = l.criteria === 'All' ? 'All must approve' : l.criteria === 'Anyone' ? 'Anyone can approve' : 'Custom rule';
      return `<div class="wf-lvl"><span class="step"><span class="step__num">${l.n}</span></span><div style="flex:1"><b style="font-weight:600;font-size:12.5px">Level ${l.n}</b> <span class="tag">${crit}</span><div class="muted" style="font-size:12px;margin-top:2px">${who}</div></div></div>`;
    }).join('');
  },
  _wfOptionHtml(w, sel) {
    const users = new Set(); w.levels.forEach(l => l.users.forEach(u => users.add(u)));
    return `<label class="wf-opt${sel ? ' is-sel' : ''}" onclick="App.regulatoryView._pickWorkflow('${w.id}')"><span class="wf-opt__radio"></span>
      <div style="flex:1"><b style="font-weight:600">${App.esc(w.name)}</b><div class="muted" style="font-size:12px">${App.esc(w.category)} · ${w.levels.length} level${w.levels.length === 1 ? '' : 's'} · ${users.size} approver${users.size === 1 ? '' : 's'}</div></div>
      ${App.ui.pill(w.status, 'green')}</label>`;
  },
  _pickWorkflow(id) {
    this._pickWf = id;
    document.querySelectorAll('#wfPick .wf-opt').forEach(el => el.classList.remove('is-sel'));
    const idx = (DB.workflows || []).findIndex(w => w.id === id);
    const opts = document.querySelectorAll('#wfPick .wf-opt'); if (opts[idx]) opts[idx].classList.add('is-sel');
    const chain = document.getElementById('wfChain'); const w = (DB.workflows || []).find(x => x.id === id);
    if (chain) chain.innerHTML = `<div class="login__label" style="margin-top:14px">Approval chain</div>${this._wfChainHtml(w)}`;
  },
  _sendApproval() {
    const pid = this.editor.policyId; const p = App.policy(pid);
    const chs = this._changesForPolicy(pid).filter(c => { const s = this.st(c.id); return (s.status === 'accepted' || s.status === 'suggested') && !s.sent; });
    if (!chs.length) { App.toast('Approve or suggest at least one change first', 'warn'); return; }
    const pref = this._preferredWorkflow(p); this._pickWf = pref ? pref.id : null;
    App.openModal({
      title: 'Send for approval', sub: chs.length + ' change' + (chs.length === 1 ? '' : 's') + ' on ' + (p ? p.name : pid) + ' - choose the workflow it should follow.', lg: true,
      body: `<div class="info-banner" style="margin-top:0">${App.icon('shield')} <span>The change routes through this maker-checker chain, level by level. The requester can never self-approve.</span></div>
        <div class="login__label">Approval workflow</div>
        <div id="wfPick">${(DB.workflows || []).map(w => this._wfOptionHtml(w, pref && w.id === pref.id)).join('')}</div>
        <div id="wfChain"><div class="login__label" style="margin-top:14px">Approval chain</div>${this._wfChainHtml(pref)}</div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.regulatoryView._confirmSend()">${App.icon('send')} Send ${chs.length} change${chs.length === 1 ? '' : 's'}</button>`
    });
  },
  _confirmSend(wfId) {
    wfId = wfId || this._pickWf;
    const wf = (DB.workflows || []).find(w => w.id === wfId) || null;
    const pid = this.editor.policyId; const p = App.policy(pid);
    const chs = this._changesForPolicy(pid).filter(c => { const s = this.st(c.id); return (s.status === 'accepted' || s.status === 'suggested') && !s.sent; });
    if (!chs.length) { App.toast('Approve or suggest at least one change first', 'warn'); return; }
    const me = (App.state.user && App.state.user.id) || 'THQ0144'; let n = 0;
    const firstLevel = wf && wf.levels && wf.levels.length ? wf.levels[0].n : 1;
    chs.forEach(ch => {
      const s = this.st(ch.id); const a = ch.amendment; const to = s.status === 'suggested' ? (s.suggestText || ch.suggested) : ch.suggested;
      const dup = DB.approvals.some(x => x.policy === pid && x.change && x.change.field === ch.section && x.change.to === to && x.sourceRef === a.ref);
      if (!dup) {
        DB.approvals.unshift({ id: 'REQ-' + (2000 + DB.approvals.length), name: (p ? p.name : pid) + ' - ' + ch.section + ' → ' + to,
          type: 'Regulatory Change', policy: pid, requestedBy: me, on: '23 Jun 2026', priority: 'High', status: 'Pending L' + firstLevel,
          change: { field: ch.section, from: ch.current, to: to },
          rationale: ch.rationale + (s.status === 'suggested' ? '  Reviewer wording: ' + to : '') + (s.comment ? '  Note: ' + s.comment : ''),
          complianceFlag: 'Matches ' + a.regulator + ' ' + a.ref + ' (' + a.date + '), clause ' + ch.clauseRef + '.',
          citations: [{ kind: 'policy', id: pid, anchor: ch.section }], sourceRef: a.ref,
          workflowId: wf ? wf.id : null, workflow: wf ? wf.name : null });
        n++;
      }
      s.sent = true;
    });
    this._log('Sent for approval', (p ? p.name : pid) + ' · ' + n + ' change' + (n === 1 ? '' : 's') + (wf ? ' · ' + wf.name : ''));
    if (App.state.route === 'regulatory') App.closeModal();
    App.toast(n ? (n + ' change' + (n === 1 ? '' : 's') + ' sent' + (wf ? ' via ' + wf.name : ' to Approvals')) : 'Already sent for approval', n ? 'ok' : 'warn');
    this._syncStep();
  },

  /* ---------------- upload (dummy) - opens the editor for the release's first policy ---------------- */
  uploadModal() {
    App.openModal({
      title: 'Upload a regulator circular', sub: 'Tara reads it and maps the required changes onto your policies.', lg: true,
      body: `<div class="dropzone" onclick="document.getElementById('upPick').scrollIntoView({block:'nearest'})">${App.icon('download')}
          <div style="font-weight:600;margin-top:8px">Drop a circular PDF here, or pick a recent release</div>
          <div class="muted" style="font-size:12.5px;margin-top:3px">PDF · parsed and matched to your policy library</div></div>
        <div class="setup-label" style="margin-top:16px">Recent releases</div>
        <div id="upPick" class="reg-picklist">${(DB.amendments || []).slice().sort((x, y) => this._dateVal(y.date) - this._dateVal(x.date)).slice(0, 8).map(a => { const first = (a.changes && a.changes[0]) ? a.changes[0].policyId : null; const act = first ? `App.closeModal();App.regulatoryView.openEditor('${first}')` : `App.pdf.openFull('amendment','${a.id}')`; const n = (a.changes || []).length;
          return `<button class="reg-pick" onclick="${act}">${App.icon('alert')}<div style="flex:1;text-align:left"><b>${App.esc(a.title)}</b><div class="muted" style="font-size:12px">${App.esc(this._relCategory(a))} · ${App.esc(a.ref)} · ${n ? n + ' change' + (n === 1 ? '' : 's') : 'informational'}</div></div>${App.icon('arrow')}</button>`; }).join('')}</div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>`
    });
  }
};
