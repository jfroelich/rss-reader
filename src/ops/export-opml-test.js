import create_feeds from '/src/db/ops/create-feeds.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';
import export_opml from '/src/ops/export-opml.js';

// Exercise the typical usage of export-opml
export default async function export_opml_test() {
  const db_name = 'export-opml-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  // Insert some test feeds
  let feeds = [];
  for (let i = 0; i < 3; i++) {
    const feed = {};
    resource_utils.set_url(feed, new URL('a://b.c' + i));
    feeds.push(feed);
  }

  await create_feeds(conn, feeds);

  // This should complete without error
  const document = await export_opml(conn, 'test-title');

  // export-opml should generate a Document object
  assert(document instanceof Document);

  // The title should be set if specified
  const title_element = document.querySelector('title');
  assert(title_element);
  assert(title_element.textContent === 'test-title');

  // The correct number of outlines should have been generated
  const outlines = document.querySelectorAll('outline');
  assert(outlines.length === feeds.length);

  // For each feed that has a url, it should have a corresponding outline based
  // on the outline's xmlurl attribute value.
  for (const feed of feeds) {
    const url = resource_utils.get_url(feed);
    const selector = 'outline[xmlUrl="' + url.href + '"]';
    const outline = document.querySelector(selector);
    assert(outline instanceof Element);
  }

  conn.close();
  await indexeddb_utils.remove(db_name);
}
