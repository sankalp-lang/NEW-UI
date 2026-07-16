/* ============================================================
   PolicyOS · Tara - Integrations layer (BYO key, on-prem)
   • App.llm  - pick ANY model from 6 providers + optional fallback,
                paste that provider's key, Tara calls it from the browser.
   • App.conn - connect data sources (Keka, GreytHR, Jira, Notion, …)
                via API key or MCP server URL.
   No provider is preselected/default. Keys live only in this browser
   (localStorage) and are sent only to the provider/connector you choose.
   With no model configured, Tara falls back to the offline demo engine.
   ============================================================ */
(function () {
  const App = window.App;

  /* ---------------- provider + model catalog ---------------- */
  // shape: 'anthropic' | 'gemini' | 'openai' (OpenAI-compatible /chat/completions)
  const PROVIDERS = {
    gemini:     { label:'Gemini',     company:'Google',      shape:'gemini',
                  keyHint:'AIza…  (Google AI Studio key)',
                  models:[{id:'gemini-2.5-pro',label:'Gemini 2.5 Pro'},{id:'gemini-2.5-flash',label:'Gemini 2.5 Flash'},{id:'gemini-2.0-flash',label:'Gemini 2.0 Flash'}] },
    openai:     { label:'ChatGPT',    company:'OpenAI',      shape:'openai', base:'https://api.openai.com/v1', auth:'bearer',
                  keyHint:'sk-…  (OpenAI key)',
                  models:[{id:'gpt-4o',label:'GPT-4o'},{id:'gpt-4o-mini',label:'GPT-4o mini'}] },
    anthropic:  { label:'Claude',     company:'Anthropic',   shape:'anthropic',
                  keyHint:'sk-ant-…  (Anthropic key)',
                  models:[{id:'claude-opus-4-8',label:'Claude Opus 4.8'},{id:'claude-sonnet-4-6',label:'Claude Sonnet 4.6'},{id:'claude-haiku-4-5',label:'Claude Haiku 4.5'}] },
    sarvam:     { label:'Sarvam',     company:'Sarvam AI',   shape:'openai', base:'https://api.sarvam.ai/v1', auth:'sarvam',
                  keyHint:'Sarvam API subscription key',
                  models:[{id:'sarvam-m',label:'Sarvam-M'}] },
    grok:       { label:'Grok',       company:'xAI',         shape:'openai', base:'https://api.x.ai/v1', auth:'bearer',
                  keyHint:'xai-…  (xAI key)',
                  models:[{id:'grok-4',label:'Grok 4'}] },
    perplexity: { label:'Perplexity', company:'Perplexity',  shape:'openai', base:'https://api.perplexity.ai', auth:'bearer',
                  keyHint:'pplx-…  (Perplexity key)',
                  models:[{id:'sonar-pro',label:'Sonar Pro'}] }
  };

  /* ---------------- brand logos (inline SVG, approximate marks) ---------------- */
  const LOGOS = {
    gemini:'<svg viewBox="0 0 24 24" width="100%" height="100%"><defs><linearGradient id="tgem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4796E3"/><stop offset=".5" stop-color="#9177C7"/><stop offset="1" stop-color="#D96570"/></linearGradient></defs><path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10C7.4 11.4 11.4 7.4 12 2z" fill="url(#tgem)"/></svg>',
    openai:'<svg viewBox="0 0 24 24" width="100%" height="100%"><g transform="translate(12,12)" fill="#0D0D0D"><ellipse rx="9.3" ry="3"/><ellipse rx="9.3" ry="3" transform="rotate(60)"/><ellipse rx="9.3" ry="3" transform="rotate(120)"/></g></svg>',
    anthropic:'<svg viewBox="0 0 24 24" width="100%" height="100%" stroke="#C96442" stroke-width="2.4" stroke-linecap="round"><g transform="translate(12,12)"><line x1="-8" y1="0" x2="8" y2="0"/><line x1="0" y1="-8" x2="0" y2="8"/><line x1="-6" y1="-6" x2="6" y2="6"/><line x1="-6" y1="6" x2="6" y2="-6"/></g></svg>',
    sarvam:'<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="5" y="5" width="14" height="14" rx="3" transform="rotate(45 12 12)" fill="#EA580C"/><circle cx="12" cy="12" r="3.2" fill="#fff"/></svg>',
    grok:'<svg viewBox="0 0 24 24" width="100%" height="100%" stroke="#0D0D0D" stroke-width="2.6" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="6.5" x2="9.5" y2="17.5"/></svg>',
    perplexity:'<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#20808D" stroke-width="1.9" stroke-linecap="round"><path d="M12 3.5v17"/><path d="M12 8.5C9.3 5.6 5 6.8 5 10.5s4.3 4.9 7 2"/><path d="M12 8.5c2.7-2.9 7-1.7 7 2s-4.3 4.9-7 2"/></svg>'
  };
  const CONN_LOGOS = {
    keka:'<svg viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" rx="6" fill="#0AA89E"/><text x="12" y="17" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="Inter,sans-serif">k</text></svg>',
    greythr:'<svg viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" rx="6" fill="#F47216"/><text x="12" y="17" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" font-family="Inter,sans-serif">g</text></svg>',
    jira:'<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 2.5 20.5 11H16L12 7 8 11H3.5z" fill="#2684FF"/><path d="M12 21.5 3.5 13H8l4 4 4-4h4.5z" fill="#2684FF" opacity=".55"/></svg>',
    notion:'<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="#111"/><path d="M8 16V8l8 8M8 8h.01M16 8v8" stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    slack:'<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="9.4" y="3" width="3.2" height="9" rx="1.6" fill="#36C5F0"/><rect x="11.4" y="12" width="3.2" height="9" rx="1.6" fill="#2EB67D"/><rect x="3" y="11.4" width="9" height="3.2" rx="1.6" fill="#ECB22E"/><rect x="12" y="9.4" width="9" height="3.2" rx="1.6" fill="#E01E5A"/></svg>',
    policyos:'<svg viewBox="0 0 24 24" width="100%" height="100%"><rect width="24" height="24" rx="6" fill="#1c1a16"/><text x="12" y="17" text-anchor="middle" font-size="12" font-weight="700" fill="#f4f1ea" font-family="Inter,sans-serif">P</text></svg>',
    gdrive:'<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M9 3h6l6 10.5h-6z" fill="#FFCF63"/><path d="M3 20.5 6 14l6 10.5H7z" fill="#34A853" transform="translate(0 -1)"/><path d="M9 3 3 14l3 6.5L15 14z" fill="#4285F4"/><path d="M21 13.5 15 14l-3 6.5h8z" fill="#EA4335"/></svg>',
    gmail:'<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="3" y="5.5" width="18" height="13" rx="2" fill="#fff" stroke="#EA4335" stroke-width="1.4"/><path d="M4 7l8 6 8-6" stroke="#EA4335" stroke-width="1.4" fill="none"/></svg>'
  };

  /* ---------------- real brand logos via logo.dev (publishable key only) ---------------- */
  const LOGODEV_PK = 'pk_L_47syMESEi-pOlU39KgSw';
  const PROVIDER_DOMAINS = { gemini:'gemini.google.com', openai:'openai.com', anthropic:'anthropic.com', sarvam:'sarvam.ai', grok:'x.ai', perplexity:'perplexity.ai' };
  const CONN_DOMAINS = { keka:'keka.com', greythr:'greythr.com', jira:'jira.com', notion:'notion.so', slack:'slack.com', policyos:'tartanhq.com', gdrive:'google.com', gmail:'gmail.com' };
  function logoImg(dom, id, kind, s) {
    return '<span class="brand-logo" style="width:' + s + 'px;height:' + s + 'px">'
      + '<img src="https://img.logo.dev/' + dom + '?token=' + LOGODEV_PK + '&size=' + (s * 2) + '&format=png&retina=true" width="' + s + '" height="' + s + '" alt="" onerror="App.brandFallback(this,\'' + kind + '\',\'' + id + '\')">'
      + '</span>';
  }
  // if logo.dev is unreachable/offline, fall back to the inline SVG mark
  App.brandFallback = function (el, kind, id) { const m = (kind === 'conn') ? CONN_LOGOS : LOGOS; const sp = el.parentNode; if (sp) sp.innerHTML = m[id] || ''; };

  function md(s) {
    s = App.esc(s || '');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const lines = s.split(/\n/); let h = ''; let li = false;
    for (const ln of lines) { const t = ln.trim();
      if (/^[-*•]\s+/.test(t)) { if (!li) { h += '<ul>'; li = true; } h += '<li>' + t.replace(/^[-*•]\s+/, '') + '</li>'; }
      else { if (li) { h += '</ul>'; li = false; } if (t) h += '<p>' + t + '</p>'; } }
    if (li) h += '</ul>';
    return h || '<p></p>';
  }

  /* ---------------- shared persisted store ---------------- */
  function store(key, fallbackMem) {
    return {
      get() { try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch (e) {} return fallbackMem.v || {}; },
      set(o) { fallbackMem.v = o; try { localStorage.setItem(key, JSON.stringify(o)); } catch (e) {} }
    };
  }

  /* ============================================================
     App.llm - model selection + live calls
     ============================================================ */
  const _llmMem = {}; const llmStore = store('tara_llm_cfg', _llmMem);
  const LLM = {
    PROVIDERS,
    logo(id, size) { const s = (size || 18); const dom = PROVIDER_DOMAINS[id]; return dom ? logoImg(dom, id, 'llm', s) : '<span class="brand-logo" style="width:' + s + 'px;height:' + s + 'px">' + (LOGOS[id] || '') + '</span>'; },
    get() { return llmStore.get(); },
    configured() { const c = LLM.get(); return !!(c.primary && c.primary.provider && c.primary.model && c.primary.key); }, // live (key present)
    selected() { const c = LLM.get(); return !!(c.primary && c.primary.provider && c.primary.model); },                  // a model is chosen (key optional)
    modelMeta(slot) { const c = LLM.get(); const s = c[slot]; if (!s) return null; const p = PROVIDERS[s.provider]; const m = p && p.models.find(x => x.id === s.model); return { provider: s.provider, providerLabel: p ? p.label : s.provider, model: s.model, modelLabel: m ? m.label : s.model }; },
    clear() { llmStore.set({}); LLM.refreshBadges(); },

    buildContext(user) {
      const hrmsOn = App.hasSource && (App.hasSource('keka') || App.hasSource('greythr'));
      const jiraOn = App.hasSource && App.hasSource('jira');
      const vis = App.visiblePolicies(user);
      const pol = vis.map(p => '### ' + p.name + ' (' + p.version + ', ' + p.category + ')\n' + p.summary + '\nKey parameters: ' + Object.entries(p.facts).map(([k, v]) => k + ': ' + v).join('; ') + '\nRules: ' + p.rules.join(' | ')).join('\n\n');
      const hidden = DB.policies.length - vis.length;
      const polBlock = '## POLICIES THIS USER MAY ACCESS (PolicyOS) - ' + vis.length + ' of ' + DB.policies.length + '\n' + (pol || '(none in scope)') + '\n\n[' + hidden + ' other policies exist but are OUTSIDE this user\'s scope and are not included.]';
      let ctx = 'COMPANY: ' + DB.company.name + '\n\n';
      if (hrmsOn) {
        const people = DB.employees.map(e => '- ' + e.name + ' | ' + e.title + ' | team: ' + e.team + ' | today: ' + (e.presence === 'office' ? 'in office (' + e.checkin + ')' : e.presence)).join('\n');
        const teams = DB.teams.map(t => '- ' + t.name + ' (lead ' + t.lead + ', ' + DB.employees.filter(e => e.team === t.name).length + ')').join('\n');
        ctx += '## PEOPLE (Keka HRMS)\n' + people + '\n\n## TEAMS\n' + teams + '\n\n';
      }
      if (jiraOn) {
        const jira = DB.jiraIssues.map(i => '- ' + i.key + ' | ' + i.title + ' | assignee ' + App.emp(i.assignee).name + ' | ' + ((DB.jiraProjects.find(p => p.key === i.project) || {}).name) + ' | ' + i.status).join('\n');
        ctx += '## WORK IN PROGRESS (Jira)\n' + jira + '\n\n';
      }
      ctx += polBlock;
      if (!hrmsOn && !jiraOn) ctx += '\n\n[Only the policy library is connected in this deployment - answer from policies only.]';
      return ctx;
    },
    systemPrompt(user) {
      const srcList = (App.sourceLabels ? App.sourceLabels() : []).concat(['Policies']).join(', ');
      return 'You are Tara, the on-prem company copilot for ' + DB.company.name + ', answering for ' + user.name + ' (' + DB.roleLabels[user.role] + ', ' + user.team + ').\nRULES: Answer ONLY from the CONTEXT below - it is already filtered to what THIS user may see. If something is absent (a policy, person, or salary), say the user is not permitted to see it; never guess or use outside knowledge. Be concise; bold key values like **720**. End with a final line "SOURCES: <subset of ' + srcList + '>" (omit if none).\n\nCONTEXT:\n' + LLM.buildContext(user);
    },

    async _call(slot, query, user) {
      const cfg = LLM.get()[slot]; const p = PROVIDERS[cfg.provider]; const sys = LLM.systemPrompt(user);
      let text;
      if (p.shape === 'gemini') {
        const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + cfg.model + ':generateContent', {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key },
          body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: [{ role: 'user', parts: [{ text: query }] }], generationConfig: { maxOutputTokens: 1500 } })
        });
        if (!r.ok) throw new Error(p.label + ' ' + r.status + ' - ' + (await r.text()).slice(0, 140));
        const d = await r.json(); text = ((d.candidates || [])[0]?.content?.parts || []).map(x => x.text || '').join('');
      } else if (p.shape === 'anthropic') {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: cfg.model, max_tokens: 1500, system: sys, messages: [{ role: 'user', content: query }] })
        });
        if (!r.ok) throw new Error(p.label + ' ' + r.status + ' - ' + (await r.text()).slice(0, 140));
        const d = await r.json(); text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      } else { // openai-compatible
        const headers = { 'content-type': 'application/json' };
        if (p.auth === 'sarvam') headers['api-subscription-key'] = cfg.key; else headers['Authorization'] = 'Bearer ' + cfg.key;
        const r = await fetch(p.base + '/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model: cfg.model, max_tokens: 1500, messages: [{ role: 'system', content: sys }, { role: 'user', content: query }] }) });
        if (!r.ok) throw new Error(p.label + ' ' + r.status + ' - ' + (await r.text()).slice(0, 140));
        const d = await r.json(); text = d.choices[0].message.content;
      }
      return text;
    },
    _format(text, slot) {
      let chips = [];
      const m = text.match(/\n?\s*SOURCES?:\s*(.+?)\s*$/i);
      if (m) { text = text.slice(0, m.index).trim();
        m[1].split(',').map(s => s.trim().toLowerCase()).forEach(s => {
          if (/hrms|people|keka|directory/.test(s)) chips.push({ kind: 'hrms', label: 'Keka HRMS' });
          else if (/jira/.test(s)) chips.push({ kind: 'jira', label: 'Jira' });
          else if (/polic/.test(s)) chips.push({ kind: 'policy', label: 'PolicyOS' });
          else if (/notion/.test(s)) chips.push({ kind: 'policy', label: 'Notion' }); });
      }
      const meta = LLM.modelMeta(slot);
      chips.push({ kind: 'llm', label: (slot === 'fallback' ? 'Fallback · ' : '') + (meta ? meta.modelLabel : '') + ' · on-prem' });
      return { html: md(text), sources: chips };
    },
    async answer(query, user) {
      user = user || App.state.user;
      try { return LLM._format(await LLM._call('primary', query, user), 'primary'); }
      catch (e) {
        const cfg = LLM.get();
        if (cfg.fallback && cfg.fallback.key) {
          try { return LLM._format(await LLM._call('fallback', query, user), 'fallback'); } catch (e2) {}
        }
        return { html: '<p>⚠️ Couldn\'t reach the model.</p><p class="muted" style="font-size:12.5px">' + App.esc(String(e.message || e)) + '</p><p class="muted" style="font-size:12.5px">Check the key in <strong>Connect a model</strong>. Demo mode works without a key.</p>', sources: [{ kind: 'locked', label: 'connection error' }] };
      }
    },

    statusLabel() { const m = LLM.modelMeta('primary'); if (!m) return App.icon('plug') + ' Demo mode'; return LLM.logo(m.provider, 14) + ' ' + App.esc(m.modelLabel) + (LLM.configured() ? '' : ' · demo'); },
    refreshBadges() { document.querySelectorAll('.tara-status').forEach(el => { el.innerHTML = LLM.statusLabel(); el.classList.toggle('is-live', LLM.configured()); }); },

    /* ---- setup modal (model-card grid + optional fallback) ---- */
    _draft: null,
    openSetup() {
      const c = LLM.get();
      LLM._draft = { primary: Object.assign({ provider: '', model: '', key: '' }, c.primary), fallback: Object.assign({ provider: '', model: '', key: '' }, c.fallback), showFallback: !!(c.fallback && c.fallback.provider) };
      App.openModal({ title: 'Connect a model', sub: 'Bring your own key. Pick any model - Tara only ever sends each user the data they\'re allowed to see. The key is optional here: pick a model to preview it in demo mode, add a key to answer live.', lg: true,
        body: '<div id="llmSetupBody"></div>',
        footer: (LLM.selected() ? '<button class="btn btn--danger" onclick="App.llm.clear();App.closeModal();App.toast(\'Reset to demo mode\')">Reset to demo</button>' : '') + '<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.llm._save()">Save model</button>' });
      LLM._renderSetup();
    },
    _grid(slot, excludeId) {
      const sel = LLM._draft[slot];
      return Object.entries(PROVIDERS).map(([pk, p]) =>
        '<div class="prov-row"><div class="prov-row__h">' + LLM.logo(pk, 16) + '<span>' + p.label + '</span><span class="prov-row__co">' + p.company + '</span></div><div class="llm-cards">' +
        p.models.filter(m => !(excludeId && pk === LLM._draft.primary.provider && m.id === excludeId)).map(m => {
          const on = sel.provider === pk && sel.model === m.id;
          return '<button class="llm-card' + (on ? ' is-sel' : '') + '" onclick="App.llm._pick(\'' + slot + '\',\'' + pk + '\',\'' + m.id + '\')">' + LLM.logo(pk, 18) + '<span>' + App.esc(m.label) + '</span>' + (on ? App.icon('check') : '') + '</button>';
        }).join('') + '</div></div>'
      ).join('');
    },
    _renderSetup() {
      const host = document.getElementById('llmSetupBody'); if (!host) return;
      const d = LLM._draft;
      const pHint = d.primary.provider ? PROVIDERS[d.primary.provider].keyHint : 'Select a model above, then paste its API key';
      let html =
        '<div class="info-banner">' + App.icon('lock') + ' <span>Permission-faithful: the model is handed only the context the current persona can see. Log in as a staff user and it literally can\'t answer about a policy they\'re not on.</span></div>' +
        '<div class="setup-label">Primary model</div>' + LLM._grid('primary') +
        '<div class="field" style="margin-top:14px"><label>API key for ' + (d.primary.provider ? PROVIDERS[d.primary.provider].label : 'the selected model') + '</label><input class="input" id="llmKeyPrimary" type="password" placeholder="' + App.esc(pHint) + '" value="' + App.esc(d.primary.key) + '" oninput="App.llm._draft.primary.key=this.value"/><div class="hint">Optional - leave blank to preview this model in demo mode. If set, it\'s stored only in this browser and sent only to ' + (d.primary.provider ? PROVIDERS[d.primary.provider].company : 'the provider') + '.</div></div>' +
        '<div class="divider"></div>';
      if (!d.showFallback) {
        html += '<button class="btn btn--sm" onclick="App.llm._draft.showFallback=true;App.llm._renderSetup()">' + App.icon('plus') + ' Add a fallback model (optional)</button>';
      } else {
        const fHint = d.fallback.provider ? PROVIDERS[d.fallback.provider].keyHint : 'Select a fallback model, then paste its key';
        html += '<div class="setup-label">Fallback model <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">- used only if the primary fails. Optional.</span></div>' + LLM._grid('fallback', d.primary.model) +
          '<div class="field" style="margin-top:14px"><label>API key for the fallback</label><input class="input" id="llmKeyFallback" type="password" placeholder="' + App.esc(fHint) + '" value="' + App.esc(d.fallback.key) + '" oninput="App.llm._draft.fallback.key=this.value"/></div>' +
          '<button class="btn btn--sm btn--ghost" onclick="App.llm._draft.showFallback=false;App.llm._draft.fallback={provider:\'\',model:\'\',key:\'\'};App.llm._renderSetup()">Remove fallback</button>';
      }
      host.innerHTML = html;
    },
    _pick(slot, provider, model) { const s = LLM._draft[slot]; s.provider = provider; s.model = model; LLM._renderSetup(); },
    _save() {
      const d = LLM._draft;
      if (!d.primary.provider || !d.primary.model) { App.toast('Pick a primary model', 'warn'); return; }
      // key is OPTIONAL - selecting a model persists and shows in the header; a key upgrades it to live answers.
      const cfg = { primary: { provider: d.primary.provider, model: d.primary.model, key: d.primary.key.trim() } };
      if (d.showFallback && d.fallback.provider && d.fallback.model) cfg.fallback = { provider: d.fallback.provider, model: d.fallback.model, key: d.fallback.key.trim() };
      llmStore.set(cfg); LLM.refreshBadges(); App.closeModal();
      const label = LLM.modelMeta('primary').modelLabel;
      App.toast(d.primary.key.trim() ? ('Connected live · ' + label) : ('Model set · ' + label + ' - add a key to answer live'));
    }
  };
  App.llm = LLM;

  /* ============================================================
     App.conn - data-source connectors (API key or MCP server)
     ============================================================ */
  const _connMem = {}; const connStore = store('tara_conn_cfg', _connMem);
  const CONN = {
    logo(id, size) { const s = (size || 22); const dom = CONN_DOMAINS[id]; return dom ? logoImg(dom, id, 'conn', s) : '<span class="brand-logo" style="width:' + s + 'px;height:' + s + 'px">' + (CONN_LOGOS[id] || CONN_LOGOS.policyos) + '</span>'; },
    all() { return connStore.get(); },
    state(id) { const c = connStore.get()[id]; return c && c.connected ? c : null; },
    isConnected(id) { return !!CONN.state(id); },
    methodsFor(c) {
      // every connector offers both an API-key path and an MCP-server path ("same options")
      const m = [{ id: 'api', label: 'API key' }, { id: 'mcp', label: 'MCP server' }];
      if (c.kind === 'HRMS' || c.kind === 'Project' || c.kind === 'Docs / KB') m.unshift({ id: 'oauth', label: 'OAuth' });
      return m;
    },
    _draft: null,
    openSetup(id) {
      const c = DB.connectors.find(x => x.id === id); if (!c) return;
      const saved = connStore.get()[id] || {};
      CONN._draft = { id, method: saved.method || CONN.methodsFor(c)[0].id, key: saved.key || '', url: saved.url || '' };
      const methods = CONN.methodsFor(c);
      App.openModal({ title: 'Connect ' + c.name, sub: c.note,
        body:
          '<div class="row gap-12" style="margin-bottom:14px">' + CONN.logo(id, 40) + '<div><div style="font-weight:600">' + App.esc(c.name) + '</div><div class="muted" style="font-size:12.5px">' + App.esc(c.kind) + ' · ' + App.esc(c.count) + '</div></div></div>' +
          '<div class="info-banner">' + App.icon('shield') + ' <span>Tara inherits this source\'s own permissions - it never returns anything the signed-in user couldn\'t open in ' + App.esc(c.name) + ' directly.</span></div>' +
          '<div class="field"><label>Connection method</label><select class="select" id="connMethod" style="width:100%" onchange="App.conn._draft.method=this.value;App.conn._renderField()">' + methods.map(m => '<option value="' + m.id + '"' + (m.id === CONN._draft.method ? ' selected' : '') + '>' + m.label + '</option>').join('') + '</select></div>' +
          '<div id="connField"></div>',
        footer: (CONN.isConnected(id) ? '<button class="btn btn--danger" onclick="App.conn.disconnect(\'' + id + '\')">Disconnect</button>' : '') + '<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.conn._save(\'' + id + '\')">Connect</button>' });
      CONN._renderField();
    },
    _renderField() {
      const host = document.getElementById('connField'); if (!host) return; const d = CONN._draft;
      if (d.method === 'mcp') host.innerHTML = '<div class="field"><label>MCP server URL</label><input class="input" id="connUrl" placeholder="https://mcp.your-source.com/sse" value="' + App.esc(d.url) + '" oninput="App.conn._draft.url=this.value"/><div class="hint">Tara connects to your MCP server; OAuth/credentials are brokered there.</div></div>';
      else if (d.method === 'oauth') host.innerHTML = '<div class="field"><label>OAuth</label><div class="pdf-ph" style="min-height:auto;padding:18px;text-align:center;cursor:pointer" onclick="App.toast(\'OAuth consent flow opens on the deployed app\')">' + App.icon('key') + '<div class="muted" style="margin-top:6px;font-size:12.5px">Authorize via the provider - paste the resulting token below, or use the hosted consent flow after deploy.</div></div><input class="input" style="margin-top:10px" id="connKey" type="password" placeholder="Access token" value="' + App.esc(d.key) + '" oninput="App.conn._draft.key=this.value"/></div>';
      else host.innerHTML = '<div class="field"><label>API key / token</label><input class="input" id="connKey" type="password" placeholder="Paste the API key from ' + '" value="' + App.esc(d.key) + '" oninput="App.conn._draft.key=this.value"/><div class="hint">Stored only in this browser; sent only to this source.</div></div>';
    },
    _save(id) {
      const d = CONN._draft;
      if (d.method === 'mcp' ? !d.url.trim() : !d.key.trim()) { App.toast('Enter the ' + (d.method === 'mcp' ? 'MCP URL' : 'credential'), 'warn'); return; }
      const cfg = connStore.get(); cfg[id] = { connected: true, method: d.method, key: d.key.trim(), url: d.url.trim() }; connStore.set(cfg);
      App.closeModal(); App.toast(DB.connectors.find(x => x.id === id).name + ' connected'); App.reload();
    },
    disconnect(id) { const cfg = connStore.get(); delete cfg[id]; connStore.set(cfg); App.closeModal(); App.toast('Disconnected'); App.reload(); }
  };
  App.conn = CONN;

  /* unified answer: real model when connected, else offline engine */
  App.tara = {
    answer(query, user) {
      user = user || App.state.user;
      if (App.llm.configured()) return App.llm.answer(query, user);
      return new Promise(res => setTimeout(() => res(App.askTara(query, user)), 520));
    }
  };
})();
