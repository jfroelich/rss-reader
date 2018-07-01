import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import * as idbmodel from '/src/model/idb-model.js';
import * as Model from '/src/model/model.js';
import {register_test} from '/test/test-registry.js';

async function archive_entries_test() {
  // TODO: insert archivable data, non-archivable data, and then assert the
  // archivable data was archived, and that the non-archivable data was not
  // archived
  const conn = await idbmodel.open('archive-entries-test');
  const max_age = 100;
  const ids = await idbmodel.archive_entries(conn, max_age);
  conn.close();
  await indexeddb.remove(conn.name);
}

async function create_feed_test() {
  const feed = Model.create_feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  Model.append_feed_url(feed, feed_url);
  const conn = await idbmodel.open('create-feed-test');
  const stored_feed_id = await idbmodel.create_feed(conn, feed);
  assert(Model.is_valid_feed_id(stored_feed_id));
  let stored_feed = await idbmodel.get_feed(conn, 'url', feed_url, true);
  assert(Model.is_feed(stored_feed));
  stored_feed = await idbmodel.get_feed(conn, 'id', stored_feed_id, false);
  assert(Model.is_feed(stored_feed));
  conn.close();
  await indexeddb.remove(conn.name);
}

register_test(create_feed_test);
register_test(archive_entries_test);
