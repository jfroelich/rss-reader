'use strict';

// import base/indexeddb.js
// import base/object.js
// import feed.js
// import reader-db.js

async function reader_feed_put(feed, conn) {
  console.assert(feed_is_feed(feed));
  console.assert(indexeddb_is_open(conn));

  let storable = feed_sanitize(feed);
  storable = object_filter_empty_props(storable);
  storable.dateUpdated = new Date();
  await reader_db_put_feed(conn, storable);

  return storable;
}
