/* ==========================================================================
   NET // CONFIG — Vendor syntax templates
   One generator object per platform. Syntax is never shared between
   vendors. A module that is not defined for a vendor is reported by the
   engine as "Template not available for this platform."

   Signature of every module function:  (params, ctx) => string[]
     ctx.device  : 'router' | 'switch' | 'firewall' | 'ap'
     ctx.secret(value, label) -> value or <REPLACE-WITH-LABEL> placeholder
     ctx.warn(msg) / ctx.note(msg) -> surfaced in the UI next to output
   ========================================================================== */
(function () {
  'use strict';
  const NC = window.NC;
  const N = NC.Net, V = NC.Valid;

  /* ------------------------------------------------------------------
     Shared helpers (pure formatting — no vendor syntax in here)
     ------------------------------------------------------------------ */
  const H = (NC.H = {
    c(s) { return N.parseCidr(String(s || ''), true); },
    mask: (p) => N.maskStr(p),
    wild: (p) => N.wildcardStr(p),
    list: (s) => V.list(s),
    san(s, max) {
      let r = String(s || '').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9_.\-]/g, '');
      if (max) r = r.slice(0, max);
      return r || 'UNNAMED';
    },
    dq(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; },
    exclusions(c, start, end) {
      const s = N.parseIPv4(start), e = N.parseIPv4(end);
      const out = [];
      const first = c.network + 1, last = c.broadcast - 1;
      if (s > first) out.push([N.toIPv4(first), N.toIPv4(s - 1)]);
      if (e < last) out.push([N.toIPv4(e + 1), N.toIPv4(last)]);
      return out;
    },
    lease(sec) {
      sec = +sec || 86400;
      return { d: Math.floor(sec / 86400), h: Math.floor((sec % 86400) / 3600), m: Math.floor((sec % 3600) / 60) };
    },
    rosTime(sec) {
      sec = +sec;
      if (sec % 86400 === 0) return sec / 86400 + 'd';
      if (sec % 3600 === 0) return sec / 3600 + 'h';
      if (sec % 60 === 0) return sec / 60 + 'm';
      return sec + 's';
    },
    addr(s) {
      s = String(s || '').trim().toLowerCase();
      if (!s || s === 'any') return { any: true };
      const c = N.parseCidr(s, true);
      if (!c) return { any: true };
      if (c.prefix === 32) return { host: c.ipStr, c, cidr: c.ipStr + '/32' };
      return { net: c.networkStr, prefix: c.prefix, c, cidr: c.cidr };
    },
    port(s) {
      s = String(s || '').trim();
      if (!s) return null;
      const m = /^(\d+)\s*-\s*(\d+)$/.exec(s);
      return m ? { from: +m[1], to: +m[2] } : { from: +s, to: +s };
    },
    portStr(p, sep) { return p.from === p.to ? String(p.from) : p.from + (sep || '-') + p.to; },
    ifs: (s) => V.expandIfs(s),
    groups: (s) => V.ifList(s),
    /** 'ge-0/0/1.20' -> {phy:'ge-0/0/1', unit:'20'} */
    unit(ifn) {
      const m = /^(.*)\.(\d+)$/.exec(String(ifn).trim());
      return m ? { phy: m[1], unit: m[2] } : { phy: String(ifn).trim(), unit: '0' };
    },
    indent(lines, n) { const pad = ' '.repeat(n); return lines.map((l) => (l === '' ? '' : pad + l)); },
    vlanNum(ifn) { const m = /^vlan\s*\.?\s*(\d+)$/i.exec(String(ifn).trim()); return m ? m[1] : null; },
    dhMap: { 14: 'modp2048', 15: 'modp3072', 16: 'modp4096', 19: 'ecp256', 20: 'ecp384', 21: 'ecp521' },
    dnsList(p) { return V.list(p); }
  });

  const T = (NC.Templates = {});

  /* ==================================================================
     CISCO IOS / IOS-XE
     ================================================================== */
  const ciscoAddr = (a) => (a.any ? 'any' : a.host ? 'host ' + a.host : a.net + ' ' + H.wild(a.prefix));
  const ciscoPort = (p) => (!p ? '' : p.from === p.to ? ' eq ' + p.from : ' range ' + p.from + ' ' + p.to);
  const ciscoRange = (spec) => {
    const g = H.groups(spec);
    if (g.length === 1 && g[0].name) return 'interface ' + g[0].name;
    const parts = g.map((x) => (x.name ? x.name : x.prefix + x.start + ' - ' + x.end));
    return 'interface range ' + parts.join(' , ');
  };
  const ciscoSev = { informational: 'informational', notifications: 'notifications', warnings: 'warnings', errors: 'errors', debugging: 'debugging' };

  T.cisco = {
    id: 'cisco',
    comment: '!',
    preamble: () => ['configure terminal'],
    postamble: () => ['end', '! Save only after verification:', '! copy running-config startup-config'],

    basic(p, x) {
      const L = [`hostname ${p.hostname}`];
      if (p.domain) L.push(`ip domain name ${p.domain}`);
      const dns = H.list(p.dns);
      if (dns.length) L.push(`ip name-server ${dns.join(' ')}`);
      L.push('service timestamps log datetime msec localtime show-timezone', 'service timestamps debug datetime msec localtime show-timezone', 'service password-encryption');
      if (p.mgmtEnable) {
        const c = H.c(p.mgmtIp);
        const vn = H.vlanNum(p.mgmtIface);
        L.push('!');
        if (vn && x.device === 'switch') L.push(`vlan ${vn}`, ' name MGMT', '!');
        L.push(`interface ${p.mgmtIface}`, ' description MANAGEMENT', ` ip address ${c.ipStr} ${H.mask(c.prefix)}`, ' no shutdown');
        if (p.mgmtGw) {
          L.push('!');
          if (x.device === 'switch') { L.push(`ip default-gateway ${p.mgmtGw}`); x.note('ip default-gateway is used only while "ip routing" is disabled. On a Layer-3 switch use a static default route instead.'); }
          else L.push(`ip route 0.0.0.0 0.0.0.0 ${p.mgmtGw} name MGMT-DEFAULT`);
        }
      }
      const ntp = H.list(p.ntp);
      if (ntp.length) { L.push('!'); ntp.forEach((s, i) => L.push(`ntp server ${s}${i === 0 ? ' prefer' : ''}`)); }
      if (p.snmpEnable) {
        const a = H.c(p.snmpAllowed);
        L.push('!', 'ip access-list standard SNMP-RO', ` permit ${a.networkStr} ${H.wild(a.prefix)}`, ' deny   any log');
        L.push(`snmp-server community ${x.secret(p.snmpCommunity, 'SNMP-COMMUNITY')} RO SNMP-RO`);
        if (p.snmpLocation) L.push(`snmp-server location ${p.snmpLocation}`);
        if (p.snmpContact) L.push(`snmp-server contact ${p.snmpContact}`);
      }
      if (p.syslogEnable) {
        L.push('!', `logging host ${p.syslogServer}`, `logging trap ${ciscoSev[p.syslogLevel] || 'informational'}`, 'logging buffered 64000 informational');
        if (p.mgmtEnable) L.push(`logging source-interface ${p.mgmtIface}`);
      }
      if (p.banner) L.push('!', 'banner motd #', ...String(p.banner).replace(/#/g, '').split('\n'), '#');
      return L;
    },

    vlan(p, x) {
      const L = [];
      const rows = p.rows || [];
      if (x.device === 'switch') {
        rows.forEach((r) => L.push(`vlan ${r.vlanId}`, ` name ${H.san(r.name, 32)}`, '!'));
        const l3 = p.l3 && rows.some((r) => r.gateway);
        if (l3) {
          L.push('ip routing', '!');
          rows.filter((r) => r.gateway).forEach((r) => {
            const c = H.c(r.subnet);
            L.push(`interface Vlan${r.vlanId}`, ` description ${r.description || r.name}`, ` ip address ${r.gateway} ${H.mask(c.prefix)}`, ' no shutdown', '!');
          });
        }
      } else {
        L.push(`interface ${p.parent}`, ' description 802.1Q-TRUNK', ' no ip address', ' no shutdown', '!');
        rows.forEach((r) => {
          const c = H.c(r.subnet);
          L.push(`interface ${p.parent}.${r.vlanId}`, ` description ${r.description || r.name}`, ` encapsulation dot1Q ${r.vlanId}`);
          if (r.gateway) L.push(` ip address ${r.gateway} ${H.mask(c.prefix)}`);
          L.push('!');
        });
      }
      rows.filter((r) => r.dhcp).forEach((r) => {
        const c = H.c(r.subnet);
        H.exclusions(c, r.start, r.end).forEach(([a, b]) => L.push(`ip dhcp excluded-address ${a} ${b}`));
        L.push(`ip dhcp pool VLAN${r.vlanId}-${H.san(r.name, 20)}`, ` network ${c.networkStr} ${H.mask(c.prefix)}`, ` default-router ${r.gateway}`);
        const dns = H.list(r.dns);
        if (dns.length) L.push(` dns-server ${dns.join(' ')}`);
        if (p.domain) L.push(` domain-name ${p.domain}`);
        L.push(' lease 1', '!');
      });
      return L;
    },

    dhcp(p) {
      const c = H.c(p.network);
      const L = [];
      if (p.setIfaceIp) L.push(`interface ${p.iface}`, ` ip address ${p.gateway} ${H.mask(c.prefix)}`, ' no shutdown', '!');
      H.exclusions(c, p.start, p.end).forEach(([a, b]) => L.push(`ip dhcp excluded-address ${a} ${b}`));
      L.push(`ip dhcp pool ${H.san(p.poolName)}`, ` network ${c.networkStr} ${H.mask(c.prefix)}`, ` default-router ${p.gateway}`);
      const dns = H.list(p.dns);
      if (dns.length) L.push(` dns-server ${dns.join(' ')}`);
      if (p.domain) L.push(` domain-name ${p.domain}`);
      const l = H.lease(p.lease);
      L.push(` lease ${l.d} ${l.h} ${l.m}`);
      return L;
    },

    ports(p, x) {
      const L = [ciscoRange(p.accessIfaces), ' description ACCESS', ' switchport mode access', ` switchport access vlan ${p.accessVlan}`];
      if (p.voiceVlan) L.push(` switchport voice vlan ${p.voiceVlan}`);
      L.push(' switchport nonegotiate');
      if (p.portfast) L.push(' spanning-tree portfast');
      if (p.bpduguard) L.push(' spanning-tree bpduguard enable');
      if (p.portSecurity) {
        L.push(` switchport port-security maximum ${p.maxMac}`, ` switchport port-security violation ${p.violation}`, ' switchport port-security mac-address sticky', ' switchport port-security');
        if (p.voiceVlan && +p.maxMac < 2) x.warn('Port security maximum should be at least 2 when a voice VLAN is configured (phone + PC).');
      }
      L.push(' no shutdown', '!');
      if (p.trunkEnable) {
        L.push(ciscoRange(p.trunkIfaces), ' description UPLINK-TRUNK', ' ! On platforms that also support ISL add: switchport trunk encapsulation dot1q', ' switchport mode trunk');
        if (p.nativeVlan) L.push(` switchport trunk native vlan ${p.nativeVlan}`);
        L.push(` switchport trunk allowed vlan ${p.allowedVlans.replace(/\s+/g, '')}`, ' switchport nonegotiate', ' no shutdown', '!');
      }
      return L;
    },

    lacp(p, x) {
      const L = ['port-channel load-balance src-dst-ip', '!'];
      const po = `Port-channel${p.lagId}`;
      const body = [];
      if (x.device === 'switch') {
        if (p.lagMode === 'trunk') {
          body.push(' switchport mode trunk');
          if (p.nativeVlan) body.push(` switchport trunk native vlan ${p.nativeVlan}`);
          body.push(` switchport trunk allowed vlan ${String(p.allowedVlans).replace(/\s+/g, '')}`);
        } else body.push(' switchport mode access', ` switchport access vlan ${p.accessVlan}`);
      }
      L.push(ciscoRange(p.members), ` description ${po}-MEMBER`, ...body, ` channel-group ${p.lagId} mode ${p.mode}`, ' no shutdown', '!');
      L.push(`interface ${po}`, ` description ${p.description || 'LACP-BUNDLE'}`, ...body, ' no shutdown');
      return L;
    },

    stp(p) {
      const L = [];
      if (p.mode === 'mstp') {
        L.push('spanning-tree mode mst', 'spanning-tree mst configuration', ` name ${H.san(p.region || 'REGION1')}`, ' revision 1', ` instance 1 vlan ${p.vlans.replace(/\s+/g, '')}`, ' exit', `spanning-tree mst 0-1 priority ${p.priority}`);
      } else {
        L.push('spanning-tree mode rapid-pvst', 'spanning-tree extend system-id', `spanning-tree vlan ${p.vlans.replace(/\s+/g, '')} priority ${p.priority}`);
      }
      if (p.portfastDefault) L.push('spanning-tree portfast default');
      if (p.bpduguardDefault) L.push('spanning-tree portfast bpduguard default');
      if (p.loopguard) L.push('spanning-tree loopguard default');
      return L;
    },

    l2sec(p) {
      const vl = p.vlans.replace(/\s+/g, '');
      const L = [];
      if (p.snooping) {
        L.push(`ip dhcp snooping vlan ${vl}`);
        if (!p.option82) L.push('no ip dhcp snooping information option');
        L.push('ip dhcp snooping');
      }
      if (p.dai) L.push(`ip arp inspection vlan ${vl}`, 'ip arp inspection validate src-mac dst-mac ip');
      L.push('!', ciscoRange(p.trustedIfaces), ' description TRUSTED-UPLINK');
      if (p.snooping) L.push(' ip dhcp snooping trust');
      if (p.dai) L.push(' ip arp inspection trust');
      L.push('!');
      if (p.untrustedIfaces && p.snooping) L.push(ciscoRange(p.untrustedIfaces), ` ip dhcp snooping limit rate ${p.rateLimit}`, '!');
      return L;
    },

    static(p) {
      const L = [];
      (p.rows || []).forEach((r) => {
        const hop = [r.iface, r.gateway].filter(Boolean).join(' ');
        const dist = r.distance && +r.distance !== 1 ? ' ' + r.distance : '';
        const name = r.comment ? ' name ' + H.san(r.comment) : '';
        L.push(`ip route ${r.dest} ${H.mask(+r.prefix)} ${hop}${dist}${name}`);
      });
      if (p.defaultRoute) {
        const hop = [p.defaultIface, p.defaultGw].filter(Boolean).join(' ');
        L.push(`ip route 0.0.0.0 0.0.0.0 ${hop} name DEFAULT-ROUTE`);
      }
      return L;
    },

    ospf(p) {
      const L = [`router ospf ${p.processId}`, ` router-id ${p.routerId}`, ' log-adjacency-changes'];
      H.list(p.passive).forEach((i) => L.push(` passive-interface ${i}`));
      H.list(p.networks).forEach((n) => { const c = H.c(n); L.push(` network ${c.networkStr} ${H.wild(c.prefix)} area ${p.area}`); });
      if (p.defaultOriginate) L.push(' default-information originate');
      return L;
    },

    bgp(p, x) {
      const nets = H.list(p.networks).map(H.c);
      const L = [];
      if (nets.length) {
        nets.forEach((c, i) => L.push(`ip prefix-list NC-BGP-OUT seq ${(i + 1) * 10} permit ${c.cidr}`));
        if (p.anchor) nets.forEach((c) => L.push(`ip route ${c.networkStr} ${H.mask(c.prefix)} Null0 254 name BGP-ANCHOR`));
        L.push('!');
      }
      const n = p.neighbor;
      L.push(`router bgp ${p.localAsn}`, ` bgp router-id ${p.routerId}`, ' bgp log-neighbor-changes', ` neighbor ${n} remote-as ${p.remoteAsn}`);
      if (p.description) L.push(` neighbor ${n} description ${p.description}`);
      if (p.password) L.push(` neighbor ${n} password ${x.secret(p.password, 'BGP-MD5-KEY')}`);
      if (p.updateSourceIf) {
        L.push(` neighbor ${n} update-source ${p.updateSourceIf}`);
        if (p.localAsn !== p.remoteAsn) { L.push(` neighbor ${n} ebgp-multihop 2`); x.note('eBGP sourced from a loopback requires ebgp-multihop and a route to the peer loopback.'); }
      }
      L.push(' !', ' address-family ipv4 unicast');
      nets.forEach((c) => L.push(`  network ${c.networkStr} mask ${H.mask(c.prefix)}`));
      L.push(`  neighbor ${n} activate`);
      if (nets.length && p.localAsn !== p.remoteAsn) L.push(`  neighbor ${n} prefix-list NC-BGP-OUT out`);
      L.push(' exit-address-family');
      return L;
    },

    rip(p) {
      const L = ['router rip', ' version 2'];
      if (p.noAutoSummary) L.push(' no auto-summary');
      const cls = [...new Set(H.list(p.networks).map((n) => N.classfulNetwork(H.c(n).network)))];
      H.list(p.passive).forEach((i) => L.push(` passive-interface ${i}`));
      cls.forEach((n) => L.push(` network ${n}`));
      if (p.defaultOriginate) L.push(' default-information originate');
      return L;
    },

    nat(p, x) {
      const L = [`interface ${p.insideIf}`, ' ip nat inside', '!', `interface ${p.outsideIf}`, ' ip nat outside', '!'];
      const acl = () => { const c = H.c(p.insideNet); L.push('ip access-list standard NAT-INSIDE', ` permit ${c.networkStr} ${H.wild(c.prefix)}`, '!'); };
      if (p.type === 'static') L.push(`ip nat inside source static ${p.insideLocal} ${p.outsideGlobal}`);
      else if (p.type === 'dynamic') {
        acl();
        L.push(`ip nat pool NAT-POOL ${p.poolStart} ${p.poolEnd} netmask ${H.mask(+p.poolPrefix)}`, 'ip nat inside source list NAT-INSIDE pool NAT-POOL');
      } else if (p.type === 'pat') {
        acl();
        L.push(`ip nat inside source list NAT-INSIDE interface ${p.outsideIf} overload`);
      } else {
        const glob = p.useIfaceIp || !p.outsideGlobal ? `interface ${p.outsideIf}` : p.outsideGlobal;
        L.push(`ip nat inside source static ${p.protocol} ${p.insideLocal} ${p.intPort} ${glob} ${p.extPort}`);
      }
      x.note('If this router also terminates IPsec, deny VPN traffic at the top of NAT-INSIDE (NAT exemption).');
      return L;
    },

    acl(p) {
      const L = [`ip access-list extended ${H.san(p.name)}`];
      let seq = 10;
      (p.rows || []).forEach((r) => {
        if (r.comment) L.push(` remark ${r.comment}`);
        const tcpudp = r.protocol === 'tcp' || r.protocol === 'udp';
        const sp = tcpudp ? ciscoPort(H.port(r.sport)) : '';
        const dp = tcpudp ? ciscoPort(H.port(r.dport)) : '';
        L.push(` ${seq} ${r.action} ${r.protocol} ${ciscoAddr(H.addr(r.src))}${sp} ${ciscoAddr(H.addr(r.dst))}${dp}${r.log ? ' log' : ''}`);
        seq += 10;
      });
      if (p.implicitLog) L.push(' remark EXPLICIT DENY WITH LOGGING', ` ${Math.max(seq, 1000)} deny ip any any log`);
      if (p.applyIface) L.push('!', `interface ${p.applyIface}`, ` ip access-group ${H.san(p.name)} ${p.direction}`);
      return L;
    },

    mgmt(p) {
      const c = H.c(p.mgmtNet);
      const L = [];
      if (p.domain) L.push(`ip domain name ${p.domain}`);
      L.push(`crypto key generate rsa general-keys modulus ${p.keySize}`, 'ip ssh version 2', `ip ssh time-out 60`, `ip ssh authentication-retries ${p.retries}`, '!');
      L.push('ip access-list standard MGMT-ACCESS', ` permit ${c.networkStr} ${H.wild(c.prefix)}`, ' deny   any log', '!');
      if (p.adminUser) L.push(`! Create the local account on the device - never store secrets in generated files:`, `! username ${p.adminUser} privilege 15 algorithm-type scrypt secret <STRONG-SECRET>`, '!');
      L.push('line vty 0 15', ' access-class MGMT-ACCESS in', ' transport input ssh', ' login local', ` exec-timeout ${p.timeout} 0`, '!', 'line con 0', ' login local', ` exec-timeout ${p.timeout} 0`, ' logging synchronous', '!');
      L.push(`login block-for 120 attempts ${p.retries} within 60`, 'login on-failure log');
      if (p.disableInsecure) L.push('no ip http server', 'ip http secure-server');
      return L;
    },

    ipsec(p, x) {
      const ln = H.c(p.localNet), rn = H.c(p.remoteNet);
      const nm = H.san(p.name, 24);
      const psk = x.secret(p.psk, 'PRE-SHARED-KEY');
      const enc = p.encryption === 'aes128' ? 128 : 256;
      const hash = { sha1: 'sha1', sha256: 'sha256', sha512: 'sha512' }[p.hash];
      const tsHash = { sha1: 'esp-sha-hmac', sha256: 'esp-sha256-hmac', sha512: 'esp-sha512-hmac' }[p.hash];
      const L = [];
      if (p.ikeVersion === 'ikev2') {
        L.push(`crypto ikev2 proposal PROP-${nm}`, ` encryption aes-cbc-${enc}`, ` integrity ${hash}`, ` group ${p.dh}`, '!',
          `crypto ikev2 policy POL-${nm}`, ` proposal PROP-${nm}`, '!',
          `crypto ikev2 keyring KR-${nm}`, ` peer ${nm}`, `  address ${p.remotePublic}`, `  pre-shared-key ${psk}`, ' !', '!',
          `crypto ikev2 profile PROF-${nm}`, ` match identity remote address ${p.remotePublic} 255.255.255.255`, ` identity local address ${p.localPublic}`,
          ' authentication remote pre-share', ' authentication local pre-share', ` keyring local KR-${nm}`, ` lifetime ${p.ikeLifetime}`, '!');
      } else {
        L.push('crypto isakmp policy 10', ` encryption aes ${enc}`, ` hash ${hash}`, ' authentication pre-share', ` group ${p.dh}`, ` lifetime ${p.ikeLifetime}`, '!',
          `crypto isakmp key ${psk} address ${p.remotePublic}`, '!');
      }
      L.push(`crypto ipsec transform-set TS-${nm} esp-aes ${enc} ${tsHash}`, ' mode tunnel', '!',
        `ip access-list extended VPN-${nm}`, ` permit ip ${ln.networkStr} ${H.wild(ln.prefix)} ${rn.networkStr} ${H.wild(rn.prefix)}`, '!',
        `crypto map CMAP-${nm} 10 ipsec-isakmp`, ` set peer ${p.remotePublic}`, ` set transform-set TS-${nm}`);
      if (p.ikeVersion === 'ikev2') L.push(` set ikev2-profile PROF-${nm}`);
      if (p.pfs) L.push(` set pfs group${p.dh}`);
      L.push(` set security-association lifetime seconds ${p.ipsecLifetime}`, ` match address VPN-${nm}`, '!', `interface ${p.wanIf}`, ` crypto map CMAP-${nm}`);
      x.note('Exempt VPN traffic from NAT (deny local→remote at the top of the NAT ACL) or the tunnel will not match.');
      return L;
    }
  };

  /* ==================================================================
     MIKROTIK ROUTEROS v7
     ================================================================== */
  const rq = (v) => (/^[A-Za-z0-9_.\-\/:,]+$/.test(String(v)) ? String(v) : H.dq(v));
  /** Render [[path, [cmds]], ...] in /export style, skipping empty sections */
  const ros = (sections) => {
    const L = [];
    sections.forEach(([path, cmds]) => { if (cmds && cmds.length) L.push(path, ...cmds); });
    return L;
  };
  const rosLevels = { debugging: ['debug', 'info', 'warning', 'error', 'critical'], informational: ['info', 'warning', 'error', 'critical'], notifications: ['warning', 'error', 'critical'], warnings: ['warning', 'error', 'critical'], errors: ['error', 'critical'] };
  const isBridge = (i) => /^bridge/i.test(String(i));

  T.mikrotik = {
    id: 'mikrotik',
    comment: '#',
    preamble: () => ['# Paste into a RouterOS 7.x terminal or import as .rsc', '# Take a backup first: /system backup save name=pre-netconfig'],
    postamble: () => [],

    basic(p, x) {
      const dns = H.list(p.dns);
      const ntp = H.list(p.ntp);
      const S = [];
      S.push(['/system identity', [`set name=${rq(p.hostname)}`]]);
      if (dns.length) S.push(['/ip dns', [`set allow-remote-requests=no servers=${dns.join(',')}`]]);
      if (p.mgmtEnable) {
        S.push(['/ip address', [`add address=${p.mgmtIp} interface=${p.mgmtIface} comment="MANAGEMENT"`]]);
        if (p.mgmtGw) S.push(['/ip route', [`add dst-address=0.0.0.0/0 gateway=${p.mgmtGw} comment="MGMT default route"`]]);
      }
      if (ntp.length) S.push(['/system ntp client', ['set enabled=yes']], ['/system ntp client servers', ntp.map((s) => `add address=${s}`)]);
      if (p.snmpEnable) {
        S.push(['/snmp community', [`add name=${rq(x.secret(p.snmpCommunity, 'SNMP-COMMUNITY'))} addresses=${H.c(p.snmpAllowed).cidr} read-access=yes write-access=no`]]);
        S.push(['/snmp', [`set enabled=yes contact=${H.dq(p.snmpContact || '')} location=${H.dq(p.snmpLocation || '')}`]]);
      }
      if (p.syslogEnable) {
        S.push(['/system logging action', [`add name=remotesyslog target=remote remote=${p.syslogServer} remote-port=514`]]);
        S.push(['/system logging', (rosLevels[p.syslogLevel] || rosLevels.informational).map((t) => `add action=remotesyslog topics=${t}`)]);
      }
      if (p.banner) S.push(['/system note', [`set show-at-login=yes note=${H.dq(String(p.banner).replace(/\n/g, ' '))}`]]);
      if (p.domain) x.note('RouterOS has no global domain-name setting; the domain is applied per DHCP network instead.');
      return ros(S);
    },

    vlan(p, x) {
      const rows = p.rows || [];
      const ifn = (r) => `vlan${r.vlanId}-${H.san(r.name, 20)}`;
      const S = [];
      S.push(['/interface vlan', rows.map((r) => `add interface=${p.parent} name=${ifn(r)} vlan-id=${r.vlanId} comment=${H.dq(r.description || r.name)}`)]);
      if (isBridge(p.parent)) {
        const tagged = [p.parent].concat(H.ifs(p.trunkPorts)).join(',');
        S.push(['/interface bridge vlan', rows.map((r) => `add bridge=${p.parent} tagged=${tagged} vlan-ids=${r.vlanId} comment=${H.dq(r.name)}`)]);
      }
      if (p.l3) S.push(['/ip address', rows.filter((r) => r.gateway).map((r) => `add address=${r.gateway}/${H.c(r.subnet).prefix} interface=${ifn(r)} comment=${H.dq(r.name)}`)]);
      const d = rows.filter((r) => r.dhcp);
      S.push(['/ip pool', d.map((r) => `add name=pool-${H.san(r.name)} ranges=${r.start}-${r.end}`)]);
      S.push(['/ip dhcp-server', d.map((r) => `add name=dhcp-${H.san(r.name)} interface=${ifn(r)} address-pool=pool-${H.san(r.name)} lease-time=1d`)]);
      S.push(['/ip dhcp-server network', d.map((r) => {
        const dns = H.list(r.dns);
        return `add address=${H.c(r.subnet).cidr} gateway=${r.gateway}${dns.length ? ' dns-server=' + dns.join(',') : ''}${p.domain ? ' domain=' + p.domain : ''} comment=${H.dq(r.name)}`;
      })]);
      const L = ros(S);
      if (isBridge(p.parent)) {
        L.push('# Enable VLAN filtering only after verifying management access (risk of lock-out):', `# /interface bridge set [find name=${p.parent}] vlan-filtering=yes`);
        x.warn(`VLAN filtering on ${p.parent} is left disabled. Enable it from a console/MAC-Winbox session after verifying access.`);
      }
      return L;
    },

    dhcp(p) {
      const c = H.c(p.network);
      const dns = H.list(p.dns);
      const nm = H.san(p.poolName);
      return ros([
        ['/ip address', p.setIfaceIp ? [`add address=${p.gateway}/${c.prefix} interface=${p.iface} comment=${H.dq(nm)}`] : []],
        ['/ip pool', [`add name=pool-${nm} ranges=${p.start}-${p.end}`]],
        ['/ip dhcp-server', [`add name=dhcp-${nm} interface=${p.iface} address-pool=pool-${nm} lease-time=${H.rosTime(p.lease)}`]],
        ['/ip dhcp-server network', [`add address=${c.cidr} gateway=${p.gateway}${dns.length ? ' dns-server=' + dns.join(',') : ''}${p.domain ? ' domain=' + p.domain : ''} comment=${H.dq(nm)}`]]
      ]);
    },

    ports(p, x) {
      const br = p.bridge || 'bridge1';
      const acc = H.ifs(p.accessIfaces);
      const trk = p.trunkEnable ? H.ifs(p.trunkIfaces) : [];
      const voice = p.voiceVlan;
      const accFrames = voice ? 'admit-all' : 'admit-only-untagged-and-priority-tagged';
      const ports = acc.map((i) => `add bridge=${br} interface=${i} pvid=${p.accessVlan} frame-types=${accFrames} ingress-filtering=yes${p.portfast ? ' edge=yes' : ''}${p.bpduguard ? ' bpdu-guard=yes' : ''} comment="ACCESS"`);
      trk.forEach((i) => ports.push(`add bridge=${br} interface=${i}${p.nativeVlan ? ' pvid=' + p.nativeVlan + ' frame-types=admit-all' : ' frame-types=admit-only-vlan-tagged'} ingress-filtering=yes comment="TRUNK"`));
      const vlans = [];
      const allowed = p.trunkEnable ? V.vlanList(p.allowedVlans) || [] : [];
      const all = [...new Set([+p.accessVlan].concat(voice ? [+voice] : [], allowed))];
      all.forEach((v) => {
        const tagged = [br].concat(trk);
        if (voice && v === +voice) tagged.push(...acc);
        const untagged = v === +p.accessVlan ? acc : [];
        vlans.push(`add bridge=${br} tagged=${tagged.join(',')}${untagged.length ? ' untagged=' + untagged.join(',') : ''} vlan-ids=${v}`);
      });
      const L = ros([
        ['/interface bridge', p.createBridge ? [`add name=${br} protocol-mode=rstp vlan-filtering=no comment="NET // CONFIG"`] : []],
        ['/interface bridge port', ports],
        ['/interface bridge vlan', vlans]
      ]);
      L.push('# Enable VLAN filtering only after verifying management access:', `# /interface bridge set [find name=${br}] vlan-filtering=yes`);
      if (p.portSecurity) { L.push('# NOTE: RouterOS bridge has no per-port MAC limit (port security) - not generated.'); x.warn('Port security (MAC limit) is not available on RouterOS bridges and was not generated.'); }
      return L;
    },

    lacp(p, x) {
      const members = H.ifs(p.members);
      const bond = `bond${p.lagId}`;
      if (p.mode === 'passive') x.note('RouterOS 802.3ad bonding always runs LACP in active mode.');
      const S = [['/interface bonding', [`add name=${bond} mode=802.3ad slaves=${members.join(',')} lacp-rate=30secs transmit-hash-policy=layer-2-and-3 comment=${H.dq(p.description || 'LACP')}`]]];
      if (p.lagIp) S.push(['/ip address', [`add address=${p.lagIp} interface=${bond}`]]);
      else if (p.bridge) S.push(['/interface bridge port', [`add bridge=${p.bridge} interface=${bond}${p.lagMode === 'access' ? ' pvid=' + p.accessVlan : ''}`]]);
      return ros(S);
    },

    stp(p) {
      const hex = '0x' + (+p.priority).toString(16).toUpperCase();
      const L = [`/interface bridge set [find name=${p.bridge || 'bridge1'}] protocol-mode=${p.mode === 'mstp' ? 'mstp' : 'rstp'} priority=${hex}${p.mode === 'mstp' ? ' region-name=' + H.san(p.region || 'REGION1') + ' region-revision=1' : ''}`];
      return L;
    },

    l2sec(p, x) {
      const br = p.bridge || 'bridge1';
      const L = [];
      if (p.snooping) {
        L.push(`/interface bridge set [find name=${br}] dhcp-snooping=yes add-dhcp-option82=${p.option82 ? 'yes' : 'no'}`);
        L.push('/interface bridge port');
        H.ifs(p.trustedIfaces).forEach((i) => L.push(`set [find interface=${i}] trusted=yes`));
      }
      if (p.dai) { L.push('# NOTE: RouterOS does not implement Dynamic ARP Inspection - not generated.'); x.warn('Dynamic ARP Inspection is not available on RouterOS and was not generated.'); }
      return L;
    },

    static(p) {
      const cmds = (p.rows || []).map((r) => {
        const gw = r.gateway && r.iface ? `${r.gateway}%${r.iface}` : r.gateway || r.iface;
        return `add dst-address=${r.dest}/${r.prefix} gateway=${gw} distance=${r.distance || 1}${r.comment ? ' comment=' + H.dq(r.comment) : ''}`;
      });
      if (p.defaultRoute) cmds.push(`add dst-address=0.0.0.0/0 gateway=${p.defaultGw || p.defaultIface} distance=1 comment="DEFAULT-ROUTE"`);
      return ros([['/ip route', cmds]]);
    },

    ospf(p) {
      const areaId = /^\d+$/.test(p.area) ? N.toIPv4(+p.area) : p.area;
      const an = areaId === '0.0.0.0' ? 'backbone' : 'area-' + areaId;
      const tmpl = [];
      const pas = H.list(p.passive);
      if (pas.length) tmpl.push(`add area=${an} interfaces=${pas.join(',')} passive comment="passive"`);
      const nets = H.list(p.networks).map((n) => H.c(n).cidr);
      if (nets.length) tmpl.push(`add area=${an} networks=${nets.join(',')}`);
      const ifs = H.list(p.ifaces);
      if (ifs.length) tmpl.push(`add area=${an} interfaces=${ifs.join(',')}`);
      return ros([
        ['/routing ospf instance', [`add name=ospf-${p.processId} version=2 router-id=${p.routerId}${p.defaultOriginate ? ' originate-default=always' : ''}`]],
        ['/routing ospf area', [`add name=${an} area-id=${areaId} instance=ospf-${p.processId}`]],
        ['/routing ospf interface-template', tmpl]
      ]);
    },

    bgp(p, x) {
      const nets = H.list(p.networks).map((n) => H.c(n).cidr);
      const role = p.localAsn === p.remoteAsn ? 'ibgp' : 'ebgp';
      let conn = `add name=${H.san(p.description || 'peer1')} as=${p.localAsn} router-id=${p.routerId} remote.address=${p.neighbor} remote.as=${p.remoteAsn} local.role=${role}`;
      if (p.localAddress) conn += ` local.address=${p.localAddress}`;
      if (p.password) conn += ` tcp-md5-key=${rq(x.secret(p.password, 'BGP-MD5-KEY'))}`;
      if (nets.length) conn += ' output.network=bgp-networks';
      if (p.description) conn += ` comment=${H.dq(p.description)}`;
      return ros([
        ['/ip firewall address-list', nets.map((n) => `add list=bgp-networks address=${n}`)],
        ['/ip route', p.anchor ? nets.map((n) => `add dst-address=${n} blackhole comment="BGP anchor"`) : []],
        ['/routing bgp connection', [conn]]
      ]);
    },

    rip(p, x) {
      const tmpl = [];
      const pas = H.list(p.passive);
      const ifs = H.list(p.ifaces);
      if (ifs.length) tmpl.push(`add instance=rip-1 interfaces=${ifs.join(',')}`);
      if (pas.length) tmpl.push(`add instance=rip-1 interfaces=${pas.join(',')} passive`);
      x.note('RouterOS v7 RIP runs on interface templates; networks are advertised through redistribute=connected.');
      return ros([
        ['/routing rip instance', [`add name=rip-1 afi=ipv4 redistribute=connected${p.defaultOriginate ? ' originate-default=always' : ''}`]],
        ['/routing rip interface-template', tmpl]
      ]);
    },

    nat(p) {
      const c = [];
      if (p.type === 'static') {
        c.push(`add chain=dstnat dst-address=${p.outsideGlobal} action=dst-nat to-addresses=${p.insideLocal} comment="1:1 NAT inbound"`);
        c.push(`add chain=srcnat src-address=${p.insideLocal} out-interface=${p.outsideIf} action=src-nat to-addresses=${p.outsideGlobal} comment="1:1 NAT outbound"`);
      } else if (p.type === 'dynamic') {
        c.push(`add chain=srcnat src-address=${H.c(p.insideNet).cidr} out-interface=${p.outsideIf} action=src-nat to-addresses=${p.poolStart}-${p.poolEnd} comment="Dynamic NAT pool"`);
      } else if (p.type === 'pat') {
        c.push(`add chain=srcnat src-address=${H.c(p.insideNet).cidr} out-interface=${p.outsideIf} action=masquerade comment="PAT / masquerade"`);
      } else {
        const match = p.useIfaceIp || !p.outsideGlobal ? `in-interface=${p.outsideIf}` : `dst-address=${p.outsideGlobal}`;
        c.push(`add chain=dstnat ${match} protocol=${p.protocol} dst-port=${p.extPort} action=dst-nat to-addresses=${p.insideLocal} to-ports=${p.intPort} comment="Port forward ${p.extPort}->${p.insideLocal}:${p.intPort}"`);
      }
      const S = [['/ip firewall nat', c]];
      if (p.type === 'portfwd') S.push(['/ip firewall filter', [`add chain=forward action=accept connection-nat-state=dstnat in-interface=${p.outsideIf} comment="Allow port-forwarded traffic - move above any drop rule"`]]);
      return ros(S);
    },

    acl(p, x) {
      x.note('RouterOS has no ACL object; rules are generated as stateless-order entries in the forward chain.');
      const cmds = (p.rows || []).map((r) => {
        const a = [`add chain=forward action=${r.action === 'permit' ? 'accept' : 'drop'}`];
        if (r.protocol !== 'ip') a.push(`protocol=${r.protocol}`);
        const s = H.addr(r.src), d = H.addr(r.dst);
        if (!s.any) a.push(`src-address=${s.cidr}`);
        if (!d.any) a.push(`dst-address=${d.cidr}`);
        if (r.protocol === 'tcp' || r.protocol === 'udp') {
          if (r.sport) a.push(`src-port=${H.portStr(H.port(r.sport))}`);
          if (r.dport) a.push(`dst-port=${H.portStr(H.port(r.dport))}`);
        }
        if (p.applyIface) a.push(`${p.direction === 'in' ? 'in' : 'out'}-interface=${p.applyIface}`);
        if (r.log) a.push(`log=yes log-prefix=${H.dq(H.san(p.name, 20))}`);
        a.push(`comment=${H.dq(r.comment || p.name)}`);
        return a.join(' ');
      });
      if (p.implicitLog) cmds.push(`add chain=forward action=drop log=yes log-prefix="${H.san(p.name, 16)}-DENY" comment="Explicit deny"`);
      return ros([['/ip firewall filter', cmds]]);
    },

    firewall(p) {
      const cmds = (p.rows || []).map((r) => {
        const a = [`add chain=${r.chain} action=${r.action}`];
        if (r.state && r.state !== 'any') a.push(`connection-state=${r.state}`);
        if (r.protocol && r.protocol !== 'any') a.push(`protocol=${r.protocol}`);
        const s = H.addr(r.src), d = H.addr(r.dst);
        if (!s.any) a.push(`src-address=${s.cidr}`);
        if (!d.any) a.push(`dst-address=${d.cidr}`);
        if ((r.protocol === 'tcp' || r.protocol === 'udp') && r.port) a.push(`dst-port=${H.portStr(H.port(r.port))}`);
        if (r.iface) a.push(`${r.chain === 'output' ? 'out' : 'in'}-interface=${r.iface}`);
        if (r.action === 'log') a.push(`log-prefix=${H.dq(H.san(r.comment || 'LOG', 20))}`);
        if (r.action === 'reject') a.push('reject-with=icmp-admin-prohibited');
        if (r.comment) a.push(`comment=${H.dq(r.comment)}`);
        return a.join(' ');
      });
      return ros([['/ip firewall filter', cmds]]);
    },

    mgmt(p) {
      const net = H.c(p.mgmtNet).cidr;
      const svc = [];
      if (p.disableInsecure) svc.push('set telnet disabled=yes', 'set ftp disabled=yes', 'set www disabled=yes', 'set api disabled=yes', 'set api-ssl disabled=yes');
      svc.push(`set ssh address=${net} port=22`, `set winbox address=${net}`);
      const L = ros([
        ['/ip service', svc],
        ['/ip ssh', ['set strong-crypto=yes']],
        ['/tool mac-server', ['set allowed-interface-list=none']],
        ['/ip neighbor discovery-settings', ['set discover-interface-list=none']]
      ]);
      if (p.adminUser) L.push('# Create the account interactively - never keep passwords in generated files:', `# /user add name=${p.adminUser} group=full`, `# /user set [find name=${p.adminUser}] password=<STRONG-SECRET>`);
      return L;
    },

    ipsec(p, x) {
      const nm = H.san(p.name);
      const dh = H.dhMap[p.dh];
      const enc = p.encryption === 'aes128' ? 'aes-128' : 'aes-256';
      const L = ros([
        ['/ip ipsec profile', [`add name=prof-${nm} dh-group=${dh} enc-algorithm=${enc} hash-algorithm=${p.hash} lifetime=${H.rosTime(p.ikeLifetime)}`]],
        ['/ip ipsec peer', [`add name=peer-${nm} address=${p.remotePublic}/32 local-address=${p.localPublic} exchange-mode=${p.ikeVersion === 'ikev2' ? 'ike2' : 'main'} profile=prof-${nm}`]],
        ['/ip ipsec proposal', [`add name=prop-${nm} auth-algorithms=${p.hash} enc-algorithms=${enc}-cbc pfs-group=${p.pfs ? dh : 'none'} lifetime=${H.rosTime(p.ipsecLifetime)}`]],
        ['/ip ipsec identity', [`add peer=peer-${nm} auth-method=pre-shared-key secret=${rq(x.secret(p.psk, 'PRE-SHARED-KEY'))}`]],
        ['/ip ipsec policy', [`add src-address=${H.c(p.localNet).cidr} dst-address=${H.c(p.remoteNet).cidr} tunnel=yes action=encrypt proposal=prop-${nm} peer=peer-${nm}`]],
        ['/ip firewall nat', [`add chain=srcnat action=accept src-address=${H.c(p.localNet).cidr} dst-address=${H.c(p.remoteNet).cidr} comment="IPsec NAT bypass - must sit above masquerade"`]]
      ]);
      x.warn('Move the "IPsec NAT bypass" rule above any masquerade/src-nat rule: /ip firewall nat move [find comment~"IPsec NAT bypass"] 0');
      return L;
    }
  };

  /* ==================================================================
     FORTIGATE — FortiOS 7.x
     ================================================================== */
  const fgi = (lines) => lines.map((l) => '    ' + l);
  const cfg = (path, body) => ['config ' + path].concat(fgi(body), ['end']);
  const edit = (name, body) => ['edit ' + name].concat(fgi(body), ['next']);
  const fq = (s) => H.dq(s);
  const fgNet = (c) => `${c.networkStr} ${H.mask(c.prefix)}`;
  const fgSev = { debugging: 'debug', informational: 'information', notifications: 'notification', warnings: 'warning', errors: 'error' };
  const fgAddrName = (a) => (a.any ? 'all' : a.host ? `H_${a.host}` : `N_${a.net}_${a.prefix}`);
  const fgAddrEdits = (addrs) => {
    const seen = new Set();
    const out = [];
    addrs.forEach((a) => {
      if (a.any) return;
      const n = fgAddrName(a);
      if (seen.has(n)) return;
      seen.add(n);
      out.push(...edit(fq(n), [`set subnet ${a.host ? a.host + ' 255.255.255.255' : a.net + ' ' + H.mask(a.prefix)}`]));
    });
    return out;
  };
  const fgService = (proto, port, customs) => {
    if (!proto || proto === 'any' || proto === 'ip') return 'ALL';
    if (proto === 'icmp') return 'ALL_ICMP';
    const pp = H.port(port);
    if (!pp) return proto === 'tcp' ? 'ALL_TCP' : 'ALL_UDP';
    const name = `NC_${proto.toUpperCase()}_${H.portStr(pp)}`;
    if (!customs.has(name)) customs.set(name, edit(fq(name), [`set ${proto}-portrange ${H.portStr(pp)}`]));
    return name;
  };

  T.fortigate = {
    id: 'fortigate',
    comment: '#',
    preamble: () => ['# Paste into the FortiGate CLI (global VDOM or the target VDOM).', '# Back up first: execute backup config flash pre-netconfig'],
    postamble: () => [],

    basic(p, x) {
      const L = cfg('system global', [`set hostname ${fq(p.hostname)}`].concat(p.banner ? ['set pre-login-banner enable'] : []));
      const dns = H.list(p.dns);
      if (dns.length) L.push(...cfg('system dns', [`set primary ${dns[0]}`].concat(dns[1] ? [`set secondary ${dns[1]}`] : [])));
      if (p.domain) x.note('FortiOS: set the DNS search domain under "config system dns" if required for your build.');
      const ntp = H.list(p.ntp);
      if (ntp.length) {
        const eds = [];
        ntp.forEach((s, i) => eds.push(...edit(String(i + 1), [`set server ${fq(s)}`])));
        L.push(...cfg('system ntp', ['set ntpsync enable', 'set type custom', 'set syncinterval 60', 'config ntpserver'].concat(fgi(eds), ['end'])));
      }
      if (p.mgmtEnable) {
        const c = H.c(p.mgmtIp);
        L.push(...cfg('system interface', edit(fq(p.mgmtIface), [`set ip ${c.ipStr} ${H.mask(c.prefix)}`, `set allowaccess ping https ssh${p.snmpEnable ? ' snmp' : ''}`, 'set description "MANAGEMENT"'])));
        if (p.mgmtGw) L.push(...cfg('router static', edit('0', [`set gateway ${p.mgmtGw}`, `set device ${fq(p.mgmtIface)}`, 'set comment "MGMT default route"'])));
      }
      if (p.snmpEnable) {
        L.push(...cfg('system snmp sysinfo', ['set status enable', `set description ${fq(p.hostname)}`, `set contact-info ${fq(p.snmpContact || '')}`, `set location ${fq(p.snmpLocation || '')}`]));
        const a = H.c(p.snmpAllowed);
        L.push(...cfg('system snmp community', edit('1', [`set name ${fq(x.secret(p.snmpCommunity, 'SNMP-COMMUNITY'))}`, 'config hosts'].concat(fgi(edit('1', [`set ip ${fgNet(a)}`])), ['end']))));
      }
      if (p.syslogEnable) {
        L.push(...cfg('log syslogd setting', ['set status enable', `set server ${fq(p.syslogServer)}`, 'set mode udp', 'set port 514']));
        L.push(...cfg('log syslogd filter', [`set severity ${fgSev[p.syslogLevel] || 'information'}`]));
      }
      if (p.banner) L.push(...cfg('system replacemsg admin "pre_admin-disclaimer-text"', [`set buffer ${fq(p.banner)}`]));
      return L;
    },

    vlan(p) {
      const rows = p.rows || [];
      const used = new Set();
      const nm = (r) => {
        let n = H.san(r.name, 15);
        if (used.has(n)) n = H.san(`VL${r.vlanId}-${r.name}`, 15);
        used.add(n);
        return n;
      };
      const names = rows.map(nm);
      const eds = [];
      rows.forEach((r, i) => {
        const c = H.c(r.subnet);
        const body = ['set vdom "root"'];
        if (p.l3 && r.gateway) body.push(`set ip ${r.gateway} ${H.mask(c.prefix)}`, 'set allowaccess ping');
        body.push(`set description ${fq(r.description || r.name)}`, 'set role lan', `set interface ${fq(p.parent)}`, `set vlanid ${r.vlanId}`);
        eds.push(...edit(fq(names[i]), body));
      });
      const L = cfg('system interface', eds);
      const d = [];
      rows.forEach((r, i) => {
        if (!r.dhcp) return;
        const c = H.c(r.subnet);
        const dns = H.list(r.dns);
        const body = ['set dns-service ' + (dns.length ? 'specify' : 'default'), `set default-gateway ${r.gateway}`, `set netmask ${H.mask(c.prefix)}`, `set interface ${fq(names[i])}`, 'config ip-range'];
        body.push(...fgi(edit('1', [`set start-ip ${r.start}`, `set end-ip ${r.end}`])), 'end');
        dns.slice(0, 3).forEach((s, k) => body.push(`set dns-server${k + 1} ${s}`));
        if (p.domain) body.push(`set domain ${fq(p.domain)}`);
        body.push('set lease-time 86400');
        d.push(...edit('0', body));
      });
      if (d.length) L.push(...cfg('system dhcp server', d));
      return L;
    },

    dhcp(p) {
      const c = H.c(p.network);
      const L = [];
      if (p.setIfaceIp) L.push(...cfg('system interface', edit(fq(p.iface), [`set ip ${p.gateway} ${H.mask(c.prefix)}`, 'set allowaccess ping'])));
      const dns = H.list(p.dns);
      const body = ['set dns-service ' + (dns.length ? 'specify' : 'default'), `set default-gateway ${p.gateway}`, `set netmask ${H.mask(c.prefix)}`, `set interface ${fq(p.iface)}`, 'config ip-range'];
      body.push(...fgi(edit('1', [`set start-ip ${p.start}`, `set end-ip ${p.end}`])), 'end');
      dns.slice(0, 3).forEach((s, k) => body.push(`set dns-server${k + 1} ${s}`));
      if (p.domain) body.push(`set domain ${fq(p.domain)}`);
      body.push(`set lease-time ${p.lease}`);
      L.push(...cfg('system dhcp server', edit('0', body)));
      return L;
    },

    lacp(p) {
      const body = ['set vdom "root"', 'set type aggregate', `set member ${H.ifs(p.members).map(fq).join(' ')}`, `set lacp-mode ${p.mode}`, `set description ${fq(p.description || 'LACP')}`];
      if (p.lagIp) { const c = H.c(p.lagIp); body.push(`set ip ${c.ipStr} ${H.mask(c.prefix)}`, 'set allowaccess ping'); }
      return cfg('system interface', edit(fq(`LAG${p.lagId}`), body));
    },

    static(p) {
      const eds = [];
      (p.rows || []).forEach((r) => {
        const b = [`set dst ${r.dest} ${H.mask(+r.prefix)}`];
        if (r.gateway) b.push(`set gateway ${r.gateway}`);
        b.push(`set device ${fq(r.iface)}`);
        if (r.distance && +r.distance !== 10) b.push(`set distance ${r.distance}`);
        if (r.comment) b.push(`set comment ${fq(r.comment)}`);
        eds.push(...edit('0', b));
      });
      if (p.defaultRoute) eds.push(...edit('0', [`set gateway ${p.defaultGw}`, `set device ${fq(p.defaultIface)}`, 'set comment "DEFAULT-ROUTE"']));
      return cfg('router static', eds);
    },

    ospf(p) {
      const areaId = /^\d+$/.test(p.area) ? N.toIPv4(+p.area) : p.area;
      const nets = [];
      H.list(p.networks).forEach((n, i) => nets.push(...edit(String(i + 1), [`set prefix ${fgNet(H.c(n))}`, `set area ${areaId}`])));
      const body = [`set router-id ${p.routerId}`];
      if (p.defaultOriginate) body.push('set default-information-originate enable');
      const pas = H.list(p.passive);
      if (pas.length) body.push(`set passive-interface ${pas.map(fq).join(' ')}`);
      body.push('config area', ...fgi(edit(areaId, [])), 'end', 'config network', ...fgi(nets), 'end');
      return cfg('router ospf', body);
    },

    bgp(p, x) {
      const nets = H.list(p.networks).map(H.c);
      const L = [];
      if (p.anchor && nets.length) {
        const eds = [];
        nets.forEach((c) => eds.push(...edit('0', [`set dst ${fgNet(c)}`, 'set blackhole enable', 'set distance 254', 'set comment "BGP anchor"'])));
        L.push(...cfg('router static', eds));
      }
      const nb = [`set remote-as ${p.remoteAsn}`];
      if (p.description) nb.push(`set description ${fq(p.description)}`);
      if (p.updateSourceIf) nb.push(`set update-source ${fq(p.updateSourceIf)}`);
      if (p.password) nb.push(`set password ${x.secret(p.password, 'BGP-MD5-KEY')}`);
      if (p.updateSourceIf && p.localAsn !== p.remoteAsn) nb.push('set ebgp-enforce-multihop enable');
      const netEds = [];
      nets.forEach((c, i) => netEds.push(...edit(String(i + 1), [`set prefix ${fgNet(c)}`])));
      L.push(...cfg('router bgp', [`set as ${p.localAsn}`, `set router-id ${p.routerId}`, 'config neighbor', ...fgi(edit(fq(p.neighbor), nb)), 'end', 'config network', ...fgi(netEds), 'end']));
      return L;
    },

    rip(p) {
      const nets = [];
      H.list(p.networks).forEach((n, i) => nets.push(...edit(String(i + 1), [`set prefix ${fgNet(H.c(n))}`])));
      const body = [];
      if (p.defaultOriginate) body.push('set default-information-originate enable');
      const pas = H.list(p.passive);
      if (pas.length) body.push(`set passive-interface ${pas.map(fq).join(' ')}`);
      body.push('config network', ...fgi(nets), 'end');
      const ifs = H.list(p.ifaces);
      if (ifs.length) {
        const e = [];
        ifs.forEach((i) => e.push(...edit(fq(i), ['set receive-version 2', 'set send-version 2'])));
        body.push('config interface', ...fgi(e), 'end');
      }
      return cfg('router rip', body);
    },

    nat(p, x) {
      const L = [];
      const inside = p.insideNet ? H.addr(p.insideNet) : null;
      const pol = (body) => cfg('firewall policy', edit('0', body));
      if (p.type === 'pat' || p.type === 'dynamic') {
        L.push(...cfg('firewall address', fgAddrEdits([inside])));
        if (p.type === 'dynamic') L.push(...cfg('firewall ippool', edit('"NAT-POOL"', ['set type one-to-one', `set startip ${p.poolStart}`, `set endip ${p.poolEnd}`])));
        const b = ['set name "LAN-to-WAN-NAT"', `set srcintf ${fq(p.insideIf)}`, `set dstintf ${fq(p.outsideIf)}`, 'set action accept', `set srcaddr ${fq(fgAddrName(inside))}`, 'set dstaddr "all"', 'set schedule "always"', 'set service "ALL"', 'set logtraffic all', 'set nat enable'];
        if (p.type === 'dynamic') b.push('set ippool enable', 'set poolname "NAT-POOL"');
        L.push(...pol(b));
      } else {
        const vipName = `VIP_${p.insideLocal}${p.type === 'portfwd' ? '_' + p.extPort : ''}`;
        const vb = [`set extip ${p.outsideGlobal}`, `set mappedip ${fq(p.insideLocal)}`, `set extintf ${fq(p.outsideIf)}`];
        if (p.type === 'static') vb.push('set nat-source-vip enable');
        else vb.push('set portforward enable', `set protocol ${p.protocol}`, `set extport ${p.extPort}`, `set mappedport ${p.intPort}`);
        L.push(...cfg('firewall vip', edit(fq(vipName), vb)));
        const customs = new Map();
        const svc = p.type === 'portfwd' ? fgService(p.protocol, p.intPort, customs) : 'ALL';
        if (customs.size) L.push(...cfg('firewall service custom', [].concat(...customs.values())));
        L.push(...pol([`set name ${fq(H.san('WAN-to-' + p.insideLocal, 35))}`, `set srcintf ${fq(p.outsideIf)}`, `set dstintf ${fq(p.insideIf)}`, 'set action accept', 'set srcaddr "all"', `set dstaddr ${fq(vipName)}`, 'set schedule "always"', `set service ${fq(svc)}`, 'set logtraffic all']));
        if (p.type === 'static') x.warn('The inbound policy allows service ALL to the static-NAT host. Restrict the service before production.');
      }
      return L;
    },

    firewall(p, x) {
      const customs = new Map();
      const addrs = [];
      const pols = [], local = [];
      (p.rows || []).forEach((r, i) => {
        const n = i + 1;
        if (r.state && r.state !== 'any' && r.state !== 'new') { x.note(`Rule ${n} (${r.state}) skipped - FortiGate policies are stateful; return traffic is permitted automatically.`); return; }
        if (r.action === 'log') { x.warn(`Rule ${n} skipped - FortiOS has no log-only action. Use logtraffic on an accept/deny policy.`); return; }
        if (r.chain === 'output') { x.warn(`Rule ${n} skipped - FortiOS does not filter locally originated (output) traffic with policies.`); return; }
        const s = H.addr(r.src), d = H.addr(r.dst);
        addrs.push(s, d);
        const svc = fgService(r.protocol, r.port, customs);
        const action = r.action === 'accept' ? 'accept' : 'deny';
        if (r.chain === 'input') {
          const b = [`set intf ${fq(r.iface || 'any')}`, `set srcaddr ${fq(fgAddrName(s))}`, `set dstaddr ${fq(fgAddrName(d))}`, `set action ${action}`, `set service ${fq(svc)}`, 'set schedule "always"'];
          if (r.comment) b.push(`set comments ${fq(r.comment)}`);
          local.push(...edit('0', b));
        } else {
          const b = [`set name ${fq(H.san(r.comment || 'RULE-' + n, 35))}`, `set srcintf ${fq(r.iface || 'any')}`, `set dstintf ${fq(p.dstIf || 'any')}`, `set action ${action}`, `set srcaddr ${fq(fgAddrName(s))}`, `set dstaddr ${fq(fgAddrName(d))}`, 'set schedule "always"', `set service ${fq(svc)}`, 'set logtraffic all'];
          if (r.action === 'reject') b.push('set send-deny-packet enable');
          if (r.comment) b.push(`set comments ${fq(r.comment)}`);
          pols.push(...edit('0', b));
        }
      });
      const L = [];
      const ae = fgAddrEdits(addrs);
      if (ae.length) L.push(...cfg('firewall address', ae));
      if (customs.size) L.push(...cfg('firewall service custom', [].concat(...customs.values())));
      if (pols.length) L.push(...cfg('firewall policy', pols));
      if (local.length) L.push(...cfg('firewall local-in-policy', local));
      return L;
    },

    mgmt(p) {
      const c = H.c(p.mgmtNet);
      const L = cfg('system interface', edit(fq(p.mgmtIface), ['set allowaccess ping https ssh']));
      const g = [`set admintimeout ${p.timeout}`, 'set admin-ssh-port 22', `set admin-lockout-threshold ${p.retries}`, 'set admin-lockout-duration 120', 'set admin-https-redirect enable', 'set strong-crypto enable'];
      if (p.disableInsecure) g.push('set admin-telnet disable');
      L.push(...cfg('system global', g));
      L.push(...cfg('system admin', edit(fq(p.adminUser || 'admin'), [`set trusthost1 ${fgNet(c)}`])));
      return L;
    },

    ipsec(p, x) {
      const nm = H.san(p.name, 15);
      const ln = H.c(p.localNet), rn = H.c(p.remoteNet);
      const prop = `${p.encryption}-${p.hash}`;
      const p1 = [`set interface ${fq(p.wanIf)}`, `set ike-version ${p.ikeVersion === 'ikev2' ? 2 : 1}`, 'set peertype any', 'set net-device disable', `set proposal ${prop}`, `set dhgrp ${p.dh}`, `set local-gw ${p.localPublic}`, `set remote-gw ${p.remotePublic}`, `set keylife ${p.ikeLifetime}`, `set psksecret ${x.secret(p.psk, 'PRE-SHARED-KEY')}`];
      if (p.ikeVersion === 'ikev1') p1.splice(2, 0, 'set mode main');
      const p2 = [`set phase1name ${fq(nm)}`, `set proposal ${prop}`];
      if (p.pfs) p2.push('set pfs enable', `set dhgrp ${p.dh}`); else p2.push('set pfs disable');
      p2.push(`set keylifeseconds ${p.ipsecLifetime}`, `set src-subnet ${fgNet(ln)}`, `set dst-subnet ${fgNet(rn)}`);
      const la = H.addr(p.localNet), ra = H.addr(p.remoteNet);
      const L = [];
      L.push(...cfg('vpn ipsec phase1-interface', edit(fq(nm), p1)));
      L.push(...cfg('vpn ipsec phase2-interface', edit(fq(nm + '-P2'), p2)));
      L.push(...cfg('firewall address', fgAddrEdits([la, ra])));
      L.push(...cfg('router static', [].concat(edit('0', [`set dst ${fgNet(rn)}`, `set device ${fq(nm)}`, `set comment ${fq('VPN ' + nm)}`]), edit('0', [`set dst ${fgNet(rn)}`, 'set blackhole enable', 'set distance 254', `set comment ${fq('VPN ' + nm + ' blackhole')}`]))));
      L.push(...cfg('firewall policy', [].concat(
        edit('0', [`set name ${fq(H.san('LAN-to-' + nm, 35))}`, `set srcintf ${fq(p.lanIf)}`, `set dstintf ${fq(nm)}`, 'set action accept', `set srcaddr ${fq(fgAddrName(la))}`, `set dstaddr ${fq(fgAddrName(ra))}`, 'set schedule "always"', 'set service "ALL"', 'set logtraffic all']),
        edit('0', [`set name ${fq(H.san(nm + '-to-LAN', 35))}`, `set srcintf ${fq(nm)}`, `set dstintf ${fq(p.lanIf)}`, 'set action accept', `set srcaddr ${fq(fgAddrName(ra))}`, `set dstaddr ${fq(fgAddrName(la))}`, 'set schedule "always"', 'set service "ALL"', 'set logtraffic all'])
      )));
      return L;
    }
  };

  /* ==================================================================
     JUNIPER JUNOS  (set-style; load with "load set terminal")
     ================================================================== */
  const jfull = (ifn) => { const u = H.unit(ifn); return `${u.phy}.${u.unit}`; };
  const jArea = (a) => (/^\d+$/.test(String(a)) ? N.toIPv4(+a) : String(a));
  const jSev = { debugging: 'any', informational: 'info', notifications: 'notice', warnings: 'warning', errors: 'error' };
  const jMembers = (arr) => (arr.length === 1 ? String(arr[0]) : `[ ${arr.join(' ')} ]`);
  const jRange = (name, spec) => {
    const L = [];
    H.groups(spec).forEach((g) => {
      if (g.name) L.push(`set interfaces interface-range ${name} member ${g.name}`);
      else L.push(`set interfaces interface-range ${name} member-range ${g.prefix}${g.start} to ${g.prefix}${g.end}`);
    });
    return L;
  };
  const jPrio = (p) => (+p === 0 ? '0' : +p / 1024 + 'k');

  T.juniper = {
    id: 'juniper',
    comment: '#',
    restrict: { nat: ['firewall'], firewall: ['firewall'], ipsec: ['firewall'], ports: ['switch'], stp: ['switch'], l2sec: ['switch'] },
    restrictMsg: { nat: 'NAT is generated for SRX (Firewall) only.', firewall: 'Security policies are generated for SRX (Firewall) only.', ipsec: 'IPsec is generated for SRX (Firewall) only.' },
    preamble: () => ['# Enter configuration mode and paste with: load set terminal'],
    postamble: () => ['# Validate and apply with a safety rollback:', '#   show | compare', '#   commit check', '#   commit confirmed 5'],

    basic(p, x) {
      const L = [`set system host-name ${p.hostname}`];
      if (p.domain) L.push(`set system domain-name ${p.domain}`);
      H.list(p.dns).forEach((s) => L.push(`set system name-server ${s}`));
      if (p.mgmtEnable) {
        const u = H.unit(p.mgmtIface);
        L.push(`set interfaces ${u.phy} unit ${u.unit} family inet address ${H.c(p.mgmtIp).ipStr}/${H.c(p.mgmtIp).prefix}`);
        if (p.mgmtGw) {
          L.push(`set routing-options static route 0.0.0.0/0 next-hop ${p.mgmtGw}`, 'set routing-options static route 0.0.0.0/0 no-readvertise');
          if (/^(fxp0|me0|em0|vme)/.test(u.phy)) x.note('For out-of-band fxp0/me0 consider "set system management-instance" (mgmt_junos) instead of a default route in inet.0.');
        }
      }
      H.list(p.ntp).forEach((s, i) => L.push(`set system ntp server ${s}${i === 0 ? ' prefer' : ''}`));
      if (p.snmpEnable) {
        const cm = x.secret(p.snmpCommunity, 'SNMP-COMMUNITY');
        if (p.snmpLocation) L.push(`set snmp location ${H.dq(p.snmpLocation)}`);
        if (p.snmpContact) L.push(`set snmp contact ${H.dq(p.snmpContact)}`);
        L.push(`set snmp community ${cm} authorization read-only`, `set snmp community ${cm} clients ${H.c(p.snmpAllowed).cidr}`);
      }
      if (p.syslogEnable) L.push(`set system syslog host ${p.syslogServer} any ${jSev[p.syslogLevel] || 'info'}`);
      if (p.banner) L.push(`set system login message ${H.dq(String(p.banner).replace(/\n/g, '\\n'))}`);
      if (x.device === 'firewall') x.note('SRX: allow host-inbound system-services (ssh, snmp, ntp) on the management zone.');
      return L;
    },

    vlan(p, x) {
      const rows = p.rows || [];
      const L = [];
      if (x.device === 'switch') {
        rows.forEach((r) => {
          const n = H.san(r.name);
          L.push(`set vlans ${n} vlan-id ${r.vlanId}`);
          if (r.description) L.push(`set vlans ${n} description ${H.dq(r.description)}`);
          if (p.l3 && r.gateway) L.push(`set vlans ${n} l3-interface irb.${r.vlanId}`, `set interfaces irb unit ${r.vlanId} family inet address ${r.gateway}/${H.c(r.subnet).prefix}`);
        });
      } else {
        const ph = H.unit(p.parent).phy;
        L.push(`set interfaces ${ph} vlan-tagging`);
        rows.forEach((r) => {
          L.push(`set interfaces ${ph} unit ${r.vlanId} description ${H.dq(r.description || r.name)}`, `set interfaces ${ph} unit ${r.vlanId} vlan-id ${r.vlanId}`);
          if (p.l3 && r.gateway) L.push(`set interfaces ${ph} unit ${r.vlanId} family inet address ${r.gateway}/${H.c(r.subnet).prefix}`);
        });
      }
      rows.filter((r) => r.dhcp).forEach((r) => {
        const pool = `POOL-${H.san(r.name)}`;
        const base = `set access address-assignment pool ${pool} family inet`;
        const ifn = x.device === 'switch' ? `irb.${r.vlanId}` : `${H.unit(p.parent).phy}.${r.vlanId}`;
        L.push(`${base} network ${H.c(r.subnet).cidr}`, `${base} range R1 low ${r.start}`, `${base} range R1 high ${r.end}`, `${base} dhcp-attributes router ${r.gateway}`);
        H.list(r.dns).forEach((d) => L.push(`${base} dhcp-attributes name-server ${d}`));
        if (p.domain) L.push(`${base} dhcp-attributes domain-name ${p.domain}`);
        L.push(`${base} dhcp-attributes maximum-lease-time 86400`, `set system services dhcp-local-server group GRP-${H.san(r.name)} interface ${ifn}`);
      });
      if (x.device === 'firewall' && rows.some((r) => r.dhcp)) x.note('SRX: add "host-inbound-traffic system-services dhcp" to the zone that owns the VLAN units.');
      return L;
    },

    dhcp(p, x) {
      const c = H.c(p.network);
      const pool = `POOL-${H.san(p.poolName)}`;
      const base = `set access address-assignment pool ${pool} family inet`;
      const L = [];
      if (p.setIfaceIp) { const u = H.unit(p.iface); L.push(`set interfaces ${u.phy} unit ${u.unit} family inet address ${p.gateway}/${c.prefix}`); }
      L.push(`${base} network ${c.cidr}`, `${base} range R1 low ${p.start}`, `${base} range R1 high ${p.end}`, `${base} dhcp-attributes router ${p.gateway}`);
      H.list(p.dns).forEach((d) => L.push(`${base} dhcp-attributes name-server ${d}`));
      if (p.domain) L.push(`${base} dhcp-attributes domain-name ${p.domain}`);
      L.push(`${base} dhcp-attributes maximum-lease-time ${p.lease}`, `set system services dhcp-local-server group GRP-${H.san(p.poolName)} interface ${jfull(p.iface)}`);
      if (x.device === 'firewall') x.note('SRX: allow "host-inbound-traffic system-services dhcp" on the LAN zone.');
      return L;
    },

    ports(p, x) {
      const L = jRange('ACCESS-PORTS', p.accessIfaces);
      const r = 'set interfaces interface-range ACCESS-PORTS';
      L.push(`${r} description "ACCESS"`, `${r} unit 0 family ethernet-switching interface-mode access`, `${r} unit 0 family ethernet-switching vlan members ${p.accessVlan}`);
      const acc = H.ifs(p.accessIfaces);
      if (p.portfast) acc.forEach((i) => L.push(`set protocols rstp interface ${i} edge`));
      if (p.bpduguard) L.push('set protocols rstp bpdu-block-on-edge');
      if (p.portSecurity) {
        const act = { restrict: 'drop-and-log', shutdown: 'shutdown', protect: 'drop' }[p.violation] || 'drop';
        acc.forEach((i) => L.push(`set switch-options interface ${i}.0 interface-mac-limit ${p.maxMac} packet-action ${act}`));
      }
      if (p.voiceVlan) x.warn('Junos voice VLAN (switch-options voip) references the VLAN by name - add: set switch-options voip interface <if>.0 vlan <VOICE-VLAN-NAME>');
      if (p.trunkEnable) {
        const allowed = V.vlanList(p.allowedVlans) || [];
        const members = p.nativeVlan && !allowed.includes(+p.nativeVlan) ? String(p.allowedVlans).split(',').map((s) => s.trim()).concat(String(p.nativeVlan)) : String(p.allowedVlans).split(',').map((s) => s.trim());
        H.ifs(p.trunkIfaces).forEach((i) => {
          L.push(`set interfaces ${i} description "UPLINK-TRUNK"`, `set interfaces ${i} unit 0 family ethernet-switching interface-mode trunk`, `set interfaces ${i} unit 0 family ethernet-switching vlan members ${jMembers(members)}`);
          if (p.nativeVlan) L.push(`set interfaces ${i} native-vlan-id ${p.nativeVlan}`);
        });
      }
      return L;
    },

    lacp(p, x) {
      const ae = `ae${p.lagId}`;
      const opt = x.device === 'switch' ? 'ether-options' : 'gigether-options';
      const L = [`set chassis aggregated-devices ethernet device-count ${+p.lagId + 1}`];
      H.ifs(p.members).forEach((i) => L.push(`set interfaces ${i} ${opt} 802.3ad ${ae}`));
      L.push(`set interfaces ${ae} description ${H.dq(p.description || 'LACP')}`, `set interfaces ${ae} aggregated-ether-options lacp ${p.mode}`, `set interfaces ${ae} aggregated-ether-options lacp periodic fast`);
      if (x.device === 'switch') {
        if (p.lagMode === 'trunk') {
          const m = String(p.allowedVlans).split(',').map((s) => s.trim());
          L.push(`set interfaces ${ae} unit 0 family ethernet-switching interface-mode trunk`, `set interfaces ${ae} unit 0 family ethernet-switching vlan members ${jMembers(m)}`);
          if (p.nativeVlan) L.push(`set interfaces ${ae} native-vlan-id ${p.nativeVlan}`);
        } else L.push(`set interfaces ${ae} unit 0 family ethernet-switching interface-mode access`, `set interfaces ${ae} unit 0 family ethernet-switching vlan members ${p.accessVlan}`);
      } else if (p.lagIp) L.push(`set interfaces ${ae} unit 0 family inet address ${p.lagIp}`);
      x.note('Member interfaces must not carry any unit configuration: "delete interfaces <member> unit 0" first if present.');
      return L;
    },

    stp(p, x) {
      const proto = p.mode === 'mstp' ? 'mstp' : 'rstp';
      const L = [];
      if (proto === 'mstp') L.push(`set protocols mstp configuration-name ${H.san(p.region || 'REGION1')}`, 'set protocols mstp revision-level 1');
      L.push(`set protocols ${proto} bridge-priority ${jPrio(p.priority)}`);
      if (p.bpduguardDefault) L.push(`set protocols ${proto} bpdu-block-on-edge`);
      if (p.portfastDefault) x.note('Junos has no global edge default - mark edge ports per interface (Access & Trunk module).');
      if (p.loopguard) x.note('Junos loop protection is configured per interface: set protocols rstp interface <if> no-root-port / bpdu-timeout-action.');
      return L;
    },

    l2sec(p) {
      const L = [];
      const names = H.list(p.vlanNames);
      const trusted = H.ifs(p.trustedIfaces);
      names.forEach((v) => {
        const b = `set vlans ${v} forwarding-options dhcp-security`;
        if (p.dai) L.push(`${b} arp-inspection`);
        if (p.option82) L.push(`${b} option-82`);
        if (!p.dai && !p.option82) L.push(`${b} group TRUSTED overrides trusted`);
        else L.push(`${b} group TRUSTED overrides trusted`);
        trusted.forEach((i) => L.push(`${b} group TRUSTED interface ${i}.0`));
      });
      return L;
    },

    static(p) {
      const L = [];
      (p.rows || []).forEach((r) => {
        const pre = `set routing-options static route ${r.dest}/${r.prefix}`;
        if (r.comment) L.push(`# ${r.comment}`);
        L.push(`${pre} next-hop ${r.gateway || jfull(r.iface)}`);
        if (r.distance && +r.distance !== 5) L.push(`${pre} preference ${r.distance}`);
      });
      if (p.defaultRoute) L.push(`set routing-options static route 0.0.0.0/0 next-hop ${p.defaultGw || jfull(p.defaultIface)}`);
      return L;
    },

    ospf(p, x) {
      const a = jArea(p.area);
      const L = [`set routing-options router-id ${p.routerId}`];
      H.list(p.ifaces).forEach((i) => L.push(`set protocols ospf area ${a} interface ${jfull(i)}`));
      H.list(p.passive).forEach((i) => L.push(`set protocols ospf area ${a} interface ${jfull(i)} passive`));
      if (p.defaultOriginate) {
        L.push('set policy-options policy-statement OSPF-DEFAULT term 1 from protocol static', 'set policy-options policy-statement OSPF-DEFAULT term 1 from route-filter 0.0.0.0/0 exact', 'set policy-options policy-statement OSPF-DEFAULT term 1 then accept', 'set protocols ospf export OSPF-DEFAULT');
      }
      if (H.list(p.networks).length) x.note('Junos enables OSPF per interface; the Networks list is informational for this platform.');
      if (x.device === 'firewall') x.note('SRX: add "host-inbound-traffic protocols ospf" to the zones of OSPF interfaces.');
      return L;
    },

    bgp(p, x) {
      const nets = H.list(p.networks).map((n) => H.c(n).cidr);
      const ext = p.localAsn !== p.remoteAsn;
      const g = `set protocols bgp group ${ext ? 'EBGP' : 'IBGP'}-${p.remoteAsn}`;
      const L = [`set routing-options router-id ${p.routerId}`, `set routing-options autonomous-system ${p.localAsn}`];
      if (p.anchor) nets.forEach((n) => L.push(`set routing-options static route ${n} discard`));
      nets.forEach((n) => L.push(`set policy-options prefix-list NC-BGP-OUT ${n}`));
      if (nets.length) L.push('set policy-options policy-statement BGP-EXPORT term ADVERTISE from prefix-list NC-BGP-OUT', 'set policy-options policy-statement BGP-EXPORT term ADVERTISE then accept', 'set policy-options policy-statement BGP-EXPORT term REJECT then reject');
      L.push(`${g} type ${ext ? 'external' : 'internal'}`, `${g} peer-as ${p.remoteAsn}`);
      if (p.localAddress) L.push(`${g} local-address ${p.localAddress}`);
      if (nets.length) L.push(`${g} export BGP-EXPORT`);
      if (p.password) L.push(`${g} authentication-key ${H.dq(x.secret(p.password, 'BGP-MD5-KEY'))}`);
      L.push(`${g} neighbor ${p.neighbor}${p.description ? ' description ' + H.dq(p.description) : ''}`);
      if (x.device === 'firewall') x.note('SRX: add "host-inbound-traffic protocols bgp" on the peering zone.');
      return L;
    },

    rip(p, x) {
      const L = [];
      if (p.defaultOriginate) L.push('set policy-options policy-statement RIP-EXPORT term DEFAULT from protocol static', 'set policy-options policy-statement RIP-EXPORT term DEFAULT from route-filter 0.0.0.0/0 exact', 'set policy-options policy-statement RIP-EXPORT term DEFAULT then accept');
      L.push('set policy-options policy-statement RIP-EXPORT term CONNECTED from protocol [ direct rip ]', 'set policy-options policy-statement RIP-EXPORT term CONNECTED then accept', 'set protocols rip group RIP-NEIGHBORS export RIP-EXPORT');
      H.list(p.ifaces).forEach((i) => L.push(`set protocols rip group RIP-NEIGHBORS neighbor ${jfull(i)}`));
      if (H.list(p.passive).length) x.note('Junos RIP: passive interfaces are simply not listed as neighbors; their subnets are exported via the direct-route policy.');
      return L;
    },

    nat(p) {
      const L = [];
      const fz = p.fromZone || 'trust', tz = p.toZone || 'untrust';
      if (p.type === 'pat' || p.type === 'dynamic') {
        const rs = `set security nat source rule-set RS-${fz.toUpperCase()}-TO-${tz.toUpperCase()}`;
        if (p.type === 'dynamic') L.push(`set security nat source pool NAT-POOL address ${p.poolStart}/32 to ${p.poolEnd}/32`);
        L.push(`${rs} from zone ${fz}`, `${rs} to zone ${tz}`, `${rs} rule R1 match source-address ${H.c(p.insideNet).cidr}`, `${rs} rule R1 match destination-address 0.0.0.0/0`);
        L.push(p.type === 'pat' ? `${rs} rule R1 then source-nat interface` : `${rs} rule R1 then source-nat pool NAT-POOL`);
        if (p.type === 'dynamic') L.push(`set security nat proxy-arp interface ${jfull(p.outsideIf)} address ${p.poolStart}/32 to ${p.poolEnd}/32`);
      } else if (p.type === 'static') {
        const rs = `set security nat static rule-set RS-STATIC-${tz.toUpperCase()}`;
        L.push(`${rs} from zone ${tz}`, `${rs} rule R1 match destination-address ${p.outsideGlobal}/32`, `${rs} rule R1 then static-nat prefix ${p.insideLocal}/32`, `set security nat proxy-arp interface ${jfull(p.outsideIf)} address ${p.outsideGlobal}/32`);
      } else {
        const rs = `set security nat destination rule-set RS-DNAT-${tz.toUpperCase()}`;
        L.push(`set security nat destination pool DNAT-${p.insideLocal.replace(/\./g, '-')} address ${p.insideLocal}/32 port ${p.intPort}`, `${rs} from zone ${tz}`);
        L.push(`${rs} rule R1 match destination-address ${p.outsideGlobal ? p.outsideGlobal + '/32' : '0.0.0.0/0'}`, `${rs} rule R1 match destination-port ${p.extPort}`, `${rs} rule R1 match protocol ${p.protocol}`, `${rs} rule R1 then destination-nat pool DNAT-${p.insideLocal.replace(/\./g, '-')}`);
      }
      return L;
    },

    acl(p) {
      const f = `set firewall family inet filter ${H.san(p.name)}`;
      const L = [];
      (p.rows || []).forEach((r, i) => {
        const t = `${f} term T${(i + 1) * 10}`;
        if (r.comment) L.push(`# ${r.comment}`);
        const s = H.addr(r.src), d = H.addr(r.dst);
        if (!s.any) L.push(`${t} from source-address ${s.cidr}`);
        if (!d.any) L.push(`${t} from destination-address ${d.cidr}`);
        if (r.protocol !== 'ip') L.push(`${t} from protocol ${r.protocol}`);
        if (r.protocol === 'tcp' || r.protocol === 'udp') {
          if (r.sport) L.push(`${t} from source-port ${H.portStr(H.port(r.sport))}`);
          if (r.dport) L.push(`${t} from destination-port ${H.portStr(H.port(r.dport))}`);
        }
        if (r.log) L.push(`${t} then syslog`);
        L.push(`${t} then ${r.action === 'permit' ? 'accept' : 'discard'}`);
      });
      if (p.implicitLog) L.push(`${f} term DENY-ALL then syslog`, `${f} term DENY-ALL then discard`);
      else L.push('# Junos filters end with an implicit discard of all remaining traffic.');
      if (p.applyIface) { const u = H.unit(p.applyIface); L.push(`set interfaces ${u.phy} unit ${u.unit} family inet filter ${p.direction === 'in' ? 'input' : 'output'} ${H.san(p.name)}`); }
      return L;
    },

    firewall(p, x) {
      const L = [];
      const apps = new Map();
      const book = new Map();
      const addrName = (a) => {
        if (a.any) return 'any';
        const n = a.host ? `H-${a.host}` : `N-${a.net}_${a.prefix}`;
        book.set(n, a.cidr);
        return n;
      };
      const app = (proto, port) => {
        if (!proto || proto === 'any') return 'any';
        if (proto === 'icmp') return 'junos-icmp-all';
        const pp = H.port(port);
        if (!pp) return proto === 'tcp' ? 'junos-tcp-any' : 'junos-udp-any';
        const n = `NC-${proto.toUpperCase()}-${H.portStr(pp)}`;
        apps.set(n, [`set applications application ${n} protocol ${proto}`, `set applications application ${n} destination-port ${H.portStr(pp)}`]);
        return n;
      };
      const pol = [];
      (p.rows || []).forEach((r, i) => {
        const n = i + 1;
        if (r.state && r.state !== 'any' && r.state !== 'new') { x.note(`Rule ${n} (${r.state}) skipped - SRX security policies are stateful.`); return; }
        if (r.action === 'log') { x.warn(`Rule ${n} skipped - Junos has no log-only policy action.`); return; }
        if (r.chain === 'output') { x.warn(`Rule ${n} skipped - SRX security policies do not filter self-originated traffic.`); return; }
        const fz = r.iface || p.fromZone || 'trust';
        const tz = r.chain === 'input' ? 'junos-host' : p.dstIf || 'untrust';
        const pn = H.san(r.comment || `RULE-${n}`, 60);
        const b = `set security policies from-zone ${fz} to-zone ${tz} policy ${pn}`;
        pol.push(`${b} match source-address ${addrName(H.addr(r.src))}`, `${b} match destination-address ${addrName(H.addr(r.dst))}`, `${b} match application ${app(r.protocol, r.port)}`);
        const act = r.action === 'accept' ? 'permit' : r.action === 'reject' ? 'reject' : 'deny';
        pol.push(`${b} then ${act}`, `${b} then log ${act === 'permit' ? 'session-close' : 'session-init'}`);
      });
      book.forEach((cidr, n) => L.push(`set security address-book global address ${n} ${cidr}`));
      apps.forEach((ls) => L.push(...ls));
      L.push(...pol);
      return L;
    },

    mgmt(p) {
      const c = H.c(p.mgmtNet);
      const f = 'set firewall family inet filter PROTECT-RE';
      const L = ['set system services ssh root-login deny', 'set system services ssh connection-limit 10', 'set system services ssh rate-limit 5'];
      if (p.disableInsecure) L.push('delete system services telnet', 'delete system services web-management http');
      L.push(`set system login retry-options tries-before-disconnect ${p.retries}`, `set system login class NC-ADMIN idle-timeout ${p.timeout}`, 'set system login class NC-ADMIN permissions all');
      if (p.adminUser) L.push('# Create the account interactively - never keep secrets in generated files:', `# set system login user ${p.adminUser} class NC-ADMIN authentication plain-text-password`);
      L.push(`set policy-options prefix-list MGMT-HOSTS ${c.cidr}`,
        `${f} term SSH-ALLOW from source-prefix-list MGMT-HOSTS`, `${f} term SSH-ALLOW from protocol tcp`, `${f} term SSH-ALLOW from destination-port ssh`, `${f} term SSH-ALLOW then accept`,
        `${f} term SSH-DENY from protocol tcp`, `${f} term SSH-DENY from destination-port ssh`, `${f} term SSH-DENY then syslog`, `${f} term SSH-DENY then discard`,
        `${f} term ALLOW-OTHER then accept`, 'set interfaces lo0 unit 0 family inet filter input PROTECT-RE');
      return L;
    },

    ipsec(p, x) {
      const nm = H.san(p.name);
      const enc = p.encryption === 'aes128' ? 'aes-128-cbc' : 'aes-256-cbc';
      const ikeAuth = { sha1: 'sha1', sha256: 'sha-256' }[p.hash];
      const espAuth = { sha1: 'hmac-sha1-96', sha256: 'hmac-sha-256-128' }[p.hash];
      const wan = jfull(p.wanIf);
      const L = [
        `set security ike proposal IKE-${nm} authentication-method pre-shared-keys`, `set security ike proposal IKE-${nm} dh-group group${p.dh}`,
        `set security ike proposal IKE-${nm} authentication-algorithm ${ikeAuth}`, `set security ike proposal IKE-${nm} encryption-algorithm ${enc}`,
        `set security ike proposal IKE-${nm} lifetime-seconds ${p.ikeLifetime}`
      ];
      if (p.ikeVersion === 'ikev1') L.push(`set security ike policy IKE-POL-${nm} mode main`);
      L.push(`set security ike policy IKE-POL-${nm} proposals IKE-${nm}`, `set security ike policy IKE-POL-${nm} pre-shared-key ascii-text ${H.dq(x.secret(p.psk, 'PRE-SHARED-KEY'))}`,
        `set security ike gateway GW-${nm} ike-policy IKE-POL-${nm}`, `set security ike gateway GW-${nm} address ${p.remotePublic}`,
        `set security ike gateway GW-${nm} external-interface ${wan}`, `set security ike gateway GW-${nm} local-address ${p.localPublic}`,
        `set security ike gateway GW-${nm} version ${p.ikeVersion === 'ikev2' ? 'v2-only' : 'v1-only'}`,
        `set security ipsec proposal ESP-${nm} protocol esp`, `set security ipsec proposal ESP-${nm} authentication-algorithm ${espAuth}`,
        `set security ipsec proposal ESP-${nm} encryption-algorithm ${enc}`, `set security ipsec proposal ESP-${nm} lifetime-seconds ${p.ipsecLifetime}`);
      if (p.pfs) L.push(`set security ipsec policy IPSEC-POL-${nm} perfect-forward-secrecy keys group${p.dh}`);
      L.push(`set security ipsec policy IPSEC-POL-${nm} proposals ESP-${nm}`,
        `set security ipsec vpn VPN-${nm} bind-interface st0.0`, `set security ipsec vpn VPN-${nm} ike gateway GW-${nm}`,
        `set security ipsec vpn VPN-${nm} ike ipsec-policy IPSEC-POL-${nm}`, `set security ipsec vpn VPN-${nm} establish-tunnels immediately`,
        'set interfaces st0 unit 0 family inet', 'set security zones security-zone VPN interfaces st0.0',
        `set security zones security-zone untrust interfaces ${wan} host-inbound-traffic system-services ike`,
        `set routing-options static route ${H.c(p.remoteNet).cidr} next-hop st0.0`,
        `set security address-book global address LOCAL-${nm} ${H.c(p.localNet).cidr}`, `set security address-book global address REMOTE-${nm} ${H.c(p.remoteNet).cidr}`);
      [['trust', 'VPN', 'LOCAL', 'REMOTE'], ['VPN', 'trust', 'REMOTE', 'LOCAL']].forEach(([fz, tz, s, d]) => {
        const b = `set security policies from-zone ${fz} to-zone ${tz} policy ${fz}-TO-${tz}-${nm}`;
        L.push(`${b} match source-address ${s}-${nm}`, `${b} match destination-address ${d}-${nm}`, `${b} match application any`, `${b} then permit`);
      });
      return L;
    }
  };

  /* ==================================================================
     ARUBA AOS-CX 10.x
     ================================================================== */
  const arIf = (n) => {
    const s = String(n).trim();
    let m;
    if ((m = /^vlan\s*(\d+)$/i.exec(s))) return 'vlan ' + m[1];
    if ((m = /^loopback\s*(\d+)$/i.exec(s))) return 'loopback ' + m[1];
    if ((m = /^lag\s*(\d+)$/i.exec(s))) return 'lag ' + m[1];
    return s;
  };
  const arRanges = (spec) => H.groups(spec).map((g) => (g.name ? g.name : `${g.prefix}${g.start}-${g.prefix}${g.end}`));
  const ai = (lines) => H.indent(lines, 4);
  const arSev = { debugging: 'debug', informational: 'info', notifications: 'notice', warnings: 'warning', errors: 'err' };
  const arAddr = (a) => (a.any ? 'any' : a.host ? a.host : `${a.net}/${a.prefix}`);
  const arPort = (p) => (!p ? '' : p.from === p.to ? ' eq ' + p.from : ' range ' + p.from + ' ' + p.to);
  const arLease = (sec) => { const l = H.lease(sec); return [l.d, l.h, l.m].map((v) => String(v).padStart(2, '0')).join(':'); };
  const arPool = (name, c, start, end, gw, dns, domain, lease) => {
    const b = [`range ${start} ${end} prefix-len ${c.prefix}`, `default-router ${gw}`];
    if (dns.length) b.push(`dns-server ${dns.join(' ')}`);
    if (domain) b.push(`domain-name ${domain}`);
    b.push(`lease ${arLease(lease)}`, 'exit');
    return [`pool ${name}`].concat(ai(b));
  };

  T.aruba = {
    id: 'aruba',
    comment: '!',
    preamble: () => ['configure terminal'],
    postamble: () => ['end', '! Save only after verification:', '! write memory'],

    basic(p, x) {
      const vrf = p.mgmtEnable && p.mgmtIface === 'mgmt' ? 'mgmt' : 'default';
      const L = [`hostname ${p.hostname}`];
      if (p.domain) L.push(`ip dns domain-name ${p.domain}`);
      H.list(p.dns).forEach((d) => L.push(`ip dns server-address ${d} vrf ${vrf}`));
      const ntp = H.list(p.ntp);
      if (ntp.length) { ntp.forEach((s) => L.push(`ntp server ${s} iburst`)); L.push('ntp enable', `ntp vrf ${vrf}`); }
      if (p.snmpEnable) {
        L.push(`snmp-server vrf ${vrf}`, `snmp-server community ${x.secret(p.snmpCommunity, 'SNMP-COMMUNITY')}`);
        if (p.snmpLocation) L.push(`snmp-server system-location ${p.snmpLocation}`);
        if (p.snmpContact) L.push(`snmp-server system-contact ${p.snmpContact}`);
      }
      if (p.syslogEnable) L.push(`logging ${p.syslogServer} severity ${arSev[p.syslogLevel] || 'info'} vrf ${vrf}`);
      if (p.banner) L.push('banner motd ^', ...String(p.banner).replace(/\^/g, '').split('\n'), '^');
      if (p.mgmtEnable) {
        const c = H.c(p.mgmtIp);
        if (p.mgmtIface === 'mgmt') L.push('!', 'interface mgmt', ...ai(['no shutdown', `ip static ${c.ipStr}/${c.prefix}`].concat(p.mgmtGw ? [`default-gateway ${p.mgmtGw}`] : [])));
        else {
          L.push('!', `interface ${arIf(p.mgmtIface)}`, ...ai(['description MANAGEMENT', `ip address ${c.ipStr}/${c.prefix}`, 'no shutdown']));
          if (p.mgmtGw) L.push(`ip route 0.0.0.0/0 ${p.mgmtGw}`);
        }
      }
      return L;
    },

    vlan(p) {
      const rows = p.rows || [];
      const L = [];
      rows.forEach((r) => L.push(`vlan ${r.vlanId}`, ...ai([`name ${H.san(r.name, 32)}`].concat(r.description ? [`description ${r.description}`] : []))));
      if (p.l3) rows.filter((r) => r.gateway).forEach((r) => L.push(`interface vlan ${r.vlanId}`, ...ai([`description ${r.name}`, `ip address ${r.gateway}/${H.c(r.subnet).prefix}`])));
      const d = rows.filter((r) => r.dhcp);
      if (d.length) {
        const b = [];
        d.forEach((r) => b.push(...arPool(H.san(r.name), H.c(r.subnet), r.start, r.end, r.gateway, H.list(r.dns), p.domain, 86400)));
        b.push('enable');
        L.push('dhcp-server vrf default', ...ai(b));
      }
      return L;
    },

    dhcp(p) {
      const c = H.c(p.network);
      const L = [];
      if (p.setIfaceIp) {
        const ifn = arIf(p.iface);
        L.push(`interface ${ifn}`, ...ai((/^vlan|^loopback/.test(ifn) ? [] : ['routing']).concat([`ip address ${p.gateway}/${c.prefix}`, 'no shutdown'])));
      }
      L.push('dhcp-server vrf default', ...ai(arPool(H.san(p.poolName), c, p.start, p.end, p.gateway, H.list(p.dns), p.domain, p.lease).concat(['enable'])));
      return L;
    },

    ports(p) {
      const L = [];
      if (p.portSecurity) L.push('port-access port-security enable');
      if (p.voiceVlan) L.push(`vlan ${p.voiceVlan}`, ...ai(['voice']));
      arRanges(p.accessIfaces).forEach((r) => {
        const b = ['description ACCESS', 'no shutdown', 'no routing'];
        if (p.voiceVlan) b.push(`vlan trunk native ${p.accessVlan}`, `vlan trunk allowed ${p.accessVlan},${p.voiceVlan}`);
        else b.push(`vlan access ${p.accessVlan}`);
        if (p.portfast) b.push('spanning-tree port-type admin-edge');
        if (p.bpduguard) b.push('spanning-tree bpdu-guard');
        if (p.portSecurity) b.push('port-access port-security', ...ai(['enable', `client-limit ${p.maxMac}`]));
        L.push(`interface ${r}`, ...ai(b));
      });
      if (p.trunkEnable) arRanges(p.trunkIfaces).forEach((r) => {
        const b = ['description UPLINK-TRUNK', 'no shutdown', 'no routing'];
        if (p.nativeVlan) b.push(`vlan trunk native ${p.nativeVlan}`);
        b.push(`vlan trunk allowed ${String(p.allowedVlans).replace(/\s+/g, '')}`);
        L.push(`interface ${r}`, ...ai(b));
      });
      return L;
    },

    lacp(p) {
      const b = ['no shutdown', 'no routing'];
      if (p.description) b.unshift(`description ${p.description}`);
      if (p.lagMode === 'trunk') { if (p.nativeVlan) b.push(`vlan trunk native ${p.nativeVlan}`); b.push(`vlan trunk allowed ${String(p.allowedVlans).replace(/\s+/g, '')}`); }
      else b.push(`vlan access ${p.accessVlan}`);
      b.push(`lacp mode ${p.mode}`);
      const L = [`interface lag ${p.lagId}`, ...ai(b)];
      arRanges(p.members).forEach((r) => L.push(`interface ${r}`, ...ai(['no shutdown', `lag ${p.lagId}`])));
      return L;
    },

    stp(p, x) {
      const mult = Math.round(+p.priority / 4096);
      const L = [];
      if (p.mode === 'mstp') L.push('spanning-tree mode mstp', `spanning-tree config-name ${H.san(p.region || 'REGION1')}`, 'spanning-tree config-revision 1', `spanning-tree priority ${mult}`, 'spanning-tree');
      else L.push('spanning-tree mode rpvst', `spanning-tree vlan ${p.vlans.replace(/\s+/g, '')}`, `spanning-tree vlan ${p.vlans.replace(/\s+/g, '')} priority ${mult}`, 'spanning-tree');
      if (p.bpduguardDefault || p.portfastDefault || p.loopguard) x.note('AOS-CX applies admin-edge, BPDU guard and loop guard per interface - see the Access & Trunk module.');
      return L;
    },

    l2sec(p) {
      const L = [];
      const vl = V.vlanList(p.vlans) || [];
      if (p.snooping) { L.push('dhcpv4-snooping'); if (!p.option82) L.push('no dhcpv4-snooping option 82'); }
      vl.forEach((v) => {
        const b = [];
        if (p.snooping) b.push('dhcpv4-snooping');
        if (p.dai) b.push('arp inspection');
        L.push(`vlan ${v}`, ...ai(b));
      });
      arRanges(p.trustedIfaces).forEach((r) => {
        const b = [];
        if (p.snooping) b.push('dhcpv4-snooping trust');
        if (p.dai) b.push('arp inspection trust');
        L.push(`interface ${r}`, ...ai(b));
      });
      return L;
    },

    static(p) {
      const L = [];
      (p.rows || []).forEach((r) => {
        if (r.comment) L.push(`! ${r.comment}`);
        L.push(`ip route ${r.dest}/${r.prefix} ${r.gateway || arIf(r.iface)}${r.distance && +r.distance !== 1 ? ' distance ' + r.distance : ''}`);
      });
      if (p.defaultRoute) L.push(`ip route 0.0.0.0/0 ${p.defaultGw || arIf(p.defaultIface)}`);
      return L;
    },

    ospf(p, x) {
      const a = jArea(p.area);
      const b = [`router-id ${p.routerId}`];
      if (p.defaultOriginate) b.push('default-information originate');
      b.push(`area ${a}`);
      const L = [`router ospf ${p.processId}`, ...ai(b)];
      const pas = H.list(p.passive).map(arIf);
      const ifs = [...new Set(H.list(p.ifaces).map(arIf).concat(pas))];
      ifs.forEach((i) => L.push(`interface ${i}`, ...ai([`ip ospf ${p.processId} area ${a}`].concat(pas.includes(i) ? ['ip ospf passive'] : []))));
      if (H.list(p.networks).length) x.note('AOS-CX enables OSPF per interface; the Networks list is informational for this platform.');
      return L;
    },

    bgp(p, x) {
      const nets = H.list(p.networks).map((n) => H.c(n).cidr);
      const L = [];
      if (p.anchor) nets.forEach((n) => L.push(`ip route ${n} blackhole`));
      const n = p.neighbor;
      const b = [`bgp router-id ${p.routerId}`, `neighbor ${n} remote-as ${p.remoteAsn}`];
      if (p.description) b.push(`neighbor ${n} description ${p.description}`);
      if (p.password) b.push(`neighbor ${n} password plaintext ${x.secret(p.password, 'BGP-MD5-KEY')}`);
      if (p.updateSourceIf) b.push(`neighbor ${n} update-source ${arIf(p.updateSourceIf)}`);
      b.push('address-family ipv4 unicast', ...ai(nets.map((x2) => `network ${x2}`).concat([`neighbor ${n} activate`])), 'exit-address-family');
      L.push(`router bgp ${p.localAsn}`, ...ai(b));
      return L;
    },

    acl(p) {
      const nm = H.san(p.name);
      const b = [];
      let seq = 10;
      (p.rows || []).forEach((r) => {
        if (r.comment) b.push(`${seq} comment ${r.comment}`);
        const tu = r.protocol === 'tcp' || r.protocol === 'udp';
        const proto = r.protocol === 'ip' ? 'any' : r.protocol;
        b.push(`${seq} ${r.action} ${proto} ${arAddr(H.addr(r.src))}${tu ? arPort(H.port(r.sport)) : ''} ${arAddr(H.addr(r.dst))}${tu ? arPort(H.port(r.dport)) : ''}${r.log ? ' log' : ''}`);
        seq += 10;
      });
      if (p.implicitLog) b.push(`${Math.max(seq, 1000)} deny any any any log`);
      const L = [`access-list ip ${nm}`, ...ai(b)];
      if (p.applyIface) {
        const v = H.vlanNum(p.applyIface);
        if (v) L.push(`vlan ${v}`, ...ai([`apply access-list ip ${nm} ${p.direction}`]));
        else L.push(`interface ${arIf(p.applyIface)}`, ...ai([`apply access-list ip ${nm} ${p.direction}`]));
      }
      return L;
    },

    mgmt(p) {
      const c = H.c(p.mgmtNet).cidr;
      const L = ['ssh server vrf mgmt', 'ssh server vrf default', 'https-server vrf mgmt',
        'access-list ip MGMT-ACCESS', ...ai([`10 permit tcp ${c} any eq 22`, `20 permit tcp ${c} any eq 443`, '30 deny tcp any any eq 22 log', '40 deny tcp any any eq 443 log', '50 permit any any any']),
        'apply access-list ip MGMT-ACCESS control-plane vrf default',
        'cli-session', ...ai([`timeout ${p.timeout}`])];
      if (p.adminUser) L.push('! Create the account interactively - never keep secrets in generated files:', `! user ${p.adminUser} group administrators password`);
      return L;
    }
  };
})();
