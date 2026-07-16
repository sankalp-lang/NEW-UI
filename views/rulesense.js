/* RuleSense AI - policies → executable rules → BRE code (JSONata) */
App.registerView('rulesense', {
  title: 'RuleSense AI',
  render(ctx) {
    if (!App.canAccessView('rulesense', ctx.user)) return App.lockedPage('RuleSense AI', 'RuleSense is for administrators and policy managers.');
    const u = ctx.user;
    const vis = App.visiblePolicies(u);

    // Resolve which policy to open (param wins, must be visible to this user)
    const wanted = ctx.params && ctx.params.policy ? App.policy(ctx.params.policy) : null;
    const open = wanted && App.canViewPolicy(wanted, u) ? wanted : null;

    if (open) {
      App.state.rulesense = { policy: open.id, tab: 'rules', step: 1 };
      return `<div class="page"><div id="rsEditor">${App.rulesenseView.editorHtml(open, u)}</div></div>`;
    }

    // ---- Picker: choose a policy to open the rule editor ----
    App.state.rulesense = { policy: null, tab: 'rules', step: 1 };
    const hidden = DB.policies.length - vis.length;

    if (!vis.length) {
      return `<div class="page">
        <div class="page__head"><div><h1>RuleSense AI</h1><p>Convert policy documents into executable rules and BRE-ready code.</p></div></div>
        ${App.ui.empty('lock', 'No policies in your scope', 'You do not have access to any policy. Ask an administrator to grant access.')}
      </div>`;
    }

    const cards = vis.map(p => {
      const owner = App.emp(p.owner);
      const ruleCount = (p.rules || []).length;
      const lendingish = p.category === 'Lending';
      return `<button class="actioncard" onclick="App.navigate('rulesense',{policy:'${p.id}'})">
        <span class="actioncard__ic" style="background:var(--brand-50);color:var(--brand-600)">${App.icon(lendingish ? 'code' : 'file')}</span>
        <div style="flex:1">
          <b>${App.esc(p.name)}</b>
          <span>${App.esc(p.category)} · ${App.esc(p.sub)} · <span class="mono">${p.version}</span></span>
          <div class="row gap-6 mt-8" style="flex-wrap:wrap">
            ${App.ui.statusPill(p.status)}
            ${ruleCount ? App.ui.pill(ruleCount + ' rule' + (ruleCount > 1 ? 's' : ''), 'violet') : App.ui.pill('No rules yet', 'gray')}
            ${App.ui.pill('Owner: ' + owner.name, 'gray')}
          </div>
        </div>
        <span class="muted" style="align-self:center">${App.icon('arrow')}</span>
      </button>`;
    }).join('');

    return `<div class="page">
      <div class="page__head"><div><h1>RuleSense AI</h1><p>Convert policy documents into executable rules, then auto-generate BRE-ready code. Pick a policy to open the rule editor.</p></div></div>
      <div class="info-banner">${App.icon('zap')} <span><strong>RuleSense</strong> reads your policy PDF, extracts structured logic (trigger → condition → action), and compiles it to a Business Rules Engine expression you can test and deploy.</span></div>
      ${hidden ? `<div class="lock-banner">${App.icon('lock')} <span><strong>${hidden} polic${hidden > 1 ? 'ies are' : 'y is'} hidden</strong> - outside your role's access scope.</span></div>` : ''}
      <div class="grid grid-2">${cards}</div>
    </div>`;
  },
  mount(root, ctx) {
    // Editor is fully re-rendered by helper innerHTML swaps; nothing global to wire here.
  }
});

App.rulesenseView = {
  /* ---------- state helpers ---------- */
  st() { return App.state.rulesense || (App.state.rulesense = { policy: null, tab: 'rules', step: 1 }); },
  cur() { return App.policy(this.st().policy); },

  /* version trail + rule-by-rule compare now live in App.versions (shared with the Policies table) */

  /* ---------- loosely parse "IF ... THEN ..." rule strings ---------- */
  _triggerFor(cond, action) {
    const s = (cond + ' ' + action).toLowerCase();
    if (/dpd|bucket|legal|recovery/.test(s)) return 'On repayment event';
    if (/pep|str|kyc|due_diligence|flagged/.test(s)) return 'On onboarding / periodic review';
    if (/device|incident|unmanaged/.test(s)) return 'On device / security event';
    if (/leave|certificate/.test(s)) return 'On leave request';
    if (/expense|international/.test(s)) return 'On expense claim';
    return 'On application evaluation';
  },
  parseRule(r) {
    const m = /^\s*if\s+(.*?)\s+then\s+(.*)$/i.exec(r || '');
    const condition = m ? m[1].trim() : r, action = m ? m[2].trim() : 'Apply policy outcome';
    return { condition, action, trigger: this._triggerFor(condition, action) };
  },

  /* humanize a condition fragment into a readable requirement */
  humanize(cond) {
    let s = String(cond);
    s = s.replace(/_/g, ' ')
         .replace(/\bcibil score\b/gi, 'CIBIL score')
         .replace(/\bfoir\b/gi, 'FOIR')
         .replace(/\bltv\b/gi, 'LTV')
         .replace(/\bgst\b/gi, 'GST')
         .replace(/\bdpd\b/gi, 'DPD')
         .replace(/\bpep\b/gi, 'PEP')
         .replace(/\bmfa\b/gi, 'MFA')
         .replace(/\s*>=\s*/g, ' ≥ ')
         .replace(/\s*<=\s*/g, ' ≤ ')
         .replace(/\s*!=\s*/g, ' ≠ ')
         .replace(/\s*=\s*/g, ' = ')
         .replace(/\s*>\s*/g, ' > ')
         .replace(/\s*<\s*/g, ' < ')
         .replace(/\bor\b/gi, 'or')
         .replace(/\band\b/gi, 'and');
    return s.trim();
  },

  /* ---------- stepper ---------- */
  stepperHtml() {
    const s = this.st();
    const steps = [['01', 'Rules'], ['02', 'Code'], ['03', 'Review']];
    return `<div class="stepper">${steps.map((st, i) => {
      const n = i + 1;
      const cls = n === s.step ? 'is-active' : (n < s.step ? 'is-done' : '');
      const sep = i < steps.length - 1 ? '<div class="step__line"></div>' : '';
      return `<div class="step ${cls}" onclick="App.rulesenseView.goStep(${n})"><span class="step__num">${n < s.step ? App.icon('check') : st[0]}</span> ${st[1]}</div>${sep}`;
    }).join('')}</div>`;
  },
  goStep(n) {
    const s = this.st();
    s.step = n;
    // map step → a sensible default tab
    if (n === 1) s.tab = 'rules';
    else if (n === 2) s.tab = 'bre';
    else if (n === 3) s.tab = 'split';
    this.refresh();
  },

  /* ---------- tabs ---------- */
  tabsHtml() {
    const s = this.st();
    const tabs = [['rules', 'Rules'], ['summary', 'Summary'], ['bre', 'BRE-Rules'], ['split', 'Split View']];
    return `<div class="tabs">${tabs.map(t =>
      `<div class="tab ${s.tab === t[0] ? 'is-active' : ''}" onclick="App.rulesenseView.setTab('${t[0]}')">${t[1]}</div>`
    ).join('')}</div>`;
  },
  setTab(t) {
    const s = this.st();
    s.tab = t;
    // keep step roughly in sync with the tab the user is exploring
    if (t === 'rules' || t === 'summary') s.step = 1;
    else if (t === 'bre') s.step = 2;
    else if (t === 'split') s.step = 3;
    this.refresh();
  },

  /* ---------- tab bodies ---------- */
  rulesTabHtml(p) {
    const rules = p.rules || [];
    if (!rules.length) return App.ui.empty('code', 'No rules extracted yet', 'RuleSense found no machine-readable logic in this policy. Add requirements manually or re-run extraction.');
    const ro = App.currentUser() && App.currentUser().role === 'user';   // staff use is read-only
    const items = rules.map((r, i) => {
      const pr = this.parseRule(r);
      return `<div class="minirow">
        <span class="pill pill--violet" style="width:24px;justify-content:center">${i + 1}</span>
        <div style="flex:1">
          <b style="font-weight:600">${App.esc(this.humanize(pr.condition))}</b>
          <div class="muted" style="font-size:12px;margin-top:2px">→ ${App.esc(this.humanize(pr.action))}</div>
        </div>
        ${ro ? '' : `<button class="btn btn--sm btn--ghost" onclick="App.rulesenseView.editRule(${i})">${App.icon('edit')}</button>`}
      </div>`;
    }).join('');
    return `<div class="card"><div class="card__head">${App.icon('shield')}<h3>Extracted requirements</h3><div class="spacer"></div><span class="muted" style="font-size:12px">${rules.length} rule${rules.length > 1 ? 's' : ''}${ro ? '' : ' · editable'}</span></div>
      <div class="card__body">${items}</div></div>`;
  },

  summaryTabHtml(p) {
    const factLines = Object.entries(p.facts || {})
      .map(([k, v]) => `<li><strong>${App.esc(k)}</strong>: ${App.esc(v)}</li>`).join('');
    const ruleCount = (p.rules || []).length;
    return `<div class="answer-card">
        <div class="answer-card__h">${App.icon('sparkles')} RuleSense narrative · ${App.esc(p.version)}</div>
        <div class="answer-card__b">
          <p>${App.esc(p.summary)}</p>
          <p style="margin-top:10px">From this document, RuleSense derived <strong>${ruleCount}</strong> executable rule${ruleCount === 1 ? '' : 's'} governed by the following key parameters:</p>
          ${factLines ? `<ul style="margin:8px 0 0;padding-left:18px;line-height:1.7">${factLines}</ul>` : '<p class="muted" style="margin-top:8px">No structured parameters detected.</p>'}
          <p class="muted" style="margin-top:12px;font-size:12.5px">These map deterministically to a JSONata expression evaluated by the BRE at decision time.</p>
        </div>
      </div>`;
  },

  breTabHtml(p) {
    const rules = p.rules || [];
    if (!rules.length) return App.ui.empty('key', 'Nothing to compile', 'This policy has no rules to express as BRE triggers, conditions and actions.');
    return `<div class="grid grid-2">${rules.map((r, i) => {
      const pr = this.parseRule(r);
      return `<div class="card card--pad">
        <div class="row gap-8" style="margin-bottom:10px"><span class="pill pill--violet">Rule ${i + 1}</span></div>
        <div class="minirow"><span class="muted" style="width:74px">Trigger</span><span class="spacer" style="flex:1"></span><b style="text-align:right">${App.esc(pr.trigger)}</b></div>
        <div class="minirow"><span class="muted" style="width:74px;align-self:flex-start">Condition</span><span class="spacer" style="flex:1"></span><b style="text-align:right" class="mono" style="font-size:12px">${App.esc(this.humanize(pr.condition))}</b></div>
        <div class="minirow"><span class="muted" style="width:74px">Action</span><span class="spacer" style="flex:1"></span>${App.ui.pill(this.humanize(pr.action), /reject/i.test(pr.action) ? 'red' : /refer|l2/i.test(pr.action) ? 'amber' : 'blue')}</div>
      </div>`;
    }).join('')}</div>`;
  },

  splitTabHtml(p) {
    return `<div class="grid" style="grid-template-columns:1fr 1.05fr;gap:16px">
      <div>
        <div class="login__label">Source document</div>
        <div class="pdf-ph"><div class="pdf-ph__title"></div><div class="pdf-ph__bar w90"></div><div class="pdf-ph__bar w70"></div><div class="pdf-ph__bar w80"></div><div class="pdf-ph__bar w50"></div><div style="height:14px"></div><div class="pdf-ph__bar w80"></div><div class="pdf-ph__bar w90"></div><div class="pdf-ph__bar w70"></div><div class="pdf-ph__bar w50"></div><p class="muted" style="text-align:center;margin-top:18px;font-size:12px">${App.esc(p.name)}.pdf · ${App.esc(p.version)}</p></div>
      </div>
      <div>
        <div class="login__label">Compiled BRE rules</div>
        ${this.breTabHtml(p)}
      </div>
    </div>`;
  },

  tabBody(p) {
    const t = this.st().tab;
    if (t === 'summary') return this.summaryTabHtml(p);
    if (t === 'bre') return this.breTabHtml(p);
    if (t === 'split') return this.splitTabHtml(p);
    return this.rulesTabHtml(p);
  },

  /* ---------- full editor markup ---------- */
  editorHtml(p, u) {
    u = u || App.currentUser();
    return `
      <div class="page__head">
        <div>
          <h1>RuleSense AI</h1>
          <p>Extract, review and compile policy logic into a deployable Business Rules Engine.</p>
        </div>
        <div class="spacer"></div>
        <button class="btn btn--sm" onclick="App.navigate('rulesense')">${App.icon('arrow')} All policies</button>
      </div>

      <div class="row gap-8 mb-16" style="flex-wrap:wrap">
        <span class="pill pill--violet">${App.icon('file')} ${App.esc(p.name)}</span>
        <span class="pill pill--gray">${App.esc(p.category)} · ${App.esc(p.sub)}</span>
        ${App.ui.statusPill(p.status)}
      </div>

      <div class="row gap-8 mb-16" style="flex-wrap:wrap;align-items:center">
        <span class="login__label" style="margin:0">Versions</span>
        ${App.versions ? App.versions.chipsHtml(p.id) : ''}
        <div class="spacer" style="flex:1"></div>
        <button class="btn btn--sm" onclick="App.versions.open('${p.id}')">${App.icon('layers')} Compare versions</button>
      </div>

      ${this.stepperHtml()}
      ${this.tabsHtml()}

      <div id="rsTabBody">${this.tabBody(p)}</div>

      <div class="divider"></div>
      ${u.role === 'user'
        ? `<div class="info-banner" style="margin-bottom:0">${App.icon('eye')} <span><strong>Read-only.</strong> You can review the extracted rules and the generated logic for policies you can access. Editing rules and pushing to the engine is for policy managers and admins.</span></div>`
        : `<div class="row gap-8" style="flex-wrap:wrap">
        <button class="btn" onclick="App.rulesenseView.testLogic()">${App.icon('zap')} Test Logic</button>
        <button class="btn" onclick="App.rulesenseView.reviewVariables()">${App.icon('database')} Review Variables</button>
        ${App.sim && App.sim.paramsFor(p.id) ? `<button class="btn" onclick="App.simView.open('${p.id}')">${App.icon('chart')} Simulate impact</button>` : ''}
        <div class="spacer" style="flex:1"></div>
        <button class="btn btn--primary" onclick="App.rulesenseView.initiateBre()">${App.icon('code')} Initiate BRE Update</button>
      </div>`}`;
  },

  /* re-render the editor in place (keeps state) */
  refresh() {
    const p = this.cur();
    if (!p) { App.navigate('rulesense'); return; }
    const host = document.getElementById('rsEditor');
    if (host) host.innerHTML = this.editorHtml(p, App.currentUser());
    else App.reload();
  },

  /* ---------- rule edit (inline demo) ---------- */
  editRule(i) {
    const p = this.cur();
    if (!p) return;
    const pr = this.parseRule((p.rules || [])[i] || '');
    App.openModal({
      title: 'Edit rule ' + (i + 1),
      sub: p.name + ' · ' + p.version,
      body: `<div class="field"><label>Condition (IF)</label><input class="input" id="rsRuleCond" value="${App.esc(pr.condition)}"/></div>
        <div class="field" style="margin-bottom:0"><label>Action (THEN)</label><input class="input" id="rsRuleAct" value="${App.esc(pr.action)}"/></div>
        <div class="hint" style="margin-top:8px">Changes are validated against the policy schema before they can be committed to a new version.</div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn--primary" onclick="App.closeModal();App.toast('Rule change staged for v-next (demo)')">Save rule</button>`
    });
  },

  /* ---------- Test Logic modal ---------- */
  testLogic() {
    const p = this.cur();
    App.openModal({
      title: 'Test Logic',
      sub: 'Validate the extracted rules for ' + (p ? p.name : 'this policy') + ' before generating code.',
      body: `<div class="grid grid-2">
          <div class="actioncard" style="cursor:default;flex-direction:column;align-items:flex-start">
            <span class="actioncard__ic" style="background:var(--brand-50);color:var(--brand-600)">${App.icon('zap')}</span>
            <div><b>Advanced Data Creation</b><span>Generate synthetic applicant profiles across edge cases and run them through every rule.</span></div>
            <button class="btn btn--primary btn--sm mt-12" onclick="App.closeModal();App.toast('Synthetic test set generated · 240 profiles (demo)')">Get Started</button>
          </div>
          <div class="actioncard" style="cursor:default;flex-direction:column;align-items:flex-start">
            <span class="actioncard__ic" style="background:var(--teal-50);color:var(--teal-600)">${App.icon('database')}</span>
            <div><b>Historical Data Testing</b><span>Replay the last 90 days of decisions and compare rule output against booked outcomes.</span></div>
            <button class="btn btn--teal btn--sm mt-12" onclick="App.closeModal();App.toast('Backtest queued · replaying 12,480 records (demo)')">Get Started</button>
          </div>
        </div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>`
    });
  },

  /* ---------- Review Variables modal ---------- */
  reviewVariables() {
    const p = this.cur();
    const maps = this.varMap(p);
    const rows = maps.map(m => `<tr>
        <td><span class="mono" style="font-size:12.5px">${App.esc(m.src)}</span></td>
        <td>${App.icon('arrow')}</td>
        <td><span class="mono" style="font-size:12.5px">${m.dest ? App.esc(m.dest) : '-'}</span></td>
        <td>${m.dest ? `<span class="tag">${App.esc(m.type || 'string')}</span>` : '<span class="muted">-</span>'}</td>
        <td class="muted" style="font-size:12px">${m.dest ? App.esc(m.desc || '') : '-'}</td>
        <td>${m.dest ? App.ui.pill('Mapped', 'green') : App.ui.pill('Unmapped', 'amber')}</td>
      </tr>`).join('');
    App.openModal({
      title: 'Review Variables',
      sub: 'Source fields mapped to BRE input variables for ' + (p ? p.name : 'this policy') + '.',
      body: `<div class="table-wrap"><table class="tbl"><thead><tr><th>Source field</th><th></th><th>BRE variable</th><th>Data type</th><th>Description</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="info-banner mt-16" style="margin-bottom:0">${App.icon('info')} <span>Unmapped fields fall back to the default resolver. Map them to a verified source (Keka / bureau pull) for deterministic evaluation.</span></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>
        <button class="btn btn--primary" onclick="App.closeModal();App.toast('Variable mapping saved (demo)')">Save mapping</button>`
    });
  },

  /* derive a source→destination variable map from policy facts/rules (dest + data type + description, as in production) */
  varMap(p) {
    const dict = {
      cibil_score: ['bureauScore', 'number', 'Bureau credit score (300-900) from the latest CIBIL pull'],
      cibil: ['bureauScore', 'number', 'Bureau credit score (300-900) from the latest CIBIL pull'],
      cmr: ['bureauCmr', 'number', 'CIBIL MSME Rank for business applicants (1-10)'],
      age: ['applicantAge', 'number', 'Applicant age in completed years at application date'],
      foir: ['foirRatio', 'decimal', 'Fixed-obligation-to-income ratio incl. the proposed EMI'],
      monthly_income: ['monthlyIncome', 'number', 'Verified net monthly income (bank/payslip)'],
      ltv: ['loanToValue', 'decimal', 'Loan amount over asset value at sanction'],
      business_vintage_years: ['businessVintage', 'number', 'Years since business incorporation/registration'],
      promoter_age: ['promoterAge', 'number', 'Primary promoter age in completed years'],
      gst_turnover: ['gstTurnover', 'number', 'Trailing 12-month turnover from GST returns'],
      dpd: ['daysPastDue', 'number', 'Days past due on the account'],
      customer_pep: ['isPep', 'boolean', 'Politically-exposed-person screening flag'],
      leave_balance: ['leaveBalance', 'number', 'Accrued leave balance in days'],
      expense: ['claimAmount', 'number', 'Claimed expense amount in INR']
    };
    const found = new Set();
    (p && p.rules || []).forEach(r => {
      const cond = this.parseRule(r).condition;
      Object.keys(dict).forEach(k => { if (new RegExp('\\b' + k + '\\b', 'i').test(cond)) found.add(k); });
    });
    let list = Array.from(found).map(k => ({ src: k, dest: dict[k][0], type: dict[k][1], desc: dict[k][2] }));
    if (!list.length) list = [
      { src: 'cibil_score', dest: 'bureauScore', type: 'number', desc: dict.cibil_score[2] },
      { src: 'monthly_income', dest: 'monthlyIncome', type: 'number', desc: dict.monthly_income[2] }
    ];
    // always show one unmapped to illustrate the state
    list.push({ src: 'employment_tenure', dest: null });
    return list;
  },

  /* ---------- Initiate BRE Update modal ---------- */
  initiateBre() {
    const p = this.cur();
    // pull 2 engineers as pending approvers
    const approvers = [App.emp('THQ0128'), App.emp('THQ0118')].filter(Boolean);
    const apprRows = approvers.map(e => `<div class="minirow">
        ${App.ui.avatar(e, 'sm')}
        <div style="flex:1"><b style="font-weight:600">${App.esc(e.name)}</b> <span class="muted" style="font-size:12px">· ${App.esc(e.title)}</span></div>
        ${App.ui.pill('Pending', 'amber')}
      </div>`).join('');
    App.openModal({
      title: 'Initiate BRE Update',
      sub: 'Compile ' + (p ? p.name + ' · ' + p.version : 'this policy') + ' into deployable engine code.',
      lg: true,
      body: `<div class="grid grid-2" style="margin-bottom:16px">
          <div class="field" style="margin:0"><label>Code Language</label>
            <select class="select" id="rsLang" style="width:100%"><option>JSONata</option><option>Drools (DRL)</option><option>Python</option><option>Java</option></select>
          </div>
          <div class="field" style="margin:0"><label>Target environment</label>
            <select class="select" style="width:100%"><option>Staging</option><option>Production (post-approval)</option></select>
          </div>
        </div>
        <div class="login__label">Pending approvals</div>
        <div class="card card--pad" style="padding:6px 16px">${apprRows}</div>
        <div id="rsGenStatus" class="info-banner mt-16" style="display:none;margin-bottom:0"></div>
        <div id="rsGenCode" style="margin-top:16px"></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn--primary" id="rsGenBtn" onclick="App.rulesenseView.generateCode()">${App.icon('zap')} Generate Code</button>`
    });
  },

  /* ---------- simulated code-gen pipeline ---------- */
  generateCode() {
    const p = this.cur();
    const btn = document.getElementById('rsGenBtn');
    const status = document.getElementById('rsGenStatus');
    const codeHost = document.getElementById('rsGenCode');
    if (!status || !codeHost) return;
    if (btn) { btn.disabled = true; btn.innerHTML = App.icon('clock') + ' Generating…'; }
    codeHost.innerHTML = '';
    status.style.display = 'flex';

    const langSel0 = document.getElementById('rsLang'); const lang0 = langSel0 ? langSel0.value : 'JSONata';
    const stages = ['Analysing rules', 'Understanding policy intent', 'Generating ' + lang0, 'Validating expression', 'Finalizing'];
    let i = 0;
    const tick = () => {
      if (i < stages.length) {
        status.innerHTML = App.icon('clock') + ' <span><strong>' + App.esc(stages[i]) + '</strong> · step ' + (i + 1) + ' of ' + stages.length + '…</span>';
        i++;
        setTimeout(tick, 620);
      } else {
        status.innerHTML = App.icon('check') + ' <span><strong>Code generated.</strong> ' + App.esc(lang0) + ' output validated against the policy schema.</span>';
        if (btn) { btn.disabled = false; btn.innerHTML = App.icon('zap') + ' Regenerate'; }
        const langSel = document.getElementById('rsLang'); const lang = langSel ? langSel.value : 'JSONata';
        codeHost.innerHTML = `<pre class="code" id="rsCode">${App.rulesenseView.codeFor(p, lang)}</pre>
          <div class="row gap-8 mt-12">
            <button class="btn btn--sm" onclick="App.rulesenseView.copyCode()">${App.icon('clipboard')} Copy</button>
            <button class="btn btn--sm" onclick="App.toast('Running generated code against the sample cohort (demo)')">${App.icon('zap')} Test Code</button>
            <div class="spacer" style="flex:1"></div>
            <button class="btn btn--sm btn--primary" onclick="App.closeModal();App.toast('BRE update submitted for approval (demo)')">${App.icon('send')} Submit for approval</button>
          </div>`;
      }
    };
    tick();
  },

  copyCode() {
    const el = document.getElementById('rsCode');
    const txt = el ? el.textContent : '';
    if (navigator.clipboard && txt) {
      navigator.clipboard.writeText(txt).then(() => App.toast('JSONata copied to clipboard'), () => App.toast('Copied (demo)'));
    } else {
      App.toast('JSONata copied to clipboard');
    }
  },

  /* dispatch code generation by the language chosen in the modal (mirrors production CodeLanguage enum) */
  codeFor(p, lang) {
    const l = String(lang || 'JSONata').toLowerCase();
    if (l.indexOf('drools') >= 0) return this.droolsFor(p);
    if (l.indexOf('python') >= 0) return this.pythonFor(p);
    if (l.indexOf('java') >= 0) return this.javaFor(p);
    return this.jsonataFor(p);
  },
  // simple readable generators for the non-JSONata targets (demo-grade, from the same parsed rules)
  _plainConds(p) {
    return (p && p.rules || []).map(r => { const pr = this.parseRule(r); return { cond: pr.condition, action: pr.action }; });
  },
  droolsFor(p) {
    const C = s => `<span class="c">${App.esc(s)}</span>`;
    const K = s => `<span class="k">${s}</span>`;
    const rules = this._plainConds(p).map((r, i) =>
      `${K('rule')} "${App.esc(p.name)} #${i + 1}"\n${K('when')}\n    $a : Application( ${App.esc(r.cond.replace(/\bor\b/gi, '||').replace(/\band\b/gi, '&&'))} )\n${K('then')}\n    $a.setDecision("${App.esc(r.action.replace(/"/g, ''))}");\n${K('end')}`).join('\n\n');
    return C('// RuleSense → Drools (DRL) · ' + p.name + ' (' + p.version + ')') + '\n' + K('package') + ' com.tartan.bre;\n\n' + rules;
  },
  pythonFor(p) {
    const C = s => `<span class="c">${App.esc(s)}</span>`;
    const K = s => `<span class="k">${s}</span>`;
    const lines = this._plainConds(p).map(r =>
      `    ${K('if')} ${App.esc(r.cond.replace(/\bOR\b/gi, 'or').replace(/\bAND\b/gi, 'and').replace(/\s=\s/g, ' == '))}:\n        ${K('return')} "${App.esc(r.action.replace(/"/g, ''))}"`).join('\n');
    return C('# RuleSense → Python · ' + p.name + ' (' + p.version + ')') + `\n${K('def')} decide(application):\n${lines}\n    ${K('return')} "approve"`;
  },
  javaFor(p) {
    const C = s => `<span class="c">${App.esc(s)}</span>`;
    const K = s => `<span class="k">${s}</span>`;
    const lines = this._plainConds(p).map(r =>
      `        ${K('if')} (${App.esc(r.cond.replace(/\bor\b/gi, ' || ').replace(/\band\b/gi, ' && ').replace(/\s=\s/g, ' == '))}) ${K('return')} "${App.esc(r.action.replace(/"/g, ''))}";`).join('\n');
    return C('// RuleSense → Java · ' + p.name + ' (' + p.version + ')') + `\n${K('public class')} ${p.id.replace(/-/g, '')}Policy {\n    ${K('public String')} decide(Application application) {\n${lines}\n        ${K('return')} "approve";\n    }\n}`;
  },

  /* build a plausible JSONata expression from the policy's rules/facts */
  jsonataFor(p) {
    const K = s => `<span class="k">${s}</span>`;
    const S = s => `<span class="s">${App.esc(s)}</span>`;
    const N = s => `<span class="n">${App.esc(s)}</span>`;
    const C = s => `<span class="c">${App.esc(s)}</span>`;

    if (!p || !(p.rules || []).length) {
      return C('/* No rules to compile for this policy. */') + '\n(\n  { ' + S('"decision"') + ': ' + S('"manual_review"') + ' }\n)';
    }

    const dict = {
      cibil_score: 'bureauScore', cmr: 'bureauCmr', age: 'applicantAge', foir: 'foirRatio',
      monthly_income: 'monthlyIncome', ltv: 'loanToValue', business_vintage_years: 'businessVintage',
      promoter_age: 'promoterAge', gst_turnover: 'gstTurnover', dpd: 'daysPastDue',
      customer_pep: 'isPep', leave_balance: 'leaveBalance', expense: 'claimAmount',
      level: 'jobLevel', increment: 'incrementPct'
    };
    const mapVar = v => dict[v] || v.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

    // Translate one IF...THEN rule into a JSONata $.applicant condition line.
    // NOTE: this string is interpolated into innerHTML, so EVERY literal '<' / '>'
    // operator must be HTML-escaped (App.esc) - otherwise the browser parses
    // "bureauScore < 700 ? <span" as a stray tag and eats the comparison.
    const lines = (p.rules || []).map(r => {
      const pr = this.parseRule(r);
      // turn "cibil_score < 700 OR age > 58" into application.bureauScore < 700 or application.applicantAge > 58
      let cond = pr.condition
        .replace(/\b([a-z_]+)\b\s*(>=|<=|!=|=|>|<)\s*([0-9.]+|true|false)/gi,
          (_, field, op, val) => `application.${mapVar(field)} ${op === '=' ? '=' : op} ${val}`)
        .replace(/\bOR\b/gi, 'or').replace(/\bAND\b/gi, 'and');
      // escape brackets/ampersands, then re-colorize numeric literals
      let condHtml = App.esc(cond).replace(/\b([0-9][0-9.]*|true|false)\b/g, m => N(m));
      const action = /reject/i.test(pr.action) ? 'reject'
        : /legal/i.test(pr.action) ? 'initiate_legal'
        : /hard bucket/i.test(pr.action) ? 'move_hard_bucket'
        : /enhanced/i.test(pr.action) ? 'enhanced_dd'
        : /str/i.test(pr.action) ? 'file_str'
        : /founder|coo|l2|refer/i.test(pr.action) ? 'refer' : 'approve';
      return `      ${condHtml} ? ${S('"' + action + '"')}`;
    });

    // pick a headline cutoff from facts for a readable comment
    const cibil = p.facts && (p.facts['Minimum CIBIL score'] || p.facts['Minimum CIBIL / CMR']);
    const header = C('/* RuleSense → JSONata · ' + p.name + ' (' + p.version + ') */')
      + (cibil ? '\n' + C('/* headline cutoff: ' + cibil + ' */') : '');

    const body =
`(
  ${K('$decision')} := ${K('function')}($application) {(
${lines.join(' :\n')} :
      ${S('"approve"')}
  )};

  {
    ${S('"policyId"')}: ${S('"' + p.id + '"')},
    ${S('"version"')}: ${S('"' + p.version + '"')},
    ${S('"decision"')}: ${K('$decision')}(application),
    ${S('"evaluatedAt"')}: ${K('$now')}()
  }
)`;
    return header + '\n' + body;
  }
};
