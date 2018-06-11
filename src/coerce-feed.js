import * as db from '/src/db.js';

// Coerce a feed in the parse format (e.g. one that was fetched) into a database
// formatted feed object. This module is cross cutting because it involves
// deeper knowledge of multiple feed object formats.
export function coerce_feed(parsed_feed) {
  const feed = db.create_feed();

  if (parsed_feed.type) {
    db.set_feed_type(feed, parsed_feed.type);
  }

  if (parsed_feed.link) {
    let link_url;
    try {
      link_url = new URL(parsed_feed.link);
    } catch (error) {
    }

    if (link_url) {
      db.set_feed_link(feed, link_url.href);
    }
  }

  if (parsed_feed.title) {
    db.set_feed_title(feed, parsed_feed.title);
  }

  if (parsed_feed.description) {
    db.set_feed_description(feed, parsed_feed.description);
  }

  if (parsed_feed.datePublished) {
    db.set_feed_date_published(feed, parsed_feed.datePublished);
  } else {
    db.set_feed_date_published(feed, new Date());
  }

  db.set_feed_date_fetched(feed, new Date());
  return feed;
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion error');
}
