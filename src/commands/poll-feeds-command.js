import open from '/src/db/ops/open.js';
import * as favicon from '/src/lib/favicon.js';
import {poll_feeds, PollFeedsArgs} from '/src/ops/poll-feeds.js';

export default async function poll_feeds_command() {
  console.log('Polling feeds...');

  const proms = [open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);

  const args = new PollFeedsArgs();
  args.conn = conn;
  args.iconn = iconn;

  // The user is expressing explicit intent to poll, so disregard whenever the
  // last poll ran.
  args.ignore_recency_check = true;

  await poll_feeds(args);
  conn.close();
  iconn.close();

  console.log('Poll completed');
}
