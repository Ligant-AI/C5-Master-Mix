/**
 * Path-based router for benchtools.ligant.ai/master-mix/*.
 *
 * The Master Mix tool is deployed as its own Cloudflare Pages project
 * (ligant-master-mix), separate from the ADC's own project
 * (ligant-tools), which owns the benchtools.ligant.ai custom domain directly.
 * This Worker is bound to a route matching only the /master-mix path
 * on that same zone, so it intercepts just those requests; everything else on
 * the domain falls through to the ADC's Pages project untouched.
 *
 * The Master Mix tool's own build uses relative asset paths (base: './'),
 * so it does not matter to the browser that it is served from a sub-path
 * instead of a domain root: what matters here is that this Worker strips the
 * /master-mix prefix before forwarding, since the upstream Pages
 * project serves the same files at its own root.
 */

const UPSTREAM_HOST = 'ligant-master-mix.pages.dev'
const PREFIX = '/master-mix'

export default {
  async fetch(request) {
    const url = new URL(request.url)

    // No trailing slash: relative asset paths in index.html would resolve
    // against the wrong directory, so this is a redirect, not a proxy.
    if (url.pathname === PREFIX) {
      return Response.redirect(`${url.origin}${PREFIX}/${url.search}`, 301)
    }

    if (!url.pathname.startsWith(`${PREFIX}/`)) {
      return fetch(request)
    }

    const upstream = new URL(request.url)
    upstream.hostname = UPSTREAM_HOST
    upstream.pathname = url.pathname.slice(PREFIX.length) || '/'

    // The Host header is dropped rather than copied, so fetch() sets the one
    // the upstream Pages project actually expects for its own domain.
    const headers = new Headers(request.headers)
    headers.delete('host')

    return fetch(
      new Request(upstream, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'follow',
        // The upstream's own headers (e.g. Content-Type on /LICENSE) govern
        // caching, not a second layer here: a proxy that caches independently
        // of the origin can keep serving what the origin said before its last
        // deploy, which is exactly the kind of staleness this route exists to
        // avoid introducing.
        cf: { cacheTtl: 0, cacheEverything: false },
      }),
    )
  },
}
