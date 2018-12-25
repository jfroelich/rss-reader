import * as favicon from '/src/favicon/favicon-control.js';
import * as db from '/src/db/db.js';

export async function refresh_feed_icons(session, iconn) {
  const feeds = await db.get_feeds(session, 'active', false);
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed_icon(session, iconn, feed));
  }
  return Promise.all(promises);
}

// Update the favicon of a feed in the database
async function refresh_feed_icon(session, iconn, feed) {
  if (!feed.urls || !feed.urls.length) {
    return;
  }

  const lookup_url = favicon.create_lookup_url(feed);
  if (!lookup_url) {
    return;
  }

  let doc = undefined;
  let fetch_flag = true;
  const icon_url_string =
      await favicon.lookup(iconn, lookup_url, doc, fetch_flag);

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    // TODO: use a partial update here instead of a full feed overwrite
    await db.update_feed(session, feed, true);
  }
}
