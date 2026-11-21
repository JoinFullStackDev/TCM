import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateInvalidNpi, generateNpi, isValidNpi, luhnCheckDigit, npiCheckDigit } from '../npi';
import { seededRng } from './rng';

test('known-good NPIs pass the check-digit rule', () => {
  // 1234567893 is the CMS worked example; the others are published sample NPIs.
  for (const npi of ['1234567893', '1245319599', '1003000126']) assert.ok(isValidNpi(npi), npi);
});

test('the CMS worked example: 80840 + 123456789 gives check digit 3', () => {
  assert.equal(npiCheckDigit('123456789'), 3);
  assert.equal(luhnCheckDigit('80840123456789'), 3);
});

test('a wrong check digit, wrong length or non-digits fail', () => {
  assert.equal(isValidNpi('1234567890'), false);
  assert.equal(isValidNpi('123456789'), false);
  assert.equal(isValidNpi('12345678933'), false);
  assert.equal(isValidNpi('12345678a3'), false);
});

test('generated NPIs are 10 digits, start with 1 and are check-digit valid', () => {
  const rng = seededRng(42);
  for (let i = 0; i < 2000; i++) {
    const npi = generateNpi(rng);
    assert.match(npi, /^1\d{9}$/);
    assert.ok(isValidNpi(npi), npi);
  }
});

test('generated invalid NPIs are 10 digits with a wrong check digit', () => {
  const rng = seededRng(7);
  for (let i = 0; i < 2000; i++) {
    const npi = generateInvalidNpi(rng);
    assert.match(npi, /^\d{10}$/);
    assert.equal(isValidNpi(npi), false, npi);
  }
});

test('npiCheckDigit refuses anything but nine digits', () => {
  assert.throws(() => npiCheckDigit('12345678'));
  assert.throws(() => npiCheckDigit('12345678x'));
});
