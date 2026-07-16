/* Home - the company-brain chat surface. Empty state = the ask hero (radiant-blue headline + ask bar
   + source/prompt chips). Once you ask, it becomes an inline, permission-faithful conversation.
   Answers come from App.tara.answer, so RBAC is enforced at retrieval. */
App.registerView('home', {
  title: 'Home',
  render(ctx) {
    if (!App.state.home) App.state.home = [];
    const u = ctx.user;

    if (!App.state.home.length) {
      const prompts = App.suggestPrompts(u).slice(0, 3);
      return `<div class="page home">
        <section class="homehero">
          <div class="homehero__wash"></div>
          <div class="homehero__in">
            <div class="eyebrow">${App.icon('sparkles')} Company brain</div>
            <h1>Ask your policies, regulations and governance — anything.</h1>
            <div class="homeask">
              <div class="homeask__r">
                <span class="homeask__spk">${App.icon('sparkles')}</span>
                <textarea id="homeInput" rows="1" placeholder="Ask anything…  e.g. what's the personal-loan eligibility?" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();App.home.ask();}"></textarea>
                <button class="homeask__send" onclick="App.home.ask()">Ask ${App.icon('send')}</button>
              </div>
              <div class="homeask__f">
                <span class="muted" style="font-size:12px">Answers only from what you're allowed to see</span>
                <div class="homeask__srcs">
                  <span>${App.icon('file')} Policies</span>
                  <span>${App.icon('alert')} Regulatory</span>
                  <span>${App.icon('branch')} Approvals</span>
                </div>
              </div>
            </div>
            <div class="homeprompts">
              ${prompts.map(s => `<button class="homeprompt" onclick="App.home.ask('${s.q.replace(/'/g, "\\'")}')">${App.esc(s.q)}</button>`).join('')}
            </div>
          </div>
        </section>
      </div>`;
    }

    // conversation view: thread + a persistent follow-up bar
    return `<div class="page home home--chat">
      <div class="home__bar">
        <span class="eyebrow">${App.icon('sparkles')} Company brain</span>
        <div class="spacer" style="flex:1"></div>
        <button class="btn btn--sm" onclick="App.home.reset()">${App.icon('plus')} New chat</button>
      </div>
      <div id="homeThread" class="home__thread"></div>
      <div class="homeask home__foot">
        <div class="homeask__r">
          <span class="homeask__spk">${App.icon('sparkles')}</span>
          <textarea id="homeInput" rows="1" placeholder="Ask a follow-up…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();App.home.ask();}"></textarea>
          <button class="homeask__send" onclick="App.home.ask()">Ask ${App.icon('send')}</button>
        </div>
      </div>
    </div>`;
  },
  mount() { App.home.render(); const i = document.getElementById('homeInput'); if (i) i.focus(); }
});

App.home = {
  render() {
    const t = document.getElementById('homeThread'); if (!t) return;
    t.innerHTML = (App.state.home || []).map(m => {
      if (m.role === 'user') return `<div class="msg msg--user" style="margin-bottom:16px"><div class="msg__bubble" style="max-width:70%">${App.esc(m.text)}</div></div>`;
      if (m.typing) return `<div class="msg msg--ai" style="margin-bottom:16px"><div class="msg__av">${App.icon('sparkles')}</div><div class="msg__bubble"><div class="typing"><span></span><span></span><span></span></div></div></div>`;
      const src = m.sources && m.sources.length ? `<div class="src-row">${m.sources.map(s => { const ic = { hrms: 'users', jira: 'branch', policy: 'shield', locked: 'lock', llm: 'sparkles' }[s.kind] || 'database'; return `<span class="src-chip ${s.kind}">${App.icon(ic)} ${App.esc(s.label)}</span>`; }).join('')}</div>` : '';
      return `<div class="msg msg--ai" style="margin-bottom:16px"><div class="msg__av">${App.icon('sparkles')}</div><div class="msg__bubble" style="max-width:82%">${m.html}${src}</div></div>`;
    }).join('');
    t.scrollTop = t.scrollHeight;
  },
  ask(text) {
    const inp = document.getElementById('homeInput');
    text = (text || (inp && inp.value) || '').trim(); if (!text) return;
    if (inp) inp.value = '';
    if (!App.state.home) App.state.home = [];
    const wasEmpty = App.state.home.length === 0;
    App.state.home.push({ role: 'user', text });
    const ph = { role: 'ai', typing: true };
    App.state.home.push(ph);
    if (wasEmpty) App.reload(); else App.home.render();   // first ask swaps hero → conversation layout
    App.tara.answer(text, App.state.user).then(r => {
      ph.typing = false; ph.html = r.html; ph.sources = r.sources; App.home.render();
    }).catch(e => {
      ph.typing = false; ph.html = '<p>' + App.esc(String(e && e.message || e)) + '</p>'; ph.sources = []; App.home.render();
    });
  },
  reset() { App.state.home = []; App.reload(); }
};
