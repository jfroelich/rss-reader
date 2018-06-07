import {append_feed_url, create_feed, set_feed_date_fetched, set_feed_date_last_modified, set_feed_date_published, set_feed_description, set_feed_link, set_feed_title, set_feed_type} from '/src/reader-db.js';

// Coerce a feed in the parse format (e.g. one that was fetched) into a database
// formatted feed object. This module is cross cutting because it involves
// deeper knowledge of multiple feed object formats.

// TODO: not sure I like the fetch_info parameter. Perhaps I should just accept
// a Response object. The problem is how to get the request url. Maybe I should
// de-aggregate this parameter.

export function coerce_feed(parsed_feed, fetch_info) {
  const request_url = fetch_info.request_url;
  const response_url = fetch_info.response_url;
  const response_last_modified_date = fetch_info.response_last_modified_date;

  assert(request_url instanceof URL);
  assert(response_url instanceof URL);

  const feed = create_feed();

  if (parsed_feed.type) {
    set_feed_type(feed, parsed_feed.type);
  }

  append_feed_url(feed, request_url);
  append_feed_url(feed, response_url);

  if (parsed_feed.link) {
    let link_url;
    try {
      link_url = new URL(parsed_feed.link);
    } catch (error) {
    }

    if (link_url) {
      set_feed_link(feed, link_url.href);
    }
  }

  if (parsed_feed.title) {
    set_feed_title(feed, parsed_feed.title);
  }

  if (parsed_feed.description) {
    set_feed_description(feed, parsed_feed.description);
  }

  if (parsed_feed.datePublished) {
    set_feed_date_published(feed, parsed_feed.datePublished);
  } else {
    set_feed_date_published(feed, new Date());
  }

  set_feed_date_fetched(feed, new Date());
  set_feed_date_last_modified(feed, response_last_modified_date);
  return feed;
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion error');
}
