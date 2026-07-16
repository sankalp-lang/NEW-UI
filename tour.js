/* ============================================================
   PolicyOS · Tara - interactive guided tour
   A spotlight (punched-hole scrim + accent ring) steps the user through
   the REAL app: sidebar, Ask-Tara, their role's first block, ⌘K, persona
   switch - then a role-aware "what's next" finish. Runs once per browser,
   relaunchable from the bottom-left chip or the user menu.
   ============================================================ */
(function () {
  const App = window.App;
  const el = id => document.getElementById(id);

  const TOUR = {
    steps: [], i: 0,

    stepsFor(u) {
      const firstCard = { sel: '.content .grid', title: 'Your home', body: 'Quick actions, the numbers that matter, and what needs your attention - all in one place. The ask bar up top is your front door for anything ad-hoc.' };
      return [
        { center: true, title: 'Welcome to PolicyOS · Tara', body: 'A 30-second tour of the on-prem, permission-faithful company brain. Skip anytime.' },
        { sel: '.sidebar .nav', title: 'Role-aware navigation', body: 'The sidebar shows only what your role can use - Administration is admin-only.' },
        { sel: '#homeInput', title: 'Ask in plain English', body: 'Home is your single place to ask - eligibility, a leave rule, a what-if. Answers only from what you’re allowed to see, cited to the page.' },
        firstCard,
        { sel: '.sidebar__search', title: 'Jump with ⌘K', body: 'Open the command palette to jump to any page, find a person, or ask Tara from anywhere.' },
        { sel: '.userchip', title: 'See the permission boundary', body: 'Switch persona here. Ask the same question as a staff user vs an admin and watch the answer change - that’s permission-faithful retrieval.' },
        { finish: true, title: 'You’re all set', body: 'Pick a place to start - or relaunch this tour anytime from the bottom-left.' }
      ];
    },

    seen() { try { return localStorage.getItem('tara_tour_seen') === '1'; } catch (e) { return false; } },
    _markSeen() { try { localStorage.setItem('tara_tour_seen', '1'); } catch (e) {} },
    maybeAutostart() { if (!TOUR.seen() && App.state.user) setTimeout(function () { if (App.state.user) TOUR.start(); }, 700); },

    start() {
      if (!App.state.user) return;
      TOUR.steps = TOUR.stepsFor(App.state.user);
      TOUR.i = 0;
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
          ${s.finish ? TOUR.finishCards() : ''}
          <div class="tour-foot">
            <div class="tour-dots">${dots}</div>
            <div class="row gap-8">
              ${TOUR.i > 0 ? `<button class="btn btn--sm" onclick="App.tour.go(${TOUR.i - 1})">Back</button>` : `<button class="skip" onclick="App.tour.end()">Skip</button>`}
              <button class="btn btn--sm btn--primary" onclick="${nextAttr}">${isLast ? 'Done' : 'Next'} ${isLast ? '' : App.icon('arrow')}</button>
            </div>
          </div>
        </div>`;

      const target = (!s.center && !s.finish && s.sel) ? document.querySelector(s.sel) : null;
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
        const vw = window.innerWidth, vh = window.innerHeight;
        let top, left;
        if (r.right + gap + pw < vw) { left = r.right + gap; top = clamp(r.top + r.height / 2 - ph / 2, 12, vh - ph - 12); }
        else if (r.left - gap - pw > 0) { left = r.left - gap - pw; top = clamp(r.top + r.height / 2 - ph / 2, 12, vh - ph - 12); }
        else if (r.bottom + gap + ph < vh) { top = r.bottom + gap; left = clamp(r.left, 12, vw - pw - 12); }
        else { top = clamp(r.top - ph - gap, 12, vh - ph - 12); left = clamp(r.left, 12, vw - pw - 12); }
        pop.style.transform = 'none'; pop.style.top = top + 'px'; pop.style.left = left + 'px';
        pop.classList.add('show');
      };
      // only scroll if the target is actually out of view, then place after layout settles (no mid-scroll race)
      const r0 = target.getBoundingClientRect();
      if (r0.top < 80 || r0.bottom > window.innerHeight - 24) { try { target.scrollIntoView({ block: 'center' }); } catch (e) {} }
      requestAnimationFrame(function () { requestAnimationFrame(place); });
    },

    finishCards() {
      const role = App.state.user.role;
      const cards = role === 'user' ? [['clipboard', 'Take an assessment', 'assessments'], ['file', 'Your policies', 'policies']]
        : role === 'policy_manager' ? [['file', 'Your policies', 'policies'], ['alert', 'Regulatory gaps', 'regulatory']]
        : [['alert', 'Regulatory', 'regulatory'], ['users', 'Users & access', 'usersaccess']];
      return `<div class="tour-next">${cards.map(c => `<button class="tour-nextcard" onclick="App.tour.end();App.navigate('${c[2]}')"><span class="tour-nc-ic">${App.icon(c[0])}</span><span style="flex:1">${c[1]}</span>${App.icon('arrow')}</button>`).join('')}</div>`;
    },

    end() { TOUR._markSeen(); const l = el('tourLayer'); if (l) l.classList.remove('show'); ['tourPop', 'tourRing', 'tourDim'].forEach(function (id) { const e = el(id); if (e) e.classList.remove('show'); }); window.removeEventListener('resize', TOUR._reflow); },
    renderRelaunch() { if (!App.state.user || el('tourRelaunch')) return; const b = document.createElement('button'); b.id = 'tourRelaunch'; b.className = 'tour-relaunch'; b.innerHTML = App.icon('sparkles') + ' Take a tour'; b.onclick = function () { App.tour.start(); }; document.body.appendChild(b); },
    _cleanup() { ['tourLayer', 'tourRelaunch'].forEach(function (id) { const e = el(id); if (e) e.remove(); }); }
  };
  App.tour = TOUR;
})();
