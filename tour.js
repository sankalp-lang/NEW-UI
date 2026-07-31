/* ============================================================
   PolicyOS - interactive guided tour
   One step per module the signed-in person can actually open, read straight off their
   sidebar. Each step OPENS that page and spotlights the part that matters on it, so the
   tour walks the real app rather than pointing at the nav. Nobody is shown a section
   their role cannot reach, and the page they started on is restored at the end.
   ============================================================ */
(function () {
  const App = window.App;
  const el = id => document.getElementById(id);

  const TOUR = {
    steps: [], i: 0,

    /* One step per module the signed-in person can actually reach, read straight off their
       sidebar, so nobody is shown a section they cannot open. Copy stays at 20-30 words. */
    COPY: {
      home:        'Ask a question in plain language. Answers come only from the policies and sources you are cleared to see, and every one is cited.',
      dashboard:   'Your daily overview: active policies, approvals waiting on you, open regulatory gaps and assessment progress, all scoped to the categories you own.',
      rulesense:   'Convert a policy document into structured rules, then generate business rule engine code your developers can use directly in origination.',
      approvals:   'Every policy change runs through maker-checker here, level by level on the workflow set for its category. Nobody can approve their own request.',
      regulatory:  'Upload a circular, check the rules extracted from it, then review the change each affected policy needs before routing it for approval.',
      bredecoder:  'Paste existing rule engine code and get clean documentation back in plain language. Useful when the original policy document has gone missing.',
      insightgen:  'Ask a data question in plain language. It writes the query, runs it, and explains what the result means for the portfolio.',
      policies:    'The library for every policy you can access, with version history and a side by side comparison showing exactly what changed.',
      assessments: 'Build policy awareness tests, assign them by team, and track completion and scores so you can show regulators the training actually happened.',
      usersaccess: 'Manage people, roles and reach. Access follows the categories someone owns, so a change here applies across search, answers and every module.',
      connectors:  'Connect Keka, Jira, Notion and Slack, then set which tools each team may use. The assistant can only act inside those limits.',
      category:    'Define the policy taxonomy. Categories drive access scoping and approval routing, so turning one off hides its policies for everyone straight away.'
    },
    COPY_STAFF: {
      assessments: 'Policy awareness checks assigned to you. Finish each one before its window closes, then review your score and the answers you missed.'
    },

    /* What to spotlight once the module is open, most relevant thing first.
       Several are role-dependent (a manager sees a table where staff see cards), so each
       module lists fallbacks and the first one present on the page wins. */
    ANCHOR: {
      home:        ['.homeask', '#homeInput'],
      dashboard:   ['.dsh__stats', '.dsh__quick', '.page__head'],
      rulesense:   ['#rsEditor', '.actioncard', '.grid.grid-2', '.card'],
      approvals:   ['.table-wrap', '.kpi', '.card'],
      regulatory:  ['.reg-polrow', '.reg-rel', '.reg-stats', '.card'],
      bredecoder:  ['#breCode', '#breDrop', '.card'],
      insightgen:  ['#igInput', '.card'],
      policies:    ['.table-wrap', '.card--pad', '.card'],
      assessments: ['.table-wrap', '.card--pad', '.kpi', '.card'],
      usersaccess: ['.table-wrap', '.card'],
      connectors:  ['.cn-card', '.grid', '.card'],
      category:    ['#catGrid', '.card']
    },

    stepsFor(u) {
      const m = App.navModel(u);
      const copyFor = id => (u.role === 'user' && TOUR.COPY_STAFF[id]) || TOUR.COPY[id] || '';
      // each module step OPENS its page, then points at the part that matters there
      const step = (it, group) => ({ route: it.id, sels: TOUR.ANCHOR[it.id] || ['.page__head'],
        group: group || null, title: it.label, body: copyFor(it.id) });
      const steps = [{ center: true, title: 'Welcome to PolicyOS', body: 'This walks through the sections your role can reach. It takes about a minute, and you can leave at any point.' }];
      m.pinned.forEach(it => steps.push(step(it, null)));
      m.groups.forEach(g => g.items.forEach(it => steps.push(step(it, g.title))));
      steps.push({ sel: '#botFab', title: 'The assistant', body: 'It sits on every page. Ask it anything, or tell it to do something. It shows the exact action and waits for your approval.' });
      steps.push({ finish: true, title: 'You are all set', body: 'That covers every section available to your role. You can start this tour again whenever you like from the button in the bottom left.' });
      return steps;
    },

    seen() { try { return localStorage.getItem('policyos_tour_seen') === '1'; } catch (e) { return false; } },
    _markSeen() { try { localStorage.setItem('policyos_tour_seen', '1'); } catch (e) {} },
    maybeAutostart() { if (!TOUR.seen() && App.state.user) setTimeout(function () { if (App.state.user) TOUR.start(); }, 700); },

    start() {
      if (!App.state.user) return;
      TOUR.steps = TOUR.stepsFor(App.state.user);
      TOUR.i = 0;
      TOUR._returnTo = App.state.route || 'home';   // the tour walks the app, so put them back after
      if (!el('tourLayer')) {
        const layer = document.createElement('div');
        layer.id = 'tourLayer'; layer.className = 'tour-layer';
        layer.innerHTML = '<div class="tour-dim" id="tourDim"></div><div class="tour-ring" id="tourRing"></div><div class="tour-pop" id="tourPop"></div>';
        document.body.appendChild(layer);
      }
      el('tourLayer').classList.add('show');
      window.addEventListener('resize', TOUR._reflow);
      TOUR.go(0);
    },
    _reflow() { const l = el('tourLayer'); if (l && l.classList.contains('show')) TOUR.go(TOUR.i); },
    // first anchor that actually exists on the open page (roles render different shapes)
    _target(s) {
      const list = s.sels || (s.sel ? [s.sel] : []);
      for (let k = 0; k < list.length; k++) { const found = document.querySelector(list[k]); if (found) return found; }
      return null;
    },

    go(i) {
      TOUR.i = Math.max(0, Math.min(TOUR.steps.length - 1, i));
      const s = TOUR.steps[TOUR.i];
      const ring = el('tourRing'), pop = el('tourPop'), dim = el('tourDim');
      if (!pop) return;
      const isLast = TOUR.i === TOUR.steps.length - 1;
      const dots = TOUR.steps.map((_, k) => `<button class="tour-dot ${k === TOUR.i ? 'cur' : (k < TOUR.i ? 'done' : '')}" onclick="App.tour.go(${k})"></button>`).join('');
      const nextAttr = isLast ? 'App.tour.end()' : 'App.tour.go(' + (TOUR.i + 1) + ')';
      pop.innerHTML = `<div class="tour-prog"><i style="width:${Math.round((TOUR.i + 1) / TOUR.steps.length * 100)}%"></i></div>
        <div class="tour-pop__b">
          <div class="tour-eyebrow">${App.icon('sparkles')} Tour · ${TOUR.i + 1} of ${TOUR.steps.length}</div>
          <button class="tour-x" onclick="App.tour.end()" aria-label="Close tour">${App.icon('x')}</button>
          <h4>${App.esc(s.title)}</h4><p>${s.body}</p>
          <div class="tour-foot">
            <div class="tour-dots">${dots}</div>
            <div class="row gap-8">
              ${TOUR.i > 0 ? `<button class="btn btn--sm" onclick="App.tour.go(${TOUR.i - 1})">Back</button>` : `<button class="skip" onclick="App.tour.end()">Skip</button>`}
              <button class="btn btn--sm btn--primary" onclick="${nextAttr}">${isLast ? 'Done' : 'Next'} ${isLast ? '' : App.icon('arrow')}</button>
            </div>
          </div>
        </div>`;

      // the centered cards read best against an unscrolled page
      if ((s.center || s.finish) && (window.scrollY || window.pageYOffset)) window.scrollTo(0, 0);
      // open the module this step is about, so the spotlight lands on the real page
      if (s.route && App.state.route !== s.route && App.canAccessView(s.route, App.state.user)) {
        App.navigate(s.route);
        window.scrollTo(0, 0);        // land at the top of the page, as a fresh visit would
      }
      // reflect it in the sidebar too: open the group the module sits in
      if (s.group && App.state.navOpen) { App.state.navOpen[s.group] = true; if (App.renderNav) App.renderNav(); }
      const target = (!s.center && !s.finish) ? TOUR._target(s) : null;
      if (!target) {
        dim.classList.add('show'); ring.classList.remove('show');
        pop.style.transform = 'translate(-50%,-50%)'; pop.style.top = '50%'; pop.style.left = '50%';
        pop.classList.add('show');
        return;
      }
      const place = function () {
        const r = target.getBoundingClientRect(); const pad = 6, gap = 16;
        const clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
        dim.classList.remove('show'); // the ring's huge box-shadow IS the scrim
        ring.style.top = (r.top - pad) + 'px'; ring.style.left = (r.left - pad) + 'px';
        ring.style.width = (r.width + pad * 2) + 'px'; ring.style.height = (r.height + pad * 2) + 'px';
        ring.classList.add('show');
        const pw = pop.offsetWidth || 320, ph = pop.offsetHeight || 210;
        const vw = window.innerWidth || document.documentElement.clientWidth || 1280;
        const vh = window.innerHeight || document.documentElement.clientHeight || 800;
        let top, left;
        if (r.right + gap + pw < vw) { left = r.right + gap; top = clamp(r.top + r.height / 2 - ph / 2, 12, vh - ph - 12); }
        else if (r.left - gap - pw > 0) { left = r.left - gap - pw; top = clamp(r.top + r.height / 2 - ph / 2, 12, vh - ph - 12); }
        else if (r.bottom + gap + ph < vh) { top = r.bottom + gap; left = clamp(r.left, 12, vw - pw - 12); }
        else { top = clamp(r.top - ph - gap, 12, vh - ph - 12); left = clamp(r.left, 12, vw - pw - 12); }
        pop.style.transform = 'none'; pop.style.top = top + 'px'; pop.style.left = left + 'px';
        pop.classList.add('show');
      };
      /* Bring the target into view by aligning its TOP just under the header. Centring is wrong
         here: tables and grids are often taller than the viewport, so centring one scrolls past
         the page heading and lands in the middle of a list. Only scroll when it is actually needed. */
      const scroller = (function () {
        let n = target.parentElement;
        while (n && n !== document.body) {
          const st = getComputedStyle(n);
          if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 4) return n;
          n = n.parentElement;
        }
        return null;
      })();
      const TOP = 110;
      const r0 = target.getBoundingClientRect();
      // a fixed element (the assistant launcher) is always on screen: scrolling for it does nothing
      const isFixed = getComputedStyle(target).position === 'fixed';
      const vh = window.innerHeight || document.documentElement.clientHeight || 0;
      if (!isFixed && vh > 200 && (r0.top < 70 || r0.top > vh - 140)) {
        if (scroller) {
          const sr = scroller.getBoundingClientRect();
          scroller.scrollTop = Math.max(0, scroller.scrollTop + (r0.top - sr.top) - 24);
        } else {
          window.scrollTo(0, Math.max(0, (window.scrollY || window.pageYOffset || 0) + r0.top - TOP));
        }
      }
      requestAnimationFrame(function () { requestAnimationFrame(place); });
    },


    end() {
      TOUR._markSeen();
      const l = el('tourLayer'); if (l) l.classList.remove('show');
      ['tourPop', 'tourRing', 'tourDim'].forEach(function (id) { const e = el(id); if (e) e.classList.remove('show'); });
      window.removeEventListener('resize', TOUR._reflow);
      if (TOUR._returnTo && App.state.user && App.state.route !== TOUR._returnTo) App.navigate(TOUR._returnTo);
      TOUR._returnTo = null;
    },
    renderRelaunch() { if (!App.state.user || el('tourRelaunch')) return; const b = document.createElement('button'); b.id = 'tourRelaunch'; b.className = 'tour-relaunch'; b.innerHTML = App.icon('sparkles') + ' Take a tour'; b.onclick = function () { App.tour.start(); }; document.body.appendChild(b); },
    _cleanup() { ['tourLayer', 'tourRelaunch'].forEach(function (id) { const e = el(id); if (e) e.remove(); }); }
  };
  App.tour = TOUR;
})();
