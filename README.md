<img width="1481" height="875" alt="Screenshot 2026-09-18 115421" src="https://github.com/user-attachments/assets/fd6b008b-ba69-46e5-b045-711ae74848ac" />
<img width="1456" height="883" alt="Screenshot 2026-09-18 115413" src="https://github.com/user-attachments/assets/5cea0bca-d907-4532-a91b-02d7e6da44cd" />
<img width="1449" height="879" alt="Screenshot 2026-09-18 115403" src="https://github.com/user-attachments/assets/6f8ae630-f27b-4f20-b344-1598e1be195c" />
<img width="1446" height="870" alt="Screenshot 2026-09-18 115354" src="https://github.com/user-attachments/assets/307acdd2-7ba9-4dd3-951a-12972ae46dc0" />
<img width="1144" height="877" alt="Screenshot 2026-09-18 115341" src="https://github.com/user-attachments/assets/d2afff27-4249-4879-9fb1-b8f57a23f341" />




NET // CONFIG

Network Configuration Generator for Network Engineers

Generate clean, vendor-specific network configurations for Cisco, MikroTik, FortiGate, Juniper and Aruba from simple forms, directly in your browser.

⚠️ Demo / early version (v1.0.0) NET // CONFIG is currently a demo project and still in active development. The generated configurations are based on each vendor's documented syntax, but they have not yet been tested on real devices. Commands can differ between firmware versions. Always review and test generated configurations in a lab before deploying them to production.

🔗 Repository: https://github.com/bardhyx/NETCONFIG

🚀 Getting Started (no installation needed)

You don't need to install anything: no frameworks, no dependencies, no server.

Option 1: Download ZIP (easiest)
Open the repository: https://github.com/bardhyx/NETCONFIG
Click the green Code button, then Download ZIP
Extract the ZIP file (right-click → Extract All)
Open the extracted folder and double-click index.html

The app opens in your browser and is ready to use.

Option 2: Git clone
bash
git clone https://github.com/bardhyx/NETCONFIG.git
cd NETCONFIG

Then open index.html in your browser.

Optional: run with a local server

Running on localhost enables the modern clipboard API (Copy button):

bash
python -m http.server 8080

Then open http://localhost:8080 in your browser.

🔧 Supported Vendors
Vendor	Platform	Devices
Cisco	IOS / IOS-XE	Router, Switch
MikroTik	RouterOS v7	Router, Switch, Firewall, Access Point
FortiGate	FortiOS 7.x	Firewall
Juniper	Junos OS	Router (MX), Switch (EX), Firewall (SRX)
Aruba	AOS-CX 10.x	Switch

If a feature cannot be expressed correctly on a platform, the app shows "Template not available for this platform" instead of generating incorrect syntax.

✨ Features

Configuration modules

Basic: hostname, management IP, DNS, NTP, SNMP, Syslog, login banner
Switching: VLAN, access & trunk ports, voice VLAN, port security, LACP, Spanning Tree, DHCP Snooping & Dynamic ARP Inspection
Routing: static & default routes, OSPF, BGP, RIP
Services: DHCP server, NAT (static, dynamic, PAT/masquerade, port forwarding)
Security: ACL, firewall rules, SSH & management access hardening, IPsec site-to-site VPN

Validation before generation

IP addresses, CIDR prefixes and network addresses
Gateways inside the correct subnet and outside the DHCP pool
VLAN IDs (1–4094), duplicate VLANs and overlapping subnets
ASN ranges, ports and protocol/port combinations
Clear error messages, e.g. "Gateway 192.168.30.1 does not belong to subnet 192.168.20.0/24."

Tools

Configuration wizard: Vendor → Device → Configuration → Parameters
Multi-module builds (e.g. Base System + VLAN + DHCP in one output)
Output editor with syntax highlighting, line numbers, copy, download (.txt), print and fullscreen
SVG topology preview for every module
Template library (Small Office, Router-on-a-Stick, BGP Edge Router, Cisco Access Switch and more)
Network calculator: IPv4/subnet, VLSM, CIDR/mask, binary, IPv6, MAC
Command reference for Cisco, MikroTik, Linux, Windows and FortiGate
Configuration history (saved in your browser's LocalStorage)
Dark / light mode, keyboard shortcuts and responsive design

⌨️ Keyboard Shortcuts
Shortcut	Action
Ctrl + K	Search
Ctrl + Enter	Generate configuration
Ctrl + S	Save configuration to history
Ctrl + Shift + C	Copy configuration
Esc	Close modal / search / fullscreen

🔒 Security
The app only generates text. It never connects to devices, never logs in and never executes commands.
No passwords are collected. Secrets (SNMP community, BGP MD5 key, IPsec PSK) stay in memory only and are replaced with <REPLACE-WITH-…> placeholders in history and exports.
Everything runs locally in your browser. No data is sent anywhere.
Demo values use private (RFC 1918) and documentation (RFC 5737) IP ranges and private ASNs.

📁 Project Structure
text
index.html          App shell and layout
css/style.css       Styles (dark/light theme, responsive)
js/validators.js    IP / subnet / IPv6 / MAC math and validation
js/templates.js     Vendor syntax generators (Cisco, MikroTik, FortiGate, Juniper, Aruba)
js/generators.js    Form schemas, validation engine, topology, syntax highlighting
js/app.js           User interface, history, calculator, shortcuts
data/vendors.js     Vendors, modules, templates, labs, command reference

Built with HTML, CSS and vanilla JavaScript: no frameworks, no build step.

🗺️ Roadmap
Testing generated configurations on real devices and lab environments (GNS3 / EVE-NG / CML)
More vendors and modules
Export / import of saved configurations
Optional backend / API

🤝 Contributing

Feedback, bug reports and suggestions are welcome. Open an Issue or send a Pull Request. If you test a configuration on a real device and find a difference, please report it; it helps make the tool more accurate.

If you find this project useful, please give it a ⭐ on GitHub!

📄 License

This project is licensed under the MIT License. See the LICENSE file for details.
© 2026 Bardhyl
