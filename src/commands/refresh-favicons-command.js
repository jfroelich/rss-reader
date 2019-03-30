import open from '/src/db/ops/open.js';
import * as favicon from '/src/lib/favicon.js';
import refresh_feed_icons from '/src/ops/refresh-feed-icons.js';

export default async function refresh_favicons_command() {
  console.log('Refreshing favicons for feeds...');
  const proms = [open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  await refresh_feed_icons(conn, iconn);
  conn.close();
  iconn.close();
  console.log('Completed refreshing favicons');
}
