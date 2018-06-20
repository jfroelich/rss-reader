// indexedDB does not support storing Function objects, because Function objects
// are not serializable. Therefore instanceof and typeof are not usable for
// making assertions about type. Therefore, use a hidden "magic" property to
// enable some minimal form of type checking.
export const MAGIC = 0xfeedfeed;

export function create() {
  return {magic: MAGIC};
}

// NOTE: typeof null === 'object'
export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === MAGIC;
}

export function is_valid_id(id) {
  return Number.isInteger(id) && id > 0;
}

// Returns whether the feed has correct properties and property values
export function is_valid(feed) {
  if (!is_feed(feed)) {
    return false;
  }

  if ('id' in feed && !is_valid_id(feed.id)) {
    return false;
  }

  if (!['undefined', 'string'].includes(typeof feed.title)) {
    return false;
  }

  const urls = feed.urls;
  if (urls && !Array.isArray(urls)) {
    return false;
  }

  return true;
}

// Appends a url to the feed's internal list. Lazily creates the list if needed
// * @param feed {Object} a feed object
// * @param url {URL}
export function append_url(feed, url) {
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

export function set_date_fetched(feed, date) {
  feed.dateFetched = date;
}

export function set_date_last_modified(feed, date) {
  feed.dateLastModifed = date;
}

export function set_date_published(feed, date) {
  feed.datePublished = date;
}

export function set_description(feed, description) {
  feed.description = description;
}

export function set_link(feed, url_string) {
  feed.link = url_string;
}

export function set_title(feed, title) {
  feed.title = title;
}

export function set_type(feed, feed_type_string) {
  feed.type = feed_type_string;
}
