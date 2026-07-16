/* BRE Decoder - turn Business-Rule-Engine code into human-readable documentation */
App.registerView('bredecoder', {
  title: 'BRE Decoder',
  render(ctx) {
    if (!App.canAccessView('bredecoder', ctx.user)) return App.lockedPage('BRE Decoder', 'BRE Decoder is for administrators and policy managers.');
    // initialise / reset state for this view
    App.state.bredecoder = {
      phase: 'idle',                 // 'idle' | 'generating' | 'done'
      source: 'code',                // 'code' | 'file'
      lang: 'JSONata',
      code: App.bredecoderView.SAMPLE,
      context: '',
      timer: null
    };
    return `<div class="page">
      <div class="page__head">
        <div><h1>BRE Decoder</h1><p>Paste raw business-rule-engine logic and Tara turns it into clean, reviewable documentation - what it does, the step-by-step logic, and the business interpretation.</p></div>
        <div class="spacer"></div>
        <span class="pill pill--teal">${App.icon('sparkles')} Claude · on-prem</span>
      </div>
      <div class="info-banner">${App.icon('info')} <span>Decoding runs <strong>locally on your BYO-LLM gateway</strong> - rule logic never leaves your environment. Output is editable before export.</span></div>
      <div class="grid" id="breGrid" style="grid-template-columns:minmax(0,0.95fr) minmax(0,1.05fr);align-items:start">
        <div id="breInput">${App.bredecoderView.inputHtml()}</div>
        <div id="breOutput">${App.bredecoderView.outputHtml()}</div>
      </div>
    </div>`;
  },
  mount(root) {
    App.bredecoderView.wireInput(root);
  }
});

