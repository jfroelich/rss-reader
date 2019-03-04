// Create the url to use for lookups given a database feed object
export function get_feed_favicon_lookup_url(feed) {
  if (feed.link) {
    return new URL(feed.link);
  }

  // TODO: use Feed.getURLString
  if (!feed.urls) {
    return;
  }

  if (!feed.urls.length) {
    return;
  }

  // TODO: use Feed.getURLString
  const url_string = feed.urls[feed.urls.length - 1];
  if (!url_string) {
    return;
  }

  // Throw if url_string is invalid or relative
  const tail_url = new URL(url_string);
  return new URL(tail_url.origin);
}
