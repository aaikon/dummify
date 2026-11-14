import { describe, expect, it } from 'vitest';
import { hostMatches, normalizeHost } from './host';

describe('normalizeHost', () => {
  it.each([
    ['https://www.google.com/search?q=x', 'google.com'],
    ['https://Mail.Google.com/mail/u/0/', 'mail.google.com'],
    ['http://example.org:8080/path', 'example.org'],
    ['https://example.com./', 'example.com'],
    ['https://www2.example.com/', 'www2.example.com'],
    ['http://localhost:3000/', 'localhost'],
  ])('normalizes %s to %s', (url, expected) => {
    expect(normalizeHost(url)).toBe(expected);
  });

  it.each([
    'chrome://extensions/',
    'about:blank',
    'moz-extension://abc/popup.html',
    'file:///home/user/page.html',
    'not a url',
    '',
  ])('returns null for unsupported or invalid url %s', (url) => {
    expect(normalizeHost(url)).toBeNull();
  });
});

describe('hostMatches', () => {
  it.each([
    ['example.com', 'example.com', true],
    ['mail.example.com', 'example.com', true],
    ['notexample.com', 'example.com', false],
    ['example.com.evil.io', 'example.com', false],
    ['google.com', 'google.*', true],
    ['google.co.uk', 'google.*', true],
    ['google.fi', 'google.*', true],
    ['google.com.au', 'google.*', true],
    ['mail.google.com', 'google.*', false],
    ['google.evil.example', 'google.*', false],
    ['googleusercontent.com', 'google.*', false],
  ])('%s vs %s → %s', (host, pattern, expected) => {
    expect(hostMatches(host, pattern)).toBe(expected);
  });
});
