/* ==========================================================================
   NET // CONFIG — Network math & validation
   NC.Net   : IPv4 / IPv6 / MAC arithmetic (pure functions)
   NC.Valid : input validators used by forms and the calculator
   ========================================================================== */
(function () {
  'use strict';
  const NC = (window.NC = window.NC || {});

  /* ------------------------------ IPv4 ------------------------------ */
  const Net = {
    parseIPv4(s) {
      if (typeof s !== 'string') return null;
      const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
      if (!m) return null;
      let n = 0;
      for (let i = 1; i <= 4; i++) {
        if (m[i].length > 1 && m[i][0] === '0') return null; // no leading zeros
        const o = +m[i];
        if (o > 255) return null;
        n = n * 256 + o;
      }
      return n;
    },
    toIPv4(n) {
      n = n >>> 0;
      return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    },
    maskInt(p) { return p <= 0 ? 0 : (0xffffffff << (32 - p)) >>> 0; },
    maskStr(p) { return Net.toIPv4(Net.maskInt(p)); },
    wildcardStr(p) { return Net.toIPv4(~Net.maskInt(p) >>> 0); },
    prefixFromMask(str) {
      const n = Net.parseIPv4(str);
      if (n === null) return null;
      const inv = ~n >>> 0;
      if ((inv & (inv + 1)) !== 0) return null; // non-contiguous
      let p = 0;
      for (let i = 31; i >= 0; i--) { if ((n >>> i) & 1) p++; else break; }
      return p;
    },
    /** Parse "a.b.c.d/nn" or "a.b.c.d mask" or "a.b.c.d" (=> /32). */
    parseCidr(s, allowBare) {
      if (typeof s !== 'string') return null;
      s = s.trim();
      let ipStr, prefix;
      let m = /^([\d.]+)\s*\/\s*(\d{1,2})$/.exec(s);
      if (m) { ipStr = m[1]; prefix = +m[2]; }
      else if ((m = /^([\d.]+)\s+([\d.]+)$/.exec(s))) { ipStr = m[1]; prefix = Net.prefixFromMask(m[2]); if (prefix === null) return null; }
      else if (allowBare && Net.parseIPv4(s) !== null) { ipStr = s; prefix = 32; }
      else return null;
      if (prefix > 32) return null;
      const ip = Net.parseIPv4(ipStr);
      if (ip === null) return null;
      const mask = Net.maskInt(prefix);
      const network = (ip & mask) >>> 0;
      const broadcast = (network | (~mask >>> 0)) >>> 0;
      return { ip, prefix, mask, network, broadcast, ipStr: Net.toIPv4(ip), networkStr: Net.toIPv4(network), cidr: Net.toIPv4(network) + '/' + prefix };
    },
    inSubnet(ipInt, c) { return ((ipInt & c.mask) >>> 0) === c.network; },
    /** Full subnet report used by the calculator. */
    info(c) {
      const total = Math.pow(2, 32 - c.prefix);
      let first, last, usable;
      if (c.prefix === 32) { first = last = c.network; usable = 1; }
      else if (c.prefix === 31) { first = c.network; last = c.broadcast; usable = 2; }
      else { first = c.network + 1; last = c.broadcast - 1; usable = total - 2; }
      return {
        address: Net.toIPv4(c.ip), network: Net.toIPv4(c.network), broadcast: Net.toIPv4(c.broadcast),
        first: Net.toIPv4(first), last: Net.toIPv4(last), usable, total,
        mask: Net.maskStr(c.prefix), wildcard: Net.wildcardStr(c.prefix), prefix: c.prefix,
        cls: Net.ipClass(c.ip), type: Net.ipType(c.ip),
        binIp: Net.toBinary(c.ip), binMask: Net.toBinary(c.mask),
        hex: '0x' + (c.ip >>> 0).toString(16).toUpperCase().padStart(8, '0')
      };
    },
    toBinary(n) {
      const b = (n >>> 0).toString(2).padStart(32, '0');
      return b.match(/.{8}/g).join('.');
    },
    fromBinary(s) {
      const clean = s.replace(/[\s.]/g, '');
      if (!/^[01]{32}$/.test(clean)) return null;
      return parseInt(clean, 2) >>> 0;
    },
    ipClass(n) {
      const o = n >>> 24;
      if (o < 128) return 'A'; if (o < 192) return 'B'; if (o < 224) return 'C'; if (o < 240) return 'D (multicast)'; return 'E (reserved)';
    },
    ipType(n) {
      const t = [
        ['0.0.0.0/8', 'This network'], ['10.0.0.0/8', 'Private (RFC 1918)'], ['100.64.0.0/10', 'Shared / CGNAT (RFC 6598)'],
        ['127.0.0.0/8', 'Loopback'], ['169.254.0.0/16', 'Link-local'], ['172.16.0.0/12', 'Private (RFC 1918)'],
        ['192.0.2.0/24', 'Documentation (TEST-NET-1)'], ['192.168.0.0/16', 'Private (RFC 1918)'],
        ['198.18.0.0/15', 'Benchmarking (RFC 2544)'], ['198.51.100.0/24', 'Documentation (TEST-NET-2)'],
        ['203.0.113.0/24', 'Documentation (TEST-NET-3)'], ['224.0.0.0/4', 'Multicast'], ['240.0.0.0/4', 'Reserved']
      ];
      for (const [c, label] of t) { if (Net.inSubnet(n, Net.parseCidr(c))) return label; }
      return 'Public';
    },
    classfulNetwork(n) {
      const o = n >>> 24;
      const p = o < 128 ? 8 : o < 192 ? 16 : 24;
      return Net.toIPv4((n & Net.maskInt(p)) >>> 0);
    },
    /** Split a network into 2^bits subnets. */
    split(c, newPrefix, limit) {
      const out = [];
      const step = Math.pow(2, 32 - newPrefix);
      const count = Math.pow(2, newPrefix - c.prefix);
      for (let i = 0; i < Math.min(count, limit || 256); i++) {
        const net = c.network + i * step;
        out.push(Net.info(Net.parseCidr(Net.toIPv4(net) + '/' + newPrefix)));
      }
      return { list: out, count };
    },
    /** VLSM allocation: requirements sorted by size desc. */
    vlsm(c, reqs) {
      const sorted = reqs.map((r, i) => ({ ...r, i })).sort((a, b) => b.hosts - a.hosts);
      let cursor = c.network;
      const end = c.broadcast;
      const res = [];
      for (const r of sorted) {
        let p = 32;
        while (p > 0 && (Math.pow(2, 32 - p) - (p >= 31 ? 0 : 2)) < r.hosts) p--;
        if (r.hosts === 2 && p === 31) p = 30; // keep broadcast semantics for typical p2p unless user wants /31
        const size = Math.pow(2, 32 - p);
        if (cursor % size !== 0) cursor = Math.ceil(cursor / size) * size;
        if (cursor + size - 1 > end) { res.push({ ...r, error: 'Not enough address space' }); continue; }
        const inf = Net.info(Net.parseCidr(Net.toIPv4(cursor) + '/' + p));
        res.push({ ...r, subnet: inf.network + '/' + p, info: inf, waste: inf.usable - r.hosts });
        cursor += size;
      }
      return { rows: res, used: cursor - c.network, total: c.broadcast - c.network + 1 };
    },

    /* ------------------------------ IPv6 ------------------------------ */
    parseIPv6(s) {
      if (typeof s !== 'string') return null;
      s = s.trim().toLowerCase().replace(/%.*$/, '');
      if (!s || /[^0-9a-f:.]/.test(s)) return null;
      const dbl = s.split('::');
      if (dbl.length > 2) return null;
      const toGroups = (part) => {
        if (part === '') return [];
        const g = part.split(':');
        const out = [];
        for (let i = 0; i < g.length; i++) {
          const x = g[i];
          if (x.includes('.')) {
            if (i !== g.length - 1) return null;
            const v4 = Net.parseIPv4(x);
            if (v4 === null) return null;
            out.push((v4 >>> 16).toString(16), (v4 & 0xffff).toString(16));
          } else {
            if (!/^[0-9a-f]{1,4}$/.test(x)) return null;
            out.push(x);
          }
        }
        return out;
      };
      const left = toGroups(dbl[0]);
      const right = dbl.length === 2 ? toGroups(dbl[1]) : [];
      if (!left || !right) return null;
      let groups;
      if (dbl.length === 2) {
        const fill = 8 - left.length - right.length;
        if (fill < 1) return null;
        groups = left.concat(Array(fill).fill('0'), right);
      } else {
        if (left.length !== 8) return null;
        groups = left;
      }
      let v = 0n;
      for (const g of groups) v = (v << 16n) | BigInt(parseInt(g, 16));
      return v;
    },
    v6Groups(v) {
      const g = [];
      for (let i = 7; i >= 0; i--) g.push(Number((v >> BigInt(i * 16)) & 0xffffn));
      return g;
    },
    v6Full(v) { return Net.v6Groups(v).map((x) => x.toString(16).padStart(4, '0')).join(':'); },
    v6Compress(v) {
      const g = Net.v6Groups(v);
      let bestS = -1, bestL = 0;
      for (let i = 0; i < 8;) {
        if (g[i] === 0) { let j = i; while (j < 8 && g[j] === 0) j++; if (j - i > bestL) { bestS = i; bestL = j - i; } i = j; } else i++;
      }
      const h = g.map((x) => x.toString(16));
      if (bestL < 2) return h.join(':');
      return h.slice(0, bestS).join(':') + '::' + h.slice(bestS + bestL).join(':');
    },
    v6Info(str) {
      const m = /^(.+?)(?:\/(\d{1,3}))?$/.exec(str.trim());
      if (!m) return null;
      const v = Net.parseIPv6(m[1]);
      if (v === null) return null;
      const p = m[2] === undefined ? 64 : +m[2];
      if (p > 128) return null;
      const all = (1n << 128n) - 1n;
      const mask = p === 0 ? 0n : (all << BigInt(128 - p)) & all;
      const net = v & mask;
      const last = net | (~mask & all);
      let type = 'Global unicast';
      const top = Number(v >> 112n);
      if (v === 0n) type = 'Unspecified'; else if (v === 1n) type = 'Loopback';
      else if ((top & 0xffc0) === 0xfe80) type = 'Link-local unicast';
      else if ((top & 0xfe00) === 0xfc00) type = 'Unique local (ULA)';
      else if ((top & 0xff00) === 0xff00) type = 'Multicast';
      else if (top === 0x2001 && Number((v >> 96n) & 0xffffn) === 0x0db8) type = 'Documentation (2001:db8::/32)';
      else if ((v >> 32n) === 0xffffn) type = 'IPv4-mapped';
      const hosts = 1n << BigInt(128 - p);
      return {
        compressed: Net.v6Compress(v), expanded: Net.v6Full(v), prefix: p,
        network: Net.v6Compress(net) + '/' + p, first: Net.v6Compress(net), last: Net.v6Compress(last),
        total: hosts.toString(), type,
        subnets64: p <= 64 ? (1n << BigInt(64 - p)).toString() : '—',
        ptr: Net.v6Full(v).replace(/:/g, '').split('').reverse().join('.') + '.ip6.arpa'
      };
    },

    /* ------------------------------ MAC ------------------------------ */
    parseMac(s) {
      const hex = String(s || '').replace(/[^0-9a-fA-F]/g, '');
      if (hex.length !== 12 || /[^0-9a-fA-F:\-.\s]/.test(String(s).trim())) return null;
      return hex.toLowerCase();
    },
    macFormats(hex) {
      const pairs = hex.match(/.{2}/g);
      const first = parseInt(pairs[0], 16);
      const eui = (first ^ 0x02).toString(16).padStart(2, '0') + pairs[1] + ':' + pairs[2] + 'ff:fe' + pairs[3] + ':' + pairs[4] + pairs[5];
      return {
        colon: pairs.join(':').toUpperCase(), hyphen: pairs.join('-').toUpperCase(),
        cisco: hex.match(/.{4}/g).join('.'), bare: hex.toUpperCase(),
        oui: pairs.slice(0, 3).join(':').toUpperCase(),
        cast: first & 1 ? 'Multicast' : 'Unicast',
        admin: first & 2 ? 'Locally administered' : 'Universally administered (OUI)',
        eui64: 'fe80::' + eui.replace(/^0+(?=[0-9a-f])/, '').replace(/:0+(?=[0-9a-f])/g, ':'),
        binary: pairs.map((p) => parseInt(p, 16).toString(2).padStart(8, '0')).join(' ')
      };
    }
  };

  /* ------------------------------ List / port helpers ------------------------------ */
  const Valid = {
    list(s) { return String(s == null ? '' : s).split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean); },
    isIPv4(s) { return Net.parseIPv4(String(s || '')) !== null; },
    isCidr(s) { return !!Net.parseCidr(String(s || '')); },
    isNetworkCidr(s) { const c = Net.parseCidr(String(s || '')); return !!c && c.ip === c.network; },
    isHostCidr(s) {
      const c = Net.parseCidr(String(s || ''));
      if (!c) return false;
      if (c.prefix >= 31) return true;
      return c.ip !== c.network && c.ip !== c.broadcast;
    },
    isVlan(v) { return /^\d+$/.test(String(v).trim()) && +v >= 1 && +v <= 4094; },
    isAsn(v) { return /^\d+$/.test(String(v).trim()) && +v >= 1 && +v <= 4294967295; },
    isPortSpec(v) {
      const s = String(v).trim();
      let m = /^(\d{1,5})$/.exec(s);
      if (m) return +m[1] >= 1 && +m[1] <= 65535;
      m = /^(\d{1,5})\s*-\s*(\d{1,5})$/.exec(s);
      return !!m && +m[1] >= 1 && +m[2] <= 65535 && +m[1] < +m[2];
    },
    isName(s) { return /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,62}$/.test(String(s || '').trim()); },
    isFqdn(s) { return /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(String(s || '').trim()); },
    isHost(s) { return Valid.isIPv4(s) || Valid.isFqdn(s); },
    isIfName(s) { return /^[A-Za-z0-9][A-Za-z0-9_\/.:\- ]{0,40}$/.test(String(s || '').trim()); },
    /** "10,20,30-40" -> [10,20,30..40] or null */
    vlanList(s) {
      const out = [];
      for (const part of Valid.list(s)) {
        const m = /^(\d+)(?:-(\d+))?$/.exec(part);
        if (!m) return null;
        const a = +m[1], b = m[2] ? +m[2] : a;
        if (!Valid.isVlan(a) || !Valid.isVlan(b) || b < a) return null;
        for (let i = a; i <= b; i++) out.push(i);
      }
      return out.length ? out : null;
    },
    /** Address spec used in ACL / firewall rows: any | host IP | CIDR */
    isAddrSpec(s) {
      s = String(s || '').trim().toLowerCase();
      return s === 'any' || s === '' || Valid.isIPv4(s) || Valid.isNetworkCidr(s);
    },
    /**
     * Interface list parser. Supports ranges on the last number:
     * "GigabitEthernet1/0/1-24, Gi1/0/48" -> [{prefix,start,end} | {name}]
     */
    ifList(s) {
      const items = String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
      const out = [];
      for (const it of items) {
        const m = /^(.*?)(\d+)-(\d+)$/.exec(it);
        if (m && m[1] && !/[-]$/.test(m[1]) && +m[3] >= +m[2] && +m[3] - +m[2] <= 128) out.push({ prefix: m[1], start: +m[2], end: +m[3] });
        else if (m && m[1] && /[-]$/.test(m[1])) out.push({ prefix: m[1], start: +m[2], end: +m[3] }); // e.g. ge-0/0/0-23 handled by lazy match
        else out.push({ name: it });
      }
      return out;
    },
    expandIfs(s) {
      const out = [];
      for (const g of Valid.ifList(s)) {
        if (g.name) out.push(g.name);
        else for (let i = g.start; i <= g.end; i++) out.push(g.prefix + i);
      }
      return out;
    }
  };

  NC.Net = Net;
  NC.Valid = Valid;
})();
