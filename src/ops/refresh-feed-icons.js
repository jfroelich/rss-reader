import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {FaviconService} from '/src/lib/favicon-service/favicon-service.js';
import {feed_create_favicon_lookup_url, feed_has_url} from '/src/objects/feed.js';
import {for_each_active_feed} from '/src/ops/for-each-active-feed.js';
import {update_feed} from '/src/ops/update-feed.js';

export async function refresh_feed_icons(
    rconn, iconn, channel, console = console_stub) {
  const promises = [];
  await for_each_active_feed(
      rconn,
      feed =>
          promises.push(refresh_feed(rconn, iconn, channel, console, feed)));
  await Promise.all(promises);
}

async function refresh_feed(rconn, iconn, channel, console, feed) {
  if (!feed_has_url(feed)) {
    return;
  }

  const lookup_url = feed_create_favicon_lookup_url(feed);
  if (!lookup_url) {
    return;
  }

  const fs = new FaviconService();
  fs.conn = iconn;
  fs.console = console;

  const icon_url_string = await fs.lookup(lookup_url);

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    const validate = false;
    const set_date_updated = true;
    await update_feed(rconn, channel, feed, validate, set_date_updated);
  }
}
