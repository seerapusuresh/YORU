# YORU — Cyber Threat Radar

YORU is a personal cyber-threat awareness dashboard. It combines reported incident headlines with CISA's Known Exploited Vulnerabilities (KEV) catalog and lets you compare advisories with products you choose to track.

## Run on Windows

Install Node.js 20 or newer, then double-click `Start-YORU.bat`. It opens `http://127.0.0.1:4180`. Keep the small server window open while using the app. Or run `npm start` from this folder.

## What it does

- Recent reporting aggregated from BleepingComputer, The Hacker News, SecurityWeek, Dark Reading, Krebs on Security, Cyber Security News, and CISA's cybersecurity advisory and alert feeds, with links to original reporting.
- CISA KEV entries, including affected product, CVE, date added, and remediation guidance where provided.
- Search/filter and a saved device profile. Matching is based on product/vendor names you enter and catalog text; it is a relevance hint, **not a device scan or proof of compromise**.
- Attack stories show what the source reports. Exact dwell/run time, financial losses, and impact are marked “Not reported” when sources do not provide them; YORU does not invent figures.
- Each item links to its source and shows publication/added date. Feeds update on refresh and are cached briefly.

## Data sources and limitations

- CISA Known Exploited Vulnerabilities catalog: <https://www.cisa.gov/known-exploited-vulnerabilities-catalog>
- Incident reporting feeds: BleepingComputer, The Hacker News, SecurityWeek, Dark Reading, Krebs on Security, Cyber Security News.
- Official CISA cybersecurity advisories: <https://www.cisa.gov/cybersecurity-advisories/cybersecurity-advisories.xml>
- Official CISA alerts: <https://www.cisa.gov/cybersecurity-advisories/alerts.xml>

Coverage is not exhaustive or real-time guaranteed. “Recent attacks” means incidents reported by the selected publishers, not a complete global incident registry. Publisher feeds may include vulnerability coverage and research as well as incidents. A local product match cannot establish whether your specific device is vulnerable: exact product version, configuration, patch level, and vendor advisories matter. YORU does not inspect files, network traffic, or installed software and does not replace security tools or professional advice. Source feeds can be unavailable or delayed.

## Privacy

The app runs locally. Your tracked-product profile is saved in this browser only. The local server fetches public source feeds; no account is needed. Feed providers see ordinary requests from your network. Do not enter personal or confidential information in the tracked-product list.

## Development

No external packages are required. Run `npm test` for the feed parsing tests.
