/* Approvals - maker-checker workflows (permission-faithful, RBAC-aware) */
App.registerView('approvals', {
  title: 'Approvals',
  render(ctx) {
    const u = ctx.user;
    if (!App.canAccessView('approvals', u)) return App.lockedPage('Approvals', 'Approvals are for administrators and policy managers.');
    if (!App.state.approvals) App.state.approvals = { mode: 'requests' };
    const mode = App.state.approvals.mode;

    if (mode === 'workflows') return App.approvalsView.renderWorkflows(u);
    if (mode === 'audit')     return App.approvalsView.renderAudit(u);
    return App.approvalsView.renderRequests(u);
  },
  mount(root, ctx) {
    const mode = (App.state.approvals && App.state.approvals.mode) || 'requests';
    if (mode !== 'requests') return;
    const filter = () => {
      const q  = (root.querySelector('#apSearch').value || '').toLowerCase();
      const pr = root.querySelector('#apPrio').value;
      const by = root.querySelector('#apBy').value;
      let shown = 0;
      root.querySelectorAll('#apBody tr').forEach(tr => {
        const ok = tr.dataset.name.includes(q) && (!pr || tr.dataset.prio === pr) && (!by || tr.dataset.by === by);
        tr.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      const e = root.querySelector('#apEmpty');
      if (e) e.style.display = shown ? 'none' : '';
    };
    root.querySelector('#apSearch').oninput = filter;
    root.querySelector('#apPrio').onchange = filter;
    root.querySelector('#apBy').onchange = filter;
  }
});

App.approvalsView = {

  /* ---------- helpers ---------- */
  prioPill(p) { return App.ui.pill(p, p === 'High' ? 'red' : p === 'Medium' ? 'amber' : 'gray', true); },

  // can this user act on (approve/reject) requests? makers + admins; staff users only view
  canAct(u) { return u.role === 'admin' || u.role === 'policy_manager'; },

  // workflow that governs a given policy category
  workflowFor(cat) { return DB.workflows.find(w => w.category === cat); },

  // only show requests whose underlying policy this user can actually see
  visibleRequests(u) {
    return DB.approvals.filter(a => {
      const p = App.policy(a.policy);
      return p ? App.canViewPolicy(p, u) : true;
    });
  },

  setMode(m) { App.state.approvals = { mode: m }; App.reload(); },

  /* projected impact of a change on the test cohort (reuses the simulator engine) */
  impactBlock(a) {
    const base = (a.policy && App.sim) ? App.sim.paramsFor(a.policy) : null;
    const f = (a.change && a.change.field) || '', to = (a.change && a.change.to) || '';
    let ov = null;
    if (base) {
      if (/cibil/i.test(f)) { const n = parseInt(to, 10); if (!isNaN(n)) ov = { minCibil: n }; }
      else if (/ltv/i.test(f)) { const n = parseFloat(to); if (!isNaN(n)) ov = { maxLtv: n > 1 ? n / 100 : n }; }
      else if (/foir/i.test(f)) { const n = parseFloat(to); if (!isNaN(n)) ov = { maxFoir: n > 1 ? n / 100 : n }; }
    }
    if (!ov) return a.impact ? this._impactStored(a.impact) : '';
    const r = App.sim.run(a.policy, ov);
    if (!r.applicable) return a.impact ? this._impactStored(a.impact) : '';
    const pc = x => (x * 100).toFixed(1) + '%';
    const dA = (r.proposed.rate - r.base.rate) * 100, dN = (r.proposed.npa - r.base.npa) * 100;
    const pill = (d, goodDown) => { const flat = Math.abs(d) < 0.05; const good = goodDown ? d < 0 : d > 0; return App.ui.pill((d >= 0 ? '+' : '') + d.toFixed(1) + ' pts', flat ? 'gray' : (good ? 'green' : 'red')); };
    const ovLit = '{' + Object.keys(ov).map(k => k + ':' + ov[k]).join(',') + '}';
    return `<div class="divider"></div><b style="font-size:12.5px">Projected impact on the test cohort</b>
      <div class="grid grid-3 mt-8">
        <div class="kpi"><div class="kpi__label">Approval rate</div><div class="kpi__val" style="font-size:20px">${pc(r.base.rate)} → ${pc(r.proposed.rate)}</div><div class="kpi__sub">${pill(dA, false)}</div></div>
        <div class="kpi"><div class="kpi__label">Projected NPA</div><div class="kpi__val" style="font-size:20px">${pc(r.base.npa)} → ${pc(r.proposed.npa)}</div><div class="kpi__sub">${pill(dN, true)}</div></div>
        <div class="kpi"><div class="kpi__label">Applicants reclassified</div><div class="kpi__val" style="font-size:20px">${(r.flipped.length || r.gained.length)}</div><div class="kpi__sub muted">of ${r.total}</div></div>
      </div>
      <div class="row mt-12"><button class="btn btn--sm" onclick="App.closeModal();App.simView.open('${a.policy}',${ovLit})">${App.icon('chart')} Open in simulator</button></div>`;
  },
  _impactStored(im) {
    return `<div class="info-banner" style="margin-top:14px;margin-bottom:0">${App.icon('chart')} <span><strong>Projected impact:</strong> approval ${App.esc(String(im.approvalDelta))} pts · NPA ${App.esc(String(im.npaDelta))} pts · ${App.esc(String(im.flipped))} applicants reclassified.</span></div>`;
  },

  /* ---------- view: pending requests ---------- */
  renderRequests(u) {
    const reqs = this.visibleRequests(u);
    const hidden = DB.approvals.length - reqs.length;
    const byIds = [...new Set(reqs.map(r => r.requestedBy))];

    const rows = reqs.map(a => {
      const by = App.emp(a.requestedBy);
      return `<tr class="clickable" data-name="${App.esc(a.name.toLowerCase())}" data-prio="${a.priority}" data-by="${a.requestedBy}" onclick="App.approvalsView.open('${a.id}')">
        <td><div class="cell-person">${App.icon('branch')}<div><div class="cell-strong">${App.esc(a.name)}</div><div class="muted" style="font-size:12px">${a.id} · ${App.ui.pill(a.status,'violet')}</div></div></div></td>
        <td><span class="tag">${App.esc(a.type)}</span></td>
        <td class="muted">${a.on}</td>
        <td>${this.prioPill(a.priority)}</td>
        <td><div class="cell-person">${App.ui.avatar(by,'sm')}<span>${App.esc(by.name)}</span></div></td>
        <td><button class="btn btn--sm" onclick="event.stopPropagation();App.approvalsView.open('${a.id}')">${App.icon('eye')} Review</button></td>
      </tr>`;
    }).join('');

    const empty = `<tr id="apEmpty" style="display:none"><td colspan="6">${App.ui.empty('check','Nothing matches','Try clearing the filters above.')}</td></tr>`;

    return `<div class="page">
      <div class="page__head"><div><h1>Approvals</h1><p>Maker-checker review for every policy change. Each request follows the approval workflow defined for its category.</p></div><div class="spacer"></div>
        <button class="btn" onclick="App.approvalsView.auditTrail()">${App.icon('clock')} View Audit Trail</button>
        <button class="btn btn--primary" onclick="App.approvalsView.setMode('workflows')">${App.icon('branch')} Manage Approval Workflows</button>
      </div>
      <div class="info-banner">${App.icon('shield')} <span><strong>Maker-checker enforced:</strong> the requester can never self-approve. Levels &amp; approvers come from the workflow for each policy category; regulatory checks are flagged automatically.</span></div>
      ${hidden ? `<div class="lock-banner">${App.icon('lock')} <span><strong>${hidden} request${hidden>1?'s are':' is'} hidden</strong> - they touch policies outside your access scope.</span></div>` : ''}
      <div class="toolbar">
        <div class="search-input">${App.icon('search')}<input id="apSearch" placeholder="Search requests…"/></div>
        <select class="select" id="apPrio"><option value="">All priority</option><option>High</option><option>Medium</option><option>Low</option></select>
        <select class="select" id="apBy"><option value="">All requesters</option>${byIds.map(id=>{const e=App.emp(id);return `<option value="${id}">${App.esc(e.name)}</option>`;}).join('')}</select>
      </div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Request</th><th>Type</th><th>Requested On</th><th>Priority</th><th>Requested By</th><th></th></tr></thead><tbody id="apBody">${rows || ''}${empty}${rows ? '' : `<tr><td colspan="6">${App.ui.empty('check','No pending requests','All caught up - nothing awaiting your review.')}</td></tr>`}</tbody></table></div>
    </div>`;
  },

  /* ---------- view: workflows ---------- */
  renderWorkflows(u) {
    const canEdit = u.role === 'admin' || u.role === 'policy_manager';
    const rows = DB.workflows.map(w => {
      const userCount = new Set(w.levels.flatMap(l => l.users)).size;
      return `<tr class="clickable" onclick="App.approvalsView.editWorkflow('${w.id}')">
        <td><div class="cell-person">${App.icon('branch')}<div><div class="cell-strong">${App.esc(w.name)}</div><div class="muted" style="font-size:12px">${w.id} · created ${w.created}</div></div></div></td>
        <td class="muted">${App.esc(w.milestone)}</td>
        <td>${App.ui.pill(w.category,'violet')}</td>
        <td><b>${w.levels.length}</b> <span class="muted">(${userCount} ${userCount===1?'user':'users'})</span></td>
        <td>${App.ui.statusPill(w.status)}</td>
        <td><button class="btn btn--sm" onclick="event.stopPropagation();App.approvalsView.editWorkflow('${w.id}')">${App.icon('edit')} Edit</button></td>
      </tr>`;
    }).join('');

    return `<div class="page">
      <div class="page__head"><div>
        <div class="row gap-8" style="margin-bottom:6px"><button class="btn btn--ghost btn--sm" onclick="App.approvalsView.setMode('requests')">${App.icon('arrow')} Back to requests</button></div>
        <h1>Approval Workflows</h1><p>Multi-level maker-checker chains. Each policy category routes to one workflow.</p>
      </div><div class="spacer"></div>
        ${canEdit ? `<button class="btn btn--primary" onclick="App.approvalsView.addWorkflow()">${App.icon('plus')} Add New Workflow</button>` : ''}
      </div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Workflow Name</th><th>Milestone</th><th>Category</th><th>Levels</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  },

  /* ---------- view: audit trail (full page) ---------- */
  renderAudit(u) {
    const rows = this.auditEntries(u).map(e => `<tr>
      <td class="muted mono" style="font-size:12px;white-space:nowrap">${e.ts}</td>
      <td><div class="cell-person">${App.ui.avatar(e.actor,'sm')}<span class="cell-strong">${App.esc(e.actor.name)}</span></div></td>
      <td>${App.esc(e.action)}</td>
      <td class="muted">${App.esc(e.target)}</td>
      <td>${e.status}</td>
    </tr>`).join('');

    return `<div class="page">
      <div class="page__head"><div>
        <div class="row gap-8" style="margin-bottom:6px"><button class="btn btn--ghost btn--sm" onclick="App.approvalsView.setMode('requests')">${App.icon('arrow')} Back to requests</button></div>
        <h1>Audit Trail</h1><p>Immutable, time-stamped log of every maker-checker action - captured for compliance.</p>
      </div></div>
      <div class="info-banner">${App.icon('lock')} <span>This log is append-only and synced to the <strong>audit-log service</strong>. Entries cannot be edited or deleted.</span></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Target</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  },

  // build plausible audit entries from the approvals + workflow data
  auditEntries(u) {
    const reqs = this.visibleRequests(u);
    const e = [];
    reqs.forEach(a => {
      const maker = App.emp(a.requestedBy);
      e.push({ ts: a.on + ' 09:14', actor: maker, action: 'Submitted change request', target: a.name, status: App.ui.pill('Submitted','blue') });
      const wf = this.workflowFor(App.policy(a.policy) ? App.policy(a.policy).category : null);
      if (wf) {
        const l1 = App.emp(wf.levels[0].users[0]);
        if (a.status.includes('L2')) {
          e.push({ ts: a.on + ' 11:02', actor: l1, action: 'Approved at Level 1 - escalated to L2', target: a.name, status: App.ui.pill('L1 approved','green') });
        } else {
          e.push({ ts: a.on + ' 10:48', actor: l1, action: 'Picked up for Level 1 review', target: a.name, status: App.ui.pill('In review','amber') });
        }
        if (a.complianceFlag) {
          const bot = App.emp('THQ0118');
          e.push({ ts: a.on + ' 09:15', actor: bot, action: 'Auto regulatory check matched circular', target: a.name, status: App.ui.pill('Flagged','violet') });
        }
      }
    });
    // sort newest first by raw date string then time
    return e.sort((x, y) => (y.ts > x.ts ? 1 : -1)).slice(0, 6);
  },

  /* ---------- modal: review a request (the diff) ---------- */
  open(id) {
    const a = DB.approvals.find(x => x.id === id);
    if (!a) return;
    const u = App.currentUser();
    const by = App.emp(a.requestedBy);
    const p = App.policy(a.policy);
    const wf = p ? this.workflowFor(p.category) : null;
    const canAct = this.canAct(u) && u.id !== a.requestedBy; // maker can't self-approve

    const diff = `<div class="answer-card"><div class="answer-card__h">${App.icon('edit')} Proposed change · ${App.esc(a.change.field)}</div><div class="answer-card__b">
      <div class="grid grid-2" style="gap:14px">
        <div><div class="login__label" style="margin-bottom:6px">Current</div><div class="card card--pad" style="background:var(--surface-2)"><span class="diff-del">${App.esc(a.change.from)}</span></div></div>
        <div><div class="login__label" style="margin-bottom:6px">Proposed</div><div class="card card--pad" style="background:var(--surface-2)"><span class="diff-add">${App.esc(a.change.to)}</span></div></div>
      </div></div></div>`;

    const rationale = `<div class="field" style="margin-top:14px;margin-bottom:0"><label>Rationale from requester</label><div class="card card--pad" style="background:var(--surface-2);font-size:13px;color:var(--ink-2)">${App.esc(a.rationale)}</div></div>`;

    const compliance = a.complianceFlag
      ? `<div class="info-banner" style="margin-top:14px;margin-bottom:0">${App.icon('shield')} <span><strong>Regulatory check:</strong> ${App.esc(a.complianceFlag)}</span></div>`
      : '';

    const cites = (a.citations && a.citations.length && App.pdf)
      ? `<div class="field" style="margin-top:14px;margin-bottom:0"><label>Source documents - open at the cited page</label><div class="row gap-8 wrap">${a.citations.map(ct => App.pdf.cite(ct.kind, ct.id, ct.anchor, ct.kind === 'circular' ? ('Circular ' + (a.sourceRef || '')) : null)).join('')}</div></div>`
      : '';

    // prefer the request's own stages (chosen at upload) over the category default workflow
    const chain = (a.stages && a.stages.length) ? a.stages : (wf ? wf.levels : null);
    const chainName = (a.stages && a.stages.length) ? (a.workflow || 'Custom workflow') : (wf ? wf.name : '');
    let levels = '';
    if (chain) {
      const lv = chain.map(l => {
        const approvers = (l.users || []).map(uid => { const e = App.emp(uid); return `<div class="minirow">${e ? App.ui.avatar(e,'sm') : ''}<div style="flex:1"><b style="font-weight:600">${App.esc(e ? e.name : uid)}</b> <span class="muted" style="font-size:12px">· ${App.esc(e ? e.title : '')}</span></div></div>`; }).join('');
        const cls = a.status.includes('L'+l.n) ? 'is-active' : (a.status.includes('L2') && l.n === 1 ? 'is-done' : '');
        return `<div style="margin-bottom:12px">
          <div class="row gap-8" style="margin-bottom:6px"><span class="step ${cls}"><span class="step__num">${cls==='is-done'?'✓':l.n}</span> Stage ${l.n}</span><span class="tag">${l.criteria==='All'?'All must approve':l.criteria==='Anyone'?'Anyone can approve':'Custom rule'}</span></div>
          ${approvers}
        </div>`;
      }).join('');
      levels = `<div class="divider"></div><b style="font-size:12.5px">Approval chain${chainName?' · '+App.esc(chainName):''}</b><div class="mt-8">${lv}</div>`;
    }

    const footer = `<div class="spacer" style="flex:1"></div>`
      + (canAct
          ? `<button class="btn btn--danger" onclick="App.approvalsView.reject('${a.id}')">${App.icon('x')} Reject</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('Approved · ${App.esc(a.id)} advanced to next level (demo)')">${App.icon('check')} Approve</button>`
          : `<span class="pill pill--gray" style="align-self:center">${App.icon('lock')} ${u.id===a.requestedBy?'You raised this - cannot self-approve':'View only'}</span>`);

    App.openModal({
      title: a.name,
      sub: a.id + ' · ' + a.type + ' · raised by ' + by.name + ' on ' + a.on,
      lg: true,
      body: `<div class="row gap-8" style="margin-bottom:14px;flex-wrap:wrap">${this.prioPill(a.priority)} ${App.ui.pill(a.status,'violet')} ${p?App.ui.pill(p.name+' · '+p.version,'gray'):''}</div>
        ${diff}${rationale}${compliance}${cites}${this.impactBlock(a)}${levels}`,
      footer
    });
  },

  reject(id) {
    const a = DB.approvals.find(x => x.id === id);
    const reasons = (typeof DB.rejectionReasons !== 'undefined' && DB.rejectionReasons.length)
      ? DB.rejectionReasons.slice(0, 4).map(r => r.reason)
      : ['Insufficient justification','Conflicts with existing policy','Needs legal review','Out of scope'];
    App.openModal({
      title: 'Reject request · ' + (a ? a.id : ''),
      sub: 'Send the change back to the requester with a reason.',
      body: `<div class="field"><label>Reason <span class="req">*</span></label><select class="select" style="width:100%">${reasons.map(r=>`<option>${App.esc(r)}</option>`).join('')}<option>Other (specify below)</option></select></div>
        <div class="field" style="margin-bottom:0"><label>Note to requester</label><textarea class="textarea" placeholder="Add context for the maker…"></textarea></div>`,
      footer: `<button class="btn" onclick="App.approvalsView.open('${id}')">${App.icon('arrow')} Back</button><button class="btn btn--danger" onclick="App.closeModal();App.toast('Rejected · ${App.esc(id)} returned to requester (demo)','warn')">${App.icon('x')} Confirm reject</button>`
    });
  },

  /* ---------- audit trail (from requests view button) ---------- */
  auditTrail() { this.setMode('audit'); },

  /* ---------- workflow editor / creator ---------- */
  editWorkflow(id) {
    const w = DB.workflows.find(x => x.id === id);
    if (!w) return;
    const levels = w.levels.map(l => {
      const approvers = l.users.map(uid => { const e = App.emp(uid); return `<span class="tag">${App.esc(e.name)}</span>`; }).join(' ');
      return `<div class="card card--pad" style="margin-bottom:10px">
        <div class="row gap-8" style="margin-bottom:8px"><span class="step is-active"><span class="step__num">${l.n}</span> Level ${l.n}</span><div class="spacer" style="flex:1"></div><span class="pill pill--gray">${l.criteria==='All'?'All must approve':l.criteria==='Anyone'?'Anyone can approve':'Custom'}</span></div>
        <div class="row wrap gap-6">${approvers}</div>
      </div>`;
    }).join('');
    App.openModal({
      title: 'Edit workflow · ' + w.name,
      sub: w.milestone + ' · ' + w.category + ' · ' + w.levels.length + ' levels',
      lg: true,
      body: `<div class="grid grid-2"><div class="field"><label>Workflow Name</label><input class="input" value="${App.esc(w.name)}"/></div>
        <div class="field"><label>Status</label><select class="select" style="width:100%"><option ${w.status==='Active'?'selected':''}>Active</option><option ${w.status==='Draft'?'selected':''}>Draft</option></select></div></div>
        <div class="login__label">Approval levels</div>${levels}
        <button class="btn btn--sm" onclick="App.toast('Add level - open the full editor (demo)')">${App.icon('plus')} Add Level</button>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('Workflow “${App.esc(w.name.replace(/"/g,''))}” saved (demo)')">Save workflow</button>`
    });
  },

  addWorkflow() {
    App.openModal({
      title: 'Add New Workflow',
      sub: 'Define a maker-checker chain for a policy category.',
      lg: true,
      body: `<div class="grid grid-2">
          <div class="field"><label>Workflow Name <span class="req">*</span></label><input class="input" id="wfName" placeholder="e.g. Gold Loan Policy Approval"/></div>
          <div class="field"><label>Milestone</label><select class="select" style="width:100%"><option>Policy Management</option></select></div>
        </div>
        <div class="field"><label>Category <span class="req">*</span></label><select class="select" id="wfCat" style="width:100%">${DB.categories.map(c=>`<option>${App.esc(c.name)}</option>`).join('')}</select></div>
        <div class="divider"></div>
        <div class="row gap-8" style="margin-bottom:10px"><b style="font-size:12.5px">Approval Levels</b><div class="spacer" style="flex:1"></div><button class="btn btn--sm" onclick="App.approvalsView.addLevelRow()">${App.icon('plus')} Add Level</button></div>
        <div id="wfLevels">${this.levelRowHtml(1)}${this.levelRowHtml(2)}</div>`,
      footer: `<button class="btn" onclick="App.approvalsView.setMode('workflows')">Cancel</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('Workflow created (demo)')">Save workflow</button>`
    });
  },

  levelRowHtml(n) {
    const opts = DB.employees.map(e => `<option value="${e.id}">${App.esc(e.name)} - ${App.esc(e.title)}</option>`).join('');
    return `<div class="card card--pad" style="margin-bottom:10px">
      <div class="row gap-8" style="margin-bottom:10px"><span class="step is-active"><span class="step__num">${n}</span> Level ${n}</span></div>
      <div class="field"><label>Select User <span class="req">*</span></label><select class="select" style="width:100%">${opts}</select></div>
      <div class="field" style="margin-bottom:0"><label>Minimal Approval Criteria</label>
        <div class="row wrap gap-12">
          <label class="row gap-6" style="font-weight:500"><input type="radio" name="crit-${n}" checked/> All</label>
          <label class="row gap-6" style="font-weight:500"><input type="radio" name="crit-${n}"/> Anyone</label>
          <label class="row gap-6" style="font-weight:500"><input type="radio" name="crit-${n}"/> Custom</label>
        </div>
      </div>
    </div>`;
  },

  addLevelRow() {
    const host = document.querySelector('#wfLevels');
    if (!host) return;
    const n = host.querySelectorAll('.card').length + 1;
    host.insertAdjacentHTML('beforeend', this.levelRowHtml(n));
  }
};
