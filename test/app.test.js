import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRss } from '../server.js';

test('parses RSS and decodes common entities', () => {
  const items = parseRss('<rss><channel><item><title>Attack &amp; breach</title><link>https://example.com/story</link><description><![CDATA[<p>Victim&apos;s data was exposed.</p>]]></description><pubDate>Tue, 20 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>', 'Test Feed');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Attack & breach');
  assert.equal(items[0].summary, "Victim's data was exposed.");
  assert.equal(items[0].source, 'Test Feed');
});

test('rejects feed items without an http source link', () => {
  assert.deepEqual(parseRss('<rss><channel><item><title>Unsafe</title><link>javascript:alert(1)</link></item></channel></rss>', 'Test'), []);
});
