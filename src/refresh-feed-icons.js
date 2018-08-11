import * as favicon from '/src/favicon.js';

// Update the favicon for each of the active feeds in the database
export async function refresh_feed_icons(ma, iconn) {
  const feeds = await ma.getFeeds('active', /* sorted */ false);
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed_icon(ma, iconn, feed));
  }
  return Promise.all(promises);
}

// Update the favicon of a feed in the database
async function refresh_feed_icon(ma, iconn, feed) {
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

    await ma.updateFeed(feed);
  }
}
