import {rdb_feed_append_url, rdb_feed_create} from '/src/rdb/rdb.js';

// TODO: think about fetch info parameter more, I'd prefer maybe to just accept
// a Response object. But I don't know how to get request url.
// TODO: think more about separating out the integration of fetch information
// from coercion. This kind of mixes it all together and I do not like that.

export function coerce_feed(parsed_feed, fetch_info) {
  const request_url = fetch_info.request_url;
  const response_url = fetch_info.response_url;
  const response_last_modified_date = fetch_info.response_last_modified_date;

  assert(request_url instanceof URL);
  assert(response_url instanceof URL);

  const feed = rdb_feed_create();

  if (parsed_feed.type) {
    feed.type = parsed_feed.type;
  }

  rdb_feed_append_url(feed, request_url);
  rdb_feed_append_url(feed, response_url);

  if (parsed_feed.link) {
    try {
      const url = new URL(parsed_feed.link);
      feed.link = url.href;
    } catch (error) {
    }
  }

  if (parsed_feed.title) {
    feed.title = parsed_feed.title;
  }

  if (parsed_feed.description) {
    feed.description = parsed_feed.description;
  }

  if (parsed_feed.datePublished) {
    feed.datePublished = parsed_feed.datePublished;
  } else {
    feed.datePublished = new Date();
  }

  feed.dateFetched = new Date();
  feed.dateLastModified = response_last_modified_date;
  return feed;
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
