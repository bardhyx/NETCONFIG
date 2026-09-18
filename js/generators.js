/* ==========================================================================
   NET // CONFIG — Generation engine
   NC.Schemas   : dynamic form definition per configuration module
   NC.Engine    : defaults, support matrix, validation, generation
   NC.Topology  : SVG topology preview per module
   NC.Highlight : dependency-free syntax highlighter
   ========================================================================== */
(function () {
  'use strict';
  const NC = window.NC;
  const N = NC.Net, V = NC.Valid;
  const ifd = (role) => (v, d) => NC.iface(v, d, role);

  /* ------------------------------------------------------------------
     Field builders
     ------------------------------------------------------------------ */
  const f = (id, label, type, def, o) => Object.assign({ id, label, type, def }, o || {});
  const SEV = [['informational', 'Informational (6)'], ['notifications', 'Notifications (5)'], ['warnings', 'Warnings (4)'], ['errors', 'Errors (3)'], ['debugging', 'Debugging (7)']];
  const PRIOS = []; for (let i = 0; i <= 61440; i += 4096) PRIOS.push([String(i), String(i) + (i === 0 ? ' (root)' : i === 4096 ? ' (primary root)' : i === 8192 ? ' (secondary root)' : i === 32768 ? ' (default)' : '')]);
  const onlyV = (...vs) => (p, v) => vs.includes(v);
  const notV = (...vs) => (p, v) => !vs.includes(v);

  const HOSTNAMES = { router: 'RTR-EDGE-01', switch: 'SW-ACC-01', firewall: 'FW-EDGE-01', ap: 'AP-FLOOR-01' };

  NC.Schemas = {
    basic: [
      f('hostname', 'Hostname', 'text', (v, d) => HOSTNAMES[d] || 'NET-DEVICE-01', { req: true, v: 'name', group: 'Identity', half: true, help: 'Letters, digits, dash, dot, underscore.' }),
      f('domain', 'Domain name', 'text', 'example.local', { v: 'fqdn', group: 'Identity', half: true }),
      f('mgmtEnable', 'Configure management interface', 'toggle', true, { group: 'Management' }),
      f('mgmtIface', 'Management interface', 'text', ifd('mgmt'), { req: true, v: 'ifname', group: 'Management', half: true, show: (p) => p.mgmtEnable }),
      f('mgmtIp', 'Management IP / prefix', 'text', '10.0.99.10/24', { req: true, v: 'cidrHost', group: 'Management', half: true, ph: '10.0.99.10/24', show: (p) => p.mgmtEnable }),
      f('mgmtGw', 'Management gateway', 'text', '10.0.99.1', { v: 'ipv4', group: 'Management', half: true, show: (p) => p.mgmtEnable }),
      f('dns', 'DNS servers', 'text', '1.1.1.1, 8.8.8.8', { v: 'ipv4list', group: 'Services', half: true, help: 'Comma separated.' }),
      f('ntp', 'NTP servers', 'text', '10.0.99.5, 10.0.99.6', { v: 'hosts', group: 'Services', half: true }),
      f('snmpEnable', 'Enable SNMP v2c (read-only)', 'toggle', true, { group: 'SNMP' }),
      f('snmpCommunity', 'SNMP community', 'secret', '', { group: 'SNMP', half: true, show: (p) => p.snmpEnable, help: 'Treated as a secret: never saved, placeholder by default.' }),
      f('snmpAllowed', 'Allowed NMS subnet', 'text', '10.0.99.0/24', { req: true, v: 'cidrNet', group: 'SNMP', half: true, show: (p) => p.snmpEnable }),
      f('snmpLocation', 'Location', 'text', 'DC1 / Rack A3', { group: 'SNMP', half: true, show: (p) => p.snmpEnable }),
      f('snmpContact', 'Contact', 'text', 'noc@example.local', { group: 'SNMP', half: true, show: (p) => p.snmpEnable }),
      f('syslogEnable', 'Send logs to remote syslog', 'toggle', true, { group: 'Syslog' }),
      f('syslogServer', 'Syslog server', 'text', '10.0.99.50', { req: true, v: 'ipv4', group: 'Syslog', half: true, show: (p) => p.syslogEnable }),
      f('syslogLevel', 'Severity', 'select', 'informational', { opts: SEV, group: 'Syslog', half: true, show: (p) => p.syslogEnable }),
      f('banner', 'Login banner', 'textarea', 'Authorized access only. All activity is monitored and logged.', { group: 'Banner', rows: 2 })
    ],

    vlan: [
      f('parent', 'Parent / trunk interface', 'text', ifd('parent'), { req: true, v: 'ifname', half: true, show: (p, v, d) => ['mikrotik', 'fortigate'].includes(v) || (d !== 'switch' && ['cisco', 'juniper'].includes(v)), help: 'Sub-interfaces / VLAN interfaces are created on this link.' }),
      f('trunkPorts', 'Bridge tagged ports', 'text', ifd('trunk'), { v: 'iflist', half: true, show: (p, v) => v === 'mikrotik', help: 'Ports that carry the VLANs tagged (bridge VLAN table).' }),
      f('domain', 'DHCP domain name', 'text', 'example.local', { v: 'fqdn', half: true }),
      f('l3', 'Create Layer-3 gateway interfaces', 'toggle', true, { half: true }),
      f('rows', 'VLANs', 'table', [
        { vlanId: '20', name: 'USERS', subnet: '192.168.20.0/24', gateway: '192.168.20.1', dhcp: true, start: '192.168.20.50', end: '192.168.20.200', dns: '1.1.1.1', description: 'User workstations' },
        { vlanId: '30', name: 'SERVERS', subnet: '192.168.30.0/24', gateway: '192.168.30.1', dhcp: false, start: '', end: '', dns: '', description: 'Server segment' }
      ], {
        add: 'Add VLAN', cols: [
          { id: 'vlanId', label: 'VLAN ID', type: 'text', req: true, v: 'vlan', w: 70, ph: '20' },
          { id: 'name', label: 'Name', type: 'text', req: true, v: 'name', w: 110, ph: 'USERS' },
          { id: 'subnet', label: 'Subnet', type: 'text', v: 'cidrNet', w: 140, ph: '192.168.20.0/24' },
          { id: 'gateway', label: 'Gateway', type: 'text', v: 'ipv4', w: 120, ph: '192.168.20.1' },
          { id: 'dhcp', label: 'DHCP', type: 'bool', w: 50 },
          { id: 'start', label: 'DHCP start', type: 'text', v: 'ipv4', w: 120, ph: '.50' },
          { id: 'end', label: 'DHCP end', type: 'text', v: 'ipv4', w: 120, ph: '.200' },
          { id: 'dns', label: 'DNS', type: 'text', v: 'ipv4list', w: 110, ph: '1.1.1.1' },
          { id: 'description', label: 'Description', type: 'text', w: 140 }
        ], blank: { vlanId: '', name: '', subnet: '', gateway: '', dhcp: false, start: '', end: '', dns: '', description: '' }
      })
    ],

    dhcp: [
      f('poolName', 'Pool name', 'text', 'LAN', { req: true, v: 'name', half: true }),
      f('iface', 'Serving interface', 'text', ifd('lan'), { req: true, v: 'ifname', half: true }),
      f('network', 'Network', 'text', '192.168.10.0/24', { req: true, v: 'cidrNet', half: true, ph: '192.168.10.0/24' }),
      f('gateway', 'Default gateway', 'text', '192.168.10.1', { req: true, v: 'ipv4', half: true }),
      f('start', 'Pool start', 'text', '192.168.10.100', { req: true, v: 'ipv4', half: true }),
      f('end', 'Pool end', 'text', '192.168.10.200', { req: true, v: 'ipv4', half: true }),
      f('dns', 'DNS servers', 'text', '1.1.1.1, 8.8.8.8', { v: 'ipv4list', half: true }),
      f('lease', 'Lease time', 'select', '86400', { opts: [['3600', '1 hour'], ['28800', '8 hours'], ['86400', '1 day'], ['604800', '7 days']], half: true }),
      f('domain', 'Domain', 'text', 'example.local', { v: 'fqdn', half: true }),
      f('setIfaceIp', 'Assign gateway IP to the serving interface', 'toggle', true, { half: true })
    ],

    ports: [
      f('accessIfaces', 'Access interfaces', 'text', ifd('access'), { req: true, v: 'iflist', group: 'Access ports', half: true, help: 'Ranges on the last number: Gi1/0/1-24, ether2-7, 1/1/1-24' }),
      f('accessVlan', 'Access VLAN', 'text', '10', { req: true, v: 'vlan', group: 'Access ports', half: true }),
      f('voiceVlan', 'Voice VLAN (optional)', 'text', '', { v: 'vlan', group: 'Access ports', half: true, ph: 'e.g. 20' }),
      f('portfast', 'Edge port (PortFast)', 'toggle', true, { group: 'Access ports', half: true }),
      f('bpduguard', 'BPDU guard', 'toggle', true, { group: 'Access ports', half: true }),
      f('portSecurity', 'Port security (MAC limit)', 'toggle', true, { group: 'Access ports', half: true }),
      f('maxMac', 'Max MAC addresses', 'number', '2', { v: 'int:1:1024', group: 'Access ports', half: true, show: (p) => p.portSecurity }),
      f('violation', 'Violation action', 'select', 'restrict', { opts: [['restrict', 'Restrict (drop + log)'], ['shutdown', 'Shutdown (err-disable)'], ['protect', 'Protect (drop silently)']], group: 'Access ports', half: true, show: (p, v) => p.portSecurity && ['cisco', 'juniper'].includes(v) }),
      f('trunkEnable', 'Configure uplink trunk', 'toggle', true, { group: 'Trunk' }),
      f('trunkIfaces', 'Trunk interfaces', 'text', ifd('trunk'), { req: true, v: 'iflist', group: 'Trunk', half: true, show: (p) => p.trunkEnable }),
      f('allowedVlans', 'Allowed VLANs', 'text', '10,20,30,99', { req: true, v: 'vlanList', group: 'Trunk', half: true, show: (p) => p.trunkEnable }),
      f('nativeVlan', 'Native VLAN', 'text', '999', { v: 'vlan', group: 'Trunk', half: true, show: (p) => p.trunkEnable, help: 'Use an unused VLAN to mitigate VLAN hopping.' }),
      f('bridge', 'Bridge', 'text', 'bridge1', { req: true, v: 'ifname', group: 'RouterOS bridge', half: true, show: onlyV('mikrotik') }),
      f('createBridge', 'Create the bridge', 'toggle', true, { group: 'RouterOS bridge', half: true, show: onlyV('mikrotik') })
    ],

    lacp: [
      f('lagId', 'Bundle ID', 'number', '1', { req: true, v: 'int:1:64', half: true, help: 'Port-channel / bond / ae / lag number.' }),
      f('members', 'Member interfaces', 'text', ifd('lag'), { req: true, v: 'iflist', half: true }),
      f('mode', 'LACP mode', 'select', 'active', { opts: [['active', 'Active'], ['passive', 'Passive']], half: true }),
      f('description', 'Description', 'text', 'UPLINK-TO-CORE', { half: true }),
      f('lagMode', 'Bundle mode', 'select', 'trunk', { opts: [['trunk', '802.1Q trunk'], ['access', 'Access']], half: true, show: (p, v, d) => d === 'switch' }),
      f('allowedVlans', 'Allowed VLANs', 'text', '10,20,30,99', { req: true, v: 'vlanList', half: true, show: (p, v, d) => d === 'switch' && p.lagMode === 'trunk' }),
      f('nativeVlan', 'Native VLAN', 'text', '999', { v: 'vlan', half: true, show: (p, v, d) => d === 'switch' && p.lagMode === 'trunk' }),
      f('accessVlan', 'Access VLAN', 'text', '10', { req: true, v: 'vlan', half: true, show: (p, v, d) => d === 'switch' && p.lagMode === 'access' }),
      f('lagIp', 'Bundle IP / prefix', 'text', '', { v: 'cidrHost', half: true, show: (p, v, d) => d !== 'switch', ph: '10.0.0.1/30' }),
      f('bridge', 'Add to bridge', 'text', 'bridge1', { v: 'ifname', half: true, show: (p, v, d) => v === 'mikrotik' && d === 'switch' })
    ],

    stp: [
      f('mode', 'Mode', 'select', 'rstp', { opts: [['rstp', 'Rapid (RSTP / Rapid-PVST+)'], ['mstp', 'Multiple (MSTP)']], half: true }),
      f('priority', 'Bridge priority', 'select', '4096', { opts: PRIOS, half: true }),
      f('vlans', 'VLANs', 'text', '1,10,20,30,99', { req: true, v: 'vlanList', half: true, show: onlyV('cisco', 'aruba'), help: 'Per-VLAN priority (Rapid-PVST+) or MST instance 1 mapping.' }),
      f('region', 'MST region name', 'text', 'REGION1', { v: 'name', half: true, show: (p) => p.mode === 'mstp' }),
      f('bridge', 'Bridge', 'text', 'bridge1', { req: true, v: 'ifname', half: true, show: onlyV('mikrotik') }),
      f('portfastDefault', 'Edge (PortFast) on all access ports', 'toggle', true, { show: notV('mikrotik') }),
      f('bpduguardDefault', 'BPDU guard on edge ports by default', 'toggle', true, { show: notV('mikrotik') }),
      f('loopguard', 'Loop guard by default', 'toggle', false, { show: notV('mikrotik') })
    ],

    l2sec: [
      f('vlans', 'Protected VLANs', 'text', '10,20', { req: true, v: 'vlanList', half: true, show: notV('juniper', 'mikrotik') }),
      f('vlanNames', 'Protected VLAN names', 'text', 'USERS, VOICE', { req: true, half: true, show: onlyV('juniper'), help: 'Junos dhcp-security is configured under the VLAN name.' }),
      f('bridge', 'Bridge', 'text', 'bridge1', { req: true, v: 'ifname', half: true, show: onlyV('mikrotik') }),
      f('trustedIfaces', 'Trusted interfaces (uplinks / DHCP server)', 'text', ifd('trunk'), { req: true, v: 'iflist', half: true }),
      f('untrustedIfaces', 'Rate-limited access interfaces', 'text', ifd('access'), { v: 'iflist', half: true, show: onlyV('cisco') }),
      f('rateLimit', 'DHCP rate limit (pps)', 'number', '15', { v: 'int:1:2048', half: true, show: onlyV('cisco') }),
      f('snooping', 'DHCP snooping', 'toggle', true, { half: true }),
      f('dai', 'Dynamic ARP Inspection', 'toggle', true, { half: true }),
      f('option82', 'Insert DHCP option 82', 'toggle', false, { half: true })
    ],

    static: [
      f('rows', 'Static routes', 'table', (v, d) => {
        const ifc = v === 'fortigate' ? NC.iface(v, d, 'wan') : '';
        return [
          { dest: '10.50.0.0', prefix: '16', gateway: '10.0.0.2', iface: ifc, distance: '', comment: 'Branch networks' },
          { dest: '172.16.20.0', prefix: '24', gateway: '10.0.0.3', iface: ifc, distance: '200', comment: 'DMZ floating backup' }
        ];
      }, {
        add: 'Add route', cols: [
          { id: 'dest', label: 'Destination', type: 'text', req: true, v: 'ipv4', w: 120, ph: '10.50.0.0' },
          { id: 'prefix', label: 'Prefix', type: 'text', req: true, v: 'int:0:32', w: 60, ph: '16' },
          { id: 'gateway', label: 'Gateway', type: 'text', v: 'ipv4', w: 120, ph: '10.0.0.2' },
          { id: 'iface', label: 'Interface', type: 'text', v: 'ifname', w: 130, ph: 'optional' },
          { id: 'distance', label: 'Distance', type: 'text', v: 'int:1:255', w: 70, ph: 'default' },
          { id: 'comment', label: 'Comment', type: 'text', w: 160 }
        ], blank: { dest: '', prefix: '24', gateway: '', iface: '', distance: '', comment: '' }
      }),
      f('defaultRoute', 'Add default route (0.0.0.0/0)', 'toggle', true, { group: 'Default route' }),
      f('defaultGw', 'Default gateway', 'text', '10.0.0.1', { v: 'ipv4', group: 'Default route', half: true, show: (p) => p.defaultRoute }),
      f('defaultIface', 'Exit interface', 'text', ifd('wan'), { v: 'ifname', group: 'Default route', half: true, show: (p) => p.defaultRoute, req: (p, v) => v === 'fortigate' })
    ],

    ospf: [
      f('routerId', 'Router ID', 'text', '10.255.255.1', { req: true, v: 'ipv4', half: true }),
      f('processId', 'Process ID', 'number', '1', { req: true, v: 'int:1:65535', half: true, show: onlyV('cisco', 'aruba', 'mikrotik') }),
      f('area', 'Area', 'text', '0', { req: true, v: 'area', half: true, help: 'Decimal (0) or dotted (0.0.0.0).' }),
      f('defaultOriginate', 'Originate default route', 'toggle', false, { half: true }),
      f('networks', 'Networks', 'textarea', '10.10.10.0/24\n10.20.20.0/24', { v: 'cidrNetList', rows: 3, req: onlyV('cisco', 'fortigate'), help: 'One prefix per line. Used by Cisco, FortiGate, MikroTik.' }),
      f('ifaces', 'OSPF interfaces', 'text', ifd('ospf'), { v: 'iflist', half: true, req: onlyV('juniper', 'aruba'), show: notV('cisco', 'fortigate'), help: 'Junos / AOS-CX enable OSPF per interface.' }),
      f('passive', 'Passive interfaces', 'text', ifd('passive'), { v: 'iflist', half: true })
    ],

    bgp: [
      f('localAsn', 'Local ASN', 'text', '65000', { req: true, v: 'asn', half: true }),
      f('routerId', 'Router ID', 'text', '10.255.255.1', { req: true, v: 'ipv4', half: true }),
      f('neighbor', 'Neighbor IP', 'text', '203.0.113.1', { req: true, v: 'ipv4', half: true }),
      f('remoteAsn', 'Remote ASN', 'text', '65001', { req: true, v: 'asn', half: true }),
      f('networks', 'Advertised networks', 'textarea', '198.51.100.0/24', { v: 'cidrNetList', rows: 2, help: 'One prefix per line. Only these are advertised (outbound filter).' }),
      f('updateSourceIf', 'Update source interface', 'text', '', { v: 'ifname', half: true, ph: 'Loopback0', show: onlyV('cisco', 'aruba', 'fortigate') }),
      f('localAddress', 'Local address (update source)', 'text', '', { v: 'ipv4', half: true, ph: '203.0.113.2', show: onlyV('juniper', 'mikrotik') }),
      f('password', 'MD5 password', 'secret', '', { half: true, help: 'Never saved. Placeholder unless "Insert secrets" is enabled.' }),
      f('description', 'Description', 'text', 'ISP-A', { v: 'name', half: true }),
      f('anchor', 'Anchor advertised prefixes with a discard route', 'toggle', true)
    ],

    rip: [
      f('networks', 'Networks', 'textarea', '10.10.10.0/24\n10.20.20.0/24', { v: 'cidrNetList', rows: 3, req: onlyV('cisco', 'fortigate'), show: notV('juniper', 'mikrotik'), help: 'Cisco converts these to classful network statements.' }),
      f('ifaces', 'RIP interfaces', 'text', ifd('ospf'), { v: 'iflist', half: true, req: onlyV('juniper', 'mikrotik'), show: notV('cisco') }),
      f('passive', 'Passive interfaces', 'text', ifd('passive'), { v: 'iflist', half: true }),
      f('defaultOriginate', 'Originate default route', 'toggle', false, { half: true }),
      f('noAutoSummary', 'Disable auto-summary', 'toggle', true, { half: true, show: onlyV('cisco') })
    ],

    nat: [
      f('type', 'NAT type', 'select', 'pat', { opts: [['static', 'Static NAT (1:1)'], ['dynamic', 'Dynamic NAT (pool)'], ['pat', 'PAT / Masquerade'], ['portfwd', 'Port forwarding']], half: true }),
      f('insideIf', 'Inside interface', 'text', ifd('lan'), { req: true, v: 'ifname', half: true, show: notV('mikrotik', 'juniper') }),
      f('outsideIf', 'Outside interface', 'text', ifd('wan'), { req: true, v: 'ifname', half: true }),
      f('fromZone', 'Inside zone', 'text', 'trust', { req: true, v: 'name', half: true, show: onlyV('juniper') }),
      f('toZone', 'Outside zone', 'text', 'untrust', { req: true, v: 'name', half: true, show: onlyV('juniper') }),
      f('insideNet', 'Inside network', 'text', '192.168.10.0/24', { req: true, v: 'cidrNet', half: true, show: (p) => p.type === 'pat' || p.type === 'dynamic' }),
      f('poolStart', 'Pool start', 'text', '203.0.113.10', { req: true, v: 'ipv4', half: true, show: (p) => p.type === 'dynamic' }),
      f('poolEnd', 'Pool end', 'text', '203.0.113.20', { req: true, v: 'ipv4', half: true, show: (p) => p.type === 'dynamic' }),
      f('poolPrefix', 'Pool prefix length', 'number', '24', { req: true, v: 'int:1:32', half: true, show: (p, v) => p.type === 'dynamic' && v === 'cisco' }),
      f('insideLocal', 'Inside local IP', 'text', '192.168.10.20', { req: true, v: 'ipv4', half: true, show: (p) => p.type === 'static' || p.type === 'portfwd' }),
      f('outsideGlobal', 'Outside global IP', 'text', '203.0.113.20', { v: 'ipv4', half: true, show: (p) => p.type === 'static' || p.type === 'portfwd', req: (p, v) => p.type === 'static' || v === 'fortigate' || (p.type === 'portfwd' && !p.useIfaceIp) }),
      f('useIfaceIp', 'Use outside interface address', 'toggle', false, { half: true, show: (p, v) => p.type === 'portfwd' && ['cisco', 'mikrotik', 'juniper'].includes(v) }),
      f('protocol', 'Protocol', 'select', 'tcp', { opts: [['tcp', 'TCP'], ['udp', 'UDP']], half: true, show: (p) => p.type === 'portfwd' }),
      f('extPort', 'External port', 'text', '8443', { req: true, v: 'port1', half: true, show: (p) => p.type === 'portfwd' }),
      f('intPort', 'Internal port', 'text', '443', { req: true, v: 'port1', half: true, show: (p) => p.type === 'portfwd' })
    ],

    acl: [
      f('name', 'ACL name', 'text', 'WEB-ACCESS', { req: true, v: 'name', half: true }),
      f('applyIface', 'Apply to interface', 'text', ifd('lan'), { v: 'ifname', half: true, ph: 'optional' }),
      f('direction', 'Direction', 'select', 'in', { opts: [['in', 'Inbound'], ['out', 'Outbound']], half: true }),
      f('implicitLog', 'Explicit "deny any" with logging at the end', 'toggle', true, { half: true }),
      f('rows', 'Rules', 'table', [
        { action: 'permit', protocol: 'tcp', src: '10.10.10.0/24', sport: '', dst: '10.20.20.10', dport: '443', log: false, comment: 'Users to web server HTTPS' },
        { action: 'permit', protocol: 'udp', src: '10.10.10.0/24', sport: '', dst: '10.20.20.53', dport: '53', log: false, comment: 'Users to internal DNS' },
        { action: 'permit', protocol: 'icmp', src: '10.10.10.0/24', sport: '', dst: '10.20.20.0/24', dport: '', log: false, comment: 'ICMP diagnostics' },
        { action: 'deny', protocol: 'tcp', src: 'any', sport: '', dst: '10.20.20.0/24', dport: '22', log: true, comment: 'Block SSH to servers' }
      ], {
        add: 'Add rule', order: true, cols: [
          { id: 'action', label: 'Action', type: 'select', opts: [['permit', 'Permit'], ['deny', 'Deny']], w: 90 },
          { id: 'protocol', label: 'Protocol', type: 'select', opts: [['ip', 'IP'], ['tcp', 'TCP'], ['udp', 'UDP'], ['icmp', 'ICMP']], w: 80 },
          { id: 'src', label: 'Source', type: 'text', req: true, v: 'addr', w: 130, ph: 'any / host / CIDR' },
          { id: 'sport', label: 'Src port', type: 'text', v: 'port', w: 75, ph: 'any' },
          { id: 'dst', label: 'Destination', type: 'text', req: true, v: 'addr', w: 130, ph: 'any / host / CIDR' },
          { id: 'dport', label: 'Dst port', type: 'text', v: 'port', w: 75, ph: 'any' },
          { id: 'log', label: 'Log', type: 'bool', w: 44 },
          { id: 'comment', label: 'Comment', type: 'text', w: 170 }
        ], blank: { action: 'permit', protocol: 'tcp', src: 'any', sport: '', dst: 'any', dport: '', log: false, comment: '' }
      })
    ],

    firewall: [
      f('dstIf', 'Egress interface / zone', 'text', (v) => (v === 'juniper' ? 'untrust' : 'port1'), { req: true, v: 'name', half: true, show: onlyV('fortigate', 'juniper'), help: 'FortiGate dstintf or SRX to-zone for forward rules.' }),
      f('rows', 'Rules', 'table', (v, d) => {
        const wan = v === 'juniper' ? 'untrust' : NC.iface(v, d, 'wan');
        const lan = v === 'juniper' ? 'trust' : NC.iface(v, d, 'lan');
        return [
          { action: 'accept', chain: 'input', protocol: 'any', src: 'any', dst: 'any', port: '', iface: '', state: 'established,related', comment: 'Allow established and related' },
          { action: 'drop', chain: 'input', protocol: 'any', src: 'any', dst: 'any', port: '', iface: '', state: 'invalid', comment: 'Drop invalid' },
          { action: 'accept', chain: 'input', protocol: 'tcp', src: '10.0.99.0/24', dst: 'any', port: '22', iface: lan, state: 'new', comment: 'SSH from management' },
          { action: 'accept', chain: 'forward', protocol: 'tcp', src: '10.10.10.0/24', dst: '10.20.20.10', port: '443', iface: lan, state: 'new', comment: 'Users to web server' },
          { action: 'drop', chain: 'input', protocol: 'any', src: 'any', dst: 'any', port: '', iface: wan, state: 'any', comment: 'Drop all other input from WAN' }
        ];
      }, {
        add: 'Add rule', order: true, cols: [
          { id: 'action', label: 'Action', type: 'select', opts: [['accept', 'Accept'], ['drop', 'Drop'], ['reject', 'Reject'], ['log', 'Log']], w: 88 },
          { id: 'chain', label: 'Chain', type: 'select', opts: [['input', 'Input'], ['forward', 'Forward'], ['output', 'Output']], w: 92 },
          { id: 'protocol', label: 'Protocol', type: 'select', opts: [['any', 'Any'], ['tcp', 'TCP'], ['udp', 'UDP'], ['icmp', 'ICMP']], w: 76 },
          { id: 'src', label: 'Source', type: 'text', v: 'addr', w: 120, ph: 'any' },
          { id: 'dst', label: 'Destination', type: 'text', v: 'addr', w: 120, ph: 'any' },
          { id: 'port', label: 'Port', type: 'text', v: 'port', w: 64, ph: 'any' },
          { id: 'iface', label: 'In interface / zone', type: 'text', v: 'ifname', w: 110, ph: 'any' },
          { id: 'state', label: 'Conn. state', type: 'select', opts: [['any', 'Any'], ['new', 'New'], ['established,related', 'Established, related'], ['invalid', 'Invalid']], w: 140 },
          { id: 'comment', label: 'Comment', type: 'text', w: 170 }
        ], blank: { action: 'accept', chain: 'forward', protocol: 'tcp', src: 'any', dst: 'any', port: '', iface: '', state: 'new', comment: '' }
      })
    ],

    mgmt: [
      f('mgmtNet', 'Management subnet (allowed)', 'text', '10.0.99.0/24', { req: true, v: 'cidrNet', half: true }),
      f('mgmtIface', 'Management interface', 'text', ifd('mgmt'), { req: true, v: 'ifname', half: true, show: onlyV('fortigate') }),
      f('domain', 'Domain (RSA key label)', 'text', 'example.local', { req: true, v: 'fqdn', half: true, show: onlyV('cisco') }),
      f('keySize', 'RSA modulus', 'select', '2048', { opts: [['2048', '2048 bit'], ['4096', '4096 bit']], half: true, show: onlyV('cisco') }),
      f('timeout', 'Idle timeout (minutes)', 'number', '10', { req: true, v: 'int:1:60', half: true }),
      f('retries', 'Max login attempts', 'number', '3', { req: true, v: 'int:1:10', half: true }),
      f('adminUser', 'Admin username', 'text', (v) => (v === 'fortigate' ? 'admin' : 'netadmin'), { v: 'name', half: true, help: 'Only the name is used. Passwords are never collected.' }),
      f('disableInsecure', 'Disable Telnet / HTTP / insecure services', 'toggle', true, { half: true })
    ],

    ipsec: [
      f('name', 'Tunnel name', 'text', 'SITE-B', { req: true, v: 'name', half: true }),
      f('ikeVersion', 'IKE version', 'select', 'ikev2', { opts: [['ikev2', 'IKEv2'], ['ikev1', 'IKEv1 (main mode)']], half: true }),
      f('localPublic', 'Local public IP', 'text', '198.51.100.1', { req: true, v: 'ipv4', group: 'Peers', half: true }),
      f('remotePublic', 'Remote public IP', 'text', '203.0.113.2', { req: true, v: 'ipv4', group: 'Peers', half: true }),
      f('localNet', 'Local network', 'text', '192.168.10.0/24', { req: true, v: 'cidrNet', group: 'Peers', half: true }),
      f('remoteNet', 'Remote network', 'text', '192.168.20.0/24', { req: true, v: 'cidrNet', group: 'Peers', half: true }),
      f('wanIf', 'WAN interface', 'text', ifd('wan'), { req: true, v: 'ifname', group: 'Peers', half: true, show: notV('mikrotik') }),
      f('lanIf', 'LAN interface', 'text', ifd('lan'), { req: true, v: 'ifname', group: 'Peers', half: true, show: onlyV('fortigate') }),
      f('encryption', 'Encryption', 'select', 'aes256', { opts: [['aes256', 'AES-256-CBC'], ['aes128', 'AES-128-CBC']], group: 'Crypto', half: true }),
      f('hash', 'Integrity / hash', 'select', 'sha256', { opts: [['sha256', 'SHA-256'], ['sha512', 'SHA-512'], ['sha1', 'SHA-1 (legacy)']], group: 'Crypto', half: true }),
      f('dh', 'DH group', 'select', '14', { opts: [['14', 'Group 14 (MODP 2048)'], ['15', 'Group 15 (MODP 3072)'], ['16', 'Group 16 (MODP 4096)'], ['19', 'Group 19 (ECP 256)'], ['20', 'Group 20 (ECP 384)'], ['21', 'Group 21 (ECP 521)']], group: 'Crypto', half: true }),
      f('pfs', 'Perfect Forward Secrecy', 'toggle', true, { group: 'Crypto', half: true }),
      f('ikeLifetime', 'IKE lifetime (s)', 'number', '28800', { req: true, v: 'int:300:86400', group: 'Crypto', half: true }),
      f('ipsecLifetime', 'IPsec lifetime (s)', 'number', '3600', { req: true, v: 'int:120:86400', group: 'Crypto', half: true }),
      f('psk', 'Pre-shared key', 'secret', '', { group: 'Authentication', help: 'Never saved to history, URL or logs. Placeholder unless "Insert secrets" is enabled.' })
    ]
  };

  /* ------------------------------------------------------------------
     Value checkers  -> null (ok) | message
     ------------------------------------------------------------------ */
  const chk = {
    ipv4: (v) => (V.isIPv4(v) ? null : `"${v}" is not a valid IPv4 address.`),
    cidrNet: (v) => {
      const c = N.parseCidr(v);
      if (!c) return `"${v}" is not a valid prefix (expected e.g. 192.168.20.0/24).`;
      if (c.ip !== c.network) return `${v} is not a network address - did you mean ${c.cidr}?`;
      return null;
    },
    cidrHost: (v) => {
      const c = N.parseCidr(v);
      if (!c) return `"${v}" is not a valid address/prefix (expected e.g. 10.0.99.10/24).`;
      if (c.prefix < 31 && (c.ip === c.network || c.ip === c.broadcast)) return `${v} is the ${c.ip === c.network ? 'network' : 'broadcast'} address of ${c.cidr}.`;
      return null;
    },
    vlan: (v) => (V.isVlan(v) ? null : `VLAN ID "${v}" must be between 1 and 4094.`),
    vlanList: (v) => (V.vlanList(v) ? null : `"${v}" is not a valid VLAN list (e.g. 10,20,30-40, values 1-4094).`),
    asn: (v) => (V.isAsn(v) ? (+v === 23456 ? 'AS 23456 (AS_TRANS) is reserved and cannot be used.' : null) : `ASN "${v}" must be between 1 and 4294967295.`),
    port: (v) => (V.isPortSpec(v) ? null : `"${v}" is not a valid port or range (1-65535, e.g. 443 or 1000-2000).`),
    port1: (v) => (/^\d+$/.test(v) && +v >= 1 && +v <= 65535 ? null : `Port "${v}" must be a single number 1-65535.`),
    name: (v) => (V.isName(v) ? null : `"${v}" contains invalid characters (use letters, digits, - _ .).`),
    fqdn: (v) => (V.isFqdn(v) ? null : `"${v}" is not a valid domain name.`),
    hosts: (v) => { const bad = V.list(v).find((x) => !V.isHost(x)); return bad ? `"${bad}" is not a valid IPv4 address or hostname.` : null; },
    ipv4list: (v) => { const bad = V.list(v).find((x) => !V.isIPv4(x)); return bad ? `"${bad}" is not a valid IPv4 address.` : null; },
    cidrNetList: (v) => { for (const x of V.list(v)) { const e = chk.cidrNet(x); if (e) return e; } return null; },
    ifname: (v) => (V.isIfName(v) ? null : `"${v}" is not a valid interface name.`),
    iflist: (v) => { const bad = String(v).split(',').map((s) => s.trim()).filter(Boolean).find((x) => !V.isIfName(x)); return bad ? `"${bad}" is not a valid interface name.` : null; },
    addr: (v) => {
      const s = String(v).trim().toLowerCase();
      if (s === 'any' || V.isIPv4(s)) return null;
      const c = N.parseCidr(s);
      if (!c) return `"${v}" must be "any", a host IP or a CIDR prefix.`;
      if (c.ip !== c.network) return `${v} is not a network address - did you mean ${c.cidr}?`;
      return null;
    },
    area: (v) => (/^\d+$/.test(v) && +v <= 4294967295) || V.isIPv4(v) ? null : `Area "${v}" must be a number or dotted-decimal (0 or 0.0.0.0).`
  };
  const runChk = (key, val) => {
    if (!key) return null;
    const m = /^int:(\d+):(\d+)$/.exec(key);
    if (m) return /^\d+$/.test(String(val).trim()) && +val >= +m[1] && +val <= +m[2] ? null : `Value must be a whole number between ${m[1]} and ${m[2]}.`;
    return chk[key] ? chk[key](String(val).trim()) : null;
  };
  const empty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  const resolve = (x, ...a) => (typeof x === 'function' ? x(...a) : x);

  /* ------------------------------------------------------------------
     Module-level (cross-field) validation
     ------------------------------------------------------------------ */
  const ip = (s) => N.parseIPv4(String(s || '').trim());
  const cross = {
    basic(p, v, d, E, W) {
      if (p.mgmtEnable && p.mgmtGw && !E.has('mgmtIp') && !E.has('mgmtGw')) {
        const c = N.parseCidr(p.mgmtIp);
        if (!N.inSubnet(ip(p.mgmtGw), c)) E.add('mgmtGw', `Gateway ${p.mgmtGw} does not belong to subnet ${c.cidr}.`);
        else if (ip(p.mgmtGw) === c.ip) E.add('mgmtGw', 'Gateway cannot be the management address itself.');
      }
      if (p.snmpEnable && !p.snmpCommunity) W.push('SNMP community left empty - a <REPLACE-WITH-SNMP-COMMUNITY> placeholder will be generated.');
    },
    vlan(p, v, d, E, W) {
      const rows = p.rows || [];
      if (!rows.length) E.add('rows', 'Add at least one VLAN.');
      const ids = {}, names = {}, nets = [];
      rows.forEach((r, i) => {
        const n = i + 1;
        if (r.vlanId && ids[r.vlanId]) E.row('rows', i, 'vlanId', `Duplicate VLAN ID ${r.vlanId} (rows ${ids[r.vlanId]} and ${n}).`);
        ids[r.vlanId] = n;
        const nm = String(r.name).toUpperCase();
        if (nm && names[nm]) E.row('rows', i, 'name', `Duplicate VLAN name ${r.name} (rows ${names[nm]} and ${n}).`);
        names[nm] = n;
        if (+r.vlanId === 1) W.push(`VLAN ${n}: VLAN 1 is the default VLAN - avoid using it for user traffic.`);
        const needNet = r.gateway || r.dhcp;
        if (needNet && empty(r.subnet)) { E.row('rows', i, 'subnet', `VLAN ${r.vlanId || n}: subnet is required when a gateway or DHCP is set.`); return; }
        if (empty(r.subnet) || E.hasRow('rows', i, 'subnet')) return;
        const c = N.parseCidr(r.subnet);
        nets.push([c, n]);
        if (r.gateway && !E.hasRow('rows', i, 'gateway')) {
          const g = ip(r.gateway);
          if (!N.inSubnet(g, c)) E.row('rows', i, 'gateway', `Gateway ${r.gateway} does not belong to subnet ${c.cidr}.`);
          else if (g === c.network || g === c.broadcast) E.row('rows', i, 'gateway', `Gateway ${r.gateway} is the ${g === c.network ? 'network' : 'broadcast'} address of ${c.cidr}.`);
        }
        if (r.dhcp) {
          if (!r.gateway) E.row('rows', i, 'gateway', `VLAN ${r.vlanId}: DHCP requires a gateway.`);
          if (empty(r.start)) E.row('rows', i, 'start', `VLAN ${r.vlanId}: DHCP start address is required.`);
          if (empty(r.end)) E.row('rows', i, 'end', `VLAN ${r.vlanId}: DHCP end address is required.`);
          if (!empty(r.start) && !empty(r.end) && !E.hasRow('rows', i, 'start') && !E.hasRow('rows', i, 'end')) poolChecks(c, r.start, r.end, r.gateway, (col, m) => E.row('rows', i, col, `VLAN ${r.vlanId}: ${m}`));
        }
      });
      for (let a = 0; a < nets.length; a++) for (let b = a + 1; b < nets.length; b++) {
        const [c1, n1] = nets[a], [c2, n2] = nets[b];
        if (N.inSubnet(c2.network, c1) || N.inSubnet(c1.network, c2)) E.row('rows', n2 - 1, 'subnet', `Subnet ${c2.cidr} overlaps ${c1.cidr} (row ${n1}).`);
      }
      if (v === 'fortigate') rows.forEach((r) => { if (String(r.name).length > 15) W.push(`FortiGate interface names are limited to 15 characters - "${r.name}" will be truncated.`); });
    },
    dhcp(p, v, d, E) {
      if (E.has('network')) return;
      const c = N.parseCidr(p.network);
      if (!E.has('gateway')) {
        const g = ip(p.gateway);
        if (!N.inSubnet(g, c)) E.add('gateway', `Gateway ${p.gateway} does not belong to network ${c.cidr}.`);
        else if (g === c.network || g === c.broadcast) E.add('gateway', `Gateway ${p.gateway} is the ${g === c.network ? 'network' : 'broadcast'} address.`);
      }
      if (!E.has('start') && !E.has('end')) poolChecks(c, p.start, p.end, E.has('gateway') ? '' : p.gateway, (col, m) => E.add(col, m));
    },
    ports(p, v, d, E, W) {
      if (p.voiceVlan && p.voiceVlan === p.accessVlan) E.add('voiceVlan', 'Voice VLAN must differ from the access VLAN.');
      if (p.trunkEnable) {
        const acc = new Set(V.expandIfs(p.accessIfaces).map((s) => s.toLowerCase()));
        const dup = V.expandIfs(p.trunkIfaces).find((s) => acc.has(s.toLowerCase()));
        if (dup) E.add('trunkIfaces', `Interface ${dup} is configured as both access and trunk.`);
        if (p.nativeVlan && p.nativeVlan === p.accessVlan) W.push('Native VLAN equals the access VLAN - use a dedicated unused native VLAN.');
        const al = V.vlanList(p.allowedVlans);
        if (al && !al.includes(+p.accessVlan)) W.push(`Access VLAN ${p.accessVlan} is not in the trunk allowed list.`);
      }
      if (p.portSecurity && !p.portfast) W.push('Port security is typically combined with edge (PortFast) ports.');
    },
    lacp(p, v, d, E) {
      if (!E.has('members') && V.expandIfs(p.members).length < 2) E.add('members', 'An LACP bundle needs at least two member interfaces.');
      if (V.expandIfs(p.members).length > 8 && v !== 'juniper') E.add('members', 'Most platforms support at most 8 active LACP members.');
    },
    stp(p, v, d, E, W) { if (+p.priority === 0) W.push('Priority 0 makes this bridge the root unconditionally - ensure this is the intended core/distribution switch.'); },
    l2sec(p, v, d, E) { if (p.dai && !p.snooping && v !== 'mikrotik') E.add('dai', 'Dynamic ARP Inspection relies on the DHCP snooping binding table - enable DHCP snooping.'); },
    static(p, v, d, E, W) {
      const seen = {};
      (p.rows || []).forEach((r, i) => {
        const n = i + 1;
        if (empty(r.gateway) && empty(r.iface)) E.row('rows', i, 'gateway', `Route ${n}: specify a gateway, an exit interface, or both.`);
        if (v === 'fortigate' && empty(r.iface)) E.row('rows', i, 'iface', `Route ${n}: FortiOS requires the exit interface (device).`);
        if (!E.hasRow('rows', i, 'dest') && !E.hasRow('rows', i, 'prefix')) {
          const c = N.parseCidr(`${r.dest}/${r.prefix}`);
          if (c && c.ip !== c.network) E.row('rows', i, 'dest', `Route ${n}: ${r.dest}/${r.prefix} is not a network address - did you mean ${c.cidr}?`);
          if (c && c.prefix === 0) W.push(`Route ${n} is a default route - consider the dedicated default route toggle.`);
          const k = c && c.cidr;
          if (k && seen[k]) W.push(`Route ${n} duplicates destination ${k} (route ${seen[k]}) - valid only for floating/ECMP designs.`);
          if (k) seen[k] = n;
        }
      });
      if (p.defaultRoute && empty(p.defaultGw) && empty(p.defaultIface)) E.add('defaultGw', 'Default route needs a gateway or an exit interface.');
      if (!(p.rows || []).length && !p.defaultRoute) E.add('rows', 'Add at least one route or enable the default route.');
    },
    ospf(p, v, d, E, W) {
      if (v === 'mikrotik' && empty(p.networks) && empty(p.ifaces)) E.add('networks', 'RouterOS needs networks or interfaces for the OSPF interface-template.');
      const rid = ip(p.routerId);
      if (rid === 0) E.add('routerId', 'Router ID 0.0.0.0 is not allowed.');
    },
    bgp(p, v, d, E, W) {
      if (!E.has('neighbor') && p.neighbor === p.routerId) E.add('neighbor', 'Neighbor IP cannot equal the local router ID.');
      if (!E.has('localAsn') && !E.has('remoteAsn')) {
        W.push(p.localAsn === p.remoteAsn ? 'iBGP session (same ASN): full mesh or route reflectors required.' : 'eBGP session: verify ASN, neighbor IP and prefixes with your upstream.');
        const priv = (a) => (+a >= 64512 && +a <= 65534) || (+a >= 4200000000 && +a <= 4294967294);
        if (priv(p.localAsn)) W.push(`AS${p.localAsn} is a private ASN - it must be stripped before reaching the internet.`);
      }
      if (empty(p.networks)) W.push('No prefixes will be advertised (networks list is empty).');
      if (!p.password) W.push('No MD5 password set - session authentication is recommended for eBGP.');
    },
    rip(p) {},
    nat(p, v, d, E, W) {
      if (p.type === 'dynamic' && !E.has('poolStart') && !E.has('poolEnd')) {
        if (ip(p.poolStart) > ip(p.poolEnd)) E.add('poolEnd', `Pool end ${p.poolEnd} is lower than pool start ${p.poolStart}.`);
        if (v === 'cisco' && !E.has('poolPrefix')) {
          const c = N.parseCidr(`${p.poolStart}/${p.poolPrefix}`);
          if (c && !N.inSubnet(ip(p.poolEnd), c)) E.add('poolEnd', `Pool range does not fit in a /${p.poolPrefix} netmask.`);
        }
      }
      if ((p.type === 'static' || p.type === 'portfwd') && p.insideLocal && p.insideLocal === p.outsideGlobal) E.add('outsideGlobal', 'Outside global address must differ from the inside local address.');
      if (p.type === 'static') W.push('Static NAT exposes the inside host - pair it with a restrictive inbound policy/ACL.');
    },
    acl(p, v, d, E, W) {
      const rows = p.rows || [];
      if (!rows.length) E.add('rows', 'Add at least one rule.');
      const seen = {};
      rows.forEach((r, i) => {
        const tu = r.protocol === 'tcp' || r.protocol === 'udp';
        if (!tu && (!empty(r.sport) || !empty(r.dport))) E.row('rows', i, empty(r.dport) ? 'sport' : 'dport', `Rule ${i + 1}: ports can only be matched with TCP or UDP.`);
        const k = [r.action, r.protocol, r.src, r.sport, r.dst, r.dport].join('|').toLowerCase();
        if (seen[k]) W.push(`Rule ${i + 1} duplicates rule ${seen[k]} and will never match.`);
        seen[k] = i + 1;
        if (i < rows.length - 1 && r.protocol === 'ip' && String(r.src).toLowerCase() === 'any' && String(r.dst).toLowerCase() === 'any') W.push(`Rule ${i + 1} matches all traffic - rules below it are shadowed.`);
      });
    },
    firewall(p, v, d, E, W) {
      const rows = p.rows || [];
      if (!rows.length) E.add('rows', 'Add at least one rule.');
      rows.forEach((r, i) => {
        const tu = r.protocol === 'tcp' || r.protocol === 'udp';
        if (!tu && !empty(r.port)) E.row('rows', i, 'port', `Rule ${i + 1}: a port requires TCP or UDP.`);
      });
      if (v === 'mikrotik' && !rows.some((r) => r.chain === 'input' && r.state === 'established,related')) W.push('No "established,related" accept rule in the input chain - return traffic may be dropped.');
    },
    mgmt(p, v, d, E, W) { if (!p.disableInsecure) W.push('Insecure management services remain enabled.'); },
    ipsec(p, v, d, E, W) {
      if (!E.has('localPublic') && p.localPublic === p.remotePublic) E.add('remotePublic', 'Local and remote peer addresses must differ.');
      if (!E.has('localNet') && !E.has('remoteNet')) {
        const a = N.parseCidr(p.localNet), b = N.parseCidr(p.remoteNet);
        if (N.inSubnet(b.network, a) || N.inSubnet(a.network, b)) E.add('remoteNet', `Remote network ${b.cidr} overlaps local network ${a.cidr} - NAT would be required.`);
      }
      if (v === 'juniper' && p.hash === 'sha512') E.add('hash', 'This template maps Junos to SHA-1/SHA-256 only - choose SHA-256.');
      if (p.hash === 'sha1') W.push('SHA-1 is deprecated for IPsec - prefer SHA-256 or stronger.');
      if (!p.psk) W.push('Pre-shared key is empty - a <REPLACE-WITH-PRE-SHARED-KEY> placeholder will be generated.');
      else if (p.psk.length < 20) W.push('Pre-shared key is shorter than 20 characters - use a long random key.');
      W.push('Never expose production credentials or pre-shared keys in shared environments.');
    }
  };
  function poolChecks(c, start, end, gw, add) {
    const s = ip(start), e = ip(end);
    if (!N.inSubnet(s, c)) return add('start', `Pool start ${start} is outside ${c.cidr}.`);
    if (!N.inSubnet(e, c)) return add('end', `Pool end ${end} is outside ${c.cidr}.`);
    if (s === c.network || s === c.broadcast) return add('start', `Pool start ${start} is the network/broadcast address.`);
    if (e === c.network || e === c.broadcast) return add('end', `Pool end ${end} is the network/broadcast address.`);
    if (s > e) return add('end', `Pool end ${end} is lower than pool start ${start}.`);
    const g = ip(gw);
    if (g !== null && g >= s && g <= e) add('gateway', `Gateway ${gw} is inside the DHCP pool ${start} - ${end}.`);
  }

  /* ------------------------------------------------------------------
     ENGINE
     ------------------------------------------------------------------ */
  const Engine = (NC.Engine = {
    schema: (mod) => NC.Schemas[mod] || [],

    defaults(mod, vendor, device) {
      const p = {};
      Engine.schema(mod).forEach((fl) => {
        const d = resolve(fl.def, vendor, device);
        p[fl.id] = fl.type === 'table' ? JSON.parse(JSON.stringify(d)) : d;
      });
      return p;
    },

    /** Merge template/partial params over defaults */
    withDefaults(mod, vendor, device, partial) {
      const p = Engine.defaults(mod, vendor, device);
      Object.keys(partial || {}).forEach((k) => { p[k] = JSON.parse(JSON.stringify(partial[k])); });
      return p;
    },

    visible(fl, p, vendor, device) { return !fl.show || !!fl.show(p, vendor, device); },

    /** { ok, reason } for a vendor/device/module combination */
    support(vendor, device, mod) {
      const m = NC.MODULES[mod], v = NC.VENDORS[vendor], g = NC.Templates[vendor];
      if (!m || !v || !g) return { ok: false, reason: 'Unknown selection.' };
      if (!v.devices.includes(device)) return { ok: false, reason: `${v.label} does not provide a ${NC.DEVICES[device].name.toLowerCase()} platform in this version.` };
      if (!m.devices.includes(device)) return { ok: false, reason: `${m.name} is not applicable to a ${NC.DEVICES[device].name.toLowerCase()}.` };
      if (typeof g[mod] !== 'function') return { ok: false, reason: 'Template not available for this platform.' };
      if (g.restrict && g.restrict[mod] && !g.restrict[mod].includes(device)) return { ok: false, reason: (g.restrictMsg && g.restrictMsg[mod]) || 'Template not available for this platform.' };
      return { ok: true };
    },

    countTemplates() {
      let n = 0;
      NC.VENDOR_ORDER.forEach((v) => NC.MODULE_ORDER.forEach((m) => { if (NC.VENDORS[v].devices.some((d) => Engine.support(v, d, m).ok)) n++; }));
      return n;
    },

    validate(mod, p, vendor, device) {
      const errs = [];
      const warns = [];
      const E = {
        add: (field, msg) => errs.push({ field, msg }),
        row: (field, row, col, msg) => errs.push({ field, row, col, msg }),
        has: (field) => errs.some((e) => e.field === field && e.row === undefined),
        hasRow: (field, row, col) => errs.some((e) => e.field === field && e.row === row && e.col === col)
      };
      Engine.schema(mod).forEach((fl) => {
        if (!Engine.visible(fl, p, vendor, device)) return;
        const val = p[fl.id];
        if (fl.type === 'table') {
          (val || []).forEach((r, i) => fl.cols.forEach((c) => {
            const cv = r[c.id];
            if (c.type === 'bool' || c.type === 'select') return;
            if (empty(cv)) { if (c.req) E.row(fl.id, i, c.id, `${fl.label} row ${i + 1}: ${c.label} is required.`); return; }
            const m = runChk(c.v, cv);
            if (m) E.row(fl.id, i, c.id, `${fl.label} row ${i + 1}: ${m}`);
          }));
          return;
        }
        if (fl.type === 'toggle' || fl.type === 'select') return;
        const req = resolve(fl.req, p, vendor, device);
        if (empty(val)) { if (req) E.add(fl.id, `${fl.label} is required.`); return; }
        const m = runChk(fl.v, val);
        if (m) E.add(fl.id, `${fl.label}: ${m}`);
      });
      if (cross[mod]) cross[mod](p, vendor, device, E, warns);
      return { errors: errs, warnings: warns };
    },

    /** Trim strings (table cells included) */
    clean(p) {
      const o = {};
      Object.keys(p).forEach((k) => {
        const v = p[k];
        if (Array.isArray(v)) o[k] = v.map((r) => { const x = {}; Object.keys(r).forEach((c) => (x[c] = typeof r[c] === 'string' ? r[c].trim() : r[c])); return x; });
        else o[k] = typeof v === 'string' && k !== 'banner' ? v.trim() : v;
      });
      return o;
    },

    header(vendor, device, modules) {
      const v = NC.VENDORS[vendor];
      const c = v.comment;
      const now = new Date();
      const ts = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      const bar = c + ' ' + '='.repeat(62);
      return [bar, `${c} Configuration generated by NET // CONFIG v${NC.VERSION}`, `${c} Platform : ${v.label} (${v.platform})`, `${c} Device   : ${NC.DEVICES[device].name}`, `${c} Modules  : ${modules.map((m) => NC.MODULES[m].name).join(', ')}`, `${c} Generated: ${ts}`, `${c} Always review generated configurations before deploying them to production.`, bar];
    },

    /**
     * Generate configuration for one or more modules.
     * opts: { vendor, device, modules:[{id, params}], includeSecrets, header }
     */
    generate(opts) {
      const { vendor, device } = opts;
      const g = NC.Templates[vendor];
      const res = { ok: false, text: '', errors: [], warnings: [], notes: [], unsupported: [], modules: [] };
      const supported = [];
      opts.modules.forEach((m) => {
        const s = Engine.support(vendor, device, m.id);
        if (!s.ok) res.unsupported.push({ module: m.id, reason: s.reason });
        else supported.push(m);
      });
      if (!supported.length) { res.errors.push({ module: opts.modules[0] && opts.modules[0].id, msg: 'Template not available for this platform.' }); return res; }
      supported.forEach((m) => {
        const p = Engine.clean(m.params);
        const vr = Engine.validate(m.id, p, vendor, device);
        vr.errors.forEach((e) => res.errors.push(Object.assign({ module: m.id }, e)));
        vr.warnings.forEach((w) => res.warnings.push({ module: m.id, msg: w }));
      });
      if (res.errors.length) return res;

      const c = g.comment;
      const out = [];
      if (opts.header !== false) out.push(...Engine.header(vendor, device, supported.map((m) => m.id)));
      const pre = g.preamble ? g.preamble() : [];
      if (pre.length) out.push(...pre);
      supported.forEach((m) => {
        const p = Engine.clean(m.params);
        let secretUsed = false;
        const ctx = {
          vendor, device,
          secret: (val, label) => {
            if (opts.includeSecrets && val) return val;
            if (val) secretUsed = true;
            return `<REPLACE-WITH-${label}>`;
          },
          warn: (msg) => res.warnings.push({ module: m.id, msg }),
          note: (msg) => res.notes.push({ module: m.id, msg })
        };
        const lines = g[m.id](p, ctx);
        if (secretUsed) res.notes.push({ module: m.id, msg: 'Secrets were replaced with placeholders. Enable "Insert secrets" to render them (never saved).' });
        const title = NC.MODULES[m.id].name.toUpperCase();
        out.push(c, `${c} ---- ${title} ${'-'.repeat(Math.max(4, 56 - title.length))}`, c);
        out.push(...lines);
        res.modules.push(m.id);
      });
      const post = g.postamble ? g.postamble() : [];
      if (post.length) out.push(c, ...post);
      res.text = out.join('\n') + '\n';
      res.ok = true;
      return res;
    }
  });

  /* ------------------------------------------------------------------
     TOPOLOGY (SVG) — theme-aware through CSS classes
     ------------------------------------------------------------------ */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const ICON = {
    router: '<circle r="20" class="tp-body"/><path d="M-10 -4 L-3 -4 M-6 -8 L-2 -4 L-6 0 M10 4 L3 4 M6 0 L2 4 L6 8" class="tp-glyph"/>',
    switch: '<rect x="-26" y="-14" width="52" height="28" rx="5" class="tp-body"/><path d="M-14 -5 L12 -5 M8 -9 L12 -5 L8 -1 M14 5 L-12 5 M-8 1 L-12 5 L-8 9" class="tp-glyph"/>',
    firewall: '<rect x="-22" y="-18" width="44" height="36" rx="5" class="tp-body"/><path d="M-22 -6 H22 M-22 6 H22 M-8 -18 V-6 M8 -6 V6 M-8 6 V18" class="tp-glyph"/>',
    ap: '<circle r="18" class="tp-body"/><path d="M-9 -2 A12 12 0 0 1 9 -2 M-5 3 A7 7 0 0 1 5 3" class="tp-glyph"/><circle cy="7" r="2" class="tp-dot"/>',
    cloud: '<path d="M-30 12 A13 13 0 0 1 -24 -10 A17 17 0 0 1 8 -16 A14 14 0 0 1 30 -2 A12 12 0 0 1 26 12 Z" class="tp-cloud"/>',
    host: '<rect x="-15" y="-12" width="30" height="20" rx="3" class="tp-body tp-soft"/><path d="M-6 13 H6 M0 8 V13" class="tp-glyph"/>',
    server: '<rect x="-14" y="-18" width="28" height="36" rx="3" class="tp-body tp-soft"/><path d="M-8 -9 H8 M-8 -1 H8 M-8 7 H8" class="tp-glyph"/>',
    net: '<rect x="-34" y="-11" width="68" height="22" rx="11" class="tp-net"/>'
  };
  function svg(nodes, links, h) {
    const H2 = h || 300;
    const byId = {};
    nodes.forEach((n) => (byId[n.id] = n));
    let s = `<svg viewBox="0 0 680 ${H2}" class="topo" role="img" aria-label="Topology preview" xmlns="http://www.w3.org/2000/svg">`;
    s += '<defs><marker id="tp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="tp-arrowhead"/></marker></defs>';
    links.forEach((l) => {
      const a = byId[l.a], b = byId[l.b];
      if (!a || !b) return;
      const cls = 'tp-link' + (l.dash ? ' tp-dash' : '') + (l.hot ? ' tp-hot' : '');
      if (l.curve) {
        const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - l.curve;
        s += `<path d="M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}" class="${cls}" fill="none"/>`;
        if (l.label) s += `<text x="${mx}" y="${my + l.curve / 2 - 6}" class="tp-llabel" text-anchor="middle">${esc(l.label)}</text>`;
      } else {
        s += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${cls}"${l.arrow ? ' marker-end="url(#tp-arrow)"' : ''}/>`;
        if (l.label) s += `<text x="${(a.x + b.x) / 2 + (l.dx || 0)}" y="${(a.y + b.y) / 2 + (l.dy || -6)}" class="tp-llabel" text-anchor="middle">${esc(l.label)}</text>`;
      }
    });
    nodes.forEach((n) => {
      s += `<g transform="translate(${n.x} ${n.y}) scale(1.2)" class="tp-node${n.main ? ' tp-main' : ''}">${ICON[n.t] || ICON.net}`;
      if (n.t === 'net' || n.t === 'cloud') s += `<text y="4" class="tp-inlabel" text-anchor="middle">${esc(n.label)}</text>`;
      else {
        const ly = n.t === 'switch' ? 30 : n.t === 'host' ? 27 : 34;
        s += `<text y="${ly}" class="tp-label" text-anchor="middle">${esc(n.label)}</text>`;
      }
      if (n.sub) s += `<text y="${n.t === 'net' || n.t === 'cloud' ? 26 : (n.t === 'switch' ? 30 : n.t === 'host' ? 27 : 34) + 13}" class="tp-sub" text-anchor="middle">${esc(n.sub)}</text>`;
      s += '</g>';
    });
    return s + '</svg>';
  }
  const devIcon = (d) => (d === 'switch' ? 'switch' : d === 'firewall' ? 'firewall' : d === 'ap' ? 'ap' : 'router');
  const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  NC.Topology = {
    render(vendor, device, mod, p) {
      p = p || {};
      const me = { id: 'me', x: 340, y: 150, t: devIcon(device), label: short(p.hostname || NC.VENDORS[vendor].name + ' ' + NC.DEVICES[device].name, 22), main: true };
      const spread = (items, y, x0, x1) => items.map((it, i) => Object.assign(it, { x: items.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (items.length - 1), y }));
      switch (mod) {
        case 'vlan': {
          const rows = (p.rows || []).slice(0, 4);
          const gwIsSelf = device === 'switch';
          me.y = 60;
          const sw = gwIsSelf ? me : { id: 'sw', x: 340, y: 145, t: 'switch', label: 'Access switch', sub: '802.1Q trunk' };
          const hosts = spread(rows.map((r, i) => ({ id: 'h' + i, t: 'host', label: `VLAN ${r.vlanId} ${short(r.name, 10)}`, sub: r.subnet || '' })), 245, 110, 570);
          const nodes = [me].concat(gwIsSelf ? [] : [sw], hosts);
          if (gwIsSelf) { me.y = 110; hosts.forEach((h) => (h.y = 240)); }
          const links = (gwIsSelf ? [] : [{ a: 'me', b: 'sw', label: 'trunk', hot: true }]).concat(hosts.map((h) => ({ a: sw.id, b: h.id })));
          return svg(nodes, links);
        }
        case 'dhcp': {
          me.y = 70; me.sub = 'DHCP ' + (p.gateway || '');
          const sw = { id: 'sw', x: 340, y: 150, t: 'switch', label: p.iface || 'LAN' };
          const cl = spread([{ id: 'c1', t: 'host', label: p.start || 'client' }, { id: 'c2', t: 'host', label: '…' }, { id: 'c3', t: 'host', label: p.end || 'client' }], 245, 180, 500);
          return svg([me, sw].concat(cl), [{ a: 'me', b: 'sw', label: p.network || '' }].concat(cl.map((c) => ({ a: 'sw', b: c.id, dash: true }))));
        }
        case 'ospf': case 'rip': {
          me.sub = mod === 'ospf' ? `RID ${p.routerId || ''}` : 'RIPv2';
          const area = mod === 'ospf' ? `AREA ${p.area}` : 'RIP DOMAIN';
          const n1 = { id: 'n1', x: 130, y: 90, t: 'router', label: 'Neighbor A' }, n2 = { id: 'n2', x: 550, y: 90, t: 'router', label: 'Neighbor B' };
          const nets = spread(NC.Valid.list(p.networks || p.ifaces).slice(0, 4).map((x, i) => ({ id: 'net' + i, t: 'net', label: short(x, 18) })), 255, 150, 530);
          const tag = { id: 'area', x: 340, y: 40, t: 'net', label: area };
          return svg([tag, me, n1, n2].concat(nets), [{ a: 'me', b: 'n1', hot: true }, { a: 'me', b: 'n2', hot: true }, { a: 'n1', b: 'n2', dash: true, curve: 40 }].concat(nets.map((n) => ({ a: 'me', b: n.id, dash: true }))), 290);
        }
        case 'bgp': {
          me.x = 200; me.sub = `AS${p.localAsn || ''}`;
          const peer = { id: 'peer', x: 480, y: 150, t: 'router', label: p.description || 'Peer', sub: `AS${p.remoteAsn || ''}` };
          const inet = { id: 'inet', x: 480, y: 50, t: 'cloud', label: 'INTERNET' };
          const nets = spread(NC.Valid.list(p.networks).slice(0, 3).map((x, i) => ({ id: 'p' + i, t: 'net', label: short(x, 18) })), 255, 110, 300);
          return svg([me, peer, inet].concat(nets), [{ a: 'me', b: 'peer', label: (p.localAsn === p.remoteAsn ? 'iBGP ' : 'eBGP ') + (p.neighbor || ''), hot: true }, { a: 'peer', b: 'inet' }].concat(nets.map((n) => ({ a: 'me', b: n.id, dash: true }))));
        }
        case 'static': {
          me.x = 150;
          const rows = (p.rows || []).slice(0, 3);
          const hops = spread(rows.map((r, i) => ({ id: 'g' + i, t: 'router', label: r.gateway || r.iface || 'next-hop' })), 0, 60, 240);
          hops.forEach((h, i) => { h.x = 380; h.y = 60 + i * 90; });
          const dsts = rows.map((r, i) => ({ id: 'd' + i, x: 580, y: 60 + i * 90, t: 'net', label: `${r.dest}/${r.prefix}` }));
          const nodes = [me].concat(hops, dsts);
          const links = [];
          hops.forEach((h, i) => links.push({ a: 'me', b: h.id, label: rows[i].distance ? 'AD ' + rows[i].distance : '' }, { a: h.id, b: 'd' + i, arrow: true }));
          if (p.defaultRoute) { nodes.push({ id: 'inet', x: 150, y: 50, t: 'cloud', label: '0.0.0.0/0' }); links.push({ a: 'me', b: 'inet', hot: true, label: p.defaultGw || p.defaultIface, dx: 50 }); me.y = 190; }
          return svg(nodes, links);
        }
        case 'nat': {
          const lan = { id: 'lan', x: 110, y: 150, t: p.type === 'static' || p.type === 'portfwd' ? 'server' : 'host', label: p.insideLocal || p.insideNet || 'Inside', sub: 'inside' };
          const inet = { id: 'inet', x: 570, y: 150, t: 'cloud', label: 'INTERNET' };
          me.sub = { static: 'Static NAT', dynamic: 'Dynamic NAT', pat: 'PAT / Masquerade', portfwd: 'Port forward' }[p.type];
          const lbl = p.type === 'portfwd' ? `${p.outsideGlobal || 'WAN'}:${p.extPort} → :${p.intPort}` : p.type === 'dynamic' ? `${p.poolStart} - ${p.poolEnd}` : p.type === 'static' ? p.outsideGlobal : p.outsideIf;
          return svg([lan, me, inet], [{ a: 'lan', b: 'me', label: p.insideIf || 'inside' }, { a: 'me', b: 'inet', label: lbl, hot: true }]);
        }
        case 'acl': case 'firewall': {
          const rows = (p.rows || []).slice(0, 4);
          const srcs = spread(rows.map((r, i) => ({ id: 's' + i, t: 'net', label: short(r.src || 'any', 16) })), 0, 60, 240);
          const dsts = spread(rows.map((r, i) => ({ id: 'd' + i, t: 'net', label: short(r.dst || 'any', 16) })), 0, 60, 240);
          srcs.forEach((n, i) => { n.x = 100; n.y = 55 + i * 65; });
          dsts.forEach((n, i) => { n.x = 580; n.y = 55 + i * 65; });
          me.t = 'firewall';
          const links = [];
          rows.forEach((r, i) => {
            const ok = r.action === 'permit' || r.action === 'accept';
            links.push({ a: 's' + i, b: 'me', dash: !ok }, { a: 'me', b: 'd' + i, arrow: true, dash: !ok, hot: ok, label: `${String(r.action).toUpperCase()} ${r.protocol}${r.dport || r.port ? '/' + (r.dport || r.port) : ''}` });
          });
          return svg([me].concat(srcs, dsts), links, Math.max(300, 55 + rows.length * 65));
        }
        case 'ipsec': {
          const la = { id: 'la', x: 70, y: 200, t: 'net', label: short(p.localNet, 18) };
          const ga = { id: 'ga', x: 200, y: 200, t: devIcon(device), label: 'Local GW', sub: p.localPublic, main: true };
          const inet = { id: 'inet', x: 340, y: 200, t: 'cloud', label: 'INTERNET' };
          const gb = { id: 'gb', x: 480, y: 200, t: 'firewall', label: 'Remote GW', sub: p.remotePublic };
          const lb = { id: 'lb', x: 610, y: 200, t: 'net', label: short(p.remoteNet, 18) };
          return svg([la, ga, inet, gb, lb], [{ a: 'la', b: 'ga' }, { a: 'ga', b: 'inet' }, { a: 'inet', b: 'gb' }, { a: 'gb', b: 'lb' }, { a: 'ga', b: 'gb', dash: true, hot: true, curve: 170, label: `${String(p.ikeVersion).toUpperCase()} · ${String(p.encryption).toUpperCase()}-${String(p.hash).toUpperCase()} · DH${p.dh}` }]);
        }
        case 'ports': case 'lacp': case 'stp': case 'l2sec': {
          const core = { id: 'core', x: 340, y: 50, t: 'switch', label: 'Distribution', sub: mod === 'stp' ? 'root candidate' : '' };
          me.y = 150; me.t = 'switch'; me.sub = mod === 'stp' ? `priority ${p.priority}` : mod === 'lacp' ? `LAG ${p.lagId}` : '';
          const hosts = spread([{ id: 'h1', t: 'host', label: 'PC' }, { id: 'h2', t: 'host', label: 'IP phone' }, { id: 'h3', t: 'host', label: 'PC' }, { id: 'h4', t: 'host', label: 'Printer' }], 250, 160, 520);
          const up = mod === 'lacp' ? [{ a: 'me', b: 'core', label: short(p.members, 22), hot: true, dx: 70 }, { a: 'me', b: 'core', dash: true }] : [{ a: 'me', b: 'core', label: mod === 'l2sec' ? 'trusted uplink' : 'trunk', hot: true, dx: 50 }];
          return svg([core, me].concat(hosts), up.concat(hosts.map((h) => ({ a: 'me', b: h.id, label: mod === 'ports' && h.id === 'h1' ? 'VLAN ' + p.accessVlan : '' }))));
        }
        default: {
          me.y = 150;
          const svc = [];
          if (NC.Valid.list(p.dns).length) svc.push({ id: 'dns', t: 'server', label: 'DNS', sub: NC.Valid.list(p.dns)[0] });
          if (NC.Valid.list(p.ntp).length) svc.push({ id: 'ntp', t: 'server', label: 'NTP', sub: NC.Valid.list(p.ntp)[0] });
          if (p.syslogEnable) svc.push({ id: 'log', t: 'server', label: 'Syslog', sub: p.syslogServer });
          if (p.snmpEnable) svc.push({ id: 'snmp', t: 'server', label: 'NMS', sub: p.snmpAllowed });
          if (mod === 'mgmt') svc.push({ id: 'adm', t: 'host', label: 'Admin', sub: p.mgmtNet });
          spread(svc, 255, 120, 560);
          me.sub = p.mgmtIp || p.mgmtNet || '';
          const nodes = [me].concat(svc, [{ id: 'mnet', x: 340, y: 45, t: 'net', label: 'MGMT NETWORK' }]);
          return svg(nodes, [{ a: 'me', b: 'mnet', hot: true }].concat(svc.map((s) => ({ a: 'me', b: s.id, dash: true }))));
        }
      }
    }
  };

  /* ------------------------------------------------------------------
     SYNTAX HIGHLIGHTER (no dependencies)
     ------------------------------------------------------------------ */
  const KW = {
    fortigate: /^(config|edit|set|unset|next|end|append|select|execute)$/,
    juniper: /^(set|delete|deactivate|activate)$/,
    mikrotik: /^(add|set|remove|enable|disable|print|move)$/
  };
  const TOK = /("(?:[^"\\]|\\.)*")|(<REPLACE-WITH-[A-Z0-9-]+>)|((?<![\w.\-])\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?(?![\w\-]))|([A-Za-z][\w.\-]*=)|(\[[^\]]*\])|((?<![\w.\-\/:])\d+(?![\w.\-\/:]))/g;
  function hlRest(s) {
    let out = '', last = 0, m;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(s))) {
      out += esc(s.slice(last, m.index));
      const cls = m[1] ? 't-s' : m[2] ? 't-sec' : m[3] ? 't-ip' : m[4] ? 't-a' : m[5] ? 't-p' : 't-n';
      out += `<span class="${cls}">${esc(m[0])}</span>`;
      last = TOK.lastIndex;
    }
    return out + esc(s.slice(last));
  }
  NC.Highlight = function (text, vendor) {
    const c = (NC.VENDORS[vendor] || {}).comment || '!';
    return String(text).split('\n').map((line) => {
      const t = line.trim();
      if (!t) return '';
      if (t.startsWith(c) || (c === '#' && t.startsWith('#'))) return `<span class="t-c">${esc(line)}</span>`;
      const lead = line.match(/^\s*/)[0];
      let rest = line.slice(lead.length);
      let head = '';
      if (vendor === 'mikrotik' && rest.startsWith('/')) {
        const m = /^(\/[^=]*?)(?=\s+(?:add|set|remove|print|move|enable|disable)\b|$)/.exec(rest);
        if (m) { head = `<span class="t-p">${esc(m[1])}</span>`; rest = rest.slice(m[1].length); }
        const k = /^(\s+)(add|set|remove|print|move|enable|disable)\b/.exec(rest);
        if (k) { head += esc(k[1]) + `<span class="t-k">${k[2]}</span>`; rest = rest.slice(k[0].length); }
        return esc(lead) + head + hlRest(rest);
      }
      const w = /^(\S+)/.exec(rest)[1];
      const isNo = w === 'no';
      if (KW[vendor] ? KW[vendor].test(w) : true) {
        head = `<span class="${isNo ? 't-no' : 't-k'}">${esc(w)}</span>`;
        rest = rest.slice(w.length);
        if (vendor === 'fortigate' && w === 'set') {
          const a = /^(\s+)(\S+)/.exec(rest);
          if (a) { head += esc(a[1]) + `<span class="t-a">${esc(a[2])}</span>`; rest = rest.slice(a[0].length); }
        }
      }
      return esc(lead) + head + hlRest(rest);
    });
  };
  NC.esc = esc;
})();
