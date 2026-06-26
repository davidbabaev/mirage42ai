# Mirage42 — Backlog

Everything we might work on. Add freely. I pull from here into today.md.
Mark items [done] when finished so they drop out of the active list.

## Active

### Fix broken flag images in admin dashboard
- What: Country flags show as broken-image placeholders in the Users by Country panel and Users Management table.
- Type: visual
- Reference: docs/autopilot/refs/broken-flags.png
- Notes: approved fix is a bundled SVG flag set with a CountryFlag component keyed to ISO codes.

### Infrastructure hardening (deployment task — do with Render staging/production)
- What: Add network-level protection at the host: firewall rules, DDoS/WAF protection (e.g. Cloudflare in front), restrict inbound to required ports, lock down Atlas network access to known IPs.
- Type: infrastructure (not a code task — done at deploy time, verified in the host dashboards)
- Reference: none
- Notes: app-level defenses (rate limiting, validation, helmet headers, XSS/CSRF) live in CLAUDE.md standards; THIS item is the network/infra layer that sits outside the app code.

## Done

(finished items move here, newest on top)
