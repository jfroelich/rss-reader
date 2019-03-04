import * as favicon from '/src/lib/favicon.js';
import {Feed} from '/src/model/feed.js';
import * as op_utils from '/src/ops/op-utils.js';

export async function refresh_feed_icons(session, iconn) {
  const feeds = await session.getFeeds('active', false);
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed_icon(session, iconn, feed));
  }
  return Promise.all(promises);
}

// Update the favicon of a feed in the database
async function refresh_feed_icon(session, iconn, feed) {
  // TODO: use Feed.hasURL
  if (!feed.urls || !feed.urls.length) {
    return;
  }

  const lookup_url = op_utils.get_feed_favicon_lookup_url(feed);
  if (!lookup_url) {
    return;
  }

  const request = new favicon.LookupRequest();
  request.conn = iconn;
  request.url = lookup_url;
  const icon_url = await favicon.lookup(request);
  const icon_url_string = icon_url ? icon_url.href : undefined;

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    await session.updateFeed(feed, true);
  }
}
