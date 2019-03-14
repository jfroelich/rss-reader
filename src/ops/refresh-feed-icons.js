import {Feed} from '/src/model/types/feed.js';
import {lookup_feed_favicon} from '/src/ops/lookup-feed-favicon.js';

export async function refresh_feed_icons(model, iconn) {
  const feeds = await model.getFeeds('active', false);
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed_icon(model, iconn, feed));
  }
  return Promise.all(promises);
}

async function refresh_feed_icon(model, iconn, feed) {
  if (!Feed.prototype.hasURL.call(feed)) {
    return;
  }

  const icon_url = await lookup_feed_favicon(feed, iconn);
  const icon_url_string = icon_url ? icon_url.href : undefined;

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    await model.updateFeed(feed, true);
  }
}
