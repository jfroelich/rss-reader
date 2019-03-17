import db_open from '/src/db/ops/open.js';
import * as favicon from '/src/lib/favicon/favicon.js';
import refresh_feed_icons from '/src/ops/refresh-feed-icons.js';

export default async function refresh_favicons_command() {
  const proms = [db_open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel('reader');
  await refresh_feed_icons(conn, iconn, channel);
  conn.close();
  iconn.close();
  channel.close();
}
