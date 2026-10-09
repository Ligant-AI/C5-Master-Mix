// The standing privacy statement: the suite's standard statement, byte-for-byte
// the footer's (@ligant/bench-chrome). PENDING URS v1.0.1: URS v1.0 §14.1 is to
// be replaced by the statement the live suite shows (question Q3). Do not reword
// it here.
//
// Source record:
//   package      @ligant/bench-chrome 1.3.0 (vendor/ligant-bench-chrome-1.3.0.tgz,
//                sha256 22b4445cd4b2d18bbd69b509dc0cf14354aabf24af0f626d95d200d76b7496b9)
//   path         src/index.js, export PRIVACY_STATEMENT, which is what the live
//                footer renders. 1.3.0 adds the newsletter signup to the footer,
//                and the statement now says the signup is separate.
//   sha256       f23eb418125de4b8de5bd02d6e7484d09a83f2f1da39ef851d8fb64525fe2cda
//                (UTF-8 bytes of the string, 653 bytes)
//   previously   C7's text at Ligant-AI/C7-Reconstitution 9b942e3 (src/ui/privacy.js),
//                identical to bench-chrome 1.1.0, sha256 f50160c4b6de3aa1756b487d20d071d78282b37098f731b9492c3686cbc40334.
//                C7 carries the 1.3.0 text once its own 1.3.0 update is merged.
// tests/privacy-statement.test.js re-hashes the string and compares it with the
// footer's copy in the vendored frame.
export const PRIVACY_DATE = '9 October 2026';
export const PRIVACY_STATEMENT = 'Everything you enter into this calculator stays on your computer. Calculations run entirely in your browser, and your inputs are never transmitted, stored, or logged. The newsletter signup above is separate: only an email address you choose to submit there is sent to us. We use Cloudflare Web Analytics to count visits and measure how quickly this page loads, so we can see which tools are used and improve them. It sets no cookie, does not identify you, and never reads what you type. If you allow it in the banner, we also use Google Analytics, which sets cookies and records which pages you visit; it never receives anything you type into this tool.';

// The scope statement C7's frame passes to the footer as its disclaimer
// (C7-OUT-06), copied unchanged from the same file and commit. Whether C5-OUT-05
// states it in these words is a Task 2 question: the signed URS is not in docs/.
export const SCOPE_STATEMENT = 'Ligant Bench Tools are free and open source. Research use only, not qualified for GxP decision-making.';
