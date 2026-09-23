import { test as base } from 'playwright/test'

export const mapTiles = /^https:\/\/(?:[^/]+\.)?tile\.openstreetmap\.org\//

// Exercise the real Leaflet map without depending on, or loading, public OSM
// tiles in automated tests. All application/API/database requests remain real.
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(mapTiles, route => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e2e8f0"/><path d="M0 128H256M128 0V256" stroke="#fff" stroke-width="12"/><text x="10" y="25" font-size="12" fill="#64748b">Test map tile</text></svg>',
    }))
    await use(context)
  },
})
export { expect, type Page, type APIRequestContext } from 'playwright/test'
