'use strict';

// Post fetch processing that coerces a fetched feed into the app's storage
// format.
// @param response {Object} the result of calling fetch_feed
function parse_fetched_feed(response) {
  // Allow parse error to bubble
  const result = parse_feed(response.text);
  const feed = result.feed;

  if(!feed.datePublished)
    feed.datePublished = new Date();

  if(feed.link) {
    try {
      const feed_link_object = new URL(feed.link);
      feed.link = feed_link_object.href;
    } catch(error) {
      feed.link = undefined;
    }
  }

  Feed.prototype.add_url.call(feed, response.requestURLString);
  Feed.prototype.add_url.call(feed, response.responseURLString);
  feed.dateFetched = new Date();
  feed.dateLastModified = response.lastModifiedDate;

  const entries = result.entries;
  for(const entry of entries)
    if(!entry.datePublished)
      entry.datePublished = feed.datePublished;

  for(const entry of entries) {
    if(entry.link) {
      entry_add_url_string(entry, entry.link);
      delete entry.link;
    }
  }

  const output = {};
  output.feed = feed;
  output.entries = entries;
  return output;
}
