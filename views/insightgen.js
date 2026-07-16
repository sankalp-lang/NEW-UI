/* InsightGen - text-to-SQL analytics + proactive AI insights */
App.registerView('insightgen', {
  title: 'InsightGen',
  render(ctx) {
    if (!App.canAccessView('insightgen', ctx.user)) return App.lockedPage('InsightGen', 'InsightGen is for administrators and policy managers.');
    const s = App.insightgenView._state();
    return `<div class="page">
      <div class="page__head"><div><h1>InsightGen</h1><p>Ask questions of your data in plain English. Tara writes the SQL, runs it, and surfaces proactive insights before you have to ask.</p></div><div class="spacer"></div>
        <select class="select" id="igDb" onchange="App.insightgenView.setDb(this.value)">
          ${App.insightgenView.DBS.map(d=>`<option value="${App.esc(d)}" ${d===s.db?'selected':''}>${App.esc(d)}</option>`).join('')}
        </select>
        <button class="btn btn--primary" onclick="App.insightgenView.addSource()">${App.icon('plus')} Add data source</button>
      </div>
      <div class="info-banner">${App.icon('database')} <span>Querying <strong id="igDbLabel">${App.esc(s.db)}</strong> · read-only analytics replica. Generated SQL is shown for every answer - nothing runs against production.</span></div>
      <div class="tabs">
        <div class="tab ${s.tab==='chat'?'is-active':''}" onclick="App.insightgenView.setTab('chat')">${App.icon('chat')} Chat</div>
        <div class="tab ${s.tab==='insights'?'is-active':''}" onclick="App.insightgenView.setTab('insights')">${App.icon('zap')} AI Insights <span class="nav__badge" style="margin-left:6px">${DB.insights.length}</span></div>
      </div>
      <div id="igTabBody">${s.tab==='chat'?App.insightgenView.chatHtml():App.insightgenView.insightsHtml()}</div>
    </div>`;
  },
  mount(root) {
    App.insightgenView.renderThread();
  }
});

