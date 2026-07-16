/* ============================================================
   PolicyOS · Tara - Impact Simulator
   • App.sim      - evaluate a credit policy's thresholds against the
                    anonymized test cohort; report approval/NPA/flip deltas.
   • App.simView  - the modal UI (knobs → run → result → propose to Approvals).
   Used by: policy detail, RuleSense, Regulatory radar, Approvals, and Tara.
   ============================================================ */
(function () {
  const App = window.App;

  function pass(a, pp) {
    if (pp.minCibil != null && a.cibil < pp.minCibil) return false;
    if (pp.minAge   != null && a.age   < pp.minAge)   return false;
    if (pp.maxAge   != null && a.age   > pp.maxAge)   return false;
    if (pp.maxFoir  != null && a.foir  > pp.maxFoir)  return false;
    if (pp.maxLtv   != null && a.ltv   > pp.maxLtv)   return false;
    return true;
  }
  function metrics(pp) {
    const approved = DB.testBase.filter(a => pass(a, pp));
    const def = approved.filter(a => a.defaulted).length;
    return { approved: approved.length, set: approved,
      rate: DB.testBase.length ? approved.length / DB.testBase.length : 0,
      npa: approved.length ? def / approved.length : 0 };
  }

  const SIM = {
    paramsFor(id) { return (DB.simParams && DB.simParams[id]) || null; },
    knobMeta: {
      minCibil: { label: 'Minimum CIBIL score', kind: 'int' },
      minAge:   { label: 'Minimum age',         kind: 'int' },
      maxAge:   { label: 'Maximum age',         kind: 'int' },
      maxFoir:  { label: 'Max FOIR',            kind: 'pct' },
      maxLtv:   { label: 'Max LTV',             kind: 'pct' }
    },
    run(id, overrides) {
      const base = SIM.paramsFor(id);
      if (!base) return { applicable: false };
      const prop = Object.assign({}, base, overrides || {});
      const b = metrics(base), p = metrics(prop);
      const baseSet = new Set(b.set.map(a => a.id)), propSet = new Set(p.set.map(a => a.id));
      const flipped = b.set.filter(a => !propSet.has(a.id));   // approved → rejected
      const gained  = p.set.filter(a => !baseSet.has(a.id));   // rejected → approved
      const bands = [[600, 679], [680, 719], [720, 759], [760, 860]].map(([lo, hi]) => {
        const inBand = DB.testBase.filter(a => a.cibil >= lo && a.cibil <= hi);
        return { label: lo + '–' + hi, total: inBand.length,
          base: inBand.filter(a => pass(a, base)).length, prop: inBand.filter(a => pass(a, prop)).length };
      });
      return { applicable: true, total: DB.testBase.length, base: b, proposed: p, baseParams: base, propParams: prop, flipped, gained, bands };
    },
    fmt(k, v) { return (SIM.knobMeta[k] && SIM.knobMeta[k].kind === 'pct') ? Math.round(v * 100) + '%' : String(v); }
  };
  App.sim = SIM;

  const pct = x => (x * 100).toFixed(1) + '%';

  App.simView = {
    _ov: {},
    open(id, overrides, label) {
      const p = App.policy(id); const base = SIM.paramsFor(id);
      if (!p || !base) {
        App.openModal({ title: 'Impact simulator', sub: p ? p.name : '',
          body: `<div class="info-banner" style="margin-bottom:0">${App.icon('info')} <span>Quantitative impact simulation applies to <strong>credit / origination policies</strong> (Personal Loan, Two-Wheeler, MSME, Home Loan). “${p ? App.esc(p.name) : 'This policy'}” has no numeric eligibility thresholds to model.</span></div>`,
          footer: `<button class="btn" onclick="App.closeModal()">Close</button>` });
        return;
      }
      App.simView._ov = Object.assign({}, overrides || {});
      const knobs = Object.keys(base).map(k => {
        const m = SIM.knobMeta[k] || { label: k, kind: 'int' };
        const val = (App.simView._ov[k] != null ? App.simView._ov[k] : base[k]);
        const disp = m.kind === 'pct' ? Math.round(val * 100) : val;
        const cur = m.kind === 'pct' ? Math.round(base[k] * 100) + '%' : base[k];
        return `<div class="field" style="margin:0"><label>${m.label}${m.kind === 'pct' ? ' (%)' : ''}</label><input class="input" type="number" id="sim_${k}" data-kind="${m.kind}" value="${disp}"/><div class="hint">Current: ${cur}</div></div>`;
      }).join('');
      App.openModal({
        title: 'Impact simulator · ' + p.name, lg: true,
        sub: (label || 'Model a threshold change against the test cohort') + ' · ' + DB.testBase.length + ' applicants',
        body: `<div class="info-banner">${App.icon('chart')} <span>Adjust a threshold and see who flips and how the book moves - computed on an anonymized <strong>test cohort</strong> (no PII). This is the evidence you attach to a change request.</span></div>
          <div class="login__label">Proposed thresholds</div>
          <div class="grid grid-3">${knobs}</div>
          <div class="row gap-8 mt-16"><button class="btn btn--primary" onclick="App.simView.run('${id}')">${App.icon('zap')} Run simulation</button><button class="btn" onclick="App.simView.reset('${id}')">Reset</button></div>
          <div id="simResult" class="mt-16"></div>`,
        footer: `<button class="btn" onclick="App.closeModal()">Close</button><button class="btn btn--primary" id="simProposeBtn" style="display:none" onclick="App.simView.propose('${id}')">${App.icon('send')} Propose change → Approvals</button>`
      });
      App.simView.run(id);
    },
    readOverrides(id) {
      const base = SIM.paramsFor(id); const ov = {};
      Object.keys(base).forEach(k => {
        const el = document.getElementById('sim_' + k); if (!el) return;
        let v = parseFloat(el.value); if (isNaN(v)) return;
        if (el.dataset.kind === 'pct') v = v / 100;
        ov[k] = v;
      });
      return ov;
    },
    run(id) {
      App.simView._ov = App.simView.readOverrides(id);
      const r = SIM.run(id, App.simView._ov);
      const host = document.getElementById('simResult'); if (!host) return;
      host.innerHTML = App.simView.resultHtml(r);
      const pb = document.getElementById('simProposeBtn');
      if (pb) pb.style.display = (r.flipped.length || r.gained.length) ? '' : 'none';
    },
    reset(id) { App.simView._ov = {}; App.simView.open(id); },
    resultHtml(r) {
      if (!r.applicable) return '';
      const dA = (r.proposed.rate - r.base.rate) * 100;
      const dN = (r.proposed.npa - r.base.npa) * 100;
      const deltaPill = (d, goodDown) => { const flat = Math.abs(d) < 0.05; const good = goodDown ? d < 0 : d > 0;
        return App.ui.pill((d >= 0 ? '+' : '') + d.toFixed(1) + ' pts', flat ? 'gray' : (good ? 'green' : 'red')); };
      const kpi = (lbl, from, to, pill) => `<div class="kpi"><div class="kpi__label">${lbl}</div><div class="kpi__val" style="font-size:21px">${from} → ${to}</div><div class="kpi__sub">${pill}</div></div>`;
      const maxBand = Math.max.apply(null, r.bands.map(b => b.total).concat([1]));
      const bars = r.bands.map(b => `<div class="bar-row"><div class="bar-row__lbl" style="width:108px">CIBIL ${b.label}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(b.prop / maxBand * 100)}%">${b.prop}</div></div><div class="bar-row__val">${b.prop !== b.base ? 'was ' + b.base : ''}</div></div>`).join('');
      const flips = r.flipped.length ? r.flipped : r.gained;
      const flipLabel = r.flipped.length ? 'now rejected' : 'now approved';
      const flipKind = r.flipped.length ? 'red' : 'green';
      const flipRows = flips.slice(0, 8).map(a => `<div class="minirow"><span class="mono" style="font-size:11.5px;width:64px">${a.id}</span><span style="flex:1" class="muted">CIBIL ${a.cibil} · age ${a.age} · FOIR ${Math.round(a.foir * 100)}%</span><span class="pill pill--${flipKind}">${App.icon(r.flipped.length ? 'x' : 'check')} ${flipLabel}</span></div>`).join('');
      return `<div class="grid grid-3" style="margin-bottom:14px">
          ${kpi('Approval rate', pct(r.base.rate), pct(r.proposed.rate), deltaPill(dA, false))}
          ${kpi('Projected NPA', pct(r.base.npa), pct(r.proposed.npa), deltaPill(dN, true))}
          <div class="kpi"><div class="kpi__label">Applicants reclassified</div><div class="kpi__val" style="font-size:21px">${flips.length}</div><div class="kpi__sub muted">${flipLabel} · of ${r.total}</div></div>
        </div>
        <div class="card"><div class="card__head">${App.icon('chart')}<h3>Approvals by CIBIL band (proposed)</h3></div><div class="card__body">${bars}</div></div>
        ${flips.length ? `<div class="card mt-16"><div class="card__head">${App.icon('users')}<h3>Sample of applicants who flip</h3><div class="spacer"></div><span class="muted" style="font-size:12px">anonymized · ${flips.length} total</span></div><div class="card__body">${flipRows}</div></div>` : ''}`;
    },
    propose(id) {
      const p = App.policy(id); const base = SIM.paramsFor(id); const ov = App.simView._ov || {};
      const r = SIM.run(id, ov);
      const changedKey = Object.keys(ov).find(k => ov[k] !== base[k]);
      const change = changedKey
        ? { field: SIM.knobMeta[changedKey].label, from: SIM.fmt(changedKey, base[changedKey]), to: SIM.fmt(changedKey, ov[changedKey]) }
        : { field: 'Threshold', from: '-', to: '-' };
      const dA = ((r.proposed.rate - r.base.rate) * 100).toFixed(1), dN = ((r.proposed.npa - r.base.npa) * 100).toFixed(1);
      const me = (App.state.user && App.state.user.id) || 'THQ0144';
      const req = { id: 'REQ-' + (2000 + DB.approvals.length), name: p.name + ' - ' + change.field + ' ' + change.from + ' → ' + change.to,
        type: 'Policy Change', policy: id, requestedBy: me, on: '21 Jun 2026', priority: 'High', status: 'Pending L1',
        change, rationale: 'Simulated on the test cohort: approval ' + (dA >= 0 ? '+' : '') + dA + ' pts, projected NPA ' + (dN >= 0 ? '+' : '') + dN + ' pts, ' + (r.flipped.length || r.gained.length) + ' applicants reclassified.',
        complianceFlag: null, impact: { approvalDelta: dA, npaDelta: dN, flipped: (r.flipped.length || r.gained.length) } };
      DB.approvals.unshift(req);
      App.closeModal(); App.toast('Change request ' + req.id + ' created with impact attached'); App.navigate('approvals');
    }
  };
})();