App.bredecoderView = {

  SAMPLE:
`/* Loan Eligibility Rule - Personal Loan */
(
  $age := applicant.age;
  $cibil := applicant.cibil_score;

  ($age >= 21 and $age <= 60) and $cibil >= 700
    ? {
        "decision": "APPROVED",
        "reason": "Meets age band and bureau cutoff"
      }
    : {
        "decision": "REJECTED",
        "reason": "Outside age band 21-60 or CIBIL below 700"
      }
)`,

  /* -------- left column: the input form -------- */
  inputHtml() {
    const s = App.state.bredecoder;
    return `<div class="card">
      <div class="card__head">${App.icon('code')}<h3>Rule source</h3><div class="spacer"></div>
        <div class="tabs" style="margin:0;border:none">
          <div class="tab ${s.source==='code'?'is-active':''}" onclick="App.bredecoderView.setSource('code')">Code</div>
          <div class="tab ${s.source==='file'?'is-active':''}" onclick="App.bredecoderView.setSource('file')">Text File</div>
        </div>
      </div>
      <div class="card__body">
        ${s.source==='file'
          ? `<div class="pdf-ph" id="breDrop" style="min-height:auto;padding:26px;text-align:center;cursor:pointer" onclick="App.bredecoderView.fauxUpload()">${App.icon('download')}<div class="muted" style="margin-top:8px;font-size:12.5px">Click to upload a rule file - <strong>.txt / .json / .drl</strong> (≤ 2 MB)</div></div>
             <div class="field hint" style="margin-top:10px">Uploaded files are parsed into the editor below - review before generating.</div>`
          : ''}
        <div class="field">
          <label>Rule logic <span class="req">*</span></label>
          <textarea class="textarea mono" id="breCode" rows="14" style="min-height:280px;font-size:12.5px;line-height:1.55" placeholder="Paste your BRE expression…">${App.esc(s.code)}</textarea>
        </div>
        <div class="field">
          <label>Additional context <span class="hint" style="display:inline;margin:0;font-weight:400">(optional)</span></label>
          <textarea class="textarea" id="breCtx" rows="2" placeholder="e.g. This rule sits at the top of the personal-loan decision tree; CIBIL is fetched live from the bureau.">${App.esc(s.context)}</textarea>
        </div>
        <div class="grid grid-2" style="gap:12px;align-items:end">
          <div class="field" style="margin:0">
            <label>Language</label>
            <select class="select" id="breLang" style="width:100%">
              ${['JSONata','JSON Rules','Drools (DRL)','Python expression','SQL CASE'].map(l=>`<option ${l===s.lang?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn--primary" id="breGen" style="height:40px;justify-content:center" onclick="App.bredecoderView.generate()">${App.icon('sparkles')} Generate docs</button>
        </div>
      </div>
    </div>`;
  },

  /* -------- right column: dispatches by phase -------- */
  outputHtml() {
    const s = App.state.bredecoder;
    if (s.phase === 'generating') return App.bredecoderView.generatingHtml();
    if (s.phase === 'done') return App.bredecoderView.docHtml();
    return App.bredecoderView.placeholderHtml();
  },

  placeholderHtml() {
    return `<div class="card" style="min-height:480px;display:flex;align-items:center;justify-content:center">
      ${App.ui.empty('book', 'Documentation appears here', 'Paste a rule on the left and hit Generate docs - Tara explains the logic in plain English.')}
    </div>`;
  },

  generatingHtml() {
    return `<div class="card">
      <div class="card__head">${App.icon('sparkles')}<h3>Generating documentation…</h3><div class="spacer"></div>
        <button class="btn btn--danger btn--sm" onclick="App.bredecoderView.stop()">${App.icon('x')} Stop Claude</button>
      </div>
      <div class="card__body">
        <div class="row gap-8" style="margin-bottom:16px"><span class="pill pill--teal pill--dot">Claude is reading the rule</span><span class="muted" style="font-size:12px">decoding ${App.esc(App.state.bredecoder.lang)} expression…</span></div>
        <div class="pdf-ph" style="min-height:auto;padding:22px">
          <div class="pdf-ph__title"></div>
          <div class="pdf-ph__bar w90"></div>
          <div class="pdf-ph__bar w70"></div>
          <div class="pdf-ph__bar w80"></div>
          <div style="height:14px"></div>
          <div class="pdf-ph__bar w50"></div>
          <div class="pdf-ph__bar w90"></div>
          <div class="pdf-ph__bar w70"></div>
          <div style="height:14px"></div>
          <div class="pdf-ph__bar w80"></div>
          <div class="pdf-ph__bar w50"></div>
        </div>
      </div>
    </div>`;
  },

  /* -------- the rendered document (content keyed to the sample JSONata) -------- */
  docHtml() {
    const s = App.state.bredecoder;
    const ctxLine = s.context && s.context.trim()
      ? `<div class="minirow"><span class="muted">Author context</span><span class="spacer" style="flex:1"></span><b style="text-align:right;max-width:60%">${App.esc(s.context.trim())}</b></div>`
      : '';

    // syntax-highlight a lightweight version of the sample for the doc body
    const codeBlock = App.bredecoderView.highlight(s.code);

    return `<div class="card">
      <div class="card__head">${App.icon('file')}<h3>Edit and Export</h3><div class="spacer"></div>
        <div class="row gap-6">
          <button class="btn btn--sm" onclick="App.bredecoderView.reset()">${App.icon('plus')} New</button>
          <button class="btn btn--sm" onclick="App.bredecoderView.edit()">${App.icon('edit')} Edit</button>
          <button class="btn btn--sm" onclick="App.bredecoderView.copy()">${App.icon('clipboard')} Copy markdown</button>
          <button class="btn btn--sm btn--primary" onclick="App.bredecoderView.pdf()">${App.icon('download')} Download PDF</button>
        </div>
      </div>
      <div class="card__body" id="breDoc">
        <div class="row gap-8" style="flex-wrap:wrap;margin-bottom:14px">
          ${App.ui.pill('Loan Eligibility Rule','violet')}
          ${App.ui.pill(s.lang,'gray')}
          ${App.ui.pill('Auto-generated','teal',true)}
        </div>

        <b style="font-size:12.5px;color:var(--muted)">Original rule</b>
        <pre class="code" style="margin:8px 0 18px">${codeBlock}</pre>

        <h3 style="font-size:15px;margin-bottom:8px">What this rule does</h3>
        <p style="color:var(--ink-2);margin-bottom:18px">This rule decides whether a personal-loan applicant is <strong>eligible</strong>. It checks two things about the applicant - their <strong>age</strong> and their <strong>CIBIL credit score</strong>. If the applicant is between <strong>21 and 60 years old (inclusive)</strong> <em>and</em> has a CIBIL score of <strong>700 or higher</strong>, the rule returns <strong>APPROVED</strong>. If either condition fails, it returns <strong>REJECTED</strong> with the reason that the applicant is outside the age band or below the bureau cutoff.</p>

        <h3 style="font-size:15px;margin-bottom:8px">Step-by-step logic <span class="muted" style="font-weight:400;font-size:12.5px">(in the same order as written)</span></h3>
        <div style="margin-bottom:18px">
          ${App.bredecoderView.step(1, '<code>$age := applicant.age</code>', 'Read the applicant’s age from the input payload into a local variable <b>$age</b>.')}
          ${App.bredecoderView.step(2, '<code>$cibil := applicant.cibil_score</code>', 'Read the applicant’s bureau score into a local variable <b>$cibil</b>.')}
          ${App.bredecoderView.step(3, '<code>$age &gt;= 21 and $age &lt;= 60</code>', 'Confirm the applicant falls inside the permitted age band - at least 21 and at most 60. Both bounds are inclusive.')}
          ${App.bredecoderView.step(4, '<code>and $cibil &gt;= 700</code>', 'In addition to the age check, require a CIBIL score of 700 or more. The <b>and</b> means <b>both</b> the age band and the score must pass.')}
          ${App.bredecoderView.step(5, '<code>? { "decision": "APPROVED" … }</code>', 'When every condition above is true, return an APPROVED object with a confirming reason.')}
          ${App.bredecoderView.step(6, '<code>: { "decision": "REJECTED" … }</code>', 'Otherwise (the ternary <b>else</b> branch) return REJECTED, citing the age band or the sub-700 score as the cause.')}
        </div>

        <h3 style="font-size:15px;margin-bottom:8px">Business interpretation</h3>
        <p style="color:var(--ink-2);margin-bottom:8px">In plain business terms, this is the <strong>first gate</strong> in the personal-loan decision flow. Only applicants who are <strong>working-age (21–60)</strong> and carry a <strong>healthy credit history (CIBIL ≥ 700)</strong> pass through to the next stage of underwriting. Everyone else is screened out up front, before any heavier checks (FOIR, income, documents) are run.</p>
        <div class="card card--pad" style="background:var(--surface-2);margin-bottom:18px">
          <div class="minirow"><span class="muted">Approve when</span><span class="spacer" style="flex:1"></span>${App.ui.pill('21 ≤ age ≤ 60 AND CIBIL ≥ 700','green')}</div>
          <div class="minirow"><span class="muted">Reject when</span><span class="spacer" style="flex:1"></span>${App.ui.pill('age < 21 / age > 60 / CIBIL < 700','red')}</div>
          <div class="minirow"><span class="muted">Maps to policy</span><span class="spacer" style="flex:1"></span><b>Personal Loan Credit Policy · v3.2</b></div>
          ${ctxLine}
        </div>

        <h3 style="font-size:15px;margin-bottom:8px">Notes / assumptions</h3>
        <ul style="color:var(--ink-2);margin:0;padding-left:20px;line-height:1.7">
          <li>Both age bounds are treated as <strong>inclusive</strong> - exactly 21 and exactly 60 are accepted.</li>
          <li>The score threshold uses <strong>≥ 700</strong>, so a CIBIL of exactly 700 passes.</li>
          <li>Assumes <code>applicant.age</code> and <code>applicant.cibil_score</code> are present and numeric; a missing or null field would cause the comparison to fail and route to <strong>REJECTED</strong>.</li>
          <li>This rule only covers eligibility screening - FOIR, minimum income (₹25,000/mo) and tenure limits are enforced by downstream rules.</li>
          <li>Note: PolicyOS shows a pending change (REQ-1041) to raise the CIBIL cutoff from 700 to 720 - re-decode after it is approved.</li>
        </ul>
      </div>
    </div>`;
  },

  step(n, head, meaning) {
    return `<div class="minirow" style="align-items:flex-start;gap:11px;padding:10px 0">
      <span class="step__num" style="margin-top:1px">${n}</span>
      <div style="flex:1">
        <div class="mono" style="font-size:12.5px;color:var(--ink)">${head}</div>
        <div class="muted" style="font-size:12.5px;margin-top:3px"><b style="color:var(--ink-2);font-weight:600">Meaning:</b> ${meaning}</div>
      </div>
    </div>`;
  },

  /* very small JSONata-ish highlighter for the dark code block */
  highlight(src) {
    let h = App.esc(src);
    // comments first
    h = h.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="c">$1</span>');
    // string literals
    h = h.replace(/(&quot;[^&]*?&quot;)/g, '<span class="s">$1</span>');
    // keywords / operators
    h = h.replace(/\b(and|or|not|in)\b/g, '<span class="k">$1</span>');
    h = h.replace(/(:=|\?|:|&gt;=|&lt;=|&gt;|&lt;)/g, '<span class="n">$1</span>');
    return h;
  },

  /* ---------------- interactions ---------------- */
  // read live form values back into state so re-renders keep edits
  sync(root) {
    root = root || document.getElementById('viewRoot');
    const code = root.querySelector('#breCode'); if (code) App.state.bredecoder.code = code.value;
    const ctx = root.querySelector('#breCtx'); if (ctx) App.state.bredecoder.context = ctx.value;
    const lang = root.querySelector('#breLang'); if (lang) App.state.bredecoder.lang = lang.value;
  },

  wireInput(root) {
    const code = root.querySelector('#breCode');
    const ctx = root.querySelector('#breCtx');
    const lang = root.querySelector('#breLang');
    if (code) code.oninput = () => { App.state.bredecoder.code = code.value; };
    if (ctx) ctx.oninput = () => { App.state.bredecoder.context = ctx.value; };
    if (lang) lang.onchange = () => { App.state.bredecoder.lang = lang.value; };
  },

  renderInput() {
    const el = document.getElementById('breInput');
    if (el) { el.innerHTML = App.bredecoderView.inputHtml(); App.bredecoderView.wireInput(document.getElementById('viewRoot')); }
  },
  renderOutput() {
    const el = document.getElementById('breOutput');
    if (el) el.innerHTML = App.bredecoderView.outputHtml();
  },

  setSource(src) {
    App.bredecoderView.sync();
    App.state.bredecoder.source = src;
    App.bredecoderView.renderInput();
  },

  fauxUpload() {
    App.state.bredecoder.code = App.bredecoderView.SAMPLE;
    App.state.bredecoder.source = 'code';
    App.bredecoderView.renderInput();
    App.toast('loan_eligibility.json parsed into editor (demo)');
  },

  generate() {
    App.bredecoderView.sync();
    const s = App.state.bredecoder;
    if (!s.code || !s.code.trim()) { App.toast('Paste a rule first', 'warn'); return; }
    s.phase = 'generating';
    App.bredecoderView.renderOutput();
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      s.timer = null;
      App.state.bredecoder.phase = 'done';
      App.bredecoderView.renderOutput();
    }, 1400);
  },

  stop() {
    const s = App.state.bredecoder;
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    s.phase = 'idle';
    App.bredecoderView.renderOutput();
    App.toast('Generation stopped', 'warn');
  },

  reset() {
    const s = App.state.bredecoder;
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    s.phase = 'idle';
    App.bredecoderView.renderOutput();
  },

  edit() {
    App.openModal({
      title: 'Edit documentation', sub: 'Tweak the generated narrative before exporting. Markdown is supported.', lg: true,
      body: `<div class="field"><label>What this rule does</label><textarea class="textarea" rows="3">This rule decides whether a personal-loan applicant is eligible based on age (21–60 inclusive) and CIBIL score (≥ 700). Both must pass for APPROVED, otherwise REJECTED.</textarea></div>
        <div class="field"><label>Business interpretation</label><textarea class="textarea" rows="3">First gate in the personal-loan decision flow. Screens out applicants outside the working-age band or with thin/weak credit before heavier underwriting.</textarea></div>
        <div class="field" style="margin:0"><label>Notes / assumptions</label><textarea class="textarea" rows="3">Bounds inclusive; missing fields route to REJECTED; downstream rules handle FOIR, income and tenure.</textarea></div>`,
      footer: `<button class="btn" onclick="App.closeModal()">Cancel</button><button class="btn btn--primary" onclick="App.closeModal();App.toast('Documentation updated (demo)')">Save changes</button>`
    });
  },

  copy() {
    const md = `# Loan Eligibility Rule\n\n## What this rule does\nApproves a personal-loan applicant when age is 21–60 (inclusive) AND CIBIL >= 700; otherwise rejects.\n\n## Step-by-step logic\n1. Read applicant.age into $age.\n2. Read applicant.cibil_score into $cibil.\n3. Check 21 <= age <= 60.\n4. Require cibil >= 700 (both conditions must pass).\n5. If true -> APPROVED.\n6. Else -> REJECTED.\n\n## Business interpretation\nFirst eligibility gate in the personal-loan flow.\n\n## Notes / assumptions\nBounds inclusive; missing fields -> REJECTED; downstream rules handle FOIR/income/tenure.`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(
        () => App.toast('Markdown copied to clipboard'),
        () => App.toast('Markdown ready (copy unavailable in this context)', 'warn')
      );
    } else {
      App.toast('Markdown copied to clipboard');
    }
  },

  pdf() {
    App.toast('Generating BRE_Loan_Eligibility_docs.pdf (demo)');
  }
};
