export const FEED_MAGIC = 0xfeedfeed;

export function create_feed() {
  return {magic: FEED_MAGIC};
}

export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

export function append_feed_url(feed, url) {
  if (!is_feed(feed)) {
    throw new TypeError('Invalid feed argument ' + feed);
    return false;
  }

  // Duck-typed sanity check
  const href = url.href;
  if (typeof href !== 'string') {
    throw new TypeError('Invalid url argument ' + url);
    return false;
  }

  // Lazy init
  if (!feed.urls) {
    feed.urls = [];
  }

  if (feed.urls.includes(href)) {
    return false;
  }
  feed.urls.push(href);
  return true;
}

export function is_valid_feed_id(id) {
  return Number.isInteger(id) && id > 0;
}

export function coerce_feed(parsed_feed, fetch_info) {
  const request_url = fetch_info.request_url;
  const response_url = fetch_info.response_url;
  const response_last_modified_date = fetch_info.response_last_modified_date;

  assert(request_url instanceof URL);
  assert(response_url instanceof URL);

  const feed = create_feed();

  if (parsed_feed.type) {
    feed.type = parsed_feed.type;
  }

  append_feed_url(feed, request_url);
  append_feed_url(feed, response_url);

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

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
