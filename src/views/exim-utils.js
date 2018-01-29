import {exportOPML as exportOPMLImpl, importOPML as importOPMLImpl} from "/src/exim.js";
import {open as openReaderDb} from "/src/rdb.js";
import {open as openFaviconDb} from "/src/favicon-service.js";

// The idea is that the view shouldn't directly call importOPML or exportOPML. Wrap those
// functions here, and have the slideshow call these wrapped functions. The wrapped functions
// take care of handling resource lifetime (e.g. opening and closing db), and set any obvious
// parameters. The default databases are used. The underlying implementations can be tested
// on different databases, but here there is the convenience of not having to specify anything.
// This leaves the view with a much simpler call

// TODO: I have no idea what to call this thing, some kind of middleware or controller, or
// even just a wrapper. I am also tempting to mix it in with a few other db wrapper calls


export async function importOPML(channel, files) {

  // Given that there could be several feeds being subscribed, use a slightly
  // higher timeout than average to reduce the chance that some contention delays
  // result in failure
  const fetchFeedTimeout = 10 * 1000;
  let feedConn, iconConn;

  try {
    [feedConn, iconConn] = await Promise.all([openReaderDb(), openIconDb()]);
    await importOPMLImpl(feedConn, iconConn, channel, fetchFeedTimeout, files);
  } finally {
    if(feedConn) feedConn.close();
    if(iconConn) iconConn.close();
  }
}

export async function exportOPML(title) {
  let conn;
  try {
    conn = await openReaderDb();
    exportOPMLImpl(conn, title);
  } finally {
    if(conn) conn.close();
  }
}
