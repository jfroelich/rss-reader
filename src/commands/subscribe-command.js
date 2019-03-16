import db_open from '/src/db/ops/db-open.js';
import {Deadline} from '/src/deadline.js';
import * as favicon from '/src/favicon/favicon.js';
import {subscribe} from '/src/ops/subscribe.js';

export default async function subscribe_command(url_string) {
  console.log('Subscribing to url %s ...', url_string);

  const proms = [db_open(), favicon.open()];
  const [conn, iconn] = await Promise.all(proms);
  const channel = new BroadcastChannel('reader');

  const callback = feed => {
    console.debug('Stored new feed, now storing entries...');
  };

  const url = new URL(url_string);
  const timeout = new Deadline(3000);
  const notify = true;
  const feed =
      await subscribe(conn, iconn, channel, url, timeout, notify, callback);

  channel.close();
  conn.close();
  iconn.close();

  console.log('Successfully subscribed to feed', feed.getURLString());
}