/* ============================================================
   agent.js - the agentic assistant (floating, company-wide).

   It does three things a plain chatbot can't:
     1. ACTS inside the platform - navigate, open a policy, run a what-if, raise a change,
        assign an assessment, upload a circular.
     2. ACTS on connected platforms - create a Jira issue, comment, post to Slack, add a
        Notion page, send mail - each gated by App.access (team bucket + per-user overrides)
        AND by whether that connector is actually connected.
     3. ASKS BEFORE IT GUESSES - when a request is ambiguous it renders a multiple-choice
        question (plus a free-text "something else") instead of picking for you.

   Every write action is PROPOSED first and only runs when you press Run, so nothing
   changes behind your back. Reads and answers stay permission-faithful via App.tara.answer.
   ============================================================ */
(function () {
  const App = window.App;
  const $ = s => document.querySelector(s);
  const esc = s => App.esc(String(s == null ? '' : s));

  /* ---------------- action registry ----------------
     scope: the connector scope required (null = native platform action governed by RBAC)
     fields: what the user will see before it runs
     run(a, user): performs it and returns a short result line */
  const ACTIONS = {
    navigate: {
      label: 'Open a module', icon: 'arrow', scope: null, instant: true,
      guard: (a, u) => App.canAccessView(a.args.route, u) ? '' : 'You do not have access to ' + a.args.label + '.',
      run(a) { App.agent.toggle(false); App.navigate(a.args.route); return 'Opened ' + a.args.label + '.'; }
    },
    open_policy: {
      label: 'Open a policy', icon: 'file', scope: null, instant: true,
      guard: (a, u) => App.canViewPolicy(App.policy(a.args.policyId), u) ? '' : 'That policy is outside your scope.',
      run(a) {
        const p = App.policy(a.args.policyId); App.agent.toggle(false);
        if (App.pdf && App.pdf.openFull) App.pdf.openFull('policy', a.args.policyId);
        else App.navigate('policies');
        return 'Opened ' + (p ? p.name : a.args.policyId) + '.';
      }
    },
    simulate: {
      label: 'Run a what-if', icon: 'chart', scope: null,
      guard: (a, u) => App.canViewPolicy(App.policy(a.args.policyId), u) ? '' : 'That policy is outside your scope.',
      run(a) {
        const ov = {}; if (a.args.cibil) ov.minCibil = a.args.cibil;
        App.agent.toggle(false);
        if (App.simView) App.simView.open(a.args.policyId, ov, 'Assistant what-if');
        const p = App.policy(a.args.policyId);
        return 'Simulated ' + (p ? p.name : a.args.policyId) + (a.args.cibil ? ' at a CIBIL cutoff of ' + a.args.cibil : '') + '.';
      }
    },
    upload_circular: {
      label: 'Upload a circular', icon: 'download', scope: null, instant: true,
      guard: (a, u) => App.canAccessView('regulatory', u) ? '' : 'Uploading circulars is for administrators and policy managers.',
      run() { App.agent.toggle(false); App.navigate('regulatory'); setTimeout(() => { if (App.regulatoryView) App.regulatoryView.uploadModal(); }, 260); return 'Opened the circular upload.'; }
    },
    raise_change: {
      label: 'Raise a policy change', icon: 'branch', scope: 'policyos.create_approval',
      guard: (a, u) => App.canEditPolicy(App.policy(a.args.policyId), u) ? '' : 'You cannot change that policy - it is outside the categories you own.',
      run(a, user) {
        const p = App.policy(a.args.policyId);
        const wf = (DB.workflows || []).find(w => p && w.category === p.category) || null;
        DB.approvals.unshift({
          id: 'REQ-' + (3000 + DB.approvals.length), name: (p ? p.name : a.args.policyId) + ' - ' + a.args.field + ' → ' + a.args.to,
          type: 'Policy Change', policy: a.args.policyId, requestedBy: user.id, on: '27 Jul 2026', priority: 'Medium',
          status: 'Pending L' + (wf && wf.levels.length ? wf.levels[0].n : 1),
          change: { field: a.args.field, from: a.args.from || '(current)', to: a.args.to },
          rationale: 'Raised from the assistant by ' + user.name + '.', complianceFlag: null,
          workflowId: wf ? wf.id : null, workflow: wf ? wf.name : null
        });
        return 'Raised a change on ' + (p ? p.name : a.args.policyId) + ' - it is now Pending' + (wf ? ' in ' + wf.name : '') + '.';
      }
    },
    assign_assessment: {
      label: 'Assign an assessment', icon: 'clipboard', scope: 'policyos.assign_assessment',
      guard: (a, u) => App.canAccessView('assessments', u) ? '' : 'Assessments are not available to your role.',
      run(a) {
        const t = (DB.assessments || []).find(x => x.id === a.args.assessmentId);
        if (t) { t.status = 'Active'; t.participants = (t.participants || 0) + (a.args.count || 0); }
        return 'Assigned “' + (t ? t.name : a.args.assessmentId) + '” to ' + a.args.teamLabel + ' (' + (a.args.count || 0) + ' people).';
      }
    },
    jira_create: {
      label: 'Create a Jira issue', icon: 'branch', scope: 'jira.create_issue',
      run(a, user) {
        let max = 0;   // next free number IN THAT PROJECT, so keys never collide
        (DB.jiraIssues || []).forEach(i => { if (i.project === a.args.project) { const n = parseInt(String(i.key).split('-')[1], 10); if (!isNaN(n) && n > max) max = n; } });
        const key = a.args.project + '-' + (max + 1);
        DB.jiraIssues.unshift({ key: key, title: a.args.title, assignee: user.id, project: a.args.project, status: 'Backlog', sprint: 'Sprint 25', updated: 'just now' });
        return 'Created ' + key + ' in ' + a.args.project + ' - “' + a.args.title + '”.';
      }
    },
    jira_comment: {
      label: 'Comment on a Jira issue', icon: 'chat', scope: 'jira.comment',
      run(a) { return 'Commented on ' + a.args.key + '.'; }
    },
    slack_post: {
      label: 'Post to Slack', icon: 'chat', scope: 'slack.post_message',
      run(a) { return 'Posted to ' + a.args.channel + '.'; }
    },
    notion_page: {
      label: 'Create a Notion page', icon: 'book', scope: 'notion.create_page',
      run(a) { return 'Created the Notion page “' + a.args.title + '”.'; }
    },
    mail_send: {
      label: 'Send an email', icon: 'mail', scope: 'gmail.send_mail',
      run(a) { return 'Sent mail to ' + a.args.to + '.'; }
    }
  };

  /* ---------------- read helpers over connected sources (scope-gated) ---------------- */
  function leaveToday(user) {
    if (!App.access.usable(user, 'keka.read_leave')) return null;
    const out = (DB.employees || []).filter(e => e.presence === 'leave');
    return { html: `<p><strong>${out.length}</strong> ${out.length === 1 ? 'person is' : 'people are'} on leave today.</p>`
      + (out.length ? `<div class="src-row" style="margin-top:6px">${out.slice(0, 8).map(e => `<span class="src-chip">${esc(e.name)} · ${esc(e.team)}</span>`).join('')}</div>` : ''),
      sources: [{ kind: 'hrms', label: 'Keka HRMS · attendance' }] };
  }
  function jiraFor(user, raw) {
    if (!App.access.usable(user, 'jira.read_issues')) return null;
    const emp = App.empByName(raw);
    const list = (DB.jiraIssues || []).filter(i => (emp ? i.assignee === emp.id : i.status === 'In Progress')).slice(0, 6);
    if (!list.length) return null;
    return { html: `<p>${emp ? esc(emp.name) + ' is working on' : 'In progress right now'}:</p>`
      + `<div style="margin-top:6px">${list.map(i => `<div class="act__ln"><em>${esc(i.key)}</em><span>${esc(i.title)}</span></div>`).join('')}</div>`,
      sources: [{ kind: 'jira', label: 'Jira' }] };
  }

  /* ---------------- intent planning ---------------- */
  function policyMatch(q, user) {
    const vis = App.visiblePolicies(user);
    const hit = vis.find(p => q.indexOf(p.name.toLowerCase()) >= 0)
      || (q.match(/personal loan|\bpl\b/) && vis.find(p => p.id === 'P-PL'))
      || (q.match(/two.?wheeler/) && vis.find(p => p.id === 'P-2W'))
      || (q.match(/home loan/) && vis.find(p => p.id === 'P-HL'))
      || (q.match(/msme/) && vis.find(p => p.id === 'P-MSME'))
      || (q.match(/kyc|aml/) && vis.find(p => p.id === 'P-KYC'))
      || (q.match(/leave/) && vis.find(p => p.id === 'P-LEAVE'))
      || (q.match(/travel|expense/) && vis.find(p => p.id === 'P-TRAVEL'))
      || (q.match(/security|infosec/) && vis.find(p => p.id === 'P-ISEC'));
    return hit || null;
  }
  const ROUTES = [
    { k: ['dashboard'], route: 'dashboard', label: 'Dashboard' },
    { k: ['approval'], route: 'approvals', label: 'Approvals' },
    { k: ['governance', 'regulatory', 'circular'], route: 'regulatory', label: 'Governance Hub' },
    { k: ['policies', 'policy library'], route: 'policies', label: 'Policies' },
    { k: ['assessment'], route: 'assessments', label: 'Assessments' },
    { k: ['rulesense', 'rules'], route: 'rulesense', label: 'RuleSense AI' },
    { k: ['insight', 'sql'], route: 'insightgen', label: 'InsightGen' },
    { k: ['connector', 'integration'], route: 'connectors', label: 'Connectors' },
    { k: ['user', 'access', 'permission'], route: 'usersaccess', label: 'Users & access' }
  ];

  function plan(raw, user) {
    const q = ' ' + raw.toLowerCase().trim() + ' ';
    // whole-word matching: 'file' must not fire inside "profile", 'open' inside "reopen".
    // symbols (like '#') fall back to a plain substring test.
    const has = (...w) => w.some(x => {
      const t = String(x).trim(); if (!t) return false;
      if (!/^[a-z0-9]/i.test(t)) return q.indexOf(t) >= 0;
      const e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('(^|[^a-z0-9])' + e + '([^a-z0-9]|$)', 'i').test(q);
    });
    // a question with no explicit value is a QUESTION, not an instruction to change something
    const interrogative = /^\s*(what|how|why|when|who|which|where|is|are|does|do|can|could|should)\b/i.test(raw);
    const hasNumber = /\d/.test(raw);
    const wantsAction = has('create ', 'raise ', 'open ', 'go to', 'take me', 'navigate', 'post ', 'send ', 'assign ', 'upload ', 'file ', 'add ', 'comment', 'simulate', 'what if', 'tell ', 'message ', 'draft ');

    /* --- Jira issue creation: needs a project → clarify --- */
    if (has('jira', 'ticket', 'issue') && has('create ', 'raise ', 'file ', 'add ', 'open a ')) {
      const m = raw.match(/(?:called|titled|for|about|:)\s*["“]?([^"”]{4,80})/i);
      const title = m ? m[1].trim().replace(/\s+$/, '') : 'Follow-up from the assistant';
      const proj = (DB.jiraProjects || []).find(p => q.indexOf(p.key.toLowerCase()) >= 0 || q.indexOf(p.name.toLowerCase()) >= 0);
      if (!proj) return { clarify: {
        q: 'Which project should the issue go in?',
        opts: (DB.jiraProjects || []).slice(0, 4).map(p => ({ label: p.key, desc: p.name, follow: 'create a jira issue in ' + p.key + ' called ' + title })) } };
      return { action: { type: 'jira_create', args: { project: proj.key, title: title },
        fields: [['Project', proj.key + ' · ' + proj.name], ['Summary', title], ['Assignee', user.name]] } };
    }
    /* --- Slack --- */
    if (has('slack', 'channel', '#') && has('post ', 'send ', 'tell ', 'message ', 'draft ')) {
      const ch = (raw.match(/#([a-z0-9_-]+)/i) || [])[1];
      const m = raw.match(/(?:saying|that|:)\s*["“]?([^"”]{3,140})/i);
      const text = m ? m[1].trim() : 'Heads-up from PolicyOS.';
      if (!ch) return { clarify: {
        q: 'Which Slack channel?',
        opts: [{ label: '#compliance', desc: 'Compliance team', follow: 'post to slack #compliance saying ' + text },
               { label: '#credit-risk', desc: 'Credit & risk', follow: 'post to slack #credit-risk saying ' + text },
               { label: '#general', desc: 'Everyone', follow: 'post to slack #general saying ' + text }] } };
      return { action: { type: 'slack_post', args: { channel: '#' + ch, text: text }, fields: [['Channel', '#' + ch], ['Message', text]] } };
    }
    /* --- Notion --- */
    if (has('notion') && has('create', 'add', 'draft', 'new') && !(interrogative && !hasNumber)) {
      const m = raw.match(/(?:called|titled|page|:)\s*["“]?([^"”]{4,80})/i);
      const title = m ? m[1].trim() : 'Untitled from PolicyOS';
      return { action: { type: 'notion_page', args: { title: title }, fields: [['Title', title], ['Space', 'TartanHQ']] } };
    }
    /* --- email: only ever an address the user actually typed (never guess a recipient) --- */
    if (has('email', 'mail ') && has('send ', 'draft ')) {
      const addr = (raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0];
      if (!addr) {
        const named = (DB.employees || []).filter(e => q.indexOf(' ' + e.name.toLowerCase() + ' ') >= 0 || q.indexOf(e.name.toLowerCase()) >= 0).slice(0, 3);
        const opts = (named.length ? named : (DB.employees || []).slice(0, 3)).map(e => ({ label: e.name, desc: e.email, follow: 'send an email to ' + e.email }));
        return { clarify: { q: 'Who exactly should this go to?', opts: opts } };
      }
      return { action: { type: 'mail_send', args: { to: addr }, fields: [['To', addr], ['From', user.email || user.name]] } };
    }
    /* --- raise a policy change: never invent the new value, and require EDIT rights --- */
    if (has('raise', 'change', 'amend', 'tighten', 'loosen') && has('policy', 'cibil', 'foir', 'ltv', 'cutoff')
        && !has('what if', 'simulate', 'impact') && !(interrogative && !hasNumber)) {
      const p = policyMatch(q, user);
      if (!p) return { clarify: { q: 'Which policy should I raise the change on?',
        opts: App.visiblePolicies(user).filter(x => App.canEditPolicy(x, user)).slice(0, 4).map(x => ({ label: x.name, desc: x.category + ' · ' + x.version, follow: raw + ' on ' + x.name })) } };
      if (!App.canEditPolicy(p, user)) return { denied: 'You can read ' + p.name + ' but not change it - only an owner of the ' + p.category + ' category can raise an amendment.' };
      const field = has('foir') ? 'Max FOIR' : has('ltv') ? 'Max LTV' : 'Minimum CIBIL score';
      const cur = (p.facts || {})[field];
      const pct = (raw.match(/(\d{1,3}(?:\.\d+)?)\s*%/) || [])[1];
      const plain = (raw.match(/\bto\s+(\d{2,3}(?:\.\d+)?)\b/i) || [])[1];
      let to = null;
      if (field === 'Minimum CIBIL score') { const n = pct ? null : (plain ? parseInt(plain, 10) : null); if (n && n >= 300 && n <= 900) to = String(n); }
      else { const n = pct != null ? parseFloat(pct) : (plain ? parseFloat(plain) : null); if (n != null && !isNaN(n) && n > 0 && n <= 100) to = n + '%'; }
      if (!to) {                                                   // ask rather than guess
        const sugg = field === 'Minimum CIBIL score' ? ['720', '740', '750'] : field === 'Max FOIR' ? ['50%', '45%', '40%'] : ['85%', '80%', '75%'];
        const verb = field === 'Max FOIR' ? 'foir' : field === 'Max LTV' ? 'ltv' : 'cibil';
        return { clarify: { q: 'What should ' + field + ' change to?' + (cur ? ' (currently ' + cur + ')' : ''),
          opts: sugg.map(v => ({ label: v, desc: cur ? 'from ' + cur : '', follow: 'raise a change on ' + p.name + ' ' + verb + ' to ' + v })) } };
      }
      return { action: { type: 'raise_change', args: { policyId: p.id, field: field, to: to, from: cur },
        fields: [['Policy', p.name], ['Field', field], ['New value', (cur ? cur + ' → ' : '') + to], ['Workflow', ((DB.workflows || []).find(w => w.category === p.category) || {}).name || 'category default']] } };
    }
    /* --- assessments: use the one they named, else ask --- */
    const namedAssess = (DB.assessments || []).find(x => q.indexOf(x.name.toLowerCase()) >= 0);
    if (has('assign') && (has('assessment', 'test', 'quiz') || namedAssess)) {
      const list = (DB.assessments || []);
      const t = namedAssess || list.find(x => x.category && q.indexOf(x.category.toLowerCase()) >= 0);
      const team = (DB.teams || []).find(x => q.indexOf(x.name.toLowerCase()) >= 0);
      if (!t) return { clarify: { q: 'Which assessment should I assign?',
        opts: list.slice(0, 4).map(x => ({ label: x.name, desc: x.category + ' · pass ' + x.passing + '%', follow: 'assign the ' + x.name + (team ? ' to ' + team.name : '') })) } };
      if (!team) return { clarify: { q: 'Which team should take it?',
        opts: (DB.teams || []).slice(0, 4).map(x => ({ label: x.name, desc: App.access.teamMembers(x.name).length + ' people', follow: 'assign the ' + t.name + ' to ' + x.name })) } };
      return { action: { type: 'assign_assessment', args: { assessmentId: t.id, teamLabel: team.name, count: App.access.teamMembers(team.name).length },
        fields: [['Assessment', t.name], ['Team', team.name], ['People', String(App.access.teamMembers(team.name).length)]] } };
    }
    /* --- what-if --- */
    if (has('what if', 'simulate', 'impact of')) {
      const p = policyMatch(q, user) || App.visiblePolicies(user).find(x => App.sim && App.sim.paramsFor(x.id));
      if (p && App.sim && App.sim.paramsFor(p.id)) {
        const num = (raw.match(/\b(6\d\d|7\d\d|8\d\d)\b/) || [])[1];
        return { action: { type: 'simulate', args: { policyId: p.id, cibil: num ? parseInt(num, 10) : null },
          fields: [['Policy', p.name], ['Change', num ? 'CIBIL cutoff → ' + num : 'current parameters'], ['Cohort', '220 test applications']] } };
      }
    }
    /* --- upload a circular --- */
    if (has('upload') && has('circular', 'regulation', 'rbi', 'sebi')) return { action: { type: 'upload_circular', args: {}, fields: [['Module', 'Governance Hub'], ['Mode', 'Manual upload (Phase 1)']] } };
    /* --- open a policy --- */
    if (has('open ', 'show me', 'pull up') && has('policy', 'loan', 'kyc', 'leave', 'travel')) {
      const p = policyMatch(q, user);
      if (p) return { action: { type: 'open_policy', args: { policyId: p.id }, fields: [['Policy', p.name], ['Version', p.version]] } };
    }
    /* --- navigate --- */
    if (has('go to', 'take me', 'open ', 'navigate', 'show ')) {
      const r = ROUTES.find(x => x.k.some(k => q.indexOf(k) >= 0));
      if (r && App.canAccessView(r.route, user)) return { action: { type: 'navigate', args: r, fields: [['Module', r.label]] } };
      if (r) return { denied: 'You do not have access to ' + r.label + '.' };
    }
    /* --- scope-gated reads over connected sources --- */
    if (has('on leave', 'who is out', 'out today')) { const r = leaveToday(user); if (r) return { answer: r }; }
    if (has('working on', 'jira', 'sprint', 'ticket')) { const r = jiraFor(user, raw); if (r) return { answer: r }; }

    /* --- ambiguous "do something" with no clear target --- */
    if (wantsAction && !policyMatch(q, user) && has('something', 'this', 'it ')) {
      return { clarify: { q: 'What would you like me to do?',
        opts: [{ label: 'Raise a policy change', desc: 'Into the maker-checker workflow', follow: 'raise a policy change' },
               { label: 'Create a Jira issue', desc: 'In one of your projects', follow: 'create a jira issue' },
               { label: 'Run a what-if', desc: 'Simulate a threshold change', follow: 'simulate a cibil change' }] } };
    }
    return null;   // fall through to permission-faithful Q&A
  }

  /* ---------------- the assistant ---------------- */
  const AG = {
    open: false,
    toggle(open) {
      AG.open = (open == null) ? !AG.open : open;
      const p = $('#chatPanel'); if (p) p.classList.toggle('open', AG.open);
      const f = $('#botFab'); if (f) f.classList.toggle('is-hidden', AG.open);
      if (AG.open) { AG.render(); setTimeout(() => { const i = $('#chatInput'); if (i) i.focus(); }, 120); }
    },
    reset() { App.state.chat = []; AG.render(); },

    /* --- floating launcher --- */
    renderFab() {
      if (!App.state.user || document.getElementById('botFab')) return;
      const b = document.createElement('button');
      b.id = 'botFab'; b.className = 'bot-fab'; b.title = 'Ask or act - the company assistant';
      b.innerHTML = App.icon('sparkles') + ' Ask anything';
      b.onclick = () => AG.toggle(true);
      document.body.appendChild(b);
    },
    _cleanup() { const f = document.getElementById('botFab'); if (f) f.remove(); },

    ask(text) {
      const inp = $('#chatInput');
      text = (text || (inp && inp.value) || '').trim(); if (!text) return;
      if (inp) inp.value = '';
      if (!App.state.chat) App.state.chat = [];
      App.state.chat.push({ role: 'user', text: text });
      const ph = { role: 'ai', typing: true };
      App.state.chat.push(ph); AG.render();

      const user = App.currentUser();
      let p = null; try { p = plan(text, user); } catch (e) { p = null; }

      // clarify / act synchronously (no model needed - it's a decision, not a generation)
      if (p && p.clarify) { Object.assign(ph, { typing: false, html: '<p>Before I run that - one thing:</p>', askq: { q: p.clarify.q, opts: p.clarify.opts, picked: null } }); AG.render(); return; }
      if (p && p.denied) { Object.assign(ph, { typing: false, html: '<p>' + esc(p.denied) + '</p>', sources: [{ kind: 'locked', label: 'Blocked by your role' }] }); AG.render(); return; }
      if (p && p.action) {
        const def = ACTIONS[p.action.type];
        const gWhy = def.guard ? def.guard(p.action, user) : '';
        const denied = (def.scope ? !App.access.usable(user, def.scope) : false) || !!gWhy;
        Object.assign(ph, { typing: false,
          html: '<p>' + (denied ? 'I can’t run this for you:' : 'Here’s what I’ll do - review and run it:') + '</p>',
          act: { type: p.action.type, args: p.action.args, fields: p.action.fields, scope: def.scope,
                 status: denied ? 'denied' : 'proposed',
                 why: denied ? (gWhy || App.access.denyReason(user, def.scope)) : '' } });
        AG.render(); return;
      }
      if (p && p.answer) { Object.assign(ph, { typing: false, html: p.answer.html, sources: p.answer.sources }); AG.render(); return; }

      // otherwise: permission-faithful Q&A
      App.tara.answer(text, user).then(r => { Object.assign(ph, { typing: false, html: r.html, sources: r.sources }); AG.render(); })
        .catch(e => { Object.assign(ph, { typing: false, html: '<p>' + esc(e && e.message || e) + '</p>', sources: [] }); AG.render(); });
    },

    /* --- clarifying question answered --- */
    pick(i, oi) {
      const m = (App.state.chat || [])[i]; if (!m || !m.askq) return;
      const opt = m.askq.opts[oi]; if (!opt) return;
      m.askq.picked = oi; AG.render();
      AG.ask(opt.follow || opt.label);
    },
    pickOther(i) {
      const el = document.getElementById('askqOther' + i); const v = el && el.value.trim();
      if (!v) return;
      const m = (App.state.chat || [])[i]; if (m && m.askq) m.askq.picked = -1;
      AG.render(); AG.ask(v);
    },

    /* --- run / cancel a proposed action --- */
    run(i) {
      const m = (App.state.chat || [])[i]; if (!m || !m.act || m.act.status !== 'proposed') return;
      const def = ACTIONS[m.act.type]; const user = App.currentUser();
      if (def.scope && !App.access.usable(user, def.scope)) { m.act.status = 'denied'; m.act.why = App.access.denyReason(user, def.scope); AG.render(); return; }
      const g = def.guard ? def.guard(m.act, user) : '';            // re-check RBAC at run time, not just at propose time
      if (g) { m.act.status = 'denied'; m.act.why = g; AG.render(); return; }
      let res = '';
      try { res = def.run(m.act, user) || 'Done.'; } catch (e) { m.act.status = 'denied'; m.act.why = String(e && e.message || e); AG.render(); return; }
      m.act.status = 'done'; m.act.result = res;
      if (App.regulatoryView && App.regulatoryView._log) { /* module audit trails stay owned by their module */ }
      AG.render();
      if (App.state.route && !def.instant) App.reload();
      App.toast(res, 'ok');
    },
    cancel(i) { const m = (App.state.chat || [])[i]; if (m && m.act) { m.act.status = 'cancelled'; AG.render(); } },

    /* --- painting --- */
    actHtml(m, i) {
      const a = m.act; const def = ACTIONS[a.type]; const st = a.status;
      const head = st === 'done' ? [App.icon('check'), 'Done'] : st === 'denied' ? [App.icon('lock'), 'Not permitted'] : st === 'cancelled' ? [App.icon('x'), 'Cancelled'] : [App.icon('zap'), 'Proposed action'];
      const tool = a.scope ? `<span class="act__tool">${App.conn.logo(App.access.connOf(a.scope), 12)} ${esc(a.scope)}</span>` : `<span class="act__tool">${App.icon('shield')} platform</span>`;
      return `<div class="act ${st === 'done' ? 'is-done' : st === 'denied' ? 'is-denied' : ''}">
        <div class="act__h">${head[0]}<b>${head[1]}</b><div style="flex:1"></div>${tool}</div>
        <div class="act__b">
          <div class="act__ln"><em>Action</em><span>${esc(def.label)}</span></div>
          ${(a.fields || []).map(f => `<div class="act__ln"><em>${esc(f[0])}</em><span>${esc(f[1])}</span></div>`).join('')}
          ${st === 'done' && a.result ? `<div class="act__ln"><em>Result</em><span>${esc(a.result)}</span></div>` : ''}
        </div>
        ${a.why ? `<div class="act__why">${App.icon('lock')}<span>${esc(a.why)}</span></div>` : ''}
        ${st === 'proposed' ? `<div class="act__f"><span class="muted" style="font-size:11.5px">${def.scope ? 'Runs in the connected tool' : 'Runs in PolicyOS'}</span><div class="spacer"></div>
          <button class="btn btn--sm" onclick="App.agent.cancel(${i})">Cancel</button>
          <button class="btn btn--sm btn--primary" onclick="App.agent.run(${i})">${App.icon('zap')} Run</button></div>` : ''}
      </div>`;
    },
    askqHtml(m, i) {
      const k = m.askq; const answered = k.picked != null;
      return `<div class="askq ${answered ? 'is-answered' : ''}">
        <div class="askq__h">${App.icon('info')}<b>Needs your call</b></div>
        <div class="askq__q">${esc(k.q)}</div>
        <div class="askq__opts">${k.opts.map((o, oi) => `<button class="askq__opt ${k.picked === oi ? 'is-picked' : ''}" ${answered ? 'disabled' : ''} onclick="App.agent.pick(${i},${oi})">
          ${App.icon(k.picked === oi ? 'check' : 'arrow')}<div><b>${esc(o.label)}</b>${o.desc ? `<span>${esc(o.desc)}</span>` : ''}</div></button>`).join('')}</div>
        ${answered ? '' : `<div class="askq__other"><input id="askqOther${i}" placeholder="Something else…" onkeydown="if(event.key==='Enter'){event.preventDefault();App.agent.pickOther(${i});}"/>
          <button class="btn btn--sm" onclick="App.agent.pickOther(${i})">Send</button></div>`}
      </div>`;
    },
    render() {
      const body = $('#chatBody'); if (!body) return;
      const chat = App.state.chat || [];
      if (!chat.length) {
        const u = App.currentUser(); const reach = App.access.reach(u);
        const sug = (App.suggestPrompts(u) || []).slice(0, 3);
        body.innerHTML = `<div style="text-align:center;padding:10px 4px 4px">
            <div style="width:46px;height:46px;border-radius:13px;background:var(--h-grad);display:grid;place-items:center;margin:0 auto 12px;color:#fff">${App.icon('sparkles')}</div>
            <b style="font-size:15px;display:block">Ask, or tell me to do it</b>
            <p class="muted" style="font-size:12.5px;margin-top:5px;line-height:1.5">I answer from what <em>you</em> can see, and I can act in PolicyOS and your connected tools - always showing you the action first.</p>
            <div class="brainsrc" style="justify-content:center">${reach.length ? reach.slice(0, 6).map(r => `<span class="brainsrc__i">${App.conn.logo(r.id, 12)} ${esc(r.name)}</span>`).join('') : `<span class="brainsrc__i">${App.icon('shield')} Policies</span>`}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:7px;margin-top:14px">
            ${sug.map(s => `<button class="chat-suggest__btn" onclick="App.agent.ask('${String(s.q).replace(/'/g, "\\'")}')">${App.icon(s.ic || 'sparkles')}<span style="flex:1;text-align:left">${esc(s.q)}</span></button>`).join('')}
            <button class="chat-suggest__btn" onclick="App.agent.ask('create a jira issue')">${App.icon('branch')}<span style="flex:1;text-align:left">Create a Jira issue</span><span class="tag">action</span></button>
            <button class="chat-suggest__btn" onclick="App.agent.ask('who is on leave today')">${App.icon('users')}<span style="flex:1;text-align:left">Who's on leave today?</span><span class="tag">HRMS</span></button>
          </div>`;
        return;
      }
      body.innerHTML = chat.map((m, i) => {
        if (m.role === 'user') return `<div class="msg msg--user"><div class="msg__bubble" style="max-width:80%">${esc(m.text)}</div></div>`;
        if (m.typing) return `<div class="msg msg--ai"><div class="msg__av">${App.icon('sparkles')}</div><div class="msg__bubble"><div class="typing"><span></span><span></span><span></span></div></div></div>`;
        const src = (m.sources && m.sources.length) ? `<div class="src-row">${m.sources.map(s => { const ic = { hrms: 'users', jira: 'branch', policy: 'shield', locked: 'lock', llm: 'sparkles' }[s.kind] || 'database'; return `<span class="src-chip ${esc(s.kind)}">${App.icon(ic)} ${esc(s.label)}</span>`; }).join('')}</div>` : '';
        return `<div class="msg msg--ai"><div class="msg__av">${App.icon('sparkles')}</div><div class="msg__bubble" style="max-width:88%">${m.html || ''}${m.act ? AG.actHtml(m, i) : ''}${m.askq ? AG.askqHtml(m, i) : ''}${src}</div></div>`;
      }).join('');
      body.scrollTop = body.scrollHeight;
    },
    _actions: ACTIONS,
    _plan: plan
  };

  App.agent = AG;
  App.chat = AG;    // the shell's panel markup + cmd palette call App.chat.*
})();
