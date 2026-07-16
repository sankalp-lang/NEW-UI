/* Connectors - sources that power permission-faithful retrieval, + BYO-LLM.
   Every source is connectable via API key, MCP server, or OAuth (App.conn).
   The model picker (App.llm) chooses any provider + an optional fallback. */
App.registerView('connectors', {
  title: 'Connectors',
  render(ctx) {
    const llmMeta = App.llm.modelMeta('primary');
    const fbMeta = App.llm.modelMeta('fallback');

    const modelCard = `
      <div class="card" style="margin-bottom:22px">
        <div class="card__head">${App.icon('sparkles')}<h3>Tara's model</h3><div class="spacer"></div>
          <button class="btn btn--primary btn--sm" onclick="App.llm.openSetup()">${App.icon('zap')} ${llmMeta?'Manage model':'Connect a model'}</button></div>
        <div class="card__body">
          <p class="muted" style="font-size:13px;margin-bottom:14px">Bring your own key - Gemini, ChatGPT, Claude, Sarvam, Grok or Perplexity. On-prem &amp; LLM-agnostic: the model only ever receives the slice of data the signed-in user is allowed to see.</p>
          <div class="grid grid-2">
            <div class="minirow" style="border:1px solid var(--line);border-radius:10px;padding:12px 14px">
              ${llmMeta?App.llm.logo(llmMeta.provider,26):App.icon('plug')}
              <div style="flex:1"><div style="font-weight:600">${llmMeta?App.esc(llmMeta.modelLabel):'No model connected'}</div><div class="muted" style="font-size:12px">${llmMeta?'Primary · '+App.esc(llmMeta.providerLabel):'Running in demo mode (offline engine)'}</div></div>
              ${llmMeta?App.ui.pill('Live','green',true):App.ui.pill('Demo','gray')}
            </div>
            <div class="minirow" style="border:1px dashed var(--line);border-radius:10px;padding:12px 14px">
              ${fbMeta?App.llm.logo(fbMeta.provider,26):App.icon('branch')}
              <div style="flex:1"><div style="font-weight:600">${fbMeta?App.esc(fbMeta.modelLabel):'No fallback set'}</div><div class="muted" style="font-size:12px">${fbMeta?'Fallback · '+App.esc(fbMeta.providerLabel):'Optional - used only if the primary fails'}</div></div>
            </div>
          </div>
        </div>
      </div>`;

    const card = c => {
      const st = App.conn.state(c.id);
      const live = !!st;
      const action = live
        ? `<span class="muted" style="font-size:12px">via ${App.esc(String(st.method).toUpperCase())}</span> <button class="btn btn--sm" onclick="App.conn.openSetup('${c.id}')">${App.icon('edit')} Manage</button>`
        : `<button class="btn btn--sm btn--primary" onclick="App.conn.openSetup('${c.id}')">${App.icon('plug')} Connect</button>`;
      const extra = c.id==='keka' && live ? `<button class="btn btn--sm" onclick="App.navigate('usersaccess')">View directory</button>` : '';
      return `<div class="card card--pad">
        <div class="row gap-12" style="margin-bottom:10px">${App.conn.logo(c.id,34)}
          <div style="flex:1"><div style="font-weight:600;font-size:14px">${App.esc(c.name)}</div><div class="muted" style="font-size:12px">${App.esc(c.kind)}</div></div>
          ${live?App.ui.pill('Connected','green',true):App.ui.pill('Available','gray')}</div>
        <div class="muted" style="font-size:12.5px;min-height:34px">${App.esc(c.note)}</div>
        <div class="row gap-8" style="margin-top:12px">${action}${extra}</div>
      </div>`;
    };

    return `<div class="page">
      <div class="page__head"><div><h1>Connectors</h1><p>Connect your sources and your model. Everything runs on-prem; keys stay in your environment and each source's own permissions are inherited at retrieval.</p></div></div>
      <div class="info-banner">${App.icon('lock')} <span><strong>Deploy-ready:</strong> connect Keka / greytHR / Jira / Notion with your real API keys or MCP servers, add a model key, and Tara answers for real - permission-faithfully.</span></div>
      ${modelCard}
      <h3 style="margin:6px 0 12px;font-size:15px">Data sources</h3>
      <div class="grid grid-3">${DB.connectors.map(card).join('')}</div>
    </div>`;
  }
});
