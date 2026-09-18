/* ==========================================================================
   NET // CONFIG — Static platform data
   Vendors, device classes, module catalog, template library, labs and
   the network command reference. Pure data: no DOM access here.
   ========================================================================== */
(function () {
  'use strict';
  const NC = (window.NC = window.NC || {});

  NC.VERSION = '1.0.0';

  /* ---------------------------------------------------------------------
     VENDORS
     ifaces: default interface names per device class and role. They are
     used to pre-fill forms so generated output matches real naming.
     --------------------------------------------------------------------- */
  NC.VENDORS = {
    cisco: {
      id: 'cisco', name: 'Cisco', platform: 'IOS / IOS-XE', label: 'Cisco IOS',
      mono: 'CS', accent: '#1ba0d7', comment: '!',
      devices: ['router', 'switch'],
      desc: 'Catalyst, ISR and ASR platforms running IOS or IOS-XE.',
      ifaces: {
        router: { wan: 'GigabitEthernet0/0', lan: 'GigabitEthernet0/1', mgmt: 'GigabitEthernet0/2', parent: 'GigabitEthernet0/1', access: 'GigabitEthernet0/1', trunk: 'GigabitEthernet0/1', lag: 'GigabitEthernet0/2-3', loop: 'Loopback0', ospf: 'GigabitEthernet0/1', passive: 'GigabitEthernet0/1' },
        switch: { wan: 'GigabitEthernet1/0/48', lan: 'Vlan10', mgmt: 'Vlan99', parent: 'Vlan10', access: 'GigabitEthernet1/0/1-24', trunk: 'GigabitEthernet1/0/48', lag: 'GigabitEthernet1/0/45-46', loop: 'Loopback0', ospf: 'Vlan10', passive: 'Vlan10' }
      }
    },
    mikrotik: {
      id: 'mikrotik', name: 'MikroTik', platform: 'RouterOS v7', label: 'MikroTik RouterOS',
      mono: 'MT', accent: '#e4403f', comment: '#',
      devices: ['router', 'switch', 'firewall', 'ap'],
      desc: 'RouterOS 7.x on hAP, CCR, CRS, RB and CHR platforms.',
      ifaces: {
        _all: { wan: 'ether1', lan: 'bridge1', mgmt: 'bridge1', parent: 'bridge1', access: 'ether2-7', trunk: 'ether8', lag: 'ether9-10', loop: 'loopback', ospf: 'ether2', passive: 'bridge1' }
      }
    },
    fortigate: {
      id: 'fortigate', name: 'FortiGate', platform: 'FortiOS 7.x', label: 'FortiGate',
      mono: 'FG', accent: '#ee3124', comment: '#',
      devices: ['firewall'],
      desc: 'FortiGate next-generation firewalls running FortiOS 7.x.',
      ifaces: {
        _all: { wan: 'port1', lan: 'port2', mgmt: 'mgmt', parent: 'port2', access: 'port2', trunk: 'port2', lag: 'port3-4', loop: 'loopback0', ospf: 'port2', passive: 'port2' }
      }
    },
    juniper: {
      id: 'juniper', name: 'Juniper', platform: 'Junos OS', label: 'Juniper Junos',
      mono: 'JN', accent: '#84b135', comment: '#',
      devices: ['router', 'switch', 'firewall'],
      desc: 'MX / ACX routers, EX switches (ELS) and SRX firewalls.',
      ifaces: {
        router: { wan: 'ge-0/0/0', lan: 'ge-0/0/1', mgmt: 'fxp0', parent: 'ge-0/0/1', access: 'ge-0/0/1', trunk: 'ge-0/0/1', lag: 'ge-0/0/2-3', loop: 'lo0.0', ospf: 'ge-0/0/1.0', passive: 'lo0.0' },
        switch: { wan: 'ge-0/0/47', lan: 'irb.10', mgmt: 'me0', parent: 'irb', access: 'ge-0/0/0-23', trunk: 'ge-0/0/47', lag: 'xe-0/2/0-1', loop: 'lo0.0', ospf: 'irb.10', passive: 'irb.10' },
        firewall: { wan: 'ge-0/0/0', lan: 'ge-0/0/1', mgmt: 'fxp0', parent: 'ge-0/0/1', access: 'ge-0/0/1', trunk: 'ge-0/0/1', lag: 'ge-0/0/2-3', loop: 'lo0.0', ospf: 'ge-0/0/1.0', passive: 'ge-0/0/1.0' }
      }
    },
    aruba: {
      id: 'aruba', name: 'Aruba', platform: 'AOS-CX 10.x', label: 'Aruba AOS-CX',
      mono: 'AR', accent: '#ff8300', comment: '!',
      devices: ['switch'],
      desc: 'HPE Aruba Networking CX 6000/6300/8000-series switches.',
      ifaces: {
        _all: { wan: '1/1/48', lan: 'vlan10', mgmt: 'mgmt', parent: 'vlan10', access: '1/1/1-24', trunk: '1/1/48', lag: '1/1/49-50', loop: 'loopback0', ospf: 'vlan10', passive: 'vlan10' }
      }
    }
  };
  NC.VENDOR_ORDER = ['cisco', 'mikrotik', 'fortigate', 'juniper', 'aruba'];

  NC.iface = function (vendor, device, role) {
    const v = NC.VENDORS[vendor];
    if (!v) return '';
    const set = v.ifaces[device] || v.ifaces._all || v.ifaces[Object.keys(v.ifaces)[0]];
    return (set && set[role]) || '';
  };

  /* ---------------------------------------------------------------------
     DEVICE CLASSES
     --------------------------------------------------------------------- */
  NC.DEVICES = {
    router:   { id: 'router',   name: 'Router',       icon: 'router',   desc: 'L3 routing, WAN edge, NAT & VPN' },
    switch:   { id: 'switch',   name: 'Switch',       icon: 'switch',   desc: 'L2/L3 access, distribution & core' },
    firewall: { id: 'firewall', name: 'Firewall',     icon: 'firewall', desc: 'Stateful security gateway & VPN' },
    ap:       { id: 'ap',       name: 'Access Point', icon: 'ap',       desc: 'Wireless edge with local services' }
  };
  NC.DEVICE_ORDER = ['router', 'switch', 'firewall', 'ap'];

  /* ---------------------------------------------------------------------
     MODULE CATALOG  (fields & validation live in js/generators.js)
     --------------------------------------------------------------------- */
  NC.CATEGORIES = [
    { id: 'basic',     name: 'Basic' },
    { id: 'switching', name: 'Switching' },
    { id: 'routing',   name: 'Routing' },
    { id: 'services',  name: 'Services' },
    { id: 'security',  name: 'Security' }
  ];

  NC.MODULES = {
    basic:    { id: 'basic',    name: 'Base System',        cat: 'basic',     icon: 'server',  desc: 'Hostname, management IP, DNS, NTP, SNMP, Syslog, banner', devices: ['router', 'switch', 'firewall', 'ap'] },
    vlan:     { id: 'vlan',     name: 'VLAN',               cat: 'switching', icon: 'layers',  desc: 'VLANs, SVI / sub-interfaces and per-VLAN DHCP', devices: ['router', 'switch', 'firewall', 'ap'] },
    ports:    { id: 'ports',    name: 'Access & Trunk',     cat: 'switching', icon: 'ports',   desc: 'Access ports, trunks, voice VLAN, port security', devices: ['switch'] },
    lacp:     { id: 'lacp',     name: 'LACP',               cat: 'switching', icon: 'link',    desc: '802.3ad link aggregation (Port-channel / bond / ae)', devices: ['switch', 'firewall'] },
    stp:      { id: 'stp',      name: 'Spanning Tree',      cat: 'switching', icon: 'tree',    desc: 'RSTP / MSTP mode, bridge priority, edge protection', devices: ['switch'] },
    l2sec:    { id: 'l2sec',    name: 'DHCP Snooping & DAI',cat: 'switching', icon: 'shield',  desc: 'DHCP snooping and Dynamic ARP Inspection', devices: ['switch'] },
    static:   { id: 'static',   name: 'Static Routes',      cat: 'routing',   icon: 'route',   desc: 'Static and default routes with distance & comments', devices: ['router', 'switch', 'firewall'] },
    ospf:     { id: 'ospf',     name: 'OSPF',               cat: 'routing',   icon: 'mesh',    desc: 'OSPFv2 process, areas, networks, passive interfaces', devices: ['router', 'switch', 'firewall'] },
    bgp:      { id: 'bgp',      name: 'BGP',                cat: 'routing',   icon: 'globe',   desc: 'eBGP / iBGP neighbor, advertised prefixes, outbound filter', devices: ['router', 'firewall'] },
    rip:      { id: 'rip',      name: 'RIP v2',             cat: 'routing',   icon: 'broadcast', desc: 'RIPv2 networks, passive interfaces, default origination', devices: ['router', 'firewall'] },
    dhcp:     { id: 'dhcp',     name: 'DHCP Server',        cat: 'services',  icon: 'dhcp',    desc: 'Address pool, gateway, DNS, lease time, domain', devices: ['router', 'switch', 'firewall', 'ap'] },
    nat:      { id: 'nat',      name: 'NAT',                cat: 'services',  icon: 'nat',     desc: 'Static, dynamic, PAT / masquerade, port forwarding', devices: ['router', 'firewall'] },
    acl:      { id: 'acl',      name: 'Access Control List',cat: 'security',  icon: 'list',    desc: 'Extended ACL / stateless filter with ordered rules', devices: ['router', 'switch', 'firewall'] },
    firewall: { id: 'firewall', name: 'Firewall Rules',     cat: 'security',  icon: 'firewall',desc: 'Stateful policy: chain, state, interface, logging', devices: ['router', 'firewall', 'ap'] },
    mgmt:     { id: 'mgmt',     name: 'SSH & Mgmt Access',  cat: 'security',  icon: 'terminal',desc: 'SSH hardening, management ACL, idle timeouts', devices: ['router', 'switch', 'firewall', 'ap'] },
    ipsec:    { id: 'ipsec',    name: 'IPsec Site-to-Site', cat: 'security',  icon: 'lock',    desc: 'IKEv1/IKEv2, proposals, PFS, protected networks', devices: ['router', 'firewall'] }
  };
  NC.MODULE_ORDER = ['basic', 'vlan', 'ports', 'lacp', 'stp', 'l2sec', 'static', 'ospf', 'bgp', 'rip', 'dhcp', 'nat', 'acl', 'firewall', 'mgmt', 'ipsec'];

  /* ---------------------------------------------------------------------
     TEMPLATE LIBRARY
     Each template is a multi-module build. `params` are merged over the
     module defaults, so only the relevant values are listed.
     --------------------------------------------------------------------- */
  NC.TEMPLATES = [
    {
      id: 'small-office', name: 'Small Office', vendor: 'cisco', device: 'router', difficulty: 'Beginner',
      desc: 'Single ISR edge router: base system, LAN DHCP, PAT to the internet and hardened SSH access.',
      modules: [
        { id: 'basic', params: { hostname: 'RTR-OFFICE-01', mgmtIface: 'GigabitEthernet0/1', mgmtIp: '192.168.10.1/24', mgmtGw: '' } },
        { id: 'dhcp', params: { poolName: 'OFFICE-LAN', iface: 'GigabitEthernet0/1', network: '192.168.10.0/24', gateway: '192.168.10.1', start: '192.168.10.100', end: '192.168.10.200', setIfaceIp: false } },
        { id: 'nat', params: { type: 'pat', insideNet: '192.168.10.0/24' } },
        { id: 'mgmt', params: { mgmtNet: '192.168.10.0/24' } }
      ]
    },
    {
      id: 'enterprise-vlan', name: 'Enterprise VLAN', vendor: 'cisco', device: 'switch', difficulty: 'Intermediate',
      desc: 'Layer-3 distribution switch with segmented user, voice, server and management VLANs.',
      modules: [
        { id: 'vlan', params: { rows: [
          { vlanId: '10', name: 'USERS', subnet: '10.10.10.0/24', gateway: '10.10.10.1', dhcp: true, start: '10.10.10.50', end: '10.10.10.250', dns: '10.10.0.53', description: 'Corporate users' },
          { vlanId: '20', name: 'VOICE', subnet: '10.10.20.0/24', gateway: '10.10.20.1', dhcp: true, start: '10.10.20.50', end: '10.10.20.250', dns: '10.10.0.53', description: 'IP telephony' },
          { vlanId: '30', name: 'SERVERS', subnet: '10.10.30.0/24', gateway: '10.10.30.1', dhcp: false, start: '', end: '', dns: '', description: 'Server farm' },
          { vlanId: '99', name: 'MGMT', subnet: '10.10.99.0/24', gateway: '10.10.99.1', dhcp: false, start: '', end: '', dns: '', description: 'Network management' }
        ] } },
        { id: 'ports', params: { accessVlan: '10', voiceVlan: '20', allowedVlans: '10,20,30,99', nativeVlan: '999' } },
        { id: 'stp', params: { mode: 'rstp', priority: '4096', vlans: '10,20,30,99' } }
      ]
    },
    {
      id: 'branch-office', name: 'Branch Office', vendor: 'fortigate', device: 'firewall', difficulty: 'Intermediate',
      desc: 'FortiGate branch: base system, user VLAN with DHCP and a route-based IPsec tunnel to HQ.',
      modules: [
        { id: 'basic', params: { hostname: 'FGT-BRANCH-01' } },
        { id: 'vlan', params: { parent: 'port2', rows: [
          { vlanId: '20', name: 'USERS', subnet: '192.168.20.0/24', gateway: '192.168.20.1', dhcp: true, start: '192.168.20.50', end: '192.168.20.200', dns: '1.1.1.1', description: 'Branch users' }
        ] } },
        { id: 'ipsec', params: { name: 'TO-HQ', localNet: '192.168.20.0/24', remoteNet: '10.10.0.0/16' } }
      ]
    },
    {
      id: 'router-on-a-stick', name: 'Router-on-a-Stick', vendor: 'cisco', device: 'router', difficulty: 'Beginner',
      desc: 'Inter-VLAN routing over a single 802.1Q trunk using dot1Q sub-interfaces and DHCP pools.',
      modules: [
        { id: 'vlan', params: { parent: 'GigabitEthernet0/1', rows: [
          { vlanId: '10', name: 'SALES', subnet: '192.168.10.0/24', gateway: '192.168.10.1', dhcp: true, start: '192.168.10.50', end: '192.168.10.200', dns: '1.1.1.1', description: 'Sales department' },
          { vlanId: '20', name: 'ENGINEERING', subnet: '192.168.20.0/24', gateway: '192.168.20.1', dhcp: true, start: '192.168.20.50', end: '192.168.20.200', dns: '1.1.1.1', description: 'Engineering' },
          { vlanId: '30', name: 'GUEST', subnet: '192.168.30.0/24', gateway: '192.168.30.1', dhcp: true, start: '192.168.30.50', end: '192.168.30.200', dns: '1.1.1.1', description: 'Guest Wi-Fi' }
        ] } }
      ]
    },
    {
      id: 'ospf-network', name: 'OSPF Network', vendor: 'juniper', device: 'router', difficulty: 'Intermediate',
      desc: 'Junos router joining OSPF area 0 with a loopback router-ID and passive edge interface.',
      modules: [
        { id: 'basic', params: { hostname: 'MX-CORE-01' } },
        { id: 'ospf', params: { routerId: '10.255.255.1', area: '0', ifaces: 'ge-0/0/0.0, ge-0/0/1.0', passive: 'lo0.0', networks: '' } }
      ]
    },
    {
      id: 'bgp-edge', name: 'BGP Edge Router', vendor: 'cisco', device: 'router', difficulty: 'Advanced',
      desc: 'Single-homed eBGP edge with Null0 anchor, outbound prefix-list and a default route.',
      modules: [
        { id: 'bgp', params: { localAsn: '65000', remoteAsn: '65001', neighbor: '203.0.113.1', networks: '198.51.100.0/24', description: 'ISP-A', updateSourceIf: '' } },
        { id: 'static', params: { rows: [], defaultRoute: true, defaultGw: '203.0.113.1', defaultIface: 'GigabitEthernet0/0' } }
      ]
    },
    {
      id: 'mikrotik-gateway', name: 'MikroTik Internet Gateway', vendor: 'mikrotik', device: 'router', difficulty: 'Beginner',
      desc: 'Home/SOHO RouterOS gateway: identity, DHCP on bridge, masquerade and a hardened input chain.',
      modules: [
        { id: 'basic', params: { hostname: 'MT-GW-01', mgmtIp: '192.168.88.1/24', mgmtGw: '', snmpEnable: false } },
        { id: 'dhcp', params: { poolName: 'LAN', iface: 'bridge1', network: '192.168.88.0/24', gateway: '192.168.88.1', start: '192.168.88.100', end: '192.168.88.254', setIfaceIp: false } },
        { id: 'nat', params: { type: 'pat', insideNet: '192.168.88.0/24', outsideIf: 'ether1' } },
        { id: 'firewall', params: {} }
      ]
    },
    {
      id: 'fortigate-firewall', name: 'FortiGate Firewall', vendor: 'fortigate', device: 'firewall', difficulty: 'Intermediate',
      desc: 'Address objects, services and ordered policies plus a published web server via VIP.',
      modules: [
        { id: 'firewall', params: {} },
        { id: 'nat', params: { type: 'portfwd', insideLocal: '192.168.10.20', outsideGlobal: '203.0.113.20', protocol: 'tcp', extPort: '443', intPort: '443' } }
      ]
    },
    {
      id: 'cisco-access-switch', name: 'Cisco Access Switch', vendor: 'cisco', device: 'switch', difficulty: 'Intermediate',
      desc: 'Hardened Catalyst access layer: port security, BPDU guard, DHCP snooping, DAI and SSH-only VTY.',
      modules: [
        { id: 'basic', params: { hostname: 'SW-ACC-01' } },
        { id: 'ports', params: {} },
        { id: 'l2sec', params: {} },
        { id: 'mgmt', params: {} }
      ]
    },
    {
      id: 'management-network', name: 'Management Network', vendor: 'aruba', device: 'switch', difficulty: 'Beginner',
      desc: 'Aruba CX out-of-band management: mgmt VRF services, management VLAN and control-plane ACL.',
      modules: [
        { id: 'basic', params: { hostname: 'CX-MGMT-01' } },
        { id: 'vlan', params: { rows: [
          { vlanId: '99', name: 'MGMT', subnet: '10.0.99.0/24', gateway: '10.0.99.1', dhcp: false, start: '', end: '', dns: '', description: 'In-band management' }
        ] } },
        { id: 'mgmt', params: {} }
      ]
    }
  ];

  /* ---------------------------------------------------------------------
     LABS — guided practice scenarios that launch into the generator
     --------------------------------------------------------------------- */
  NC.LABS = [
    { id: 'lab-vlan', title: 'Segment a flat network', level: 'Beginner', time: '15 min', template: 'enterprise-vlan',
      objective: 'Split a single broadcast domain into user, voice, server and management VLANs with gateways on a Layer-3 switch.',
      tasks: ['Create VLANs 10, 20, 30 and 99', 'Assign SVI gateways from the addressing plan', 'Enable DHCP for users and voice only', 'Verify with show vlan brief and show ip interface brief'] },
    { id: 'lab-roas', title: 'Router-on-a-Stick', level: 'Beginner', time: '10 min', template: 'router-on-a-stick',
      objective: 'Route between three VLANs using 802.1Q sub-interfaces on a single router uplink.',
      tasks: ['Create one dot1Q sub-interface per VLAN', 'Configure DHCP pools with excluded addresses', 'Configure the switch uplink as trunk', 'Ping between VLAN hosts'] },
    { id: 'lab-ospf', title: 'Bring up OSPF area 0', level: 'Intermediate', time: '20 min', template: 'ospf-network',
      objective: 'Establish OSPF adjacencies on a Junos router with a stable loopback router-ID.',
      tasks: ['Set router-id to the loopback address', 'Add transit interfaces to area 0.0.0.0', 'Mark lo0.0 passive', 'Verify with show ospf neighbor'] },
    { id: 'lab-bgp', title: 'Single-homed eBGP edge', level: 'Advanced', time: '25 min', template: 'bgp-edge',
      objective: 'Advertise your provider-independent prefix to an upstream while filtering everything else outbound.',
      tasks: ['Anchor the prefix to Null0', 'Build an outbound prefix-list', 'Peer with the ISP using MD5 authentication', 'Verify with show ip bgp summary'] },
    { id: 'lab-mt', title: 'Secure a RouterOS gateway', level: 'Beginner', time: '15 min', template: 'mikrotik-gateway',
      objective: 'Turn a default MikroTik into a secured internet gateway with DHCP, NAT and an input-chain policy.',
      tasks: ['Set identity and DNS', 'Create the DHCP pool and network', 'Masquerade LAN traffic out ether1', 'Drop unsolicited input from WAN'] },
    { id: 'lab-vpn', title: 'Branch-to-HQ IPsec', level: 'Advanced', time: '30 min', template: 'branch-office',
      objective: 'Connect a FortiGate branch to headquarters with a route-based IKEv2 tunnel.',
      tasks: ['Match proposals on both peers', 'Define protected subnets in phase 2', 'Route remote networks via the tunnel', 'Allow traffic with bidirectional policies'] }
  ];

  /* ---------------------------------------------------------------------
     COMMAND REFERENCE   [command, description, syntax, example, category]
     --------------------------------------------------------------------- */
  const cmd = (platform) => (row) => ({ platform, cmd: row[0], desc: row[1], syntax: row[2], example: row[3], cat: row[4] });

  NC.COMMANDS = [].concat(
    [
      ['show running-config', 'Display the active configuration held in RAM.', 'show running-config [interface <if> | section <regex>]', 'show running-config | section router ospf', 'Configuration'],
      ['show ip interface brief', 'One-line status and IP address summary of every interface.', 'show ip interface brief [| exclude unassigned]', 'show ip interface brief | exclude unassigned', 'Interfaces'],
      ['show interfaces', 'Detailed counters, errors, duplex, speed and MTU for interfaces.', 'show interfaces [<if>] [status | counters errors]', 'show interfaces GigabitEthernet0/1', 'Interfaces'],
      ['show interfaces status', 'Port status, VLAN, duplex and speed on switches.', 'show interfaces status [err-disabled]', 'show interfaces status err-disabled', 'Interfaces'],
      ['show vlan brief', 'VLAN database with assigned access ports.', 'show vlan brief', 'show vlan brief', 'Switching'],
      ['show interfaces trunk', 'Trunk ports, native VLAN and allowed / forwarding VLANs.', 'show interfaces trunk', 'show interfaces trunk', 'Switching'],
      ['show spanning-tree', 'STP role, state and cost per VLAN and port.', 'show spanning-tree [vlan <id> | summary | root]', 'show spanning-tree vlan 10', 'Switching'],
      ['show etherchannel summary', 'Port-channel bundles and member flags (P = bundled).', 'show etherchannel summary', 'show etherchannel summary', 'Switching'],
      ['show mac address-table', 'Learned MAC addresses per VLAN and port.', 'show mac address-table [address <mac> | interface <if> | vlan <id>]', 'show mac address-table interface Gi1/0/5', 'Switching'],
      ['show ip route', 'IPv4 routing table (RIB) with sources and next hops.', 'show ip route [<prefix>] [static | ospf | bgp | connected]', 'show ip route 10.20.0.0', 'Routing'],
      ['show ip ospf neighbor', 'OSPF adjacencies and their state.', 'show ip ospf neighbor [detail]', 'show ip ospf neighbor', 'Routing'],
      ['show ip bgp summary', 'BGP neighbors, state and prefixes received.', 'show ip bgp summary', 'show ip bgp summary', 'Routing'],
      ['show ip dhcp binding', 'Addresses leased by the IOS DHCP server.', 'show ip dhcp binding [<ip>]', 'show ip dhcp binding', 'Services'],
      ['show ip nat translations', 'Active NAT / PAT translation table.', 'show ip nat translations [verbose]', 'show ip nat translations', 'Services'],
      ['show access-lists', 'ACL entries with hit counters.', 'show access-lists [<name>]', 'show access-lists WEB-ACCESS', 'Security'],
      ['show crypto ipsec sa', 'IPsec security associations and encrypted/decrypted packet counters.', 'show crypto ipsec sa [peer <ip>]', 'show crypto ipsec sa peer 203.0.113.2', 'Security'],
      ['ping', 'ICMP reachability test, optionally sourced from an interface.', 'ping <ip> [source <if>] [repeat <n>] [size <bytes>] [df-bit]', 'ping 10.0.0.1 source Loopback0 repeat 100', 'Troubleshooting'],
      ['traceroute', 'Hop-by-hop path discovery.', 'traceroute <ip> [source <if>] [numeric]', 'traceroute 8.8.8.8 numeric', 'Troubleshooting'],
      ['copy running-config startup-config', 'Persist the running configuration to NVRAM.', 'copy running-config startup-config', 'copy running-config startup-config', 'Configuration']
    ].map(cmd('Cisco')),
    [
      ['/interface print', 'List interfaces with type, MTU and running state.', '/interface print [detail] [where <expr>]', '/interface print where running', 'Interfaces'],
      ['/ip address print', 'IPv4 addresses assigned to interfaces.', '/ip address print [where interface=<if>]', '/ip address print where interface=bridge1', 'Interfaces'],
      ['/ip route print', 'Routing table (FIB) with gateways and distances.', '/ip route print [where <expr>]', '/ip route print where dst-address=0.0.0.0/0', 'Routing'],
      ['/interface bridge vlan print', 'Bridge VLAN table: tagged / untagged membership.', '/interface bridge vlan print', '/interface bridge vlan print', 'Switching'],
      ['/interface bridge host print', 'MAC addresses learned by the bridge.', '/interface bridge host print [where interface=<if>]', '/interface bridge host print where interface=ether2', 'Switching'],
      ['/ip firewall filter print', 'Filter rules with packet/byte counters.', '/ip firewall filter print [stats] [where chain=<chain>]', '/ip firewall filter print stats where chain=input', 'Security'],
      ['/ip firewall nat print', 'NAT rules (srcnat / dstnat).', '/ip firewall nat print [stats]', '/ip firewall nat print stats', 'Services'],
      ['/ip dhcp-server lease print', 'DHCP leases handed out by the router.', '/ip dhcp-server lease print [where server=<name>]', '/ip dhcp-server lease print where server=dhcp-LAN', 'Services'],
      ['/routing ospf neighbor print', 'OSPF neighbors and adjacency state (v7).', '/routing ospf neighbor print', '/routing ospf neighbor print', 'Routing'],
      ['/routing bgp session print', 'BGP sessions and their state (v7).', '/routing bgp session print', '/routing bgp session print', 'Routing'],
      ['/ip ipsec active-peers print', 'Established IKE peers.', '/ip ipsec active-peers print', '/ip ipsec active-peers print', 'Security'],
      ['/ping', 'ICMP reachability test.', '/ping <address> [count=<n>] [src-address=<ip>] [interface=<if>]', '/ping 1.1.1.1 count=5 src-address=192.168.88.1', 'Troubleshooting'],
      ['/tool traceroute', 'Trace the path to a destination.', '/tool traceroute <address> [src-address=<ip>]', '/tool traceroute 8.8.8.8', 'Troubleshooting'],
      ['/tool torch', 'Real-time traffic monitor per interface / flow.', '/tool torch interface=<if> [src-address=<ip>]', '/tool torch interface=ether1', 'Troubleshooting'],
      ['/export', 'Print the configuration as a script (sensitive values hidden by default in v7).', '/export [compact | verbose] [file=<name>] [show-sensitive]', '/export file=before-change', 'Configuration'],
      ['/system backup save', 'Create a binary backup of the device.', '/system backup save name=<name> [password=<secret>]', '/system backup save name=pre-change', 'Configuration'],
      ['/log print', 'System log buffer.', '/log print [where topics~"<topic>"]', '/log print where topics~"error"', 'Troubleshooting'],
      ['/system resource print', 'CPU, memory, uptime and RouterOS version.', '/system resource print', '/system resource print', 'System']
    ].map(cmd('MikroTik')),
    [
      ['ip -br addr', 'Brief view of interfaces and addresses (iproute2).', 'ip [-4|-6] -br addr [show dev <if>]', 'ip -br addr show dev eth0', 'Interfaces'],
      ['ip route', 'Show / manipulate the routing table.', 'ip route [show | get <ip> | add <prefix> via <gw>]', 'ip route get 8.8.8.8', 'Routing'],
      ['ip neigh', 'ARP / NDP neighbor cache.', 'ip neigh [show dev <if> | flush dev <if>]', 'ip neigh show dev eth0', 'Interfaces'],
      ['ping', 'ICMP echo test.', 'ping [-c count] [-I iface] [-s size] [-M do] <host>', 'ping -c 4 -M do -s 1472 10.0.0.1', 'Troubleshooting'],
      ['traceroute', 'Path discovery using UDP (default), ICMP or TCP probes.', 'traceroute [-n] [-I | -T -p port] <host>', 'traceroute -n -T -p 443 example.com', 'Troubleshooting'],
      ['mtr', 'Continuous traceroute with per-hop loss and latency.', 'mtr [-rw] [-c count] <host>', 'mtr -rw -c 100 1.1.1.1', 'Troubleshooting'],
      ['ss', 'Socket statistics: listening ports and connections.', 'ss [-tulpn] [state <state>]', 'ss -tulpn', 'Troubleshooting'],
      ['dig', 'DNS lookup with full answer details.', 'dig [@server] <name> [type] [+short]', 'dig @1.1.1.1 example.com A +short', 'DNS'],
      ['tcpdump', 'Packet capture on an interface with BPF filters.', 'tcpdump -ni <if> [-w file.pcap] <filter>', 'tcpdump -ni eth0 port 53', 'Troubleshooting'],
      ['ethtool', 'NIC link settings, speed, duplex and driver stats.', 'ethtool [-S] <if>', 'ethtool eth0', 'Interfaces'],
      ['nmcli', 'NetworkManager CLI for connections and devices.', 'nmcli [dev status | con show | con up <name>]', 'nmcli dev status', 'Interfaces'],
      ['iperf3', 'Throughput testing between two hosts.', 'iperf3 -c <server> [-t sec] [-P streams] [-R]', 'iperf3 -c 10.0.0.20 -t 30 -P 4', 'Troubleshooting'],
      ['curl -I', 'Fetch HTTP response headers only.', 'curl -I [-k] <url>', 'curl -I https://example.com', 'Troubleshooting']
    ].map(cmd('Linux')),
    [
      ['ipconfig /all', 'Full adapter configuration: IP, DNS, DHCP, MAC.', 'ipconfig /all', 'ipconfig /all', 'Interfaces'],
      ['ipconfig /flushdns', 'Clear the local DNS resolver cache.', 'ipconfig /flushdns', 'ipconfig /flushdns', 'DNS'],
      ['ipconfig /release /renew', 'Release and renew a DHCP lease.', 'ipconfig /release [adapter] & ipconfig /renew [adapter]', 'ipconfig /release && ipconfig /renew', 'Interfaces'],
      ['ping', 'ICMP echo test.', 'ping [-n count] [-t] [-l size] [-f] <host>', 'ping -n 4 -l 1472 -f 10.0.0.1', 'Troubleshooting'],
      ['tracert', 'Trace route to a host.', 'tracert [-d] [-h max_hops] <host>', 'tracert -d 8.8.8.8', 'Troubleshooting'],
      ['pathping', 'Traceroute plus per-hop loss statistics.', 'pathping [-n] <host>', 'pathping -n 1.1.1.1', 'Troubleshooting'],
      ['nslookup', 'Query DNS servers interactively or once.', 'nslookup <name> [server]', 'nslookup example.com 1.1.1.1', 'DNS'],
      ['netstat -ano', 'Connections and listening ports with owning PID.', 'netstat -ano [| findstr <port>]', 'netstat -ano | findstr :443', 'Troubleshooting'],
      ['route print', 'Display the IPv4/IPv6 routing table.', 'route print [-4 | -6]', 'route print -4', 'Routing'],
      ['arp -a', 'ARP cache entries per interface.', 'arp -a [-N <if-ip>]', 'arp -a', 'Interfaces'],
      ['Test-NetConnection', 'PowerShell TCP port and ICMP reachability test.', 'Test-NetConnection -ComputerName <host> [-Port <n>] [-TraceRoute]', 'Test-NetConnection -ComputerName 10.0.0.10 -Port 443', 'Troubleshooting'],
      ['Get-NetIPConfiguration', 'PowerShell summary of IP configuration per adapter.', 'Get-NetIPConfiguration [-Detailed]', 'Get-NetIPConfiguration -Detailed', 'Interfaces'],
      ['Resolve-DnsName', 'PowerShell DNS resolver with record types.', 'Resolve-DnsName <name> [-Type <type>] [-Server <ip>]', 'Resolve-DnsName example.com -Type MX', 'DNS']
    ].map(cmd('Windows')),
    [
      ['get system status', 'Firmware version, serial, HA and operation mode.', 'get system status', 'get system status', 'System'],
      ['get system interface physical', 'Physical port link state, speed and duplex.', 'get system interface physical [<port>]', 'get system interface physical port1', 'Interfaces'],
      ['show system interface', 'Configured interface settings.', 'show system interface [<name>]', 'show system interface port2', 'Interfaces'],
      ['get router info routing-table all', 'Full routing table (RIB).', 'get router info routing-table [all | details <ip> | database]', 'get router info routing-table details 10.20.0.1', 'Routing'],
      ['get router info ospf neighbor', 'OSPF neighbor state.', 'get router info ospf neighbor [all]', 'get router info ospf neighbor', 'Routing'],
      ['get router info bgp summary', 'BGP neighbors and prefix counts.', 'get router info bgp summary', 'get router info bgp summary', 'Routing'],
      ['show firewall policy', 'Configured firewall policies.', 'show firewall policy [<id>]', 'show firewall policy 5', 'Security'],
      ['diagnose sniffer packet', 'Built-in packet capture.', "diagnose sniffer packet <if|any> '<filter>' <verbosity 1-6> [count] [a]", "diagnose sniffer packet any 'host 10.0.0.1 and icmp' 4 20 a", 'Troubleshooting'],
      ['diagnose debug flow', 'Trace a flow through policy, NAT and routing decisions.', 'diagnose debug flow filter addr <ip> ; diagnose debug flow trace start <n> ; diagnose debug enable', 'diagnose debug flow filter addr 10.0.0.1\ndiagnose debug flow trace start 20\ndiagnose debug enable', 'Troubleshooting'],
      ['diagnose vpn tunnel list', 'Detailed IPsec tunnel SAs and counters.', 'diagnose vpn tunnel list [name <phase1>]', 'diagnose vpn tunnel list name TO-HQ', 'Security'],
      ['get vpn ipsec tunnel summary', 'Up/down summary of IPsec tunnels.', 'get vpn ipsec tunnel summary', 'get vpn ipsec tunnel summary', 'Security'],
      ['execute ping', 'ICMP test, source set with ping-options.', 'execute ping-options source <ip> ; execute ping <host>', 'execute ping-options source 192.168.20.1\nexecute ping 10.10.0.10', 'Troubleshooting'],
      ['execute traceroute', 'Trace the path to a destination.', 'execute traceroute <host>', 'execute traceroute 8.8.8.8', 'Troubleshooting'],
      ['get system performance status', 'CPU, memory, sessions and network throughput.', 'get system performance status', 'get system performance status', 'System']
    ].map(cmd('FortiGate'))
  );
  NC.COMMAND_PLATFORMS = ['Cisco', 'MikroTik', 'Linux', 'Windows', 'FortiGate'];
})();
