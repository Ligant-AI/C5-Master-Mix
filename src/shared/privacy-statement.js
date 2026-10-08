// The standing privacy statement, copied byte-for-byte from C7 (CLAUDE.md
// Task 2, step 4). PENDING URS v1.0.1: URS v1.0 §14.1 is to be replaced by the
// statement live C7 shows (question Q3). Until v1.0.1 is signed this is C7's
// text exactly. Do not reword it here.
//
// Source record:
//   repository   github.com/Ligant-AI/C7-Reconstitution
//   commit       9b942e36ba2c53918b40871e18cbd053fd09d2d7 (working tree clean)
//   path         src/ui/privacy.js, export PRIVACY_STATEMENT
//   identical to @ligant/bench-chrome 1.1.0 src/index.js, export
//                PRIVACY_STATEMENT, which is what the live footer renders
//   sha256       f50160c4b6de3aa1756b487d20d071d78282b37098f731b9492c3686cbc40334
//                (UTF-8 bytes of the string, 542 bytes)
// tests/privacy-statement.test.js re-hashes the string and compares it with the
// footer's copy in the vendored frame.
export const PRIVACY_DATE = '29 September 2026';
export const PRIVACY_STATEMENT = 'Everything you enter into this tool stays on your computer. Calculations run entirely in your browser, and your inputs are never transmitted, stored, or logged. We use Cloudflare Web Analytics to count visits and measure how quickly this page loads, so we can see which tools are used and improve them. It sets no cookie, does not identify you, and never reads what you type. If you allow it in the banner, we also use Google Analytics, which sets cookies and records which pages you visit; it never receives anything you type into this tool.';

// The scope statement C7's frame passes to the footer as its disclaimer
// (C7-OUT-06), copied unchanged from the same file and commit. Whether C5-OUT-05
// states it in these words is a Task 2 question: the signed URS is not in docs/.
export const SCOPE_STATEMENT = 'Ligant Bench Tools are free and open source. Research use only, not qualified for GxP decision-making.';
