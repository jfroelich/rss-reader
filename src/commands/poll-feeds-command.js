import db_open from '/src/db/ops/open.js';
import * as favicon from '/src/lib/favicon/favicon.js';
import {poll_feeds, PollFeedsArgs} from '/src/ops/poll-feeds.js';

export default async function poll_feeds_command() {
  console.log('Polling feeds...');

  const proms = [db_open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel('reader');

  const args = new PollFeedsArgs();
  args.conn = conn;
  args.iconn = iconn;
  args.channel = channel;

  // The user is expressing explicit intent to poll, so disregard whenever the
  // last poll ran.
  args.ignore_recency_check = true;

  await poll_feeds(args);
  conn.close();
  iconn.close();
  channel.close();

  console.log('Poll completed');
}
