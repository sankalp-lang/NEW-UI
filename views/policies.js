/* Policies - repository with permission-faithful (RBAC) filtering */
App.registerView('policies', {
  title: 'Policies',
  render(ctx) {
    const u = ctx.user;
    const vis = App.visiblePolicies(u);
    const hidden = DB.policies.length - vis.length;
    const canAdd = u.role==='policy_manager' || u.role==='admin';

    // columns mirror the production Policy Management table (PolicyTable.tsx):
    // select · Policy Name · Policy Owner · Category · Sub Category · Status · Created On · Last Modified On · Version · Action
    const rows = vis.map(p => {
      const owner = App.emp(p.owner);
      const created = p.created || p.updated;
      return `<tr class="clickable" data-name="${(p.name + ' ' + (owner ? owner.name : '') + ' ' + p.category + ' ' + (p.sub || '')).toLowerCase()}" data-cat="${p.category}" data-status="${p.status}" onclick="App.policiesView.open('${p.id}')">
        <td onclick="event.stopPropagation()" style="width:34px"><input type="checkbox" class="pol-check"/></td>
        <td><div class="cell-strong" style="color:var(--brand-600)">${App.esc(p.name)}${p.sensitive?' '+App.ui.pill('Confidential','red'):''}</div></td>
        <td><div class="cell-person">${App.ui.avatar(owner,'sm')}<span>${App.esc(owner.name)}</span></div></td>
        <td>${App.ui.pill(p.category,'violet')}</td>
        <td class="muted">${p.sub ? App.esc(p.sub) : 'N/A'}</td>
        <td>${App.ui.statusPill(p.status)}</td>
        <td class="muted" style="font-size:12.5px">${created}</td>
        <td class="muted" style="font-size:12.5px">${p.updated}</td>
        <td onclick="event.stopPropagation()"><button class="btn btn--sm" title="Version history & compare" onclick="App.versions.open('${p.id}')"><span class="mono">${App.esc(p.version)}</span> ${App.icon('chevron')}</button></td>
        <td onclick="event.stopPropagation()"><button class="btn btn--sm btn--icon-ok" title="View policy" onclick="App.policiesView.open('${p.id}')">${App.icon('eye')}</button></td>
      </tr>`;
    }).join('');

    return `<div class="page">
      <div class="page__head"><div><h1>Policy Management</h1><p>Manage, view, and edit all your active and inactive policies in one place.</p></div><div class="spacer"></div>
        ${canAdd?`<button class="btn btn--primary" onclick="App.policiesView.add()">${App.icon('plus')} Add Policy</button>`:''}</div>
      ${hidden?`<div class="lock-banner">${App.icon('lock')} <span><strong>${hidden} polic${hidden>1?'ies are':'y is'} hidden</strong> - outside your role's access scope. Permission is enforced at retrieval, not hidden in the UI alone.</span></div>`:''}
      <div class="toolbar">
        <div class="search-input" style="flex:1">${App.icon('search')}<input id="polSearch" placeholder="Search Policy, SPOC, Product and Categories"/></div>
        <button class="btn" onclick="App.policiesView.toggleFilter()">${App.icon('filter')} Filter</button>
        <div id="polFilters" class="row gap-8" style="display:none">
          <select class="select" id="polCat"><option value="">All categories</option>${App.enabledCats().map(c=>`<option>${c.name}</option>`).join('')}</select>
          <select class="select" id="polStatus"><option value="">All status</option><option>Active</option><option>Draft</option></select>
        </div>
      </div>
      <div class="table-wrap"><table class="tbl"><thead><tr>
        <th style="width:34px"><input type="checkbox" class="pol-check" onclick="App.policiesView.toggleAll(this)"/></th>
        <th>Policy Name</th><th>Policy Owner</th><th>Category</th><th>Sub Category</th><th>Status</th><th>Created On</th><th>Last Modified On</th><th>Version</th><th>Action</th>
      </tr></thead><tbody id="polBody">${rows}</tbody></table></div>
    </div>`;
  },
  mount(root) {
    const filter = () => {
      const q=(root.querySelector('#polSearch').value||'').toLowerCase();
      const catEl=root.querySelector('#polCat'), stEl=root.querySelector('#polStatus');
      const cat=catEl?catEl.value:'', st=stEl?stEl.value:'';
      root.querySelectorAll('#polBody tr').forEach(tr=>{
        const ok = tr.dataset.name.includes(q) && (!cat||tr.dataset.cat===cat) && (!st||tr.dataset.status===st);
        tr.style.display = ok?'':'none';
      });
    };
    root.querySelector('#polSearch').oninput = filter;
    const catEl=root.querySelector('#polCat'); if(catEl) catEl.onchange = filter;
    const stEl=root.querySelector('#polStatus'); if(stEl) stEl.onchange = filter;
  }
});

App.policiesView = {
  toggleFilter() { const f = document.getElementById('polFilters'); if (f) f.style.display = f.style.display === 'none' ? 'flex' : 'none'; },
  toggleAll(cb) { document.querySelectorAll('#polBody .pol-check').forEach(x => { x.checked = cb.checked; }); },
  open(id) {
    const p = App.policy(id); const u = App.currentUser(); const owner = App.emp(p.owner);
    const facts = Object.entries(p.facts).map(([k,v])=>`<div class="minirow"><span class="muted">${App.esc(k)}</span><span class="spacer" style="flex:1"></span><b>${App.esc(v)}</b></div>`).join('');
    // access is category-scoped, plus optional company-wide / per-person document grants
    const grants = ['Category: '+p.category+(App.catEnabled(p.category)?'':' (disabled)')];
    if (p.access && p.access.everyone) grants.push('All staff (company-wide)');
    ((p.access && p.access.users) || []).forEach(uid => { const e = App.emp(uid); grants.push((e?e.name:uid)+' (direct)'); });
    const access = grants.map(a=>`<span class="tag">${App.esc(a)}</span>`).join(' ');
    const canRules = App.canEditPolicy(p, u);
    App.openModal({
      title: p.name, sub: p.category+' · '+p.sub+' · '+p.version, lg:true,
      body: `<div class="row gap-8" style="margin-bottom:14px;flex-wrap:wrap">${App.ui.statusPill(p.status)} ${App.ui.pill('Owner: '+owner.name,'gray')} <span class="muted" style="font-size:12px;align-self:center">Updated ${p.updated}</span></div>
        <div class="grid" style="grid-template-columns:1.3fr 1fr;gap:16px">
          <div id="polPdfPane" class="reg-review__pdf" style="max-height:440px"></div>
          <div>
            <div class="card__body" style="padding:0 0 10px"><b style="font-size:12.5px">Key parameters</b></div>${facts}
            <div class="divider"></div>
            <b style="font-size:12.5px">Who can access this</b><div class="row wrap gap-6 mt-8">${access}</div>
          </div>
        </div>`,
      footer: `<button class="btn" onclick="App.closeModal();App.versions.open('${p.id}')">${App.icon('layers')} Compare Versions</button>
        ${App.sim && App.sim.paramsFor(p.id) ? `<button class="btn" onclick="App.closeModal();App.simView.open('${p.id}')">${App.icon('chart')} Simulate impact</button>` : ''}
        ${canRules?`<button class="btn btn--primary" onclick="App.closeModal();App.navigate('rulesense',{policy:'${p.id}'})">${App.icon('code')} View Rules</button>`:''}`
    });
    if (App.pdf) App.pdf.renderInto('polPdfPane', 'policy', p.id, { fullBtn: true });
  },
  /* ---------- Add policy → 2-step: details, then choose an approval workflow + confirm its stages ---------- */
  _APPROVERS: ['THQ0144','THQ0101','THQ0165','THQ0002','THQ0001','THQ0145','THQ0128','THQ0157'],
  add() {
    const cat = (App.enabledCats()[0] || {}).name || 'Lending';
    App.state.addPolicy = { step: 1, details: { name: '', category: cat, sub: '', desc: '' }, wfId: null, stages: [] };
    App.policiesView._addRender();
  },
  _addRender() {
    const s = App.state.addPolicy; if (!s) return;
    const steps = ['Policy details', 'Approval workflow'];
    const stepper = `<div class="stepper" style="margin-bottom:16px">${steps.map((n, i) => { const num = i + 1; const cls = num < s.step ? 'is-done' : num === s.step ? 'is-active' : ''; return `${i ? '<div class="step__line"></div>' : ''}<div class="step ${cls}"><span class="step__num">${num < s.step ? App.icon('check') : num}</span>${n}</div>`; }).join('')}</div>`;
    let body, footer;
    if (s.step === 1) {
      body = stepper + `<div class="field"><label>Policy document <span class="req">*</span></label><div class="pdf-ph" style="min-height:auto;padding:22px;text-align:center;cursor:pointer">${App.icon('download')}<div class="muted" style="margin-top:8px;font-size:12.5px">Click to upload PDF (≤ 25 MB)</div></div></div>
        <div class="grid grid-2"><div class="field"><label>Product Category <span class="req">*</span></label><select class="select" id="apCat" style="width:100%">${App.enabledCats().map(c => `<option ${c.name === s.details.category ? 'selected' : ''}>${App.esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Sub-category</label><input class="input" id="apSub" value="${App.esc(s.details.sub)}" placeholder="e.g. Gold Loan"/></div></div>
        <div class="field"><label>Policy Name <span class="req">*</span></label><input class="input" id="apName" value="${App.esc(s.details.name)}" placeholder="e.g. Gold Loan Policy"/></div>
        <div class="field" style="margin-bottom:0"><label>Description <span class="req">*</span></label><textarea class="textarea" id="apDesc" placeholder="Short description…">${App.esc(s.details.desc)}</textarea></div>`;
      footer = `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.policiesView._addNext1()">Next: approval workflow ${App.icon('arrow')}</button>`;
    } else {
      const wfs = DB.workflows || [];
      const wfOpts = wfs.map(w => `<option value="${w.id}" ${w.id === s.wfId ? 'selected' : ''}>${App.esc(w.name)} (${App.esc(w.category)})</option>`).join('');
      body = stepper + `<div class="info-banner" style="margin-top:0">${App.icon('shield')} <span>This policy goes live only after every stage below approves it, in order. Maker-checker is enforced - you can't approve your own upload.</span></div>
        <div class="field"><label>Approval workflow</label><select class="select" id="apWf" style="width:100%" onchange="App.policiesView._addPickWf(this.value)">${wfOpts}</select><div class="hint">Pick a workflow to preload its stages, then adjust for this policy.</div></div>
        <div class="login__label">Approval stages</div>
        ${App.policiesView._addStagesHtml()}
        <button class="btn btn--sm mt-8" onclick="App.policiesView._addAddStage()">${App.icon('plus')} Add stage</button>`;
      footer = `<button class="btn" onclick="App.policiesView._addBack()">${App.icon('arrow')} Back</button><button class="btn btn--primary" onclick="App.policiesView._addSubmit()">${App.icon('send')} Submit for approval</button>`;
    }
    App.openModal({ title: 'Add new policy', sub: 'Step ' + s.step + ' of 2', body: body, footer: footer, lg: true });
  },
  _addStagesHtml() {
    const s = App.state.addPolicy;
    if (!s.stages.length) return `<div class="muted" style="font-size:12.5px;padding:6px 0">No stages yet - add one, or pick a workflow above.</div>`;
    return s.stages.map((st, i) => {
      const inStage = {}; (st.approvers || []).forEach(u => inStage[u] = 1);
      const pool = App.policiesView._APPROVERS.filter(u => !inStage[u] && App.emp(u));
      const chips = (st.approvers || []).map(u => { const e = App.emp(u); return `<span class="amd-pol amd-pol--rm"><span class="amd-pol__open">${App.ui.avatar(e, 'sm')} ${App.esc(e ? e.name : u)}</span><button class="amd-pol__x" title="Remove approver" onclick="App.policiesView._addRemoveApprover(${i},'${u}')">${App.icon('x')}</button></span>`; }).join('');
      return `<div class="card card--pad" style="margin-bottom:10px">
        <div class="row gap-8" style="margin-bottom:9px"><span class="step is-active"><span class="step__num">${i + 1}</span> Stage ${i + 1}</span><div class="spacer" style="flex:1"></div>${s.stages.length > 1 ? `<button class="btn btn--sm btn--danger" title="Remove stage" onclick="App.policiesView._addRemoveStage(${i})">${App.icon('trash')}</button>` : ''}</div>
        <div class="row gap-6" style="margin-bottom:10px">
          <button class="btn btn--sm${st.criteria === 'All' ? ' btn--primary' : ''}" onclick="App.policiesView._addSetCrit(${i},'All')">All must approve</button>
          <button class="btn btn--sm${st.criteria === 'Anyone' ? ' btn--primary' : ''}" onclick="App.policiesView._addSetCrit(${i},'Anyone')">Anyone can approve</button>
        </div>
        <div class="row wrap gap-6" style="align-items:center">${chips || '<span class="muted" style="font-size:12px">No approvers yet</span>'}
          ${pool.length ? `<select class="select select--sm" onchange="App.policiesView._addAddApprover(${i}, this.value)"><option value="">+ Add approver</option>${pool.map(u => { const e = App.emp(u); return `<option value="${u}">${App.esc(e.name)}</option>`; }).join('')}</select>` : ''}
        </div>
      </div>`;
    }).join('');
  },
  _addNext1() {
    const s = App.state.addPolicy;
    const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const name = g('apName').trim();
    if (!name) { App.toast('Enter a policy name', 'warn'); return; }
    s.details = { name: name, category: g('apCat'), sub: g('apSub').trim(), desc: g('apDesc').trim() };
    if (!s.wfId) {   // default to the workflow that governs this category
      const wf = (App.approvalsView && App.approvalsView.workflowFor) ? App.approvalsView.workflowFor(s.details.category) : null;
      App.policiesView._loadWf((wf || (DB.workflows || [])[0] || {}).id);
    }
    s.step = 2;
    App.policiesView._addRender();
  },
  _addBack() { App.state.addPolicy.step = 1; App.policiesView._addRender(); },
  _loadWf(wfId) {
    const s = App.state.addPolicy; const wf = (DB.workflows || []).find(w => w.id === wfId);
    s.wfId = wfId;
    s.stages = wf ? wf.levels.map(l => ({ approvers: (l.users || []).slice(), criteria: l.criteria === 'All' ? 'All' : 'Anyone' })) : [{ approvers: [], criteria: 'Anyone' }];
  },
  _addPickWf(wfId) { App.policiesView._loadWf(wfId); App.policiesView._addRender(); },
  _addSetCrit(i, c) { App.state.addPolicy.stages[i].criteria = c; App.policiesView._addRender(); },
  _addAddApprover(i, u) { if (!u) return; const st = App.state.addPolicy.stages[i]; if (st.approvers.indexOf(u) < 0) st.approvers.push(u); App.policiesView._addRender(); },
  _addRemoveApprover(i, u) { const st = App.state.addPolicy.stages[i]; st.approvers = st.approvers.filter(x => x !== u); App.policiesView._addRender(); },
  _addAddStage() { App.state.addPolicy.stages.push({ approvers: [], criteria: 'Anyone' }); App.policiesView._addRender(); },
  _addRemoveStage(i) { App.state.addPolicy.stages.splice(i, 1); App.policiesView._addRender(); },
  _addSubmit() {
    const s = App.state.addPolicy;
    if (!s.stages.length) { App.toast('Add at least one approval stage', 'warn'); return; }
    if (s.stages.some(st => !st.approvers.length)) { App.toast('Every stage needs at least one approver', 'warn'); return; }
    const wf = (DB.workflows || []).find(w => w.id === s.wfId);
    const me = (App.state.user && App.state.user.id) || 'THQ0144';
    DB.approvals.unshift({
      id: 'REQ-' + (3000 + DB.approvals.length), name: s.details.name + ' - new policy', type: 'New Policy',
      policy: null, requestedBy: me, on: '13 Jul 2026', priority: 'Medium', status: 'Pending L1',
      change: { field: 'Policy document', from: '-', to: s.details.name + ' (' + s.details.category + ')' },
      rationale: s.details.desc || 'New policy uploaded for approval.',
      complianceFlag: null,
      workflow: wf ? wf.name : 'Custom workflow', workflowId: s.wfId,
      stages: s.stages.map((st, i) => ({ n: i + 1, users: st.approvers.slice(), criteria: st.criteria }))
    });
    const n = s.stages.length;
    App.closeModal();
    App.toast('“' + s.details.name + '” submitted for approval · ' + n + ' stage' + (n === 1 ? '' : 's') + (wf ? ' · ' + wf.name : ''), 'ok');
    App.state.addPolicy = null;
  }
};
