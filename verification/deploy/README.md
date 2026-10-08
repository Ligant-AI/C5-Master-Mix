# Deployment, 8 October 2026

- Address: https://benchtools.ligant.ai/master-mix/ (the slash-less path redirects, 301).
- Cloudflare account: Ligant.ai. Pages project `ligant-master-mix` (https://ligant-master-mix.pages.dev), deployed from `npm run build` (`dist/`) with `wrangler pages deploy`; created as a classic Pages project, like the sibling tools.
- Router: `deploy/router` (C7's, with the names and prefix changed), Worker `ligant-master-mix-router` on the routes `benchtools.ligant.ai/master-mix` and `benchtools.ligant.ai/master-mix/*`. Everything else on the domain falls through untouched (the sibling tools were checked: all 200).
- Live checks: `live-form.txt` (10 of 10 pass, including the network sentinel and storage), `live-outputs.txt` (11 of 12: C5-FX-23 failed only while the suite's consent banner covered the bottom of the viewport), `live-outputs-sixty-declined.txt` (C5-FX-23 passes with the banner declined first, as a visitor does).

To redeploy: `npm run build`, then `CLOUDFLARE_ACCOUNT_ID=4833971475b892ddf97f801707137766 npx wrangler pages deploy dist --project-name ligant-master-mix --branch main`. The router changes only if the path does.
