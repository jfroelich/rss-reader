'use strict';

// TODO: maybe rename to coerce-feed or something?
// TODO: change parse_fetched_feed to not throw in the usual case

// Post fetch processing that coerces a fetched feed into the app's storage
// format.
// @param response {Object} the result of calling fetch_feed
async function parse_fetched_feed(response) {
  const feed_xml_string = await response.text();

  // Allow parse error to bubble
  const parse_result = parse_feed(feed_xml_string);
  const feed = parse_result.feed;

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

  feed_append_url(feed, response.request_url);
  feed_append_url(feed, response.response_url);
  feed.dateFetched = new Date();
  feed.dateLastModified = response.last_modified_date;

  const entries = parse_result.entries;
  for(const entry of entries)
    if(!entry.datePublished)
      entry.datePublished = feed.datePublished;

  for(const entry of entries) {
    if(entry.link) {
      entry_append_url(entry, entry.link);
      delete entry.link;
    }
  }

  const output = {};
  output.feed = feed;
  output.entries = entries;
  return output;
}