App.insightgenView = {
  DBS: ['Loan Against Property', 'Personal Loan Book'],

  /* ---------- connect more databases / warehouses, or upload a file (read-only) ---------- */
  addSource() {
    const card = (ic, t, d, fn) => `<button class="actioncard" onclick="${fn}"><span class="actioncard__ic" style="background:var(--brand-50);color:var(--brand-600)">${App.icon(ic)}</span><div><b>${t}</b><span>${d}</span></div></button>`;
    App.openModal({
      title: 'Add a data source', sub: 'Point InsightGen at another database or upload a file. Read-only - nothing is ever written back.', lg: true,
      body: `<div class="grid grid-2" style="gap:10px">
          ${card('database', 'PostgreSQL', 'Connect a Postgres database', "App.insightgenView._connectSource('PostgreSQL')")}
          ${card('database', 'MySQL', 'Connect a MySQL / MariaDB database', "App.insightgenView._connectSource('MySQL')")}
          ${card('database', 'MongoDB', 'Connect a MongoDB collection', "App.insightgenView._connectSource('MongoDB')")}
          ${card('database', 'SQL Server', 'Connect a Microsoft SQL Server DB', "App.insightgenView._connectSource('SQL Server')")}
          ${card('layers', 'Data warehouse', 'Snowflake · BigQuery · Redshift', "App.insightgenView._connectSource('Warehouse')")}
          ${card('download', 'Upload a file', 'CSV or Excel (≤ 50 MB)', 'App.insightgenView._uploadSource()')}
        </div>
        <div class="info-banner" style="margin-top:14px;margin-bottom:0">${App.icon('lock')} <span>Connect with a <strong>read-only</strong> user. Credentials stay on your infrastructure - InsightGen only reads, and shows the SQL for every answer.</span></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Close</button>`
    });
  },
  _connectSource(type) {
    const isMongo = type === 'MongoDB';
    const portHint = type === 'PostgreSQL' ? 'db.internal:5432' : type === 'MySQL' ? 'db.internal:3306' : isMongo ? 'mongodb://db.internal:27017' : type === 'SQL Server' ? 'db.internal:1433' : 'account.region.snowflakecomputing.com';
    App.openModal({
      title: 'Connect ' + type, sub: 'Read-only connection. Generated SQL is shown for every answer; nothing runs against production.',
      body: `<div class="field"><label>Connection name <span class="req">*</span></label><input class="input" id="dsName" placeholder="e.g. Collections replica"/></div>
        <div class="grid grid-2">
          <div class="field"><label>Host</label><input class="input" placeholder="${App.esc(portHint)}"/></div>
          <div class="field"><label>${isMongo ? 'Database / collection' : 'Database / schema'}</label><input class="input" placeholder="analytics"/></div>
        </div>
        <div class="field" style="margin-bottom:0"><label>Read-only user</label><input class="input" placeholder="insightgen_ro"/></div>
        <div class="info-banner" style="margin-top:14px;margin-bottom:0">${App.icon('lock')} <span>Use a read-only role. Do not paste production write credentials here.</span></div>`,
      footer: `<button class="btn" onclick="App.insightgenView.addSource()">${App.icon('arrow')} Back</button><button class="btn btn--primary" onclick="App.insightgenView._doConnect('${type}')">${App.icon('plug')} Connect</button>`
    });
    setTimeout(() => { const i = document.getElementById('dsName'); if (i) i.focus(); }, 80);
  },
  _uploadSource() {
    App.openModal({
      title: 'Upload a dataset', sub: 'CSV or Excel - parsed into a queryable table.',
      body: `<div class="field"><label>Dataset name <span class="req">*</span></label><input class="input" id="dsName" placeholder="e.g. Q2 disbursals export"/></div>
        <div class="field" style="margin-bottom:0"><label>File</label><div class="pdf-ph" style="min-height:auto;padding:22px;text-align:center;cursor:pointer">${App.icon('download')}<div class="muted" style="margin-top:8px;font-size:12.5px">Click to upload CSV / Excel (≤ 50 MB)</div></div></div>`,
      footer: `<button class="btn" onclick="App.insightgenView.addSource()">${App.icon('arrow')} Back</button><button class="btn btn--primary" onclick="App.insightgenView._doConnect('Upload')">${App.icon('check')} Add dataset</button>`
    });
    setTimeout(() => { const i = document.getElementById('dsName'); if (i) i.focus(); }, 80);
  },
  _doConnect(type) {
    const raw = ((document.getElementById('dsName') || {}).value || '').trim();
    if (!raw) { App.toast('Give the source a name', 'warn'); return; }
    if (App.insightgenView.DBS.indexOf(raw) < 0) App.insightgenView.DBS.push(raw);
    App.insightgenView._state().db = raw;
    App.closeModal();
    App.toast((type === 'Upload' ? 'Dataset added' : type + ' connected') + ' · “' + raw + '” is now queryable (demo)', 'ok');
    App.reload();
  },

  CHIPS: [
    'Top reasons for application rejection',
    'NPA rate by product',
    'Conversion by branch'
  ],

  _state() {
    if (!App.state.insightgen) App.state.insightgen = { tab: 'chat', db: 'Personal Loan Book', thread: [], subtab: {} };
    return App.state.insightgen;
  },

  setTab(t) {
    this._state().tab = t;
    const host = document.getElementById('igTabBody');
    if (!host) { App.reload(); return; }
    // Update content first, then re-toggle the top-level tab row (the .tabs that
    // sits immediately before #igTabBody). Scoping avoids touching sub-tab rows.
    host.innerHTML = t === 'chat' ? this.chatHtml() : this.insightsHtml();
    const row = host.previousElementSibling; // the top-level <div class="tabs">
    if (row && row.classList.contains('tabs')) {
      const tabs = row.querySelectorAll('.tab');
      if (tabs[0]) tabs[0].classList.toggle('is-active', t === 'chat');
      if (tabs[1]) tabs[1].classList.toggle('is-active', t !== 'chat');
    }
    if (t === 'chat') this.renderThread();
  },

  setDb(v) {
    this._state().db = v;
    const lbl = document.getElementById('igDbLabel');
    if (lbl) lbl.textContent = v;
    App.toast('Switched to ' + v, 'ok');
  },

  /* ---------------- CHAT TAB ---------------- */
  chatHtml() {
    const s = this._state();
    return `<div class="card">
        <div class="card__body">
          <div class="search-input" style="min-width:0">
            ${App.icon('sparkles')}
            <input id="igInput" placeholder="Ask a question about your data…" onkeydown="if(event.key==='Enter'){event.preventDefault();App.insightgenView.run();}"/>
            <button class="btn btn--primary btn--sm" onclick="App.insightgenView.run()">${App.icon('send')} Ask</button>
          </div>
          <div class="row wrap gap-6 mt-12">
            <span class="muted" style="font-size:12px;align-self:center">Try:</span>
            ${this.CHIPS.map(c => `<button class="btn btn--sm" onclick="App.insightgenView.run('${c.replace(/'/g,"\\'")}')">${App.icon('search')} ${App.esc(c)}</button>`).join('')}
          </div>
        </div>
      </div>
      <div id="igThread" style="margin-top:16px">${s.thread.length ? '' : App.ui.empty('chart', 'No queries yet', 'Ask a question above - Tara generates the SQL, runs it on the analytics replica, and returns a result, chart and explanation.')}</div>`;
  },

  run(text) {
    const inp = document.getElementById('igInput');
    text = (text || (inp && inp.value) || '').trim();
    if (!text) return;
    if (inp) inp.value = '';
    const s = this._state();
    const id = 'q' + (s.thread.length + 1) + '-' + Date.now();
    const ql = text.toLowerCase();
    let kind = 'generic';
    if (ql.includes('reject')) kind = 'rejection';
    else if (ql.includes('npa') || (ql.includes('product') && ql.includes('rate'))) kind = 'npa';
    else if (ql.includes('conversion') || ql.includes('branch')) kind = 'branch';

    s.thread.push({ id, q: text, kind, subtab: 'result', loading: true });
    s.subtab[id] = 'result';
    this.renderThread();

    setTimeout(() => {
      const item = s.thread.find(t => t.id === id);
      if (item) item.loading = false;
      this.renderThread();
    }, 600);
  },

  renderThread() {
    const host = document.getElementById('igThread');
    if (!host) return;
    const s = this._state();
    if (!s.thread.length) return;
    // newest first
    host.innerHTML = s.thread.slice().reverse().map(t => this.resultCard(t)).join('');
  },

  resultCard(t) {
    if (t.loading) {
      return `<div class="card" style="margin-bottom:16px"><div class="card__body">
        <div class="row gap-8"><span class="tag">${App.esc(t.q)}</span></div>
        <div class="row gap-8 mt-12" style="color:var(--muted);font-size:13px"><div class="typing"><span></span><span></span><span></span></div> Generating SQL and running query…</div>
      </div></div>`;
    }
    const a = this._answer(t.kind, t.q);
    const sub = (this._state().subtab[t.id]) || 'result';
    const tabBtn = (key, label, icon) => `<div class="tab ${sub === key ? 'is-active' : ''}" onclick="App.insightgenView.setSub('${t.id}','${key}')">${App.icon(icon)} ${label}</div>`;
    let pane = '';
    if (sub === 'sql') pane = `<pre class="code">${a.sql}</pre>`;
    else if (sub === 'chart') pane = a.chart;
    else pane = a.result;

    return `<div class="card" style="margin-bottom:16px">
      <div class="card__head">${App.icon('chart')}<h3>${App.esc(t.q)}</h3><div class="spacer"></div><span class="muted" style="font-size:12px">${App.esc(this._state().db)}</span></div>
      <div class="card__body">
        <div class="grid" style="grid-template-columns:1fr 1.25fr;gap:18px">
          <div>
            <div class="answer-card__h" style="border:none;background:transparent;padding:0 0 8px">${App.icon('sparkles')} Conversation</div>
            <div class="answer-card"><div class="answer-card__b" style="font-size:13.5px;line-height:1.6">${a.answer}</div></div>
          </div>
          <div>
            <div class="tabs" style="margin-bottom:14px">${tabBtn('sql', 'Generated SQL', 'code')}${tabBtn('result', 'Result', 'database')}${tabBtn('chart', 'Chart', 'chart')}</div>
            <div>${pane}</div>
          </div>
        </div>
      </div>
    </div>`;
  },

  setSub(id, key) {
    this._state().subtab[id] = key;
    const item = this._state().thread.find(t => t.id === id);
    if (item) item.subtab = key;
    this.renderThread();
  },

  /* ---------------- answer builders ---------------- */
  _answer(kind, q) {
    if (kind === 'rejection') return this._rejectionAnswer();
    if (kind === 'npa') return this._npaAnswer();
    if (kind === 'branch') return this._branchAnswer();
    return this._genericAnswer(q);
  },

  _rejectionAnswer() {
    const rows = DB.rejectionReasons;
    const total = rows.reduce((s, r) => s + r.count, 0);
    const max = Math.max.apply(null, rows.map(r => r.count));
    const top = rows[0];
    const pct = (c) => (100 * c / total).toFixed(1) + '%';

    const sql = `<span class="k">SELECT</span> rejection_reason,
       <span class="k">COUNT</span>(*) <span class="k">AS</span> applications,
       <span class="k">ROUND</span>(100.0 * <span class="k">COUNT</span>(*) / <span class="k">SUM</span>(<span class="k">COUNT</span>(*)) <span class="k">OVER</span> (), 1) <span class="k">AS</span> pct_of_total
<span class="k">FROM</span> loan_applications
<span class="k">WHERE</span> status = <span class="s">'Rejected'</span>
<span class="k">GROUP BY</span> rejection_reason
<span class="k">ORDER BY</span> applications <span class="k">DESC</span>;`;

    const tblRows = rows.map(r => `<tr><td class="cell-strong">${App.esc(r.reason)}</td><td><span class="mono">${r.count}</span></td><td>${App.ui.pill(pct(r.count), 'violet')}</td></tr>`).join('');
    const result = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Rejection reason</th><th>Applications</th><th>% of total</th></tr></thead><tbody>${tblRows}</tbody></table></div>
      <div class="row gap-8 mt-12"><span class="muted" style="font-size:12px;align-self:center">${rows.length} rows · ${total} rejected applications</span><div class="spacer" style="flex:1"></div><button class="btn btn--sm" onclick="App.toast('Exported result to CSV (demo)','ok')">${App.icon('download')} Download</button></div>`;

    const chart = `<div style="padding:4px 0">${rows.map(r => `<div class="bar-row"><div class="bar-row__lbl">${App.esc(r.reason)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, 100 * r.count / max).toFixed(0)}%">${r.count}</div></div><div class="bar-row__val">${pct(r.count)}</div></div>`).join('')}</div>`;

    const answer = `<p>Across <strong>${total}</strong> rejected personal-loan applications, the single biggest driver is <strong>${App.esc(top.reason)}</strong> at <strong>${App.esc(pct(top.count))}</strong> (${top.count} applications).</p>
      <p>The top three reasons - ${App.esc(rows[0].reason)}, ${App.esc(rows[1].reason)} and ${App.esc(rows[2].reason)} - together account for <strong>${pct(rows[0].count + rows[1].count + rows[2].count)}</strong> of all rejections, so tuning the bureau-score and FOIR cut-offs would move the needle most.</p>`;

    return { sql, result, chart, answer, followup: 'What is the personal loan eligibility criteria?' };
  },

  _npaAnswer() {
    const data = [
      { reason: 'Personal Loan', count: 66 },
      { reason: 'Two-Wheeler', count: 41 },
      { reason: 'MSME', count: 38 },
      { reason: 'Home Loan', count: 17 }
    ];
    const max = Math.max.apply(null, data.map(d => d.count));
    const fmt = (c) => (c / 10).toFixed(1) + '%';
    const sql = `<span class="k">SELECT</span> product,
       <span class="k">ROUND</span>(100.0 * <span class="k">SUM</span>(<span class="k">CASE WHEN</span> dpd &gt; 90 <span class="k">THEN</span> 1 <span class="k">ELSE</span> 0 <span class="k">END</span>) / <span class="k">COUNT</span>(*), 1) <span class="k">AS</span> npa_pct
<span class="k">FROM</span> loan_book
<span class="k">GROUP BY</span> product
<span class="k">ORDER BY</span> npa_pct <span class="k">DESC</span>;`;
    const tblRows = data.map(d => `<tr><td class="cell-strong">${App.esc(d.reason)}</td><td>${App.ui.pill(fmt(d.count), d.count >= 60 ? 'red' : d.count >= 40 ? 'amber' : 'green')}</td></tr>`).join('');
    const result = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Product</th><th>NPA %</th></tr></thead><tbody>${tblRows}</tbody></table></div>
      <div class="row gap-8 mt-12"><span class="muted" style="font-size:12px;align-self:center">${data.length} rows · 90+ DPD basis</span><div class="spacer" style="flex:1"></div><button class="btn btn--sm" onclick="App.toast('Exported result to CSV (demo)','ok')">${App.icon('download')} Download</button></div>`;
    const chart = `<div style="padding:4px 0">${data.map(d => `<div class="bar-row"><div class="bar-row__lbl">${App.esc(d.reason)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, 100 * d.count / max).toFixed(0)}%">${fmt(d.count)}</div></div><div class="bar-row__val">${fmt(d.count)}</div></div>`).join('')}</div>`;
    const answer = `<p><strong>Personal Loan</strong> carries the highest NPA at <strong>6.6%</strong>, above the 6% internal threshold, driven by the sub-700 CIBIL cohort.</p>
      <p>Two-Wheeler (4.1%) and MSME (3.8%) sit in the watch band; Home Loan stays healthy at 1.7%.</p>`;
    return { sql, result, chart, answer, followup: 'What is the collections and recovery policy?' };
  },

  _branchAnswer() {
    const data = [
      { reason: 'Andheri', count: 221 },
      { reason: 'Pune Camp', count: 198 },
      { reason: 'Bandra', count: 176 },
      { reason: 'Network average', count: 180 },
      { reason: 'Thane', count: 106 }
    ];
    const max = Math.max.apply(null, data.map(d => d.count));
    const fmt = (c) => (c / 10).toFixed(1) + '%';
    const sql = `<span class="k">SELECT</span> branch,
       <span class="k">ROUND</span>(100.0 * disbursed / logins, 1) <span class="k">AS</span> conversion_pct
<span class="k">FROM</span> branch_funnel
<span class="k">ORDER BY</span> conversion_pct <span class="k">DESC</span>;`;
    const tblRows = data.map(d => `<tr><td class="cell-strong">${App.esc(d.reason)}</td><td>${App.ui.pill(fmt(d.count), d.count < 120 ? 'red' : 'green')}</td></tr>`).join('');
    const result = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Branch</th><th>Conversion %</th></tr></thead><tbody>${tblRows}</tbody></table></div>
      <div class="row gap-8 mt-12"><span class="muted" style="font-size:12px;align-self:center">${data.length} rows · login → disbursal</span><div class="spacer" style="flex:1"></div><button class="btn btn--sm" onclick="App.toast('Exported result to CSV (demo)','ok')">${App.icon('download')} Download</button></div>`;
    const chart = `<div style="padding:4px 0">${data.map(d => `<div class="bar-row"><div class="bar-row__lbl">${App.esc(d.reason)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, 100 * d.count / max).toFixed(0)}%">${fmt(d.count)}</div></div><div class="bar-row__val">${fmt(d.count)}</div></div>`).join('')}</div>`;
    const answer = `<p><strong>Thane</strong> converts logins to disbursals at just <strong>10.6%</strong>, well below the <strong>18%</strong> network average.</p>
      <p>Andheri (22.1%) and Pune Camp (19.8%) lead the network - worth comparing their underwriting turnaround against Thane's.</p>`;
    return { sql, result, chart, answer, followup: 'What is the collections and recovery policy?' };
  },

  _genericAnswer(q) {
    const rows = DB.rejectionReasons.slice(0, 4);
    const total = rows.reduce((s, r) => s + r.count, 0);
    const max = Math.max.apply(null, rows.map(r => r.count));
    const sql = `<span class="c">-- interpreted: ${App.esc(q)}</span>
<span class="k">SELECT</span> dimension, <span class="k">COUNT</span>(*) <span class="k">AS</span> n
<span class="k">FROM</span> loan_applications
<span class="k">GROUP BY</span> dimension
<span class="k">ORDER BY</span> n <span class="k">DESC</span>
<span class="k">LIMIT</span> <span class="n">10</span>;`;
    const tblRows = rows.map(r => `<tr><td class="cell-strong">${App.esc(r.reason)}</td><td><span class="mono">${r.count}</span></td></tr>`).join('');
    const result = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Dimension</th><th>Count</th></tr></thead><tbody>${tblRows}</tbody></table></div>
      <div class="row gap-8 mt-12"><span class="muted" style="font-size:12px;align-self:center">${rows.length} rows</span><div class="spacer" style="flex:1"></div><button class="btn btn--sm" onclick="App.toast('Exported result to CSV (demo)','ok')">${App.icon('download')} Download</button></div>`;
    const chart = `<div style="padding:4px 0">${rows.map(r => `<div class="bar-row"><div class="bar-row__lbl">${App.esc(r.reason)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(8, 100 * r.count / max).toFixed(0)}%">${r.count}</div></div><div class="bar-row__val">${(100 * r.count / total).toFixed(0)}%</div></div>`).join('')}</div>`;
    const answer = `<p>I interpreted <em>“${App.esc(q)}”</em> against the <strong>${App.esc(this._state().db)}</strong>. Here is a first-pass breakdown - refine the question (e.g. add a time window or product) for a sharper cut.</p>
      <p class="muted" style="margin-top:6px;font-size:12.5px">Tip: try one of the example chips above for a fully modelled result.</p>`;
    return { sql, result, chart, answer, followup: q };
  },

  /* ---------------- AI INSIGHTS TAB ---------------- */
  insightsHtml() {
    const cards = DB.insights.map(i => {
      const pk = i.priority === 'High' ? 'red' : i.priority === 'Medium' ? 'amber' : 'gray';
      const open = !!(this._state().openSql && this._state().openSql[i.id]);
      return `<div class="card card--pad">
        <div class="row gap-8" style="margin-bottom:10px">
          ${App.ui.pill(i.priority + ' priority', pk, true)}
          <span class="tag">${App.esc(i.cat)}</span>
          <div class="spacer" style="flex:1"></div>
          ${App.icon('zap', '')}
        </div>
        <div style="font-size:30px;font-weight:800;letter-spacing:-.02em">${App.esc(i.metric)}</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${App.esc(i.title)}</div>
        <p class="muted" style="font-size:13px;margin-top:6px;line-height:1.55">${App.esc(i.desc)}</p>
        <div class="divider"></div>
        <button class="btn btn--ghost btn--sm" style="padding-left:0" onclick="App.insightgenView.toggleSql('${i.id}')">${App.icon('code')} SQL Query ${App.icon('chevron')}</button>
        <div id="igSql-${i.id}" style="${open ? '' : 'display:none'};margin-top:10px"><pre class="code">${this._fmtSql(i.sql)}</pre></div>
        <div class="row gap-8 mt-12">
          <button class="btn btn--primary btn--sm" onclick="App.insightgenView.investigate('${i.id}')">${App.icon('search')} Investigate</button>
          <button class="btn btn--sm" onclick="App.toast('Insight dismissed (demo)','ok')">${App.icon('x')} Dismiss</button>
        </div>
      </div>`;
    }).join('');
    return `<div class="info-banner" style="background:var(--teal-50);border-color:#a5f3fc;color:var(--teal-600)">${App.icon('sparkles')} <span>Tara scans your data on a schedule and raises anomalies proactively - ranked by priority. ${DB.insights.length} active insight${DB.insights.length === 1 ? '' : 's'}.</span></div>
      <div class="grid grid-3">${cards}</div>`;
  },

  toggleSql(id) {
    const st = this._state();
    if (!st.openSql) st.openSql = {};
    st.openSql[id] = !st.openSql[id];
    const el = document.getElementById('igSql-' + id);
    if (el) el.style.display = st.openSql[id] ? '' : 'none';
  },

  investigate(id) {
    const i = DB.insights.find(x => x.id === id);
    if (!i) return;
    // Route the relevant ones into a real Chat query; otherwise hand off to Tara.
    let q = '';
    if (/rejection/i.test(i.title)) q = 'Top reasons for application rejection';
    else if (/npa/i.test(i.title)) q = 'NPA rate by product';
    else if (/conversion/i.test(i.title) || /branch/i.test(i.title)) q = 'Conversion by branch';
    if (q) {
      this.setTab('chat');
      App.toast('Investigating in Chat…', 'ok');
      this.run(q);
    } else {
      App.goAskHome('Investigate: ' + i.title);
    }
  },

  _fmtSql(sql) {
    // light keyword highlighting for the insight SQL strings stored in DB
    let s = App.esc(sql);
    s = s.replace(/'[^']*'/g, m => `<span class="s">${m}</span>`);
    s = s.replace(/\b(SELECT|FROM|WHERE|GROUP BY|GROUP|BY|ORDER|HAVING|AS|AND|OR|CASE|WHEN|THEN|ELSE|END|SUM|COUNT|ROUND|OVER|LIMIT|DESC|ASC)\b/g, m => `<span class="k">${m}</span>`);
    return s;
  }
};
