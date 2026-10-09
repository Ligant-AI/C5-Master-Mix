// The privacy text is the suite footer's byte-for-byte (@ligant/bench-chrome 1.3.0;
// CLAUDE.md Task 2, step 4; question Q3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PRIVACY_STATEMENT } from '../src/shared/privacy-statement.js';
import { PRIVACY_STATEMENT as FOOTER_STATEMENT } from '@ligant/bench-chrome';

const RECORDED = 'f23eb418125de4b8de5bd02d6e7484d09a83f2f1da39ef851d8fb64525fe2cda';

test('the privacy statement matches its recorded SHA-256', () => {
  assert.equal(createHash('sha256').update(PRIVACY_STATEMENT, 'utf8').digest('hex'), RECORDED);
});

test('the Privacy section and the footer carry the same statement', () => {
  assert.equal(PRIVACY_STATEMENT, FOOTER_STATEMENT);
});
