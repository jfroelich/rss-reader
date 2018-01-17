import * as Status from "/src/common/status.js";

import unsubscribe as unsubscribeWithConn from "/src/feed-ops/unsubscribe.js";

import {
  open as openFeedStore
} from "/src/feed-store/feed-store.js";

// TODO: rather than this library, change all feed-store functions to treat conn as optional.
// If not specified then auto-open, auto-close, using the default database.
// * If a test user wants  to connect to a different database they can specify a connection.
// * If a normal user wants to share the connection over several calls they can specify a
// connection.
// * If a normal user wants to not deal with connection boilerplate, they can not specify a
// connection
// Furthermore, I can consider changing arguments into a 'query' object with conn as parameter,
// this will facilitate simpler arguments

export async function unsubscribe(channel, feedId) {
  let conn;
  try {
    conn = await openFeedStore();
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  let status = await unsubscribeWithConn(conn, channel, feedId);
  if(status !== Status.OK) {
    console.error('Failed to unsubscribe:', Status.toString(status));
  }

  conn.close();
  return status;
}
