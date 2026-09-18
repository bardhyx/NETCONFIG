/* ==========================================================================
   NET // CONFIG — Application shell & views
   Hash router, generator workspace, history (LocalStorage), templates,
   calculator, command reference, settings, command palette, shortcuts.
   ========================================================================== */
(function () {
  'use strict';
  const NC = window.NC;
  const E = NC.Engine;
  const esc = NC.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const icon = (n, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const resolve = (x, ...a) => (typeof x === 'function' ? x(...a) : x);

  /* ------------------------------ Storage ------------------------------ */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('netconfig.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('netconfig.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem('netconfig.' + k); } catch (e) { /* ignore */ } }
  };
  const settings = Object.assign({ header: true, lineNumbers: true, wrap: false, defaultVendor: 'cisco' }, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);

  /* ------------------------------ State ------------------------------ */
  const S = {
    view: 'dashboard', vendor: NC.VENDORS[settings.defaultVendor] ? settings.defaultVendor : 'cisco', device: null,
    module: 'vlan', bundle: ['vlan'], params: {}, includeSecrets: false,
    result: null, validated: false, templateName: null, outTab: 'config', fullscreen: false, busy: false,
    calc: { tab: 'ipv4', v4: '192.168.10.0/24', split: '26', vlsmBase: '10.10.0.0/22', vlsm: [{ name: 'USERS', hosts: '200' }, { name: 'VOICE', hosts: '100' }, { name: 'SERVERS', hosts: '50' }, { name: 'MGMT', hosts: '20' }, { name: 'P2P-WAN', hosts: '2' }], mask: '255.255.255.192', binIp: '192.168.10.1', binIn: '11000000.10101000.00001010.00000001', v6: '2001:db8:acad:10::1/64', mac: '00:1A:2B:3C:4D:5E' },
    cmd: { tab: 'Cisco', q: '' },
    tpl: { vendor: 'all', q: '' }
  };
  S.device = NC.VENDORS[S.vendor].devices[0];

  const P = (mod) => {
    if (!S.params[mod]) S.params[mod] = E.defaults(mod, S.vendor, S.device);
    return S.params[mod];
  };
  /** When vendor/device changes, move untouched vendor-specific defaults (interface names) to the new platform. */
  function reDefault(oldV, oldD) {
    Object.keys(S.params).forEach((mod) => {
      const p = S.params[mod];
      E.schema(mod).forEach((fl) => {
        if (typeof fl.def !== 'function') return;
        const oldDef = fl.def(oldV, oldD);
        if (JSON.stringify(p[fl.id]) === JSON.stringify(oldDef)) p[fl.id] = clone(fl.def(S.vendor, S.device));
      });
    });
  }

  /* ------------------------------ Stats & history ------------------------------ */
  const stats = Object.assign({ generated: 0 }, store.get('stats', {}));
  const BASE_CONFIGS = 1284;
  const history = {
    all() { return store.get('history', []); },
    save(list) { store.set('history', list.slice(0, 100)); },
    add(entry) { const l = history.all(); l.unshift(entry); history.save(l); },
    remove(id) { history.save(history.all().filter((h) => h.id !== id)); },
    get(id) { return history.all().find((h) => h.id === id); }
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const stripSecrets = (mods) => mods.map((m) => {
    const p = clone(m.params);
    E.schema(m.id).forEach((fl) => { if (fl.type === 'secret') p[fl.id] = ''; });
    return { id: m.id, params: p };
  });
  const buildTitle = (vendor, mods) => `${NC.VENDORS[vendor].name} ${mods.length > 2 ? mods.length + '-module build' : mods.map((m) => NC.MODULES[m.id || m].name).join(' + ')}`;

  function makeEntry(vendor, device, mods, ts, title) {
    const clean = stripSecrets(mods);
    const r = E.generate({ vendor, device, modules: clean, includeSecrets: false, header: true });
    return { id: uid(), title: title || buildTitle(vendor, clean) + ' Configuration', vendor, device, modules: clean, ts: ts || Date.now(), lines: r.ok ? r.text.split('\n').length - 1 : 0, text: r.ok ? r.text : '' };
  }

  function seedHistory() {
    if (store.get('seeded', false)) return;
    const today = new Date();
    const at = (daysAgo, h, m) => { const d = new Date(today); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.getTime(); };
    const seed = [
      makeEntry('cisco', 'switch', [{ id: 'vlan', params: E.defaults('vlan', 'cisco', 'switch') }], at(0, 9, 21), 'Cisco VLAN Configuration'),
      makeEntry('mikrotik', 'router', [{ id: 'dhcp', params: E.defaults('dhcp', 'mikrotik', 'router') }], at(0, 8, 54), 'MikroTik DHCP'),
      makeEntry('fortigate', 'firewall', [{ id: 'firewall', params: E.defaults('firewall', 'fortigate', 'firewall') }], at(1, 16, 40), 'FortiGate Firewall'),
      makeEntry('juniper', 'router', [{ id: 'ospf', params: E.withDefaults('ospf', 'juniper', 'router', { ifaces: 'ge-0/0/0.0, ge-0/0/1.0', passive: 'lo0.0' }) }], at(2, 11, 5), 'Juniper OSPF Area 0')
    ];
    history.save(seed.concat(history.all()));
    store.set('seeded', true);
  }

  const fmtTime = (ts) => {
    const d = new Date(ts), now = new Date();
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff === 0) return 'Today ' + hm;
    if (diff === 1) return 'Yesterday ' + hm;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + hm;
  };

  /* ------------------------------ UI primitives ------------------------------ */
  function toast(msg, type) {
    const host = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'ok');
    el.setAttribute('role', 'status');
    el.innerHTML = icon(type === 'err' ? 'alert' : type === 'info' ? 'info' : 'check') + `<span>${esc(msg)}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, 2600);
  }

  let modalResolve = null;
  function modal({ title, body, ok, cancel, danger, wide, noFooter }) {
    const m = $('#modal');
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    $('#modal-card').classList.toggle('wide', !!wide);
    const f = $('#modal-foot');
    f.hidden = !!noFooter;
    f.innerHTML = (cancel === false ? '' : `<button class="btn ghost" data-modal="cancel">${esc(cancel || 'Cancel')}</button>`) + `<button class="btn ${danger ? 'danger' : 'primary'}" data-modal="ok">${esc(ok || 'Confirm')}</button>`;
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('open'));
    setTimeout(() => { const b = $('[data-modal="ok"]', m); if (b && !noFooter) b.focus(); }, 60);
    return new Promise((res) => { modalResolve = res; });
  }
  function closeModal(val) {
    const m = $('#modal');
    if (m.hidden) return false;
    m.classList.remove('open');
    setTimeout(() => (m.hidden = true), 180);
    if (modalResolve) { modalResolve(!!val); modalResolve = null; }
    return true;
  }
  const confirmBox = (title, msg, ok, danger) => modal({ title, body: `<p class="muted">${msg}</p>`, ok, danger });

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((res, rej) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      ta.remove();
    });
  }
  function downloadText(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const stamp = () => { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); };

  const vendorBadge = (v) => `<span class="vbadge" style="--vc:${NC.VENDORS[v].accent}"><b>${NC.VENDORS[v].mono}</b>${esc(NC.VENDORS[v].name)}</span>`;
  const pageHead = (eyebrow, title, desc, actions) => `<header class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${desc ? `<p class="lead">${desc}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</header>`;

  /* ==========================================================================
     VIEWS
     ========================================================================== */
  const VIEWS = {};

  /* ------------------------------ Dashboard ------------------------------ */
  VIEWS.dashboard = {
    title: 'Dashboard',
    render() {
      const h = history.all();
      const statsCards = [
        ['CONFIGURATIONS', (BASE_CONFIGS + stats.generated).toLocaleString('en-US'), 'Generated on this workstation', 'layers'],
        ['SUPPORTED VENDORS', NC.VENDOR_ORDER.length, 'IOS · RouterOS · FortiOS · Junos · AOS-CX', 'devices'],
        ['TEMPLATES', E.countTemplates(), 'Vendor-specific syntax templates', 'templates'],
        ['RECENT BUILDS', h.length, 'Saved in local history', 'history']
      ].map(([k, v, s, ic]) => `<div class="stat card"><div class="stat-top"><span class="stat-k">${k}</span>${icon(ic)}</div><div class="stat-v" data-count="${String(v).replace(/,/g, '')}">${v}</div><div class="stat-s">${s}</div></div>`).join('');
      const qs = NC.VENDOR_ORDER.map((v) => {
        const V = NC.VENDORS[v];
        const n = NC.MODULE_ORDER.filter((m) => V.devices.some((d) => E.support(v, d, m).ok)).length;
        return `<button class="qs card" data-act="quick" data-v="${v}" style="--vc:${V.accent}"><span class="qs-mono">${V.mono}</span><span class="qs-name">${esc(V.label)}</span><span class="qs-plat">${esc(V.platform)}</span><span class="qs-meta">${n} modules · ${V.devices.map((d) => NC.DEVICES[d].name).join(', ')}</span><span class="qs-go">${icon('arrow-right')}</span></button>`;
      }).join('');
      const recent = h.slice(0, 5).map((e) => `<li class="rc-item"><button class="rc-open" data-act="hist-open" data-id="${e.id}">${vendorBadge(e.vendor)}<span class="rc-title">${esc(e.title)}</span><span class="rc-time">${fmtTime(e.ts)}</span></button></li>`).join('') || '<li class="empty-sm">No saved configurations yet.</li>';
      const cats = NC.CATEGORIES.map((c) => `<div class="cat-col"><div class="cat-title">${c.name}</div>${NC.MODULE_ORDER.filter((m) => NC.MODULES[m].cat === c.id).map((m) => `<button class="cat-link" data-act="goto-module" data-m="${m}">${icon(NC.MODULES[m].icon)}${esc(NC.MODULES[m].name)}</button>`).join('')}</div>`).join('');
      return `
        <section class="hero card">
          <div class="hero-grid"></div>
          <div class="hero-in">
            <div class="eyebrow"><span class="dot ok"></span> NETWORK ENGINEERING TOOLKIT</div>
            <h1>Network Configuration Generator</h1>
            <p class="lead">Generate clean, vendor-specific network configurations in seconds.</p>
            <div class="hero-actions">
              <button class="btn primary lg" data-act="go" data-to="generator">${icon('plus')} Create Configuration</button>
              <button class="btn ghost lg" data-act="go" data-to="templates">${icon('templates')} Browse Templates</button>
            </div>
            <div class="hero-kbd"><kbd>Ctrl</kbd>+<kbd>K</kbd> search <span class="sep"></span> <kbd>Ctrl</kbd>+<kbd>Enter</kbd> generate</div>
          </div>
          <div class="hero-term" aria-hidden="true"><div class="term-bar"><i></i><i></i><i></i><span>SW-DIST-01</span></div><pre>${NC.Highlight('vlan 20\n name USERS\n!\ninterface Vlan20\n description USERS\n ip address 192.168.20.1 255.255.255.0\n no shutdown\n!\nip dhcp pool VLAN20-USERS\n network 192.168.20.0 255.255.255.0\n default-router 192.168.20.1', 'cisco').join('\n')}</pre></div>
        </section>
        <section class="stats">${statsCards}</section>
        <section class="section"><div class="sec-head"><h2>Quick Start</h2><span class="muted">Pick a platform to open the configuration builder</span></div><div class="qs-grid">${qs}</div></section>
        <section class="dash-2">
          <div class="card pad"><div class="sec-head"><h2>Recent Configurations</h2><button class="btn ghost sm" data-act="go" data-to="history">View all ${icon('arrow-right')}</button></div><ul class="rc-list">${recent}</ul></div>
          <div class="card pad"><div class="sec-head"><h2>Platform Status</h2><span class="pill ok"><span class="dot ok"></span>SYSTEM READY</span></div>
            <ul class="status-list">
              <li><span>Generation engine</span><b class="ok">Local · offline capable</b></li>
              <li><span>Vendor templates loaded</span><b>${E.countTemplates()} / ${NC.VENDOR_ORDER.length * NC.MODULE_ORDER.length}</b></li>
              <li><span>Remote execution</span><b class="muted">Disabled by design</b></li>
              <li><span>Credential storage</span><b class="muted">Never stored</b></li>
              <li><span>History storage</span><b>LocalStorage (this browser)</b></li>
            </ul>
            <div class="notice">${icon('shield')}<span>Always review generated configurations before deploying them to production.</span></div>
          </div>
        </section>
        <section class="section card pad"><div class="sec-head"><h2>Configuration Modules</h2><span class="muted">${NC.MODULE_ORDER.length} modules across ${NC.CATEGORIES.length} categories</span></div><div class="cat-grid">${cats}</div></section>`;
    },
    mount() {
      $$('.stat-v[data-count]').forEach((el) => {
        const target = +el.dataset.count;
        if (!target || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const t0 = performance.now();
        const step = (t) => { const k = Math.min(1, (t - t0) / 700); el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US'); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    }
  };

  /* ------------------------------ Generator ------------------------------ */
  VIEWS.generator = {
    title: 'Config Generator',
    render() {
      return `${pageHead('CONFIGURATION BUILDER', 'Network Configuration Generator', 'Select a platform, choose modules and enter parameters. Output is generated locally and never sent anywhere.',
        `<button class="btn ghost" data-act="reset-mod" data-tip="Restore default parameters for the active module">${icon('refresh')} Reset module</button><button class="btn ghost" data-act="go" data-to="templates">${icon('templates')} Templates</button>`)}
        <ol class="stepper" id="stepper"></ol>
        <div class="gen-grid">
          <section class="card builder" aria-label="Configuration builder">
            <div class="step" id="st-vendor"></div>
            <div class="step" id="st-device"></div>
            <div class="step" id="st-module"></div>
            <div class="step last" id="st-params"></div>
          </section>
          <section class="card output" id="output" aria-label="Generated configuration"></section>
        </div>`;
    },
    mount() { renderGenerator(); }
  };

  function renderGenerator() {
    renderStepper(); renderVendorStep(); renderDeviceStep(); renderModuleStep(); renderParams(); renderOutput();
  }
  function renderStepper() {
    const el = $('#stepper'); if (!el) return;
    const steps = [['Select Vendor', NC.VENDORS[S.vendor].label], ['Select Device', NC.DEVICES[S.device].name], ['Select Configuration', S.bundle.map((m) => NC.MODULES[m].name).join(', ')], ['Enter Parameters', S.result && S.result.ok ? 'Generated' : 'Pending']];
    el.innerHTML = steps.map(([t, v], i) => `<li class="${i < 3 || (S.result && S.result.ok) ? 'done' : 'active'}"><button data-act="scroll-step" data-i="${i}"><span class="st-n">${i < 3 || (S.result && S.result.ok) ? icon('check') : i + 1}</span><span class="st-t"><small>STEP ${i + 1}</small>${t}</span><span class="st-v">${esc(v)}</span></button></li>`).join('');
  }
  function stepHead(n, title, extra) { return `<div class="step-head"><span class="step-n">${n}</span><h3>${title}</h3>${extra || ''}</div>`; }
  function renderVendorStep() {
    const el = $('#st-vendor'); if (!el) return;
    el.innerHTML = stepHead(1, 'Vendor') + `<div class="vendor-row" role="radiogroup" aria-label="Vendor">${NC.VENDOR_ORDER.map((v) => {
      const V = NC.VENDORS[v];
      return `<button role="radio" aria-checked="${S.vendor === v}" class="vcard${S.vendor === v ? ' sel' : ''}" data-act="vendor" data-v="${v}" style="--vc:${V.accent}"><span class="vmono">${V.mono}</span><span class="vname">${esc(V.name)}</span><span class="vplat">${esc(V.platform)}</span></button>`;
    }).join('')}</div>`;
  }
  function renderDeviceStep() {
    const el = $('#st-device'); if (!el) return;
    const V = NC.VENDORS[S.vendor];
    el.innerHTML = stepHead(2, 'Device') + `<div class="device-row" role="radiogroup" aria-label="Device">${NC.DEVICE_ORDER.map((d) => {
      const D = NC.DEVICES[d], ok = V.devices.includes(d);
      return `<button role="radio" aria-checked="${S.device === d}" class="dcard${S.device === d ? ' sel' : ''}${ok ? '' : ' off'}" ${ok ? '' : `aria-disabled="true" data-tip="Not available for ${esc(V.label)} in v${NC.VERSION}"`} data-act="device" data-d="${d}">${icon(D.icon)}<span><b>${D.name}</b><small>${D.desc}</small></span></button>`;
    }).join('')}</div>`;
  }
  function renderModuleStep() {
    const el = $('#st-module'); if (!el) return;
    const chips = NC.CATEGORIES.map((c) => {
      const mods = NC.MODULE_ORDER.filter((m) => NC.MODULES[m].cat === c.id);
      return `<div class="mcat"><div class="mcat-t">${c.name.toUpperCase()}</div><div class="mchips">${mods.map((m) => {
        const s = E.support(S.vendor, S.device, m);
        const inB = S.bundle.includes(m);
        return `<div class="mchip${S.module === m ? ' sel' : ''}${inB ? ' inb' : ''}${s.ok ? '' : ' off'}" ${s.ok ? `data-tip="${esc(NC.MODULES[m].desc)}"` : `data-tip="${esc(s.reason)}"`}><button class="mchip-main" data-act="module" data-m="${m}">${icon(s.ok ? NC.MODULES[m].icon : 'lock')}<span>${esc(NC.MODULES[m].name)}</span></button>${s.ok ? `<button class="mchip-add" data-act="${inB ? 'rmmod' : 'addmod'}" data-m="${m}" aria-label="${inB ? 'Remove from' : 'Add to'} build">${icon(inB ? 'minus' : 'plus')}</button>` : ''}</div>`;
      }).join('')}</div></div>`;
    }).join('');
    el.innerHTML = stepHead(3, 'Configuration', `<span class="step-hint">Click to select · <b>+</b> adds a module to a multi-module build</span>`) + `<div class="mgrid">${chips}</div>`;
  }

  /* --------- Dynamic parameter form --------- */
  function fieldHtml(fl, p) {
    const id = fl.id;
    const v = p[id];
    const req = resolve(fl.req, p, S.vendor, S.device);
    const lab = `<label for="f-${id}">${esc(fl.label)}${req ? ' <span class="req">*</span>' : ''}</label>`;
    const help = fl.help ? `<div class="fhelp">${esc(fl.help)}</div>` : '';
    const wrap = (inner, cls) => `<div class="field${fl.half ? ' half' : ''}${cls ? ' ' + cls : ''}" id="fw-${id}">${inner}${help}<div class="fmsg" aria-live="polite"></div></div>`;
    switch (fl.type) {
      case 'toggle':
        return wrap(`<label class="switch"><input type="checkbox" id="f-${id}" data-field="${id}" ${v ? 'checked' : ''}><span class="track"><span class="knob"></span></span><span class="sw-l">${esc(fl.label)}</span></label>`, 'is-toggle');
      case 'select':
        return wrap(lab + `<div class="select"><select id="f-${id}" data-field="${id}">${fl.opts.map(([o, l]) => `<option value="${esc(o)}"${String(v) === String(o) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${icon('chevron-down')}</div>`);
      case 'textarea':
        return wrap(lab + `<textarea id="f-${id}" data-field="${id}" rows="${fl.rows || 3}" spellcheck="false" placeholder="${esc(fl.ph || '')}">${esc(v)}</textarea>`);
      case 'secret':
        return wrap(lab + `<div class="secret"><input type="password" id="f-${id}" data-field="${id}" value="${esc(v)}" autocomplete="new-password" spellcheck="false" placeholder="Not stored · placeholder if empty"><button class="icon-btn" data-act="reveal" data-f="${id}" aria-label="Show / hide" data-tip="Show / hide">${icon('eye')}</button></div>`, 'is-secret');
      case 'table':
        return tableHtml(fl, v || []);
      default:
        return wrap(lab + `<input type="${fl.type === 'number' ? 'text' : 'text'}" inputmode="${fl.type === 'number' ? 'numeric' : 'text'}" id="f-${id}" data-field="${id}" value="${esc(v)}" spellcheck="false" autocomplete="off" placeholder="${esc(fl.ph || '')}">`);
    }
  }
  function tableHtml(fl, rows) {
    const head = `<tr><th class="c-idx">#</th>${fl.cols.map((c) => `<th style="min-width:${c.w || 100}px">${esc(c.label)}${c.req ? ' <span class="req">*</span>' : ''}</th>`).join('')}<th class="c-act"></th></tr>`;
    const body = rows.map((r, i) => `<tr>${`<td class="c-idx">${i + 1}</td>`}${fl.cols.map((c) => {
      const v = r[c.id];
      const attrs = `data-tf="${fl.id}" data-row="${i}" data-col="${c.id}" aria-label="${esc(c.label)} row ${i + 1}"`;
      if (c.type === 'bool') return `<td class="c-bool"><input type="checkbox" ${attrs} ${v ? 'checked' : ''}></td>`;
      if (c.type === 'select') return `<td><div class="select sm"><select ${attrs}>${c.opts.map(([o, l]) => `<option value="${esc(o)}"${String(v) === String(o) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${icon('chevron-down')}</div></td>`;
      return `<td><input type="text" ${attrs} value="${esc(v)}" placeholder="${esc(c.ph || '')}" spellcheck="false" autocomplete="off"></td>`;
    }).join('')}<td class="c-act"><div class="row-acts">${fl.order ? `<button class="icon-btn sm" data-act="row-up" data-f="${fl.id}" data-i="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${icon('arrow-up')}</button><button class="icon-btn sm" data-act="row-down" data-f="${fl.id}" data-i="${i}" aria-label="Move down" ${i === rows.length - 1 ? 'disabled' : ''}>${icon('arrow-down')}</button>` : ''}<button class="icon-btn sm" data-act="row-dup" data-f="${fl.id}" data-i="${i}" aria-label="Duplicate row" data-tip="Duplicate">${icon('copy')}</button><button class="icon-btn sm danger" data-act="row-del" data-f="${fl.id}" data-i="${i}" aria-label="Delete row" data-tip="Delete">${icon('trash')}</button></div></td></tr>`).join('');
    const emptyRow = rows.length ? '' : `<tr><td colspan="${fl.cols.length + 2}" class="tbl-empty">No entries yet - add the first one.</td></tr>`;
    return `<div class="field full" id="fw-${fl.id}"><div class="tbl-head"><label>${esc(fl.label)} <span class="count">${rows.length}</span></label><button class="btn sm soft" data-act="row-add" data-f="${fl.id}">${icon('plus')} ${esc(fl.add || 'Add')}</button></div><div class="tbl-wrap"><table class="dtable"><thead>${head}</thead><tbody>${body}${emptyRow}</tbody></table></div><div class="fmsg"></div></div>`;
  }

  function renderParams() {
    const el = $('#st-params'); if (!el) return;
    const mod = S.module;
    const M = NC.MODULES[mod];
    const sup = E.support(S.vendor, S.device, mod);
    const tabs = S.bundle.length > 1 ? `<div class="btabs" role="tablist">${S.bundle.map((m) => {
      const bad = S.result && S.result.errors.some((e) => e.module === m);
      return `<button role="tab" aria-selected="${m === mod}" class="btab${m === mod ? ' sel' : ''}" data-act="tab-mod" data-m="${m}">${esc(NC.MODULES[m].name)}${bad ? '<span class="err-dot"></span>' : ''}<span class="btab-x" data-act="rmmod" data-m="${m}" aria-label="Remove">${icon('x')}</span></button>`;
    }).join('')}</div>` : '';
    let body;
    if (!sup.ok) {
      const alt = NC.VENDOR_ORDER.filter((v) => NC.VENDORS[v].devices.some((d) => E.support(v, d, mod).ok)).map((v) => `<button class="btn sm soft" data-act="vendor" data-v="${v}">${esc(NC.VENDORS[v].label)}</button>`).join('');
      body = `<div class="unavail">${icon('lock')}<div><h4>Template not available for this platform.</h4><p>${esc(sup.reason)} ${esc(M.name)} is never rendered as pseudo-configuration.</p>${alt ? `<div class="alt"><span class="muted">Available on:</span> ${alt}</div>` : ''}</div></div>`;
    } else {
      const p = P(mod);
      const groups = [];
      E.schema(mod).forEach((fl) => {
        if (!E.visible(fl, p, S.vendor, S.device)) return;
        const g = fl.group || '';
        let grp = groups.find((x) => x.name === g);
        if (!grp) { grp = { name: g, items: [] }; groups.push(grp); }
        grp.items.push(fieldHtml(fl, p));
      });
      body = groups.map((g) => `<fieldset class="fgroup">${g.name ? `<legend>${esc(g.name)}</legend>` : ''}<div class="fgrid">${g.items.join('')}</div></fieldset>`).join('');
      if (mod === 'bgp') body = `<div class="alert warn">${icon('alert')}<div><b>Verify BGP parameters before deployment.</b><span>Wrong ASN, neighbor or prefixes can leak routes or black-hole traffic.</span></div></div>` + body;
      if (mod === 'ipsec') body = `<div class="alert warn">${icon('lock')}<div><b>Never expose production credentials or pre-shared keys in shared environments.</b><span>The PSK is kept in memory only - it is not saved to history, the URL or logs.</span></div></div>` + body;
    }
    const hasSecret = S.bundle.some((m) => E.schema(m).some((f) => f.type === 'secret'));
    el.innerHTML = stepHead(4, 'Parameters', `<span class="step-hint">${icon(M.icon)} ${esc(M.name)} · ${esc(NC.VENDORS[S.vendor].label)} ${esc(NC.DEVICES[S.device].name)}${S.templateName ? ` · <b>${esc(S.templateName)}</b>` : ''}</span>`) + tabs + `<div class="pform" id="pform">${body}</div>
      <div id="err-panel"></div>
      <div class="gen-bar">
        ${hasSecret ? `<label class="switch sm" data-tip="Secrets are never saved - they exist only in this tab's memory"><input type="checkbox" id="opt-secrets" ${S.includeSecrets ? 'checked' : ''}><span class="track"><span class="knob"></span></span><span class="sw-l">Insert secrets into output</span></label>` : '<span></span>'}
        <button class="btn primary lg gen-btn" id="gen-btn" data-act="generate" ${S.bundle.some((m) => E.support(S.vendor, S.device, m).ok) ? '' : 'disabled'}>${icon('play')}<span>Generate Configuration</span><kbd>Ctrl ↵</kbd></button>
      </div>`;
    renderErrors();
  }

  function renderErrors() {
    const panel = $('#err-panel');
    if (!panel) return;
    $$('#pform .invalid').forEach((x) => { x.classList.remove('invalid'); x.removeAttribute('aria-invalid'); x.removeAttribute('title'); });
    $$('#pform .fmsg').forEach((x) => (x.textContent = ''));
    const r = S.result;
    if (!r || !S.validated || !r.errors.length) { panel.innerHTML = ''; return; }
    r.errors.forEach((e) => {
      if (e.module !== S.module) return;
      if (e.row === undefined) {
        const w = $('#fw-' + e.field);
        if (w) { w.classList.add('invalid'); const inp = $('[data-field]', w); if (inp) inp.setAttribute('aria-invalid', 'true'); $('.fmsg', w).textContent = e.msg.replace(/^[^:]+: /, ''); }
      } else {
        const inp = $(`[data-tf="${e.field}"][data-row="${e.row}"][data-col="${e.col}"]`);
        if (inp) { inp.classList.add('invalid'); inp.setAttribute('aria-invalid', 'true'); inp.title = e.msg; }
        const w = $('#fw-' + e.field);
        if (w) { const m = $('.fmsg', w); m.textContent = (m.textContent ? m.textContent + ' ' : '') + ''; w.classList.add('has-row-err'); }
      }
    });
    const list = r.errors.slice(0, 12).map((e) => `<li><button data-act="focus-err" data-m="${e.module || ''}" data-f="${e.field || ''}" data-i="${e.row === undefined ? '' : e.row}" data-c="${e.col || ''}">${S.bundle.length > 1 && e.module ? `<b>${esc(NC.MODULES[e.module].name)}</b> · ` : ''}${esc(e.msg)}</button></li>`).join('');
    panel.innerHTML = `<div class="alert error" role="alert">${icon('alert')}<div><b>⚠ Configuration Error</b><span>${r.errors.length} issue${r.errors.length > 1 ? 's' : ''} must be fixed before generation.</span><ul>${list}</ul>${r.errors.length > 12 ? `<span class="muted">+ ${r.errors.length - 12} more</span>` : ''}</div></div>`;
  }

  /* --------- Output panel --------- */
  function renderOutput(animate) {
    const el = $('#output'); if (!el) return;
    const r = S.result;
    const ok = r && r.ok;
    const V = NC.VENDORS[S.vendor];
    const lines = ok ? r.text.replace(/\n$/, '').split('\n') : [];
    const meta = `<div class="out-meta">${vendorBadge(S.vendor)}<span class="chip">${esc(NC.DEVICES[S.device].name)}</span>${(ok ? r.modules : S.bundle).map((m) => `<span class="chip">${esc(NC.MODULES[m].name)}</span>`).join('')}${ok ? `<span class="chip mono">${lines.length} lines</span>` : ''}</div>`;
    const tabs = `<div class="otabs" role="tablist"><button role="tab" aria-selected="${S.outTab === 'config'}" class="otab${S.outTab === 'config' ? ' sel' : ''}" data-act="outtab" data-t="config">${icon('terminal')} Configuration</button><button role="tab" aria-selected="${S.outTab === 'topo'}" class="otab${S.outTab === 'topo' ? ' sel' : ''}" data-act="outtab" data-t="topo">${icon('topology')} Topology</button></div>`;
    const tools = `<div class="ed-tools"><button class="icon-btn" data-act="copy" data-tip="Copy (Ctrl+Shift+C)" aria-label="Copy" ${ok ? '' : 'disabled'}>${icon('copy')}</button><button class="icon-btn" data-act="download" data-tip="Download .txt" aria-label="Download" ${ok ? '' : 'disabled'}>${icon('download')}</button><button class="icon-btn" data-act="wrap" data-tip="Toggle line wrap" aria-label="Wrap" aria-pressed="${settings.wrap}">${icon('wrap')}</button><button class="icon-btn" data-act="clear" data-tip="Clear output" aria-label="Clear" ${ok ? '' : 'disabled'}>${icon('trash')}</button><button class="icon-btn" data-act="fullscreen" data-tip="${S.fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}" aria-label="Fullscreen">${icon(S.fullscreen ? 'minimize' : 'maximize')}</button></div>`;
    let pane;
    if (S.outTab === 'topo') {
      const p = S.params[S.module] || E.defaults(S.module, S.vendor, S.device);
      pane = `<div class="topo-wrap">${NC.Topology.render(S.vendor, S.device, S.module, p)}<div class="topo-cap">${icon('info')} Logical preview of <b>${esc(NC.MODULES[S.module].name)}</b> - updates with your parameters.</div></div>`;
    } else if (S.busy) {
      pane = `<div class="editor busy"><div class="scan"></div><div class="loading-lines">${'<i></i>'.repeat(9)}</div></div>`;
    } else if (!ok) {
      pane = `<div class="editor empty"><div class="empty-state">${icon('terminal', 'xl')}<h4>No configuration generated yet</h4><p>Choose a vendor, device and module, fill in the parameters and press <b>Generate Configuration</b>.</p><div class="kbd-row"><kbd>Ctrl</kbd> + <kbd>Enter</kbd></div></div></div>`;
    } else {
      const hl = NC.Highlight(r.text.replace(/\n$/, ''), S.vendor);
      pane = `<div class="editor${settings.wrap ? ' wrap' : ''}${settings.lineNumbers ? '' : ' no-ln'}${animate ? ' anim' : ''}" tabindex="0" aria-label="Generated configuration"><div class="code">${hl.map((h, i) => `<div class="ln" style="--i:${Math.min(i, 60)}"><span class="lnum">${i + 1}</span><span class="ltxt">${h || ' '}</span></div>`).join('')}</div></div>`;
    }
    const notes = [];
    if (r) {
      (r.unsupported || []).forEach((u) => notes.push(['err', `${NC.MODULES[u.module].name}: ${u.reason}`]));
      if (ok) {
        const seen = new Set();
        r.warnings.forEach((w) => { if (!seen.has(w.msg)) { seen.add(w.msg); notes.push(['warn', w.msg]); } });
        r.notes.forEach((w) => { if (!seen.has(w.msg)) { seen.add(w.msg); notes.push(['info', w.msg]); } });
      }
    }
    const notesHtml = notes.length ? `<div class="notes"><div class="notes-t">${icon('clipboard')} Deployment notes <span class="count">${notes.length}</span></div><ul>${notes.map(([t, m]) => `<li class="n-${t}">${icon(t === 'info' ? 'info' : 'alert')}<span>${esc(m)}</span></li>`).join('')}</ul></div>` : '';
    el.classList.toggle('fs', S.fullscreen);
    el.innerHTML = `<div class="out-head"><div><div class="eyebrow">OUTPUT</div><h2>Generated Configuration</h2></div>${tabs}</div>${meta}
      <div class="ed-shell"><div class="ed-bar"><span class="ed-file">${icon('file')} ${esc(fileName())}</span>${tools}</div>${pane}</div>
      ${notesHtml}
      <div class="out-actions">
        <button class="btn primary" data-act="copy" ${ok ? '' : 'disabled'}>${icon('copy')} COPY CONFIG</button>
        <button class="btn soft" data-act="download" ${ok ? '' : 'disabled'}>${icon('download')} DOWNLOAD .TXT</button>
        <button class="btn soft" data-act="print" ${ok ? '' : 'disabled'}>${icon('print')} PRINT</button>
        <button class="btn ghost" data-act="save" ${ok ? '' : 'disabled'} data-tip="Save to Recent Configurations (Ctrl+S)">${icon('save')} SAVE</button>
      </div>
      <div class="review">${icon('shield')} Always review generated configurations before deploying them to production. ${esc(V.label)} syntax targets ${esc(V.platform)}.</div>`;
  }
  function fileName() {
    const p = S.params.basic || {};
    const host = (p.hostname || NC.VENDORS[S.vendor].name).toLowerCase().replace(/[^a-z0-9\-]+/g, '-');
    const mods = (S.result && S.result.ok ? S.result.modules : S.bundle).join('-');
    return `${host}_${mods}.txt`;
  }

  /* --------- Generator actions --------- */
  function setVendor(v) {
    if (v === S.vendor) return;
    const oldV = S.vendor, oldD = S.device;
    S.vendor = v;
    if (!NC.VENDORS[v].devices.includes(S.device)) {
      S.device = NC.VENDORS[v].devices[0];
      toast(`${NC.VENDORS[v].label}: switched device to ${NC.DEVICES[S.device].name}`, 'info');
    }
    reDefault(oldV, oldD);
    S.result = null; S.validated = false; S.templateName = null;
    renderGenerator();
  }
  function setDevice(d) {
    if (!NC.VENDORS[S.vendor].devices.includes(d)) { toast(`${NC.DEVICES[d].name} is not available for ${NC.VENDORS[S.vendor].label}`, 'info'); return; }
    if (d === S.device) return;
    const oldD = S.device;
    S.device = d;
    reDefault(S.vendor, oldD);
    S.result = null; S.validated = false;
    renderGenerator();
  }
  function setModule(m, add) {
    if (add) {
      if (!S.bundle.includes(m)) S.bundle.push(m);
    } else if (!S.bundle.includes(m) || S.bundle.length === 1) S.bundle = [m];
    S.module = m;
    S.result = S.result && S.result.ok ? S.result : null;
    renderStepper(); renderModuleStep(); renderParams(); renderOutput();
  }
  function removeModule(m) {
    if (S.bundle.length === 1) return;
    S.bundle = S.bundle.filter((x) => x !== m);
    if (S.module === m) S.module = S.bundle[0];
    renderStepper(); renderModuleStep(); renderParams(); renderOutput();
  }

  function generate() {
    if (S.view !== 'generator') { go('generator'); setTimeout(generate, 50); return; }
    if (S.busy) return;
    const btn = $('#gen-btn');
    if (btn && btn.disabled) { toast('Template not available for this platform.', 'err'); return; }
    S.busy = true; S.outTab = 'config';
    if (btn) btn.classList.add('loading');
    renderOutput();
    setTimeout(() => {
      const mods = S.bundle.map((id) => ({ id, params: P(id) }));
      const r = E.generate({ vendor: S.vendor, device: S.device, modules: mods, includeSecrets: S.includeSecrets, header: settings.header });
      S.result = r; S.validated = true; S.busy = false;
      if (r.ok) {
        stats.generated++; store.set('stats', stats);
        toast(`Configuration generated · ${r.text.split('\n').length - 1} lines`);
      } else {
        const first = r.errors[0];
        if (first && first.module && first.module !== S.module && S.bundle.includes(first.module)) S.module = first.module;
        toast(`${r.errors.length} validation issue${r.errors.length > 1 ? 's' : ''} found`, 'err');
      }
      renderStepper(); renderParams(); renderOutput(true);
      if (!r.ok) { const b = $('#err-panel'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else if (window.innerWidth < 1100) { const o = $('#output'); if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }, 420);
  }

  const outputText = () => (S.result && S.result.ok ? S.result.text : '');
  function copyConfig() {
    const t = outputText();
    if (!t) { toast('Generate a configuration first', 'info'); return; }
    copyText(t).then(() => toast('✓ Configuration copied to clipboard'), () => toast('Clipboard not available in this context', 'err'));
  }
  function downloadConfig() {
    const t = outputText();
    if (!t) { toast('Generate a configuration first', 'info'); return; }
    downloadText(fileName().replace(/\.txt$/, '') + '_' + stamp() + '.txt', t);
    toast('Download started');
  }
  function printConfig() {
    const t = outputText();
    if (!t) return;
    $('#print-area').innerHTML = `<h1>NET // CONFIG</h1><p>${esc(NC.VENDORS[S.vendor].label)} · ${esc(NC.DEVICES[S.device].name)} · ${esc(S.result.modules.map((m) => NC.MODULES[m].name).join(', '))}</p><pre>${esc(t)}</pre><p class="pfoot">Always review generated configurations before deploying them to production.</p>`;
    window.print();
  }
  function saveConfig() {
    if (!S.result || !S.result.ok) { toast('Generate a configuration first', 'info'); return; }
    const e = makeEntry(S.vendor, S.device, S.bundle.map((id) => ({ id, params: P(id) })), Date.now(), S.templateName ? `${S.templateName} (${NC.VENDORS[S.vendor].name})` : null);
    history.add(e);
    toast('Saved to Recent Configurations');
    updateNavCounts();
  }
  function openEntry(e, dup) {
    S.vendor = e.vendor; S.device = e.device;
    S.params = {};
    e.modules.forEach((m) => (S.params[m.id] = E.withDefaults(m.id, e.vendor, e.device, m.params)));
    S.bundle = e.modules.map((m) => m.id); S.module = S.bundle[0];
    S.templateName = null; S.result = null; S.validated = false; S.outTab = 'config';
    if (dup) { const c = Object.assign({}, e, { id: uid(), title: e.title + ' (copy)', ts: Date.now() }); history.add(c); }
    go('generator');
    setTimeout(generate, 80);
  }
  function useTemplate(id) {
    const t = NC.TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    S.vendor = t.vendor; S.device = t.device; S.params = {};
    t.modules.forEach((m) => (S.params[m.id] = E.withDefaults(m.id, t.vendor, t.device, m.params)));
    S.bundle = t.modules.map((m) => m.id); S.module = S.bundle[0];
    S.templateName = t.name; S.result = null; S.validated = false; S.outTab = 'config';
    go('generator');
    setTimeout(generate, 80);
  }

  /* ------------------------------ Templates ------------------------------ */
  VIEWS.templates = {
    title: 'Templates',
    render() {
      return pageHead('LIBRARY', 'Configuration Templates', 'Production-style starting points. Each template is a multi-module build rendered with the vendor\'s own syntax.') +
        `<div class="toolbar"><div class="search-in">${icon('search')}<input id="tpl-q" type="search" placeholder="Search templates…" value="${esc(S.tpl.q)}" aria-label="Search templates"></div><div class="seg" role="tablist">${['all'].concat(NC.VENDOR_ORDER).map((v) => `<button class="${S.tpl.vendor === v ? 'sel' : ''}" data-act="tpl-vendor" data-v="${v}">${v === 'all' ? 'All' : esc(NC.VENDORS[v].name)}</button>`).join('')}</div></div><div class="tpl-grid" id="tpl-grid"></div>`;
    },
    mount() { renderTplGrid(); }
  };
  function renderTplGrid() {
    const g = $('#tpl-grid'); if (!g) return;
    const q = S.tpl.q.toLowerCase();
    const list = NC.TEMPLATES.filter((t) => (S.tpl.vendor === 'all' || t.vendor === S.tpl.vendor) && (!q || (t.name + ' ' + t.desc + ' ' + t.vendor + ' ' + t.modules.map((m) => NC.MODULES[m.id].name).join(' ')).toLowerCase().includes(q)));
    g.innerHTML = list.map((t) => `<article class="card tpl"><div class="tpl-top">${vendorBadge(t.vendor)}<span class="diff d-${t.difficulty.toLowerCase()}">${t.difficulty}</span></div><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p><dl class="tpl-meta"><div><dt>Device</dt><dd>${NC.DEVICES[t.device].name}</dd></div><div><dt>Modules</dt><dd>${t.modules.length}</dd></div></dl><div class="chips">${t.modules.map((m) => `<span class="chip">${esc(NC.MODULES[m.id].name)}</span>`).join('')}</div><div class="tpl-actions"><button class="btn ghost sm" data-act="tpl-preview" data-id="${t.id}">${icon('eye')} Preview</button><button class="btn primary sm" data-act="use-template" data-id="${t.id}">Use Template ${icon('arrow-right')}</button></div></article>`).join('') || `<div class="empty-block">${icon('search', 'xl')}<p>No templates match your filter.</p></div>`;
  }
  function previewTemplate(id) {
    const t = NC.TEMPLATES.find((x) => x.id === id);
    const r = E.generate({ vendor: t.vendor, device: t.device, modules: t.modules.map((m) => ({ id: m.id, params: E.withDefaults(m.id, t.vendor, t.device, m.params) })), includeSecrets: false, header: true });
    const topo = NC.Topology.render(t.vendor, t.device, t.modules[0].id, E.withDefaults(t.modules[0].id, t.vendor, t.device, t.modules[0].params));
    modal({ title: t.name, wide: true, ok: 'Use Template', cancel: 'Close', body: `<div class="pv"><div class="pv-meta">${vendorBadge(t.vendor)}<span class="chip">${NC.DEVICES[t.device].name}</span><span class="diff d-${t.difficulty.toLowerCase()}">${t.difficulty}</span></div><p class="muted">${esc(t.desc)}</p><div class="pv-topo">${topo}</div><div class="editor mini"><div class="code">${NC.Highlight(r.text, t.vendor).map((h, i) => `<div class="ln"><span class="lnum">${i + 1}</span><span class="ltxt">${h || ' '}</span></div>`).join('')}</div></div></div>` }).then((ok) => { if (ok) useTemplate(id); });
  }

  /* ------------------------------ History ------------------------------ */
  VIEWS.history = {
    title: 'Recent Configurations',
    render() {
      const h = history.all();
      return pageHead('HISTORY', 'Recent Configurations', 'Stored in this browser\'s LocalStorage. Secrets are stripped before saving.', `<button class="btn ghost" data-act="hist-export-all" ${h.length ? '' : 'disabled'}>${icon('download')} Export JSON</button><button class="btn ghost danger-t" data-act="hist-clear" ${h.length ? '' : 'disabled'}>${icon('trash')} Clear</button>`) +
        (h.length ? `<div class="card hist">${h.map((e) => `<div class="hrow"><div class="h-main">${vendorBadge(e.vendor)}<div class="h-t"><b>${esc(e.title)}</b><span>${esc(NC.DEVICES[e.device].name)} · ${e.modules.map((m) => esc(NC.MODULES[m.id].name)).join(', ')} · ${e.lines} lines</span></div></div><span class="h-time">${icon('clock')} ${fmtTime(e.ts)}</span><div class="h-acts"><button class="btn sm primary" data-act="hist-open" data-id="${e.id}">${icon('external')} Open</button><button class="btn sm soft" data-act="hist-dup" data-id="${e.id}">${icon('copy')} Duplicate</button><button class="btn sm soft" data-act="hist-export" data-id="${e.id}">${icon('download')} Export</button><button class="icon-btn danger" data-act="hist-del" data-id="${e.id}" aria-label="Delete" data-tip="Delete">${icon('trash')}</button></div></div>`).join('')}</div>`
          : `<div class="empty-block card">${icon('history', 'xl')}<h4>No saved configurations</h4><p>Generate a configuration and press <b>Save</b> or <kbd>Ctrl</kbd>+<kbd>S</kbd>.</p><button class="btn primary" data-act="go" data-to="generator">Create Configuration</button></div>`);
    }
  };

  /* ------------------------------ Devices (support matrix) ------------------------------ */
  VIEWS.devices = {
    title: 'Devices',
    render() {
      const head = `<tr><th>Module</th>${NC.VENDOR_ORDER.map((v) => `<th>${vendorBadge(v)}</th>`).join('')}</tr>`;
      const rows = NC.MODULE_ORDER.map((m) => `<tr><td><span class="mt">${icon(NC.MODULES[m].icon)} ${esc(NC.MODULES[m].name)}</span></td>${NC.VENDOR_ORDER.map((v) => {
        const ds = NC.VENDORS[v].devices.filter((d) => E.support(v, d, m).ok);
        return `<td>${ds.length ? ds.map((d) => `<span class="dv ok" data-tip="${NC.DEVICES[d].name}">${icon(NC.DEVICES[d].icon)}</span>`).join('') : '<span class="dv na" data-tip="Template not available for this platform.">—</span>'}</td>`;
      }).join('')}</tr>`).join('');
      const cards = NC.VENDOR_ORDER.map((v) => { const V = NC.VENDORS[v]; return `<div class="card pad vinfo" style="--vc:${V.accent}"><div class="vinfo-top"><span class="qs-mono">${V.mono}</span><div><b>${esc(V.label)}</b><small>${esc(V.platform)}</small></div></div><p class="muted">${esc(V.desc)}</p><div class="chips">${V.devices.map((d) => `<span class="chip">${icon(NC.DEVICES[d].icon)} ${NC.DEVICES[d].name}</span>`).join('')}</div><div class="vinfo-c"><span>Comment syntax</span><code>${esc(V.comment)}</code></div></div>`; }).join('');
      return pageHead('PLATFORMS', 'Devices & Support Matrix', 'Which modules have a verified syntax template on which platform. Unsupported combinations are never generated.') + `<div class="vinfo-grid">${cards}</div><div class="card tbl-card"><div class="tbl-wrap"><table class="matrix"><thead>${head}</thead><tbody>${rows}</tbody></table></div></div>`;
    }
  };

  /* ------------------------------ Labs ------------------------------ */
  VIEWS.labs = {
    title: 'Labs',
    render() {
      return pageHead('PRACTICE', 'Labs', 'Guided scenarios that open a pre-built configuration in the generator so you can study, modify and validate it.') +
        `<div class="lab-grid">${NC.LABS.map((l, i) => { const t = NC.TEMPLATES.find((x) => x.id === l.template); return `<article class="card lab"><div class="lab-top"><span class="lab-n">LAB ${String(i + 1).padStart(2, '0')}</span><span class="diff d-${l.level.toLowerCase()}">${l.level}</span></div><h3>${esc(l.title)}</h3><p>${esc(l.objective)}</p><ol class="lab-tasks">${l.tasks.map((x) => `<li>${esc(x)}</li>`).join('')}</ol><div class="lab-foot">${vendorBadge(t.vendor)}<span class="muted">${icon('clock')} ${l.time}</span><button class="btn primary sm" data-act="use-template" data-id="${t.id}">Launch ${icon('arrow-right')}</button></div></article>`; }).join('')}</div>`;
    }
  };

  /* ------------------------------ Network calculator ------------------------------ */
  const CALC_TABS = [['ipv4', 'IPv4 / Subnet'], ['vlsm', 'VLSM'], ['cidr', 'CIDR / Mask'], ['binary', 'Binary'], ['ipv6', 'IPv6'], ['mac', 'MAC']];
  VIEWS.calculator = {
    title: 'Network Calculator',
    render() {
      return pageHead('TOOLS', 'Network Calculator', 'IPv4, CIDR, subnet, VLSM, wildcard, broadcast, binary, IPv6 and MAC conversions - computed locally.') +
        `<div class="seg wide" role="tablist">${CALC_TABS.map(([k, l]) => `<button role="tab" aria-selected="${S.calc.tab === k}" class="${S.calc.tab === k ? 'sel' : ''}" data-act="calc-tab" data-t="${k}">${l}</button>`).join('')}</div><div id="calc"></div>`;
    },
    mount() { renderCalc(); }
  };
  const kv = (rows) => `<div class="kv-grid">${rows.map(([k, v, mono]) => `<div class="kv"><span>${k}</span><b class="${mono === false ? '' : 'mono'}">${v}</b><button class="icon-btn sm kv-copy" data-act="copy-val" data-v="${esc(String(v).replace(/<[^>]+>/g, ''))}" aria-label="Copy ${k}">${icon('copy')}</button></div>`).join('')}</div>`;
  function renderCalc() {
    const el = $('#calc'); if (!el) return;
    const t = S.calc.tab, C = S.calc, N = NC.Net;
    let html = '';
    if (t === 'ipv4') {
      html = `<div class="card pad calc-in"><label for="c-v4">IPv4 address / prefix</label><div class="row-in"><input id="c-v4" data-calc="v4" value="${esc(C.v4)}" placeholder="192.168.10.0/24 or 192.168.10.7 255.255.255.0" spellcheck="false"><div class="select"><select data-calc="split" aria-label="Split into">${Array.from({ length: 32 }, (_, i) => i + 1).map((p) => `<option value="${p}"${String(p) === C.split ? ' selected' : ''}>Split into /${p}</option>`).join('')}</select>${icon('chevron-down')}</div></div></div><div id="calc-out"></div>`;
    } else if (t === 'vlsm') {
      html = `<div class="card pad calc-in"><label for="c-vb">Address block</label><input id="c-vb" data-calc="vlsmBase" value="${esc(C.vlsmBase)}" spellcheck="false"><div class="vlsm-rows">${C.vlsm.map((r, i) => `<div class="vrow"><input data-vlsm="${i}" data-k="name" value="${esc(r.name)}" placeholder="Segment" aria-label="Segment name"><input data-vlsm="${i}" data-k="hosts" value="${esc(r.hosts)}" inputmode="numeric" placeholder="Hosts" aria-label="Hosts"><button class="icon-btn danger" data-act="vlsm-del" data-i="${i}" aria-label="Remove">${icon('trash')}</button></div>`).join('')}</div><button class="btn sm soft" data-act="vlsm-add">${icon('plus')} Add segment</button></div><div id="calc-out"></div>`;
    } else if (t === 'cidr') {
      html = `<div class="card pad calc-in"><label for="c-m">Subnet mask or wildcard → prefix</label><input id="c-m" data-calc="mask" value="${esc(C.mask)}" spellcheck="false"></div><div id="calc-out"></div>`;
    } else if (t === 'binary') {
      html = `<div class="calc-2"><div class="card pad calc-in"><label for="c-b1">IPv4 → Binary</label><input id="c-b1" data-calc="binIp" value="${esc(C.binIp)}" spellcheck="false"><div id="calc-out"></div></div><div class="card pad calc-in"><label for="c-b2">Binary → IPv4</label><input id="c-b2" data-calc="binIn" value="${esc(C.binIn)}" spellcheck="false"><div id="calc-out2"></div></div></div>`;
    } else if (t === 'ipv6') {
      html = `<div class="card pad calc-in"><label for="c-6">IPv6 address / prefix</label><input id="c-6" data-calc="v6" value="${esc(C.v6)}" spellcheck="false"></div><div id="calc-out"></div>`;
    } else {
      html = `<div class="card pad calc-in"><label for="c-mac">MAC address (any notation)</label><input id="c-mac" data-calc="mac" value="${esc(C.mac)}" spellcheck="false"></div><div id="calc-out"></div>`;
    }
    el.innerHTML = html;
    renderCalcOut();
    void N;
  }
  const calcErr = (m) => `<div class="alert error slim">${icon('alert')}<div><b>Invalid input</b><span>${esc(m)}</span></div></div>`;
  function renderCalcOut() {
    const o = $('#calc-out'); if (!o) return;
    const C = S.calc, N = NC.Net, t = C.tab;
    if (t === 'ipv4') {
      const c = N.parseCidr(C.v4, true);
      if (!c) { o.innerHTML = calcErr('Enter an address with prefix, e.g. 192.168.10.0/24 or 10.1.2.3 255.255.255.0'); return; }
      const i = N.info(c);
      let split = '';
      const np = +C.split;
      if (np > c.prefix) {
        const s = N.split(c, np, 64);
        split = `<div class="card pad"><div class="sec-head"><h3>Subnets /${np}</h3><span class="muted">${s.count.toLocaleString('en-US')} subnets${s.count > 64 ? ' (first 64 shown)' : ''}</span></div><div class="tbl-wrap"><table class="rtable"><thead><tr><th>#</th><th>Network</th><th>First host</th><th>Last host</th><th>Broadcast</th><th>Hosts</th></tr></thead><tbody>${s.list.map((x, k) => `<tr><td>${k + 1}</td><td class="mono">${x.network}/${np}</td><td class="mono">${x.first}</td><td class="mono">${x.last}</td><td class="mono">${x.broadcast}</td><td>${x.usable.toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table></div></div>`;
      }
      o.innerHTML = `<div class="card pad">${kv([['Network', i.network], ['First Host', i.first], ['Last Host', i.last], ['Broadcast', i.broadcast], ['Usable Hosts', i.usable.toLocaleString('en-US')], ['Total Addresses', i.total.toLocaleString('en-US')], ['Subnet Mask', i.mask], ['Wildcard Mask', i.wildcard], ['CIDR', '/' + i.prefix], ['IP Range', `${i.network} - ${i.broadcast}`], ['Class', i.cls, false], ['Type', i.type, false], ['Hex', i.hex]])}<div class="bin"><div><span>Address</span><code>${i.binIp}</code></div><div><span>Mask</span><code>${i.binMask}</code></div></div></div>${split}`;
    } else if (t === 'vlsm') {
      const c = N.parseCidr(C.vlsmBase);
      if (!c) { o.innerHTML = calcErr('Enter the address block as CIDR, e.g. 10.10.0.0/22'); return; }
      const reqs = C.vlsm.map((r) => ({ name: r.name || 'Segment', hosts: parseInt(r.hosts, 10) || 0 })).filter((r) => r.hosts > 0);
      const v = N.vlsm(Object.assign({}, c, { network: c.network }), reqs);
      const pct = Math.round((v.used / v.total) * 100);
      o.innerHTML = `<div class="card pad"><div class="sec-head"><h3>Allocation for ${esc(c.cidr)}</h3><span class="muted">${Math.min(pct, 100)}% of block used</span></div><div class="meter"><span style="width:${Math.min(pct, 100)}%"></span></div><div class="tbl-wrap"><table class="rtable"><thead><tr><th>Segment</th><th>Needed</th><th>Subnet</th><th>Mask</th><th>Usable range</th><th>Broadcast</th><th>Free</th></tr></thead><tbody>${v.rows.map((r) => r.error ? `<tr class="bad"><td>${esc(r.name)}</td><td>${r.hosts}</td><td colspan="5">${esc(r.error)}</td></tr>` : `<tr><td>${esc(r.name)}</td><td>${r.hosts}</td><td class="mono">${r.subnet}</td><td class="mono">${r.info.mask}</td><td class="mono">${r.info.first} - ${r.info.last}</td><td class="mono">${r.info.broadcast}</td><td>${r.waste}</td></tr>`).join('')}</tbody></table></div></div>`;
    } else if (t === 'cidr') {
      const pm = N.prefixFromMask(C.mask);
      let res;
      if (pm !== null) res = kv([['Prefix', '/' + pm], ['Mask', N.maskStr(pm)], ['Wildcard', N.wildcardStr(pm)], ['Usable hosts', (pm >= 31 ? (pm === 32 ? 1 : 2) : Math.pow(2, 32 - pm) - 2).toLocaleString('en-US')]]);
      else {
        const w = N.parseIPv4(C.mask);
        const pw = w === null ? null : N.prefixFromMask(N.toIPv4(~w >>> 0));
        res = pw !== null ? kv([['Wildcard → prefix', '/' + pw], ['Mask', N.maskStr(pw)], ['Wildcard', C.mask]]) : calcErr('Not a contiguous subnet mask or wildcard.');
      }
      const table = `<div class="card pad"><h3>CIDR reference</h3><div class="tbl-wrap"><table class="rtable"><thead><tr><th>Prefix</th><th>Subnet mask</th><th>Wildcard</th><th>Addresses</th><th>Usable</th></tr></thead><tbody>${Array.from({ length: 33 }, (_, i) => 32 - i).filter((p) => p >= 8).map((p) => `<tr${p === pm ? ' class="hl"' : ''}><td class="mono">/${p}</td><td class="mono">${N.maskStr(p)}</td><td class="mono">${N.wildcardStr(p)}</td><td>${Math.pow(2, 32 - p).toLocaleString('en-US')}</td><td>${(p >= 31 ? (p === 32 ? 1 : 2) : Math.pow(2, 32 - p) - 2).toLocaleString('en-US')}</td></tr>`).join('')}</tbody></table></div></div>`;
      o.innerHTML = `<div class="card pad">${res}</div>${table}`;
    } else if (t === 'binary') {
      const n = N.parseIPv4(C.binIp);
      o.innerHTML = n === null ? calcErr('Invalid IPv4 address.') : kv([['Binary', N.toBinary(n)], ['Decimal', String(n >>> 0)], ['Hex', '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0')]]);
      const o2 = $('#calc-out2');
      const b = N.fromBinary(C.binIn);
      if (o2) o2.innerHTML = b === null ? calcErr('Enter 32 bits (dots optional).') : kv([['IPv4', N.toIPv4(b)], ['Decimal', String(b)]]);
    } else if (t === 'ipv6') {
      const i = N.v6Info(C.v6);
      o.innerHTML = i ? `<div class="card pad">${kv([['Compressed', i.compressed], ['Expanded', i.expanded], ['Network', i.network], ['First address', i.first], ['Last address', i.last], ['Prefix', '/' + i.prefix], ['Addresses', i.total.length > 18 ? '2^' + (128 - i.prefix) : Number(i.total).toLocaleString('en-US')], ['/64 subnets', i.subnets64.length > 18 ? '2^' + (64 - i.prefix) : i.subnets64], ['Type', i.type, false]])}<div class="bin"><div><span>Reverse DNS</span><code class="brk">${i.ptr}</code></div></div></div>` : calcErr('Invalid IPv6 address, e.g. 2001:db8:acad::1/64');
    } else {
      const h = N.parseMac(C.mac);
      if (!h) { o.innerHTML = calcErr('Enter 12 hex digits in any notation.'); return; }
      const m = N.macFormats(h);
      o.innerHTML = `<div class="card pad">${kv([['IEEE (colon)', m.colon], ['Hyphen (Windows)', m.hyphen], ['Cisco dotted', m.cisco], ['Bare', m.bare], ['OUI', m.oui], ['Cast', m.cast, false], ['Administration', m.admin, false], ['EUI-64 link-local', m.eui64]])}<div class="bin"><div><span>Binary</span><code class="brk">${m.binary}</code></div></div></div>`;
    }
  }

  /* ------------------------------ Command reference ------------------------------ */
  VIEWS.commands = {
    title: 'Command Reference',
    render() {
      return pageHead('REFERENCE', 'Network Command Reference', 'Verification and troubleshooting commands for every platform you touch.') +
        `<div class="toolbar"><div class="search-in">${icon('search')}<input id="cmd-q" type="search" placeholder="Search command..." value="${esc(S.cmd.q)}" aria-label="Search command"></div><div class="seg" role="tablist">${NC.COMMAND_PLATFORMS.map((p) => `<button role="tab" aria-selected="${S.cmd.tab === p}" class="${S.cmd.tab === p ? 'sel' : ''}" data-act="cmd-tab" data-t="${p}">${p} <span class="count">${NC.COMMANDS.filter((c) => c.platform === p).length}</span></button>`).join('')}</div></div><div id="cmd-list" class="cmd-list"></div>`;
    },
    mount() { renderCmds(); }
  };
  function renderCmds() {
    const el = $('#cmd-list'); if (!el) return;
    const q = S.cmd.q.trim().toLowerCase();
    const list = NC.COMMANDS.filter((c) => (q ? true : c.platform === S.cmd.tab) && (!q || (c.cmd + ' ' + c.desc + ' ' + c.syntax + ' ' + c.cat + ' ' + c.platform).toLowerCase().includes(q)));
    el.innerHTML = (q ? `<div class="muted small">${list.length} result${list.length === 1 ? '' : 's'} across all platforms</div>` : '') + (list.map((c) => `<article class="card cmd"><div class="cmd-top"><code class="cmd-name">${esc(c.cmd)}</code><span class="chip">${esc(c.cat)}</span><span class="chip plat">${esc(c.platform)}</span></div><p>${esc(c.desc)}</p><div class="cmd-row"><span>Syntax</span><code>${esc(c.syntax)}</code></div><div class="cmd-row"><span>Example</span><pre>${esc(c.example)}</pre><button class="icon-btn sm" data-act="copy-val" data-v="${esc(c.example)}" aria-label="Copy example" data-tip="Copy">${icon('copy')}</button></div></article>`).join('') || `<div class="empty-block">${icon('search', 'xl')}<p>No commands match “${esc(S.cmd.q)}”.</p></div>`);
  }

  /* ------------------------------ Documentation ------------------------------ */
  VIEWS.docs = {
    title: 'Documentation',
    render() {
      const vendorNotes = NC.VENDOR_ORDER.map((v) => {
        const V = NC.VENDORS[v];
        const un = NC.MODULE_ORDER.filter((m) => !V.devices.some((d) => E.support(v, d, m).ok)).map((m) => NC.MODULES[m].name);
        return `<li><b>${esc(V.label)}</b> - ${esc(V.platform)}. Devices: ${V.devices.map((d) => NC.DEVICES[d].name).join(', ')}.${un.length ? ` Not generated: ${un.join(', ')}.` : ' All modules available.'}</li>`;
      }).join('');
      const shortcuts = [['Ctrl + K', 'Search / command palette'], ['Ctrl + Enter', 'Generate configuration'], ['Ctrl + S', 'Save configuration to history'], ['Ctrl + Shift + C', 'Copy configuration'], ['Esc', 'Close modal, palette, menu or fullscreen']].map(([k, d]) => `<tr><td>${k.split(' + ').map((x) => `<kbd>${x}</kbd>`).join(' + ')}</td><td>${d}</td></tr>`).join('');
      return pageHead('DOCUMENTATION', 'Using NET // CONFIG', 'How generation, validation and platform templates work.') + `<div class="docs">
        <nav class="card pad doc-toc"><b>On this page</b><a href="#d-flow" data-act="doc-jump">Workflow</a><a href="#d-valid" data-act="doc-jump">Validation</a><a href="#d-vendors" data-act="doc-jump">Platform notes</a><a href="#d-keys" data-act="doc-jump">Shortcuts</a><a href="#d-sec" data-act="doc-jump">Security model</a></nav>
        <div class="doc-body">
          <section class="card pad" id="d-flow"><h2>Workflow</h2><ol><li><b>Select vendor</b> - Cisco IOS/IOS-XE, MikroTik RouterOS 7, FortiGate FortiOS 7, Juniper Junos, Aruba AOS-CX.</li><li><b>Select device</b> - router, switch, firewall or access point. Unsupported combinations are disabled.</li><li><b>Select configuration</b> - click a module. Use <b>+</b> to stack several modules into one build (e.g. Base System + VLAN + DHCP).</li><li><b>Enter parameters</b> - the form changes per module, vendor and option (for example NAT type).</li><li><b>Generate</b> - validation runs first; if it passes the vendor template renders the configuration with a header, section markers and deployment notes.</li></ol><p class="muted">Templates and labs load complete multi-module builds that you can edit before generating.</p></section>
          <section class="card pad" id="d-valid"><h2>Validation</h2><ul><li>IPv4 addresses (no leading zeros), CIDR prefixes and network addresses (<code>10.1.1.5/24</code> is rejected as a network - it suggests <code>10.1.1.0/24</code>).</li><li>Gateways must belong to their subnet and must not be the network/broadcast address or inside a DHCP pool.</li><li>VLAN IDs 1-4094, duplicate VLAN IDs/names and overlapping subnets.</li><li>ASN range 1-4294967295 (AS 23456 rejected), private ASN warnings, iBGP vs eBGP detection.</li><li>Ports 1-65535 and ranges; ports only allowed with TCP/UDP.</li><li>Platform rules - e.g. FortiOS static routes require an exit interface; Junos and AOS-CX OSPF require interfaces.</li></ul></section>
          <section class="card pad" id="d-vendors"><h2>Platform notes</h2><ul>${vendorNotes}</ul><p class="muted">If a feature cannot be expressed correctly on a platform, the module is marked <b>Template not available for this platform</b> instead of producing look-alike syntax. Platform caveats (for example RouterOS having no Dynamic ARP Inspection) are reported as deployment notes.</p></section>
          <section class="card pad" id="d-keys"><h2>Keyboard shortcuts</h2><table class="rtable">${shortcuts}</table></section>
          <section class="card pad" id="d-sec"><h2>Security model</h2><ul><li>The application only <b>generates</b> text. It never connects to devices, never opens SSH sessions and never executes commands.</li><li>No passwords are collected. Secret fields (SNMP community, BGP MD5 key, IPsec PSK) live in memory only; history and exports always contain <code>&lt;REPLACE-WITH-…&gt;</code> placeholders.</li><li>Demo data uses private (RFC 1918) and documentation (RFC 5737) addresses and private ASNs.</li><li>Always review generated configurations before deploying them to production - ideally with a rollback (<code>commit confirmed</code>, <code>configure replace</code>, backups).</li></ul></section>
        </div></div>`;
    }
  };

  /* ------------------------------ Settings ------------------------------ */
  VIEWS.settings = {
    title: 'Settings',
    render() {
      const theme = document.documentElement.dataset.theme;
      const row = (t, d, ctl) => `<div class="set-row"><div><b>${t}</b><span>${d}</span></div>${ctl}</div>`;
      const sw = (k, on) => `<label class="switch"><input type="checkbox" data-set="${k}" ${on ? 'checked' : ''}><span class="track"><span class="knob"></span></span></label>`;
      return pageHead('PREFERENCES', 'Settings', 'Preferences are stored in this browser only.') + `<div class="card pad settings">
        ${row('Theme', 'Dark is the default NOC-style theme.', `<div class="seg"><button class="${theme === 'dark' ? 'sel' : ''}" data-act="theme-set" data-v="dark">${icon('moon')} Dark</button><button class="${theme === 'light' ? 'sel' : ''}" data-act="theme-set" data-v="light">${icon('sun')} Light</button></div>`)}
        ${row('Default vendor', 'Pre-selected when the builder opens.', `<div class="select"><select data-set="defaultVendor">${NC.VENDOR_ORDER.map((v) => `<option value="${v}"${settings.defaultVendor === v ? ' selected' : ''}>${esc(NC.VENDORS[v].label)}</option>`).join('')}</select>${icon('chevron-down')}</div>`)}
        ${row('Header comments', 'Prepend a generator/platform header block to every output.', sw('header', settings.header))}
        ${row('Line numbers', 'Show the line-number gutter in the output editor.', sw('lineNumbers', settings.lineNumbers))}
        ${row('Wrap long lines', 'Otherwise the editor scrolls horizontally.', sw('wrap', settings.wrap))}
      </div>
      <div class="card pad settings"><h3>Data</h3>
        ${row('Saved configurations', `${history.all().length} entries in LocalStorage.`, `<div class="row-btns"><button class="btn soft sm" data-act="hist-export-all">${icon('download')} Export JSON</button><button class="btn sm danger" data-act="hist-clear">${icon('trash')} Clear history</button></div>`)}
        ${row('Reset application', 'Remove all NET // CONFIG data from this browser.', `<button class="btn sm danger" data-act="reset-all">${icon('refresh')} Reset</button>`)}
      </div>`;
    }
  };

  /* ==========================================================================
     ROUTER & SHELL
     ========================================================================== */
  const NAV = [
    ['WORKSPACE', [['dashboard', 'Dashboard', 'dashboard'], ['generator', 'Config Generator', 'sliders'], ['templates', 'Templates', 'templates'], ['history', 'Recent Configs', 'history']]],
    ['TOOLS', [['calculator', 'Network Calculator', 'calc'], ['commands', 'Command Reference', 'terminal'], ['devices', 'Devices', 'devices'], ['labs', 'Labs', 'flask']]],
    ['SYSTEM', [['docs', 'Documentation', 'book'], ['settings', 'Settings', 'settings']]]
  ];
  function renderNav() {
    $('#nav').innerHTML = NAV.map(([g, items]) => `<div class="nav-g"><div class="nav-gt">${g}</div>${items.map(([id, label, ic]) => `<a href="#/${id}" class="nav-i" data-view="${id}" data-tip-r="${label}">${icon(ic)}<span class="nav-l">${label}</span>${id === 'history' ? '<span class="nav-c" id="nav-hist"></span>' : ''}</a>`).join('')}</div>`).join('');
    updateNavCounts();
  }
  function updateNavCounts() { const el = $('#nav-hist'); if (el) el.textContent = history.all().length || ''; }
  function go(view) { if (location.hash !== '#/' + view) location.hash = '#/' + view; else route(); }
  function route() {
    const v = (location.hash.replace(/^#\/?/, '') || 'dashboard').split(/[?/]/)[0];
    S.view = VIEWS[v] ? v : 'dashboard';
    if (S.view !== 'generator') S.fullscreen = false;
    $$('.nav-i').forEach((a) => { const on = a.dataset.view === S.view; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const view = VIEWS[S.view];
    const host = $('#view');
    host.innerHTML = view.render();
    host.classList.remove('enter'); void host.offsetWidth; host.classList.add('enter');
    if (view.mount) view.mount();
    document.title = `${view.title} · NET // CONFIG`;
    $('#crumb').textContent = view.title;
    document.body.classList.remove('nav-open');
    window.scrollTo(0, 0);
    $('#main').focus({ preventScroll: true });
  }

  /* ------------------------------ Theme ------------------------------ */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    store.set('theme', t);
    const b = $('#theme-btn');
    if (b) { b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon'); b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); b.dataset.tip = t === 'dark' ? 'Light mode' : 'Dark mode'; }
    if (S.view === 'settings') route();
  }

  /* ------------------------------ Command palette ------------------------------ */
  let palItems = [], palIdx = 0;
  function openPalette(q) {
    const p = $('#palette');
    p.hidden = false;
    requestAnimationFrame(() => p.classList.add('open'));
    const inp = $('#pal-q');
    inp.value = q || '';
    renderPalette();
    setTimeout(() => inp.focus(), 20);
  }
  function closePalette() { const p = $('#palette'); if (p.hidden) return false; p.classList.remove('open'); setTimeout(() => (p.hidden = true), 150); return true; }
  function paletteSource() {
    const out = [];
    NAV.forEach(([, items]) => items.forEach(([id, label, ic]) => out.push({ k: 'Page', label, ic, run: () => go(id) })));
    NC.MODULE_ORDER.forEach((m) => out.push({ k: 'Module', label: NC.MODULES[m].name, sub: NC.MODULES[m].desc, ic: NC.MODULES[m].icon, run: () => { go('generator'); setTimeout(() => setModule(m), 30); } }));
    NC.VENDOR_ORDER.forEach((v) => out.push({ k: 'Vendor', label: NC.VENDORS[v].label, sub: NC.VENDORS[v].platform, ic: 'devices', run: () => { go('generator'); setTimeout(() => setVendor(v), 30); } }));
    NC.TEMPLATES.forEach((t) => out.push({ k: 'Template', label: t.name, sub: NC.VENDORS[t.vendor].label + ' · ' + t.difficulty, ic: 'templates', run: () => useTemplate(t.id) }));
    NC.COMMANDS.forEach((c) => out.push({ k: c.platform, label: c.cmd, sub: c.desc, ic: 'terminal', run: () => { S.cmd.q = c.cmd; S.cmd.tab = c.platform; go('commands'); } }));
    out.push({ k: 'Action', label: 'Toggle dark / light mode', ic: 'sun', run: () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark') });
    out.push({ k: 'Action', label: 'Generate configuration', sub: 'Ctrl + Enter', ic: 'play', run: generate });
    return out;
  }
  function renderPalette() {
    const q = $('#pal-q').value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const src = paletteSource();
    palItems = (terms.length ? src.filter((it) => { const h = (it.label + ' ' + (it.sub || '') + ' ' + it.k).toLowerCase(); return terms.every((t) => h.includes(t)); }) : src.filter((x) => x.k === 'Page' || x.k === 'Template')).slice(0, 40);
    palIdx = 0;
    $('#pal-list').innerHTML = palItems.map((it, i) => `<li role="option" id="pal-${i}" aria-selected="${i === 0}" class="pal-i${i === 0 ? ' sel' : ''}" data-i="${i}">${icon(it.ic)}<span class="pal-l"><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span><span class="pal-k">${esc(it.k)}</span></li>`).join('') || '<li class="pal-empty">No results</li>';
  }
  function palMove(d) {
    if (!palItems.length) return;
    palIdx = (palIdx + d + palItems.length) % palItems.length;
    $$('.pal-i').forEach((el, i) => { el.classList.toggle('sel', i === palIdx); el.setAttribute('aria-selected', i === palIdx); });
    const el = $('#pal-' + palIdx); if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function palRun(i) { const it = palItems[i]; if (!it) return; closePalette(); it.run(); }

  /* ------------------------------ Event wiring ------------------------------ */
  const ACT = {
    go: (el) => go(el.dataset.to),
    quick: (el) => { const v = el.dataset.v; go('generator'); setTimeout(() => setVendor(v), 20); },
    'goto-module': (el) => { const m = el.dataset.m; go('generator'); setTimeout(() => setModule(m), 20); },
    'scroll-step': (el) => { const t = ['#st-vendor', '#st-device', '#st-module', '#st-params'][+el.dataset.i]; const x = $(t); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    vendor: (el) => setVendor(el.dataset.v),
    device: (el) => setDevice(el.dataset.d),
    module: (el) => setModule(el.dataset.m, false),
    addmod: (el) => { setModule(el.dataset.m, true); toast(`${NC.MODULES[el.dataset.m].name} added to build`, 'info'); },
    rmmod: (el, e) => { e.stopPropagation(); removeModule(el.dataset.m); },
    'tab-mod': (el) => { S.module = el.dataset.m; renderModuleStep(); renderParams(); if (S.outTab === 'topo') renderOutput(); },
    'reset-mod': () => { confirmBox('Reset module parameters?', `Restore the default parameters for <b>${esc(NC.MODULES[S.module].name)}</b>. Your edits in this module will be lost.`, 'Reset', true).then((ok) => { if (ok) { S.params[S.module] = E.defaults(S.module, S.vendor, S.device); S.result = null; S.validated = false; renderParams(); renderOutput(); toast('Module reset to defaults', 'info'); } }); },
    generate: () => generate(),
    copy: () => copyConfig(),
    download: () => downloadConfig(),
    print: () => printConfig(),
    save: () => saveConfig(),
    clear: () => { confirmBox('Clear output?', 'The generated configuration will be removed from the editor. Parameters are kept.', 'Clear', true).then((ok) => { if (ok) { S.result = null; S.validated = false; renderStepper(); renderParams(); renderOutput(); } }); },
    fullscreen: () => { S.fullscreen = !S.fullscreen; document.body.classList.toggle('fs-lock', S.fullscreen); renderOutput(); },
    wrap: () => { settings.wrap = !settings.wrap; saveSettings(); renderOutput(); },
    outtab: (el) => { S.outTab = el.dataset.t; renderOutput(); },
    reveal: (el) => { const i = $('#f-' + el.dataset.f); if (i) i.type = i.type === 'password' ? 'text' : 'password'; },
    'row-add': (el) => tableOp(el.dataset.f, (rows, fl) => rows.push(clone(fl.blank))),
    'row-del': (el) => tableOp(el.dataset.f, (rows) => rows.splice(+el.dataset.i, 1)),
    'row-dup': (el) => tableOp(el.dataset.f, (rows) => rows.splice(+el.dataset.i + 1, 0, clone(rows[+el.dataset.i]))),
    'row-up': (el) => tableOp(el.dataset.f, (rows) => { const i = +el.dataset.i; if (i > 0) [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; }),
    'row-down': (el) => tableOp(el.dataset.f, (rows) => { const i = +el.dataset.i; if (i < rows.length - 1) [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; }),
    'focus-err': (el) => {
      const m = el.dataset.m;
      if (m && m !== S.module) { S.module = m; renderModuleStep(); renderParams(); }
      const sel = el.dataset.i !== '' ? `[data-tf="${el.dataset.f}"][data-row="${el.dataset.i}"][data-col="${el.dataset.c}"]` : `#f-${el.dataset.f}`;
      const t = $(sel) || $('#fw-' + el.dataset.f);
      if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => t.focus && t.focus(), 250); }
    },
    'use-template': (el) => useTemplate(el.dataset.id),
    'tpl-preview': (el) => previewTemplate(el.dataset.id),
    'tpl-vendor': (el) => { S.tpl.vendor = el.dataset.v; $$('[data-act="tpl-vendor"]').forEach((b) => b.classList.toggle('sel', b === el)); renderTplGrid(); },
    'hist-open': (el) => { const e = history.get(el.dataset.id); if (e) openEntry(e, false); },
    'hist-dup': (el) => { const e = history.get(el.dataset.id); if (!e) return; history.add(Object.assign(clone(e), { id: uid(), title: e.title + ' (copy)', ts: Date.now() })); toast('Configuration duplicated'); updateNavCounts(); route(); },
    'hist-del': (el) => { const e = history.get(el.dataset.id); if (!e) return; confirmBox('Delete configuration?', `“${esc(e.title)}” will be permanently removed from this browser.`, 'Delete', true).then((ok) => { if (ok) { history.remove(e.id); toast('Configuration deleted', 'info'); updateNavCounts(); route(); } }); },
    'hist-export': (el) => { const e = history.get(el.dataset.id); if (!e) return; const r = E.generate({ vendor: e.vendor, device: e.device, modules: e.modules, includeSecrets: false, header: true }); downloadText(e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.txt', r.ok ? r.text : e.text); toast('Export started'); },
    'hist-export-all': () => { downloadText('netconfig-history-' + stamp() + '.json', JSON.stringify({ app: 'NET // CONFIG', version: NC.VERSION, exported: new Date().toISOString(), items: history.all() }, null, 2), 'application/json'); toast('History exported'); },
    'hist-clear': () => confirmBox('Clear all history?', 'All saved configurations will be permanently removed from this browser.', 'Clear history', true).then((ok) => { if (ok) { history.save([]); updateNavCounts(); route(); toast('History cleared', 'info'); } }),
    'reset-all': () => confirmBox('Reset NET // CONFIG?', 'History, statistics, theme and settings will be removed from this browser.', 'Reset everything', true).then((ok) => { if (ok) { ['history', 'stats', 'settings', 'theme', 'seeded'].forEach(store.del); location.hash = '#/dashboard'; location.reload(); } }),
    'calc-tab': (el) => { S.calc.tab = el.dataset.t; $$('[data-act="calc-tab"]').forEach((b) => { b.classList.toggle('sel', b === el); b.setAttribute('aria-selected', b === el); }); renderCalc(); },
    'vlsm-add': () => { S.calc.vlsm.push({ name: 'SEGMENT-' + (S.calc.vlsm.length + 1), hosts: '10' }); renderCalc(); },
    'vlsm-del': (el) => { S.calc.vlsm.splice(+el.dataset.i, 1); renderCalc(); },
    'copy-val': (el) => copyText(el.dataset.v).then(() => toast('✓ Copied to clipboard'), () => toast('Clipboard unavailable', 'err')),
    'cmd-tab': (el) => { S.cmd.tab = el.dataset.t; S.cmd.q = ''; const q = $('#cmd-q'); if (q) q.value = ''; $$('[data-act="cmd-tab"]').forEach((b) => { b.classList.toggle('sel', b === el); b.setAttribute('aria-selected', b === el); }); renderCmds(); },
    'theme-set': (el) => setTheme(el.dataset.v),
    'doc-jump': (el, e) => { e.preventDefault(); const t = $(el.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
  };
  function tableOp(fid, fn) {
    const p = P(S.module);
    const fl = E.schema(S.module).find((x) => x.id === fid);
    if (!fl) return;
    p[fid] = p[fid] || [];
    fn(p[fid], fl);
    renderParams();
    if (S.outTab === 'topo') renderOutput();
  }

  let liveTimer = null;
  function liveValidate() {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      if (S.outTab === 'topo' && S.view === 'generator') { const tw = $('.topo-wrap'); if (tw) { const p = S.params[S.module]; tw.querySelector('svg').outerHTML = NC.Topology.render(S.vendor, S.device, S.module, p); } }
      if (!S.validated) return;
      const errs = [];
      S.bundle.forEach((m) => { if (E.support(S.vendor, S.device, m).ok) E.validate(m, E.clean(P(m)), S.vendor, S.device).errors.forEach((e) => errs.push(Object.assign({ module: m }, e))); });
      // Keep the last good output visible while re-checking the edited parameters.
      S.result = Object.assign({ ok: false, text: '', warnings: [], notes: [], unsupported: [], modules: [] }, S.result || {}, { errors: errs });
      renderErrors();
    }, 280);
  }

  function onInput(e) {
    const t = e.target;
    if (t.dataset.field) {
      const fl = E.schema(S.module).find((x) => x.id === t.dataset.field);
      if (!fl) return;
      const p = P(S.module);
      p[fl.id] = t.type === 'checkbox' ? t.checked : t.value;
      if (fl.type === 'toggle' || fl.type === 'select') { renderParams(); if (S.outTab === 'topo') renderOutput(); }
      liveValidate();
    } else if (t.dataset.tf) {
      const p = P(S.module);
      const row = p[t.dataset.tf][+t.dataset.row];
      row[t.dataset.col] = t.type === 'checkbox' ? t.checked : t.value;
      liveValidate();
    } else if (t.id === 'opt-secrets') {
      S.includeSecrets = t.checked;
      if (S.includeSecrets) toast('Secrets will be rendered in the output only - never saved', 'info');
    } else if (t.dataset.calc) {
      S.calc[t.dataset.calc] = t.value;
      renderCalcOut();
    } else if (t.dataset.vlsm !== undefined) {
      S.calc.vlsm[+t.dataset.vlsm][t.dataset.k] = t.value;
      renderCalcOut();
    } else if (t.id === 'cmd-q') {
      S.cmd.q = t.value; renderCmds();
    } else if (t.id === 'tpl-q') {
      S.tpl.q = t.value; renderTplGrid();
    } else if (t.dataset.set) {
      settings[t.dataset.set] = t.type === 'checkbox' ? t.checked : t.value;
      saveSettings();
      toast('Setting saved', 'info');
    } else if (t.id === 'pal-q') renderPalette();
  }

  function init() {
    setTheme(store.get('theme', 'dark'));
    seedHistory();
    renderNav();
    $('#ver').textContent = 'v' + NC.VERSION;
    $('#year').textContent = '2026';

    document.addEventListener('click', (e) => {
      const m = e.target.closest('[data-modal]');
      if (m) { closeModal(m.dataset.modal === 'ok'); return; }
      if (e.target.id === 'modal') { closeModal(false); return; }
      if (e.target.id === 'palette') { closePalette(); return; }
      const pi = e.target.closest('.pal-i');
      if (pi) { palRun(+pi.dataset.i); return; }
      const a = e.target.closest('[data-act]');
      if (a && ACT[a.dataset.act]) {
        if (a.getAttribute('aria-disabled') === 'true' && a.dataset.act === 'device') { toast(a.dataset.tip, 'info'); return; }
        if (a.disabled) return;
        ACT[a.dataset.act](a, e);
      }
    });
    document.addEventListener('input', (e) => { if (e.target.matches('input[type="text"], input[type="search"], input[type="password"], input:not([type]), textarea')) onInput(e); });
    document.addEventListener('change', (e) => { if (e.target.matches('select, input[type="checkbox"]')) onInput(e); });

    $('#menu-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    $('#collapse-btn').addEventListener('click', () => { document.body.classList.toggle('nav-collapsed'); store.set('collapsed', document.body.classList.contains('nav-collapsed')); });
    if (store.get('collapsed', false)) document.body.classList.add('nav-collapsed');
    $('#backdrop').addEventListener('click', () => document.body.classList.remove('nav-open'));
    $('#theme-btn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    $('#search-btn').addEventListener('click', () => openPalette());
    $('#about-btn').addEventListener('click', () => modal({ title: 'About NET // CONFIG', ok: 'Close', cancel: false, body: `<div class="about"><div class="brand big"><span class="logo-mark">${icon('logo')}</span><div><b>NET <i>//</i> CONFIG</b><small>NETWORK ENGINEERING TOOLKIT · v${NC.VERSION}</small></div></div><p>Network Configuration Generator for engineers who need clean, vendor-specific configuration fast - Cisco IOS/IOS-XE, MikroTik RouterOS, FortiGate, Juniper Junos and Aruba AOS-CX.</p><ul class="status-list"><li><span>Architecture</span><b>HTML5 · CSS3 · Vanilla JS · SVG</b></li><li><span>Dependencies</span><b>None</b></li><li><span>Device access</span><b class="muted">None - generation only</b></li><li><span>Data</span><b>LocalStorage, secrets never stored</b></li></ul><div class="notice">${icon('shield')}<span>Always review generated configurations before deploying them to production.</span></div></div>` }));
    $('#pal-q').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); palMove(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palMove(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); palRun(palIdx); }
    });

    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#palette').hidden ? openPalette() : closePalette(); return; }
      if (mod && e.key === 'Enter') { e.preventDefault(); generate(); return; }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveConfig(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copyConfig(); return; }
      if (e.key === 'Escape') {
        if (closePalette()) return;
        if (closeModal(false)) return;
        if (S.fullscreen) { S.fullscreen = false; document.body.classList.remove('fs-lock'); renderOutput(); return; }
        document.body.classList.remove('nav-open');
      }
    });

    window.addEventListener('hashchange', route);
    route();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
