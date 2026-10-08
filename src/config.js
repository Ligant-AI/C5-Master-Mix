// Page-level configuration. Single strings, sourced here and nowhere else.
// The chrome (header, tool navigation, footer) is standard across Ligant Bench
// Tools; see src/ui/chrome.js. Anything here that differs between tools is the
// only thing a sibling tool changes.
import { ENGINE_VERSION, TOOL_ID, TOOL_NAME } from './engine/version.js';

export const CONFIG = Object.freeze({
  toolTitle: TOOL_NAME,
  toolId: TOOL_ID,
  productLine: 'Ligant Bench Tools',
  publisher: 'Ligant',
  legalEntity: 'Ligant AI Incorporated',
  version: ENGINE_VERSION, // moves with the engine
  // URS open item 9: the public slug is not decided, so no address is stated and
  // nothing here is citable until it is.
  slug: null,
  publicBase: 'https://benchtools.ligant.ai/',
  repositoryUrl: 'https://github.com/Ligant-AI/C5-Master-Mix',
  repositoryLabel: 'github.com/Ligant-AI/C5-Master-Mix',
  // The footer's Privacy Policy link: the one standard statement across the suite.
  privacyUrl: 'https://ligant.ai/privacy',
  contactEmail: 'hello@ligant.ai',
  address: ['3675 Market Street', 'Suite 200', 'Philadelphia PA 19104'],
  doi: null,
  citationAuthor: 'Modi, A.B.',
  citationYear: '2026',
  // The header's tagline and standfirst are product text, and none has been given
  // for C5. Left empty rather than written here.
  tagline: '',
});
