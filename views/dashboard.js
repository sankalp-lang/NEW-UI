/* Dashboard — the role-aware overview. Home is the chat surface; this is where the numbers live.
   Everything here is computed live through the same RBAC helpers the rest of the app uses
   (activePoliciesInScope, approvalsView.visibleRequests, regulatoryView._allChanges, managedEmployees,
   visiblePolicies, suggestPrompts) — no hardcoded counts. Switch persona and every widget re-scopes. */
App.registerView('dashboard', {
  title: 'Dashboard',
  render(ctx) {
    const u = ctx.user;
    const fn = u.name.split(' ')[0];
    const roleLabel = (DB.roleLabels && DB.roleLabels[u.role]) || u.role;
    const cats = App.userCategories(u);
    const scopeText = u.role === 'admin' ? 'all categories' : (cats.join(' · ') || 'no categories');
    const hr = new Date().getHours();
    const salut = hr < 12 ? 'Good morning' : (hr < 17 ? 'Good afternoon' : 'Good evening');

    /* ---------- shared render helpers ---------- */
    const stat = (icon, label, val, sub, cls) =>
      `<div class="dsh__stat"><div class="dsh__sl">${App.icon(icon)}${label}</div>` +
      `<div class="dsh__sv">${val}</div>${sub ? `<div class="dsh__ss ${cls || ''}">${sub}</div>` : ''}</div>`;
    const strip = tiles => `<div class="dsh__stats">${tiles.join('')}</div>`;
    const qa = (icon, t, sub, onclick, badge, spark) =>
      `<button class="dsh__qa" onclick="${onclick}"><span class="dsh__qaic ${spark ? 'spark' : ''}">${App.icon(icon)}</span>` +
      `<span style="min-width:0"><b>${t}</b><em>${sub}</em></span>${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
    const quick = items => `<div class="dsh__sec"><div class="dsh__head"><span class="dsh__lbl">Quick starts</span></div>` +
      `<div class="dsh__quick">${items.join('')}</div></div>`;
    const head = (lbl, linkText, onclick) =>
      `<div class="dsh__ch"><span class="dsh__lbl">${lbl}</span><span class="spacer"></span>` +
      `${linkText ? `<button class="dsh__link" onclick="${onclick}">${linkText} ${App.icon('arrow')}</button>` : ''}</div>`;
    const row = (icon, b, em, right, onclick) =>
      `<button class="dsh__row" onclick="${onclick}"><span class="dsh__rowic">${App.icon(icon)}</span>` +
      `<span class="dsh__rowm"><b>${App.esc(b)}</b><em>${App.esc(em)}</em></span>${right || ''}</button>`;
    const card = (lbl, linkText, linkClick, inner) =>
      `<div class="dsh__card">${head(lbl, linkText, linkClick)}<div class="dsh__cb">${inner}</div></div>`;
    const empty = msg => `<div class="dsh__empty">${msg}</div>`;
    const actPill = (text, kind) => App.ui.pill(text, kind);
    const actLink = text => `<span class="dsh__act">${text} ›</span>`;

    const SUBCOLORS = ['#3B54E8', '#2E8FD0', '#5E4D83', '#5FB53A', '#B77E12', '#3a7479'];
    const donut = (title, segs) => {
      const total = segs.reduce((s, x) => s + x.n, 0) || 1;
      const r = 52, C = 2 * Math.PI * r; let off = 0, arcs = '';
      segs.forEach(s => {
        const len = s.n / total * C;
        arcs += `<circle cx="66" cy="66" r="${r}" fill="none" stroke="${s.c}" stroke-width="15" ` +
          `stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 66 66)"/>`;
        off += len;
      });
      const leg = segs.map(s => `<div class="dsh__legi"><span class="dsh__sw" style="background:${s.c}"></span>` +
        `<span>${App.esc(s.label)}</span><b>${s.n}</b></div>`).join('');
      return `<div class="dsh__card">${head(title)}<div class="dsh__donut">` +
        `<div class="dsh__dc"><svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">${arcs}</svg>` +
        `<div class="dsh__dmid"><b>${total}</b><em>policies</em></div></div><div class="dsh__leg">${leg}</div></div></div>`;
    };

    const greet = sub => `<div class="dsh__greet"><div class="dsh__wash"></div><div class="dsh__gin">` +
      `<div class="dsh__chip"><span class="dot"></span>${App.esc(roleLabel)} · ${App.esc(scopeText)}</div>` +
      `<h1>${salut}, ${App.esc(fn)}</h1><p>${sub}</p></div></div>`;

    /* ---------- shared computed values ---------- */
    const activePolicies = App.activePoliciesInScope(u);
    const approvals = App.approvalsView.visibleRequests(u);
    const highAppr = approvals.filter(a => a.priority === 'High').length;

    const apprRow = a => {
      const p = App.policy(a.policy), by = App.emp(a.requestedBy);
      const title = (p ? p.name : a.policy) + ' — ' + a.change.field;
      const meta = a.id + ' · ' + (by ? by.name : 'unknown') + ' · ' + a.status;
      return row('branch', title, meta, actPill(a.priority, a.priority === 'High' ? 'red' : 'amber'), "App.navigate('approvals')");
    };

    /* ================= STAFF ================= */
    if (u.role === 'user') {
      const visible = App.visiblePolicies(u);
      const mine = DB.assessments.filter(a => a.status !== 'Draft' && visible.some(p => p.category === a.category));
      const TODAY = Date.parse('2026-06-21');
      const stateFor = a => {
        const sub = App.assessmentsView._subForUser(a.id, u.id);
        if (sub) return { t: sub.passed ? 'Passed' : 'Completed', k: sub.passed ? 'green' : 'amber' };
        const end = Date.parse(a.end);
        if (a.status === 'Completed' || (!isNaN(end) && end < TODAY)) return { t: 'Closed', k: 'gray' };
        return { t: 'Pending', k: 'amber', pending: true };
      };
      const pending = mine.filter(a => stateFor(a).pending).length;

      const assessRows = mine.length ? mine.map(a => {
        const s = stateFor(a);
        const right = s.pending ? actLink('Take test') : actPill(s.t, s.k);
        return row('clipboard', a.name, a.category + ' · pass ' + a.passing + '% · closes ' + a.end, right, "App.navigate('assessments')");
      }).join('') : empty('No assessments assigned right now.');

      const polRows = visible.map(p =>
        row(p.category === 'Compliance' ? 'shield' : 'file', p.name, p.category + ' · ' + p.sub + ' · ' + p.version,
          actLink('Ask'), `App.goAskHome('Summarize the ${p.name.replace(/'/g, "\\'")}')`)).join('');

      const suggest = App.suggestPrompts(u).slice(0, 3).map(s =>
        row('sparkles', s.q, '', actLink('Ask'), `App.goAskHome('${s.q.replace(/'/g, "\\'")}')`)).join('');

      return `<div class="page dsh">${greet('Your policies and assessments, all in one place.')}
        ${strip([
          stat('file', 'Policies you can access', visible.length, 'scoped to your role'),
          stat('clipboard', 'Assessments assigned', mine.length, mine.length ? 'across your categories' : 'none yet'),
          stat('clock', 'Pending', pending, pending ? 'action needed' : 'all caught up', pending ? 'warn' : 'up')
        ])}
        ${quick([
          qa('sparkles', 'Ask a question', 'Company brain', "App.navigate('home')", '', true),
          qa('clipboard', 'My assessments', pending ? pending + ' pending' : 'all done', "App.navigate('assessments')", pending || ''),
          qa('book', 'Browse policies', visible.length + ' available', "App.navigate('policies')"),
          qa('code', 'RuleSense AI', 'Read policy logic', "App.navigate('rulesense')")
        ])}
        <div class="dsh__cols">
          ${card('My assessments', 'View all', "App.navigate('assessments')", assessRows)}
          ${card('Your policies', 'Open Policies', "App.navigate('policies')", polRows)}
        </div>
        <div class="dsh__sec">${card('Suggested questions', 'Ask a question', "App.navigate('home')", suggest)}</div>
      </div>`;
    }

    /* ================= ADMIN / POLICY MANAGER ================= */
    const managed = App.managedEmployees(u).length;
    // regulatory gaps, computed from the passed user's scope (not global state) so the dashboard is self-contained:
    // mirror regulatoryView._inScope — admin sees every affected policy, a manager only ones in their categories.
    const regInScope = pid => { const p = App.policy(pid); return !!p && App.catEnabled(p.category) && (u.role === 'admin' || (u.categories || []).indexOf(p.category) >= 0); };
    const regChangeList = [];
    (DB.amendments || []).forEach(a => (a.changes || []).forEach(ch => { if (regInScope(ch.policyId)) regChangeList.push(ch); }));
    const regChanges = regChangeList.length;
    const regPidSeen = {}, regPolicies = [];
    regChangeList.forEach(ch => { if (!regPidSeen[ch.policyId]) { regPidSeen[ch.policyId] = 1; regPolicies.push(ch.policyId); } });
    const changesForPid = pid => regChangeList.filter(ch => ch.policyId === pid).length;

    // participation across non-draft assessments in scope
    const scopedAssess = DB.assessments.filter(a => a.status !== 'Draft' && (u.role === 'admin' || cats.indexOf(a.category) >= 0));
    const partTotal = scopedAssess.reduce((s, a) => s + a.participants, 0);
    const partDone = scopedAssess.reduce((s, a) => s + a.done, 0);
    const partPct = partTotal ? Math.round(partDone / partTotal * 100) : 0;

    const apprRows = approvals.length ? approvals.map(apprRow).join('') : empty('Nothing awaiting you.');

    // regulatory gaps grouped by affected policy, most-changed first
    const gapRows = regPolicies.map(pid => {
      const p = App.policy(pid), n = changesForPid(pid);
      return { pid, p, n };
    }).sort((a, b) => b.n - a.n);
    const gapList = gapRows.length ? gapRows.slice(0, 6).map(g =>
      row('alert', g.p ? g.p.name : g.pid, g.n + ' suggested change' + (g.n === 1 ? '' : 's'),
        actPill(g.n + ' change' + (g.n === 1 ? '' : 's'), 'amber'), "App.navigate('regulatory')")).join('')
      : empty('No regulatory gaps in your scope.');

    // policies donut — admin by category, manager by sub within their category
    let segs;
    if (u.role === 'admin') {
      const byCat = {};
      activePolicies.forEach(p => { byCat[p.category] = (byCat[p.category] || 0) + 1; });
      segs = Object.keys(byCat).map(name => ({
        label: name, n: byCat[name], c: ((DB.categories.find(c => c.name === name) || {}).color) || '#888'
      }));
    } else {
      const bySub = {};
      activePolicies.forEach(p => { bySub[p.sub] = (bySub[p.sub] || 0) + 1; });
      segs = Object.keys(bySub).map((sub, i) => ({ label: sub, n: bySub[sub], c: SUBCOLORS[i % SUBCOLORS.length] }));
    }
    const donutTitle = u.role === 'admin' ? 'Policies by category' : 'Your ' + (cats[0] || '') + ' policies';

    /* ----- ADMIN ----- */
    if (u.role === 'admin') {
      return `<div class="page dsh">${greet("Here's what needs your attention across the org.")}
        ${strip([
          stat('file', 'Active policies', activePolicies.length, 'across the org'),
          stat('branch', 'Pending approvals', approvals.length, highAppr ? highAppr + ' high priority' : 'none urgent', highAppr ? 'crit' : ''),
          stat('alert', 'Regulatory changes', regChanges, 'across ' + regPolicies.length + ' policies', regChanges ? 'warn' : ''),
          stat('clipboard', 'Assessment participation', partPct + '%', partDone + ' of ' + partTotal + ' completed', 'up'),
          stat('users', 'People', managed, 'org-wide')
        ])}
        ${quick([
          qa('plus', 'Publish a policy', 'New policy doc', "App.navigate('policies')"),
          qa('branch', 'Review approvals', 'maker-checker', "App.navigate('approvals')", approvals.length || ''),
          qa('alert', 'Regulatory review', regChanges + ' changes', "App.navigate('regulatory')"),
          qa('clipboard', 'New assessment', 'Test awareness', "App.navigate('assessments')"),
          qa('sparkles', 'Ask a question', 'Company brain', "App.navigate('home')", '', true)
        ])}
        <div class="dsh__cols">
          ${card('Pending approvals', 'View all ' + approvals.length, "App.navigate('approvals')", apprRows)}
          ${donut(donutTitle, segs)}
        </div>
        <div class="dsh__sec">${card('Regulatory gaps to review', 'Open Regulatory', "App.navigate('regulatory')", gapList)}</div>
      </div>`;
    }

    /* ----- POLICY MANAGER ----- */
    const isLending = cats.indexOf('Lending') >= 0;
    let fullSection;
    if (isLending) {
      const totalRej = DB.rejectionReasons.reduce((s, r) => s + r.count, 0);
      const top = DB.rejectionReasons.slice().sort((a, b) => b.count - a.count)[0];
      const gapNames = gapRows.slice(0, 5).map(g => (g.p ? g.p.name : g.pid) + ' ' + g.n).join(' · ');
      const riskRows =
        row('chart', 'Top rejection reason — ' + top.reason,
          top.count.toLocaleString() + ' of ' + totalRej.toLocaleString() + ' rejections (' + Math.round(top.count / totalRej * 100) + '%)',
          actPill('Risk', 'red'), "App.navigate('insightgen')") +
        row('chart', 'Simulated approval rate — Personal Loan',
          'Run the what-if on the 220-app test cohort', actLink('Simulate'), "App.navigate('insightgen')") +
        row('alert', 'Regulatory gaps — ' + (cats[0] || 'your scope'),
          gapNames || 'none open', actPill(regChanges + ' change' + (regChanges === 1 ? '' : 's'), 'amber'), "App.navigate('regulatory')");
      fullSection = card('Risk & regulatory snapshot', 'Open InsightGen', "App.navigate('insightgen')", riskRows);
    } else {
      fullSection = card('Regulatory gaps to review', 'Open Regulatory', "App.navigate('regulatory')", gapList);
    }

    return `<div class="page dsh">${greet(scopeText + ' policies, approvals and gaps in your scope.')}
      ${strip([
        stat('file', 'Active policies', activePolicies.length, App.visiblePolicies(u).length + ' viewable · ' + (cats[0] || '')),
        stat('branch', 'Awaiting you', approvals.length, 'you approve at L1', approvals.length ? 'warn' : 'up'),
        stat('alert', 'Regulatory changes', regChanges, 'across ' + regPolicies.length + ' policies', regChanges ? 'warn' : ''),
        stat('users', 'Your team', managed, (u.manages || []).join(' · ') || 'your team')
      ])}
      ${quick([
        qa('branch', 'Review approvals', 'awaiting you', "App.navigate('approvals')", approvals.length || ''),
        qa('alert', 'Regulatory review', regChanges + ' changes', "App.navigate('regulatory')"),
        qa('file', 'Edit a policy', (cats[0] || '') + ' docs', "App.navigate('policies')"),
        qa('code', 'RuleSense AI', 'Docs → rules', "App.navigate('rulesense')"),
        qa('sparkles', 'Ask a question', 'Company brain', "App.navigate('home')", '', true)
      ])}
      <div class="dsh__cols">
        ${card('Approvals awaiting you', 'View all ' + approvals.length, "App.navigate('approvals')", apprRows)}
        ${donut(donutTitle, segs)}
      </div>
      <div class="dsh__sec">${fullSection}</div>
    </div>`;
  }
});
