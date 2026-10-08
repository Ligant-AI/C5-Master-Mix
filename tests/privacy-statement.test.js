// The privacy text is C7's byte-for-byte (CLAUDE.md Task 2, step 4; question Q3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PRIVACY_STATEMENT } from '../src/shared/privacy-statement.js';
import { PRIVACY_STATEMENT as FOOTER_STATEMENT } from '@ligant/bench-chrome';

const RECORDED = 'f50160c4b6de3aa1756b487d20d071d78282b37098f731b9492c3686cbc40334';

test('the privacy statement matches its recorded SHA-256', () => {
  assert.equal(createHash('sha256').update(PRIVACY_STATEMENT, 'utf8').digest('hex'), RECORDED);
});

test('the Privacy section and the footer carry the same statement', () => {
  assert.equal(PRIVACY_STATEMENT, FOOTER_STATEMENT);
});
