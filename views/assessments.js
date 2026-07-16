/* Assessments - policy-awareness testing (RBAC-aware: managers create & manage; staff see "My Assessments") */
App.registerView('assessments', {
  title(ctx) { return (ctx.user.role === 'user') ? 'My Assessments' : 'Assessments'; },
  render(ctx) {
    const u = ctx.user;
    const isManager = u.role === 'policy_manager' || u.role === 'admin';

    /* ---------- Staff "My Assessments" (simplified) ---------- */
    if (!isManager) {
      // only show assessments whose category the user can actually access (no Lending quiz for a denied staffer)
      const mine = DB.assessments.filter(a => a.status !== 'Draft' && App.visiblePolicies(u).some(p => p.category === a.category));
      const TODAY = Date.parse('2026-06-21');
      // state: a real submission wins; else Closed if past its window/completed; else Pending (takeable)
      const stateFor = (a) => {
        const sub = App.assessmentsView._subForUser(a.id, u.id);
        if (sub) return { label: sub.passed ? 'Passed' : 'Completed', kind: sub.passed ? 'green' : 'amber', score: sub.score, real: true };
        const end = Date.parse(a.end);
        if (a.status === 'Completed' || (!isNaN(end) && end < TODAY)) return { label: 'Closed', kind: 'gray', score: null, closed: true };
        return { label: 'Pending', kind: 'amber', score: null };
      };
      const done = mine.filter(a => stateFor(a).real).length;
      const pending = mine.filter(a => stateFor(a).label === 'Pending').length;
      const cards = mine.map(a => {
        const s = stateFor(a);
        const cat = DB.categories.find(c => c.name === a.category);
        return `<div class="card card--pad" style="display:flex;gap:14px;align-items:flex-start">
          <div class="kpi__icon" style="background:${(cat && cat.color) || '#64748b'}1a;color:${(cat && cat.color) || '#64748b'};flex-shrink:0">${App.icon('clipboard')}</div>
          <div style="flex:1;min-width:0">
            <div class="row gap-8" style="flex-wrap:wrap"><b style="font-size:14px">${App.esc(a.name)}</b>${App.ui.pill(s.label, s.kind)}</div>
            <div class="muted" style="font-size:12.5px;margin-top:4px">${App.esc(a.category)} · Window ${a.start} – ${a.end} · Passing ${a.passing}%</div>
            ${s.score != null ? `<div class="muted" style="font-size:12.5px;margin-top:4px">Your score: <b style="color:var(--ink)">${s.score}%</b></div>` : ''}
          </div>
          <button class="btn ${s.real || s.closed ? '' : 'btn--primary'} btn--sm"${s.closed && !s.real ? ' disabled' : ` onclick="App.assessmentsView.take('${a.id}')"`}>${s.real ? App.icon('eye') + ' Review' : s.closed ? 'Closed' : App.icon('arrow') + ' Take test'}</button>
        </div>`;
      }).join('');

      return `<div class="page">
        <div class="page__head"><div><h1>My Assessments</h1><p>Policy-awareness checks assigned to you. Complete pending tests before their window closes.</p></div></div>
        <div class="grid grid-2" style="margin-bottom:22px">
          ${App.assessmentsHelpers.kpi('Completed', done, 'check', 'green', 'of ' + mine.length + ' assigned')}
          ${App.assessmentsHelpers.kpi('Pending', pending, 'clock', 'amber', pending ? 'action needed' : 'all caught up')}
        </div>
        ${mine.length ? `<div class="grid" style="gap:12px">${cards}</div>` : App.ui.empty('clipboard', 'No assessments assigned', 'Nothing requires your attention right now.')}
      </div>`;
    }

    /* ---------- Manager list view (category-scoped: admin = all, policy manager = their categories) ---------- */
    const scopedAssess = u.role === 'admin' ? DB.assessments : DB.assessments.filter(a => (u.categories || []).indexOf(a.category) >= 0);
    const totalDone = scopedAssess.reduce((s, a) => s + a.done, 0);
    const totalParticipants = scopedAssess.reduce((s, a) => s + a.participants, 0);
    const pendingCount = totalParticipants - totalDone;

    const rows = scopedAssess.map(a => `
      <tr class="clickable" data-name="${a.name.toLowerCase()}" data-status="${a.status}" onclick="App.assessmentsView.open('${a.id}')">
        <td><div class="cell-person">${App.icon('clipboard')}<div><div class="cell-strong">${App.esc(a.name)}</div><div class="muted" style="font-size:12px">${App.ui.pill(a.category, 'violet')}</div></div></div></td>
        <td class="muted">${a.start}</td>
        <td class="muted">${a.end}</td>
        <td><b>${a.passing}%</b></td>
        <td><div class="row gap-8"><b>${a.done}/${a.participants}</b>${App.assessmentsHelpers.progressBar(a.done, a.participants)}</div></td>
        <td>${App.ui.statusPill(a.status)}</td>
        <td onclick="event.stopPropagation()">
          <div class="row gap-6">
            <button class="btn btn--sm" onclick="App.assessmentsView.open('${a.id}')" title="View">${App.icon('eye')}</button>
            <button class="btn btn--sm btn--danger" onclick="App.assessmentsView.del('${a.id}')" title="Delete">${App.icon('trash')}</button>
          </div>
        </td>
      </tr>`).join('');

    return `<div class="page">
      <div class="page__head"><div><h1>Assessments</h1><p>Create and track policy-awareness tests. Assign by team or individual, set passing scores, and monitor completion.</p></div><div class="spacer"></div>
        <button class="btn btn--primary" onclick="App.assessmentsView.create()">${App.icon('plus')} Create new assessment</button></div>
      <div class="grid grid-4" style="margin-bottom:22px">
        ${App.assessmentsHelpers.kpi('Assignment done', totalDone, 'check', 'green', 'completions logged')}
        ${App.assessmentsHelpers.kpi('Assignment pending', pendingCount, 'clock', 'amber', 'awaiting completion')}
        ${App.assessmentsHelpers.kpi('Active assessments', scopedAssess.filter(a => a.status === 'Active').length, 'clipboard', 'blue', 'currently open')}
        ${App.assessmentsHelpers.kpi('Avg. passing bar', (scopedAssess.length ? Math.round(scopedAssess.reduce((s, a) => s + a.passing, 0) / scopedAssess.length) : 0) + '%', 'shield', 'violet', 'across all tests')}
      </div>
      <div class="toolbar">
        <div class="search-input">${App.icon('search')}<input id="asSearch" placeholder="Search assessments…"/></div>
        <select class="select" id="asStatus"><option value="">All status</option><option>Active</option><option>Draft</option><option>Completed</option></select>
      </div>
      ${scopedAssess.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Test name</th><th>Start</th><th>End</th><th>Passing</th><th>Participants</th><th>Status</th><th></th></tr></thead><tbody id="asBody">${rows}</tbody></table></div>` : App.ui.empty('clipboard', 'No assessments in your categories', 'Assessments on policies in your categories will appear here.')}
    </div>`;
  },
  mount(root, ctx) {
    const search = root.querySelector('#asSearch');
    if (!search) return; // staff view has no table
    const filter = () => {
      const q = (search.value || '').toLowerCase();
      const st = root.querySelector('#asStatus').value;
      root.querySelectorAll('#asBody tr').forEach(tr => {
        tr.style.display = (tr.dataset.name.includes(q) && (!st || tr.dataset.status === st)) ? '' : 'none';
      });
    };
    search.oninput = filter;
    root.querySelector('#asStatus').onchange = filter;
  }
});

/* ---------- namespaced helpers (avoid polluting global scope) ---------- */
App.assessmentsHelpers = {
kpi(label, val, icon, kind, sub) {
  const c = { green: 'var(--green-600)', amber: 'var(--amber-600)', blue: 'var(--blue-600)', violet: 'var(--violet-600)' }[kind] || 'var(--muted)';
  const bg = { green: 'var(--green-50)', amber: 'var(--amber-50)', blue: 'var(--blue-50)', violet: 'var(--violet-50)' }[kind] || 'var(--slate-50)';
  return `<div class="kpi"><div class="kpi__top"><span class="kpi__label">${App.esc(label)}</span><span class="kpi__icon" style="background:${bg};color:${c}">${App.icon(icon)}</span></div><div class="kpi__val">${App.esc(val)}</div><div class="kpi__sub muted">${App.esc(sub || '')}</div></div>`;
},
progressBar(done, total) {
  const pct = total ? Math.round(100 * done / total) : 0;
  return `<div style="flex:1;max-width:90px;height:8px;background:var(--surface-2);border:1px solid var(--line);border-radius:999px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--brand-600)"></div></div>`;
},

/* generate plausible MCQs for a category - deterministic, demo content */
questionsFor(a) {
  const bank = {
    Compliance: [
      { q: 'Within how many days must a Suspicious Transaction Report (STR) be filed after detection?', opts: ['24 hours', 'Within 7 days', 'Within 30 days', 'No deadline'], correct: 1 },
      { q: 'Which customers require Enhanced Due Diligence (EDD)?', opts: ['All retail customers', 'Politically Exposed Persons (PEPs)', 'Salaried customers only', 'Customers under ₹50k balance'], correct: 1 },
      { q: 'What is the mandatory authentication standard for system access under InfoSec policy?', opts: ['Password only', 'Multi-factor authentication (MFA)', 'IP whitelisting only', 'Biometric only'], correct: 1 }
    ],
    Lending: [
      { q: 'What is the minimum CIBIL score for a Personal Loan under current policy?', opts: ['650', '680', '700', '720'], correct: 2 },
      { q: 'Applications with FOIR above which threshold are referred to L2?', opts: ['45%', '50%', '55%', '60%'], correct: 2 },
      { q: 'What is the eligible age band for a Personal Loan applicant?', opts: ['21–55 years', '23–58 years', '25–60 years', '18–65 years'], correct: 1 }
    ],
    HR: [
      { q: 'How many privilege leave days are employees entitled to per year?', opts: ['12', '15', '18', '24'], correct: 2 },
      { q: 'A sick leave longer than how many consecutive days requires a medical certificate?', opts: ['1 day', '2 days', '5 days', '7 days'], correct: 1 },
      { q: 'Expenses above which amount require manager approval?', opts: ['₹2,000', '₹5,000', '₹10,000', 'Any amount'], correct: 1 }
    ],
    Others: [
      { q: 'Who owns the canonical version of a published policy in PolicyOS?', opts: ['Any staff member', 'The assigned policy owner', 'Finance team', 'External auditor'], correct: 1 },
      { q: 'When are policy access rules enforced by Tara?', opts: ['Only in the prompt', 'At retrieval time', 'Never', 'Only for admins'], correct: 1 }
    ]
  };
  return bank[a.category] || bank.Others;
}
};

App.assessmentsView = {
  /* ---------------- detail ---------------- */
  open(id) {
    const a = DB.assessments.find(x => x.id === id);
    if (!a) return;
    const qs = App.assessmentsHelpers.questionsFor(a);
    const state = { tab: 'questions' };

    const header = `<div class="row gap-8" style="margin-bottom:16px;flex-wrap:wrap">
      ${App.ui.statusPill(a.status)} ${App.ui.pill(a.category, 'violet')}
      <span class="muted" style="font-size:12px;align-self:center">${a.start} – ${a.end}</span></div>
      <div class="grid grid-4" style="margin-bottom:18px">
        ${App.assessmentsHelpers.kpi('Passing score', a.passing + '%', 'shield', 'violet', 'to clear')}
        ${App.assessmentsHelpers.kpi('Total questions', qs.length, 'clipboard', 'blue', 'multiple choice')}
        ${App.assessmentsHelpers.kpi('Participants', a.participants, 'users', 'blue', 'assigned')}
        ${App.assessmentsHelpers.kpi('Completed', a.done + '/' + a.participants, 'check', 'green', (a.participants ? Math.round(100 * a.done / a.participants) : 0) + '% done')}
      </div>`;

    const questionsTab = qs.map((item, i) => `
      <div class="card card--pad" style="margin-bottom:12px">
        <div class="row gap-8" style="align-items:flex-start"><span class="tag">Q${i + 1}</span><b style="font-size:14px;flex:1">${App.esc(item.q)}</b></div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
          ${item.opts.map((o, oi) => `<div class="minirow" style="border-bottom:none;padding:8px 12px;border:1px solid ${oi === item.correct ? '#bbf7d0' : 'var(--line)'};border-radius:10px;background:${oi === item.correct ? 'var(--green-50)' : 'var(--surface)'}">
            <span style="width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:${oi === item.correct ? 'var(--green-600)' : 'var(--line)'};color:${oi === item.correct ? '#fff' : 'var(--muted)'}">${String.fromCharCode(65 + oi)}</span>
            <span style="flex:1">${App.esc(o)}</span>
            ${oi === item.correct ? App.ui.pill('Correct Answer', 'green', false) : ''}
          </div>`).join('')}
        </div>
      </div>`).join('');

    // per-row actions: reminder (only for people who haven't completed) + single-row export
    const actionCell = (canRemind) => `<td onclick="event.stopPropagation()"><div class="row gap-6">
        <button class="btn btn--sm" ${canRemind ? `onclick="App.toast('Reminder sent (demo)')"` : 'disabled title="Already completed"'}>${App.icon('bell')} Remind</button>
        <button class="btn btn--sm btn--ghost" title="Export this result (CSV / Excel)" onclick="App.toast('Exporting user result (demo)')">${App.icon('download')}</button>
      </div></td>`;
    // real staff submissions first (highlighted), then synthesized history, then pending participants
    const subs = App.assessmentsView._subs(a.id);
    const subIds = new Set(subs.map(s => s.userId));
    const realRows = subs.map(s => { const e = App.emp(s.userId); const nm = e ? e.name : s.userId; const stt = s.passed ? 'passed' : 'failed';
      return `<tr data-user="${App.esc(nm.toLowerCase())}" data-status="${stt}" style="background:var(--brand-50)">
        <td><div class="cell-person">${e ? App.ui.avatar(e, 'sm') : ''}<span class="cell-strong">${App.esc(nm)}</span>${App.ui.pill('New', 'blue')}</div></td>
        <td class="muted">${App.esc(s.date)}</td>
        <td><b>${s.score}%</b></td>
        <td>${s.attempted}/${s.total}</td>
        <td>${App.ui.pill(s.passed ? 'Passed' : 'Failed', s.passed ? 'green' : 'red')}</td>
        ${actionCell(false)}
      </tr>`; }).join('');
    const synthCount = Math.max(0, (a.done || 0) - subs.length);
    const pool = DB.employees.filter(e => !subIds.has(e.id)).slice(0, synthCount);
    const synthRows = pool.map((e) => {
      const seed = (a.id + e.id).split('').reduce((x, c) => x * 31 + c.charCodeAt(0) | 0, 7);
      const score = 55 + (Math.abs(seed) % 46);
      const passed = score >= a.passing;
      const attempted = qs.length - (Math.abs(seed) % 2);
      const day = 1 + (Math.abs(seed) % 14);
      return `<tr data-user="${App.esc(e.name.toLowerCase())}" data-status="${passed ? 'passed' : 'failed'}">
        <td><div class="cell-person">${App.ui.avatar(e, 'sm')}<span class="cell-strong">${App.esc(e.name)}</span></div></td>
        <td class="muted">${String(day).padStart(2, '0')} Jun 2026</td>
        <td><b>${score}%</b></td>
        <td>${attempted}/${qs.length}</td>
        <td>${App.ui.pill(passed ? 'Passed' : 'Failed', passed ? 'green' : 'red')}</td>
        ${actionCell(false)}
      </tr>`;
    }).join('');
    const shown = new Set([].concat(Array.from(subIds), pool.map(e => e.id)));
    const pendingCount = Math.max(0, (a.participants || 0) - (a.done || 0));
    const pendPool = DB.employees.filter(e => !shown.has(e.id)).slice(0, Math.min(pendingCount, 8));
    const pendingRows = pendPool.map(e => `<tr data-user="${App.esc(e.name.toLowerCase())}" data-status="pending">
        <td><div class="cell-person">${App.ui.avatar(e, 'sm')}<span class="cell-strong">${App.esc(e.name)}</span></div></td>
        <td class="muted">-</td><td class="muted">-</td><td>0/${qs.length}</td>
        <td>${App.ui.pill('Pending', 'amber')}</td>
        ${actionCell(true)}
      </tr>`).join('');
    const resultRows = realRows + synthRows + pendingRows;
    const resultsTab = (a.done || subs.length || pendPool.length)
      ? `<div class="row gap-8" style="margin-bottom:12px">
           <div class="search-input" style="flex:1">${App.icon('search')}<input id="asResSearch" placeholder="Search by user name" oninput="App.assessmentsView._filterResults()"/></div>
           <select class="select" id="asResStatus" onchange="App.assessmentsView._filterResults()"><option value="">All statuses</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="pending">Pending</option></select>
           <button class="btn btn--sm" onclick="App.toast('Exporting results to CSV (demo)')">${App.icon('download')} Export</button>
         </div>
         <div class="table-wrap"><table class="tbl"><thead><tr><th>User name</th><th>Date</th><th>Score</th><th>Questions attempted</th><th>Status</th><th>Action</th></tr></thead><tbody id="asResRows">${resultRows}</tbody></table></div>`
      : App.ui.empty('chart', 'No submissions yet', 'Results will appear here once participants complete the test.');

    const renderTabs = (host) => {
      host.querySelector('#asTabBody').innerHTML = state.tab === 'questions' ? questionsTab : resultsTab;
      host.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === state.tab));
    };

    App.openModal({
      title: a.name, sub: a.category + ' · Passing ' + a.passing + '%', lg: true,
      body: `${header}
        <div class="tabs">
          <div class="tab is-active" data-tab="questions" onclick="App.assessmentsView._tab(this,'questions')">${App.icon('clipboard')} Questions</div>
          <div class="tab" data-tab="results" onclick="App.assessmentsView._tab(this,'results')">${App.icon('chart')} Results</div>
        </div>
        <div id="asTabBody">${questionsTab}</div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>
        ${a.status !== 'Completed' ? `<button class="btn btn--primary" onclick="App.assessmentsView.editSchedule('${a.id}')">${App.icon('calendar')} Edit dates &amp; score</button>` : ''}`
    });
    // store tab html + state for the tab switcher
    App.assessmentsView._detail = { state, questionsTab, resultsTab };
  },
  // edit end date + passing score (production allows this for ongoing / scheduled assessments)
  editSchedule(id) {
    const a = DB.assessments.find(x => x.id === id); if (!a) return;
    App.openModal({
      title: 'Edit schedule · ' + a.name, sub: 'Adjust the end date and passing score for this ' + a.status.toLowerCase() + ' assessment.',
      body: `<div class="grid grid-2">
          <div class="field"><label>End date</label><input class="input" type="date" value="2026-06-30"/></div>
          <div class="field"><label>Passing score (%)</label><input class="input" type="number" min="0" max="100" value="${a.passing}"/></div></div>
        <div class="info-banner" style="margin-bottom:0">${App.icon('info')} <span>Changing the passing score re-evaluates pass/fail for submissions already recorded.</span></div>`,
      footer: `<button class="btn" onclick="App.assessmentsView.open('${id}')">${App.icon('arrow')} Back</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('Schedule updated (demo)')">Save changes</button>`
    });
  },
  _filterResults() {
    const qs = ((document.getElementById('asResSearch') || {}).value || '').toLowerCase();
    const stv = (document.getElementById('asResStatus') || {}).value || '';
    document.querySelectorAll('#asResRows tr').forEach(tr => {
      tr.style.display = ((!qs || (tr.dataset.user || '').indexOf(qs) >= 0) && (!stv || tr.dataset.status === stv)) ? '' : 'none';
    });
  },
  _catOf(e) { try { const cs = App.usersAccessView._userCats(e, App.usersAccessView.provisioned(e.id)); return cs && cs.length ? cs[0] : ''; } catch (_) { return ''; } },
  _tab(el, tab) {
    const d = App.assessmentsView._detail; if (!d) return;
    d.state.tab = tab;
    document.querySelectorAll('.modal .tab').forEach(t => t.classList.toggle('is-active', t === el));
    document.getElementById('asTabBody').innerHTML = tab === 'questions' ? d.questionsTab : d.resultsTab;
  },

  del(id) {
    const a = DB.assessments.find(x => x.id === id);
    if (!a) return;
    App.openModal({
      title: 'Delete assessment?', sub: a.name,
      body: `<p>This will permanently remove <strong>${App.esc(a.name)}</strong> and all ${a.done} recorded submission${a.done === 1 ? '' : 's'}. This cannot be undone.</p>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--danger" onclick="App.closeModal();App.toast('Assessment deleted (demo)','warn')">${App.icon('trash')} Delete</button>`
    });
  },

  /* ---------------- staff: take an assessment (interactive, graded, recorded) ---------------- */
  _subs(id) { if (!App.state.assessmentSubs) App.state.assessmentSubs = {}; if (!App.state.assessmentSubs[id]) App.state.assessmentSubs[id] = []; return App.state.assessmentSubs[id]; },
  _subForUser(id, uid) { return (App.state.assessmentSubs && App.state.assessmentSubs[id] || []).find(s => s.userId === uid); },

  take(id) {
    const a = DB.assessments.find(x => x.id === id); if (!a) return;
    const existing = App.assessmentsView._subForUser(id, App.currentUser().id);
    if (existing) return App.assessmentsView._review(id, existing, false);
    const qs = App.assessmentsHelpers.questionsFor(a);
    const body = `<div class="info-banner">${App.icon('clipboard')} <span><strong>${qs.length} questions</strong> · passing ${a.passing}%. Choose one answer per question, then submit.</span></div>
      ${qs.map((item, i) => `<div class="card card--pad" style="margin-bottom:12px">
        <div class="row gap-8" style="align-items:flex-start"><span class="tag">Q${i + 1}</span><b style="font-size:14px;flex:1">${App.esc(item.q)}</b></div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
          ${item.opts.map((o, oi) => `<label class="minirow" style="border-bottom:none;padding:8px 12px;border:1px solid var(--line);border-radius:10px;cursor:pointer">
            <input type="radio" name="tq${i}" value="${oi}"/>
            <span style="width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;background:var(--surface-2);color:var(--muted)">${String.fromCharCode(65 + oi)}</span>
            <span style="flex:1">${App.esc(o)}</span>
          </label>`).join('')}
        </div></div>`).join('')}`;
    App.openModal({ title: a.name, sub: a.category + ' assessment · passing ' + a.passing + '%', lg: true, body,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.assessmentsView.submit('${id}')">${App.icon('check')} Submit answers</button>` });
  },
  submit(id) {
    const a = DB.assessments.find(x => x.id === id); if (!a) return;
    const u = App.currentUser();
    const qs = App.assessmentsHelpers.questionsFor(a);
    let correct = 0, answered = 0; const answers = [];
    qs.forEach((item, i) => {
      const sel = document.querySelector('input[name="tq' + i + '"]:checked');
      const pick = sel ? +sel.value : null;
      answers.push(pick); if (pick != null) answered++; if (pick === item.correct) correct++;
    });
    const score = Math.round(100 * correct / qs.length);
    const sub = { userId: u.id, score, correct, total: qs.length, attempted: answered, passed: score >= a.passing, answers, date: '21 Jun 2026' };
    const arr = App.assessmentsView._subs(id);
    const idx = arr.findIndex(s => s.userId === u.id);
    if (idx >= 0) arr[idx] = sub; else { arr.push(sub); a.done = Math.min(a.participants, a.done + 1); }
    App.assessmentsView._review(id, sub, true);
  },
  _review(id, sub, justSubmitted) {
    const a = DB.assessments.find(x => x.id === id); const qs = App.assessmentsHelpers.questionsFor(a);
    const head = `<div class="kpi" style="text-align:center;margin-bottom:18px"><div class="kpi__label">Your score</div>
      <div class="kpi__val" style="font-size:36px;color:${sub.passed ? 'var(--green-700)' : 'var(--red-700)'}">${sub.score}%</div>
      <div class="kpi__sub">${App.ui.pill(sub.passed ? 'Passed' : 'Did not pass', sub.passed ? 'green' : 'red')} · ${sub.correct}/${sub.total} correct · passing ${a.passing}%</div></div>`;
    const review = qs.map((item, i) => {
      const pick = sub.answers ? sub.answers[i] : null; const right = pick === item.correct;
      return `<div class="card card--pad" style="margin-bottom:10px">
        <div class="row gap-8" style="align-items:flex-start"><span class="tag">Q${i + 1}</span><b style="flex:1;font-size:13.5px">${App.esc(item.q)}</b>${App.ui.pill(right ? 'Correct' : 'Wrong', right ? 'green' : 'red')}</div>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">${item.opts.map((o, oi) => {
          const isC = oi === item.correct, isP = oi === pick;
          const bg = isC ? 'var(--green-50)' : (isP ? 'var(--red-50)' : 'var(--surface)');
          const bd = isC ? '#bcd3c2' : (isP ? '#e3c4bf' : 'var(--line)');
          return `<div class="minirow" style="border-bottom:none;padding:7px 10px;border:1px solid ${bd};border-radius:8px;background:${bg}"><span style="flex:1">${App.esc(o)}</span>${isC ? App.ui.pill('Correct', 'green') : (isP ? App.ui.pill('Your answer', 'red') : '')}</div>`;
        }).join('')}</div></div>`;
    }).join('');
    App.openModal({ title: (justSubmitted ? 'Submitted · ' : 'Your result · ') + a.name, sub: 'Graded instantly · recorded for your admin', lg: true,
      body: head + `<div class="login__label">Answer review</div>` + review,
      footer: `<button class="btn btn--primary" onclick="App.closeModal();App.navigate('assessments')">Done</button>` });
    if (justSubmitted) App.toast('Submitted - you scored ' + sub.score + '%', sub.passed ? 'ok' : 'warn');
  },

  /* ---------------- create wizard ---------------- */
  create() {
    App.state.assessments = {
      step: 1,
      details: { title: '', category: (DB.categories[0] && DB.categories[0].name) || '', desc: '', start: '', end: '', passing: 70 },
      method: null,            // 'ai' | 'csv' | 'manual'
      questions: [],           // manual builder questions
      selected: new Set()      // selected employee ids
    };
    App.navigate('assessments'); // ensure base view; then open wizard modal
    App.assessmentsView._renderWizard();
  },

  _steps() {
    const s = App.state.assessments.step;
    const names = ['Details', 'Questionnaire', 'User selection'];
    return `<div class="stepper">${names.map((n, i) => {
      const num = i + 1;
      const cls = num < s ? 'is-done' : num === s ? 'is-active' : '';
      return `${i ? '<div class="step__line"></div>' : ''}<div class="step ${cls}"><span class="step__num">${num < s ? App.icon('check') : num}</span>${n}</div>`;
    }).join('')}</div>`;
  },

  _renderWizard() {
    const st = App.state.assessments;
    let body, footer;

    if (st.step === 1) {
      const d = st.details;
      body = this._steps() + `
        <div class="field"><label>Assessment title <span class="req">*</span></label><input class="input" id="wzTitle" placeholder="e.g. KYC & AML Awareness - Q3" value="${App.esc(d.title)}"/></div>
        <div class="grid grid-2">
          <div class="field"><label>Product category <span class="req">*</span></label><select class="select" id="wzCat" style="width:100%">${DB.categories.map(c => `<option ${c.name === d.category ? 'selected' : ''}>${App.esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Passing percentage <span class="req">*</span></label><input class="input" id="wzPass" type="number" min="0" max="100" value="${d.passing}"/></div>
        </div>
        <div class="field"><label>Description</label><textarea class="textarea" id="wzDesc" placeholder="What this assessment covers…">${App.esc(d.desc)}</textarea></div>
        <div class="grid grid-2">
          <div class="field"><label>Start date & time <span class="req">*</span></label><input class="input" id="wzStart" type="datetime-local" value="${d.start}"/></div>
          <div class="field" style="margin-bottom:0"><label>End date & time <span class="req">*</span></label><input class="input" id="wzEnd" type="datetime-local" value="${d.end}"/></div>
        </div>`;
      footer = `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.assessmentsView._next1()">Save & continue ${App.icon('arrow')}</button>`;
    }

    else if (st.step === 2) {
      if (!st.method) {
        body = this._steps() + `
          <p class="muted" style="margin-bottom:16px">Choose how you'd like to build the questionnaire for <strong>${App.esc(st.details.title || 'this assessment')}</strong>.</p>
          <div class="grid grid-3">
            <button class="actioncard" onclick="App.assessmentsView._aiModal()"><span class="actioncard__ic" style="background:var(--teal-50);color:var(--teal-600)">${App.icon('sparkles')}</span><div><b>Create with AI</b><span>Generate questions from selected policies</span></div></button>
            <button class="actioncard" onclick="App.assessmentsView._csv()"><span class="actioncard__ic" style="background:var(--blue-50);color:var(--blue-600)">${App.icon('download')}</span><div><b>CSV upload</b><span>Import a prepared question bank</span></div></button>
            <button class="actioncard" onclick="App.assessmentsView._manual()"><span class="actioncard__ic" style="background:var(--violet-50);color:var(--violet-600)">${App.icon('edit')}</span><div><b>Add manually</b><span>Build questions one by one</span></div></button>
          </div>`;
        footer = `<button class="btn" onclick="App.assessmentsView._back()">${App.icon('arrow')} Back</button>`;
      } else if (st.method === 'manual') {
        body = this._steps() + this._manualBody();
        footer = `<button class="btn" onclick="App.assessmentsView._back()">${App.icon('arrow')} Back</button>
          <button class="btn btn--primary" onclick="App.assessmentsView._next2()">Save & continue ${App.icon('arrow')}</button>`;
      } else {
        // ai/csv produced a set - show summary
        body = this._steps() + `
          <div class="info-banner">${App.icon('check')} <span><strong>${st.questions.length} question${st.questions.length === 1 ? '' : 's'}</strong> ready via ${st.method === 'ai' ? 'AI generation' : 'CSV upload'}. You can switch method below.</span></div>
          ${st.questions.map((q, i) => `<div class="card card--pad" style="margin-bottom:10px"><div class="row gap-8" style="align-items:flex-start"><span class="tag">Q${i + 1}</span><b style="flex:1;font-size:13.5px">${App.esc(q.q)}</b></div></div>`).join('')}
          <button class="btn btn--ghost btn--sm mt-8" onclick="App.assessmentsView._resetMethod()">${App.icon('edit')} Choose a different method</button>`;
        footer = `<button class="btn" onclick="App.assessmentsView._back()">${App.icon('arrow')} Back</button>
          <button class="btn btn--primary" onclick="App.assessmentsView._next2()">Save & continue ${App.icon('arrow')}</button>`;
      }
    }

    else if (st.step === 3) {
      body = this._steps() + this._userBody();
      footer = `<button class="btn" onclick="App.assessmentsView._back()">${App.icon('arrow')} Back</button>
        <button class="btn btn--primary" onclick="App.assessmentsView._finish()">${App.icon('check')} Create assessment</button>`;
    }

    App.openModal({ title: 'Create new assessment', sub: 'Step ' + st.step + ' of 3', body, footer, lg: true });
    if (st.step === 3) this._wireUserSearch();
  },

  /* ---- step 1 ---- */
  _next1() {
    const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const title = g('wzTitle').trim();
    if (!title) { App.toast('Please enter a title', 'warn'); return; }
    const st = App.state.assessments;
    st.details = { title, category: g('wzCat'), desc: g('wzDesc'), start: g('wzStart'), end: g('wzEnd'), passing: Number(g('wzPass')) || 70 };
    st.step = 2;
    this._renderWizard();
  },

  /* ---- step 2: methods ---- */
  _aiModal() {
    const st = App.state.assessments;
    const vis = App.visiblePolicies(App.currentUser());
    App.openModal({
      title: 'Generate questions with AI', sub: 'Tara drafts MCQs from policies you can access.',
      body: `<div class="field"><label>Select policies <span class="req">*</span></label>
          <div style="max-height:200px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px">
          ${vis.length ? vis.map(p => `<label class="minirow" style="cursor:pointer"><input type="checkbox" class="aiPol" value="${p.id}" ${p.category === st.details.category ? 'checked' : ''}/><span style="flex:1">${App.esc(p.name)}</span><span class="tag">${App.esc(p.category)}</span></label>`).join('') : '<div class="muted" style="padding:8px">No accessible policies.</div>'}
          </div></div>
        <div class="field" style="margin-bottom:0"><label>Number of questions</label><input class="input" id="aiCount" type="number" min="1" max="20" value="5"/></div>`,
      footer: `<button class="btn" onclick="App.assessmentsView._renderWizard()">Cancel</button>
        <button class="btn btn--primary" onclick="App.assessmentsView._aiGo()">${App.icon('sparkles')} Generate</button>`
    });
  },
  _aiGo() {
    const n = Math.max(1, Math.min(20, Number((document.getElementById('aiCount') || {}).value) || 5));
    const picked = Array.from(document.querySelectorAll('.aiPol:checked')).map(c => c.value);
    if (!picked.length) { App.toast('Select at least one policy', 'warn'); return; }
    const st = App.state.assessments;
    // synthesize from the category bank, repeating to fill n
    const base = App.assessmentsHelpers.questionsFor({ category: st.details.category });
    st.questions = Array.from({ length: n }, (_, i) => base[i % base.length]);
    st.method = 'ai';
    App.toast(n + ' questions generated (demo)');
    this._renderWizard();
  },
  _csv() {
    const st = App.state.assessments;
    const base = App.assessmentsHelpers.questionsFor({ category: st.details.category });
    st.questions = base.slice();
    st.method = 'csv';
    App.toast(base.length + ' questions imported from CSV (demo)');
    this._renderWizard();
  },
  _manual() {
    const st = App.state.assessments;
    st.method = 'manual';
    if (!st.questions.length || st.questions._mode !== 'manual') {
      st.questions = [{ q: '', opts: ['', ''], correct: 0 }];
      st.questions._mode = 'manual';
    }
    this._renderWizard();
  },
  _resetMethod() { App.state.assessments.method = null; this._renderWizard(); },

  _manualBody() {
    const st = App.state.assessments;
    const blocks = st.questions.map((qq, qi) => `
      <div class="card card--pad" style="margin-bottom:12px">
        <div class="field" style="margin-bottom:10px"><label>Question ${qi + 1} <span class="req">*</span></label>
          <input class="input wzQ" data-qi="${qi}" placeholder="Type the question…" value="${App.esc(qq.q)}"/></div>
        <div class="login__label">Options · select the correct answer</div>
        ${qq.opts.map((o, oi) => `<div class="minirow" style="border-bottom:none;padding:6px 0">
          <input type="radio" name="correct-${qi}" class="wzCorrect" data-qi="${qi}" data-oi="${oi}" ${qq.correct === oi ? 'checked' : ''}/>
          <input class="input wzOpt" data-qi="${qi}" data-oi="${oi}" placeholder="Option ${String.fromCharCode(65 + oi)}" value="${App.esc(o)}" style="flex:1"/>
          ${qq.opts.length > 2 ? `<button class="btn btn--sm btn--danger" onclick="App.assessmentsView._delOpt(${qi},${oi})" title="Remove">${App.icon('x')}</button>` : ''}
        </div>`).join('')}
        <button class="btn btn--ghost btn--sm mt-8" onclick="App.assessmentsView._addOpt(${qi})">${App.icon('plus')} Add option</button>
      </div>`).join('');
    return `<p class="muted" style="margin-bottom:14px">Build multiple-choice questions. Mark one option per question as correct.</p>
      ${blocks}
      <button class="btn mt-8" onclick="App.assessmentsView._addQ()">${App.icon('plus')} Add question</button>`;
  },
  _syncManual() {
    const st = App.state.assessments;
    document.querySelectorAll('.wzQ').forEach(el => { st.questions[+el.dataset.qi].q = el.value; });
    document.querySelectorAll('.wzOpt').forEach(el => { st.questions[+el.dataset.qi].opts[+el.dataset.oi] = el.value; });
    document.querySelectorAll('.wzCorrect:checked').forEach(el => { st.questions[+el.dataset.qi].correct = +el.dataset.oi; });
  },
  _addQ() { this._syncManual(); App.state.assessments.questions.push({ q: '', opts: ['', ''], correct: 0 }); this._renderWizard(); },
  _addOpt(qi) { this._syncManual(); App.state.assessments.questions[qi].opts.push(''); this._renderWizard(); },
  _delOpt(qi, oi) {
    this._syncManual();
    const q = App.state.assessments.questions[qi];
    q.opts.splice(oi, 1);
    if (q.correct >= q.opts.length) q.correct = 0;
    this._renderWizard();
  },
  _next2() {
    const st = App.state.assessments;
    if (st.method === 'manual') {
      this._syncManual();
      const valid = st.questions.filter(q => q.q.trim() && q.opts.filter(o => o.trim()).length >= 2);
      if (!valid.length) { App.toast('Add at least one complete question', 'warn'); return; }
      st.questions = valid;
    }
    if (!st.questions.length) { App.toast('Add some questions first', 'warn'); return; }
    st.step = 3;
    this._renderWizard();
  },

  /* ---- step 3: user selection ---- */
  _userBody() {
    const st = App.state.assessments;
    const teamOpts = DB.teams.map(t => `<button class="btn btn--sm" onclick="App.assessmentsView._selectTeam('${App.esc(t.name).replace(/'/g, "\\'")}')">${App.icon('plus')} ${App.esc(t.name)}</button>`).join('');
    const list = DB.employees.map(e => { const cat = App.assessmentsView._catOf(e);
      return `
      <label class="minirow" data-n="${e.name.toLowerCase()}" style="cursor:pointer">
        <input type="checkbox" class="wzUser" value="${e.id}" ${st.selected.has(e.id) ? 'checked' : ''} onchange="App.assessmentsView._toggleUser('${e.id}',this.checked)"/>
        ${App.ui.avatar(e, 'sm')}
        <div style="flex:1"><b style="font-weight:600">${App.esc(e.name)}</b> <span class="muted" style="font-size:12px">· ${App.esc(e.title)}</span></div>
        ${cat ? `<span class="tag" style="color:var(--brand-600)">${App.esc(cat)}</span>` : ''}
        <span class="tag">${App.esc(e.team)}</span>
      </label>`; }).join('');
    return `<p class="muted" style="margin-bottom:12px">Assign this assessment to specific people, or add an entire team at once.</p>
      <div class="row wrap gap-6 mb-16">${teamOpts}</div>
      <div class="search-input" style="margin-bottom:12px"><input id="wzUserSearch" placeholder="Search people…"/></div>
      <div class="row gap-8 mb-8"><b id="wzCount">${st.selected.size}</b><span class="muted">selected</span><div class="spacer" style="flex:1"></div><button class="btn btn--ghost btn--sm" onclick="App.assessmentsView._clearUsers()">Clear all</button></div>
      <div id="wzUserList" style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px">${list}</div>`;
  },
  _wireUserSearch() {
    const s = document.getElementById('wzUserSearch');
    if (!s) return;
    s.oninput = () => {
      const q = s.value.toLowerCase();
      document.querySelectorAll('#wzUserList .minirow').forEach(r => { r.style.display = r.dataset.n.includes(q) ? '' : 'none'; });
    };
  },
  _toggleUser(id, on) {
    const st = App.state.assessments;
    if (on) st.selected.add(id); else st.selected.delete(id);
    const c = document.getElementById('wzCount'); if (c) c.textContent = st.selected.size;
  },
  _selectTeam(team) {
    const st = App.state.assessments;
    DB.employees.filter(e => e.team === team).forEach(e => st.selected.add(e.id));
    App.toast('Added ' + team + ' (' + DB.employees.filter(e => e.team === team).length + ')');
    this._renderWizard(); this._wireUserSearch();
  },
  _clearUsers() { App.state.assessments.selected.clear(); this._renderWizard(); this._wireUserSearch(); },

  _back() {
    const st = App.state.assessments;
    if (st.step === 2 && st.method) { st.method = null; this._renderWizard(); return; }
    st.step = Math.max(1, st.step - 1);
    this._renderWizard();
  },

  _finish() {
    const st = App.state.assessments;
    if (!st.selected.size) { App.toast('Select at least one participant', 'warn'); return; }
    const n = st.selected.size; const title = st.details.title || 'Untitled';
    App.openModal({
      title: 'Assignment scheduled', sub: '',
      body: `<div style="text-align:center;padding:8px 0">
          <div style="width:56px;height:56px;border-radius:50%;background:var(--green-50);color:var(--green-600);display:grid;place-items:center;margin:0 auto 14px">${App.icon('check')}</div>
          <h3 style="font-size:17px;margin-bottom:6px">“${App.esc(title)}” is scheduled</h3>
          <p class="muted" style="max-width:400px;margin:0 auto;line-height:1.6">${n} participant${n === 1 ? '' : 's'} will be notified when it opens (${App.esc(st.details.category)} · passing ${st.details.passing}%). Track completion any time from the assessments list.</p>
        </div>`,
      footer: `<button class="btn btn--primary" onclick="App.closeModal()">Done</button>`
    });
    App.state.assessments = null;
  }
};
