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
  // URS open item 9, decided by A.B., 8 October 2026: the tool's address is
  // https://benchtools.ligant.ai/master-mix/
  slug: 'master-mix',
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
  // The paragraph under the h1, as C7's. Approved by A.B., 8 October 2026
  // (Task 12); 262 characters, the length the Task 3 layout was measured with.
  tagline: 'The volume of each antibody and the diluent in a master mix, for the samples, overage, staining volume and cell number you declare. Every value is computed deterministically by arithmetic you can read. No model and no inference is applied to any reported number.',
});
