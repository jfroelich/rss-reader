// OPML export functionality for options page

// TODO: deprecate. this should probably be two functions that the caller has
// to call, one being load feeds and the other being export feeds. The caller
// should compose them. To start with this to do, first I think this function should
// be inlined into its one callsite. Then, explore the layout of that function body and
// think about how to divy it up.

import assert from "/src/assert.js";
import * as rdb from "/src/rdb.js";
import {readerExportFeeds} from "/src/reader-export.js";

export async function optionsPageExportOPML() {
  // Allow errors to bubble
  let conn, feeds;
  try {
    conn = await rdb.open();
    feeds = await rdb.getFeeds(conn);
  } finally {
    rdb.close(conn);
  }

  assert(feeds);

  const title = 'Subscriptions', fileName = 'subscriptions.xml';
  readerExportFeeds(feeds, title, fileName);
}
