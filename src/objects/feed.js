import {html_truncate} from '/src/lib/html-truncate.js';
import {html_replace_tags} from '/src/lib/html.js';
import {list_peek} from '/src/lib/list.js';
import * as object from '/src/lib/object.js';
import * as string from '/src/lib/string.js';

export const FEED_MAGIC = 0xfeedfeed;

export function feed_create() {
  return {magic: FEED_MAGIC};
}

export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

// Returns a shallow copy of the input feed with sanitized properties
export function feed_sanitize(feed, title_max_length, description_max_length) {
  if (typeof title_max_length === 'undefined') {
    title_max_length = 1024;
  }

  if (typeof description_max_length === 'undefined') {
    description_max_length = 1024 * 10;
  }

  const blank_feed = feed_create();
  const output_feed = Object.assign(blank_feed, feed);
  const html_tag_replacement = '';
  const suffix = '';

  if (output_feed.title) {
    let title = output_feed.title;
    title = string.filter_control_characters(title);
    title = html_replace_tags(title, html_tag_replacement);
    title = string.condense_whitespace(title);
    title = html_truncate(title, title_max_length, suffix);
    output_feed.title = title;
  }

  if (output_feed.description) {
    let desc = output_feed.description;
    desc = string.filter_control_characters(desc);
    desc = html_replace_tags(desc, html_tag_replacement);
    desc = string.condense_whitespace(desc);
    desc = html_truncate(desc, description_max_length, suffix);
    output_feed.description = desc;
  }

  return output_feed;
}

export function feed_prepare(feed) {
  return object.filter_empty_properties(feed_sanitize(feed));
}

export function feed_is_valid(feed) {
  if (!is_feed(feed)) {
    return false;
  }

  if ('id' in feed && !feed_id_is_valid(feed.id)) {
    return false;
  }

  return true;
}

export function feed_merge(old_feed, new_feed) {
  const merged_feed = Object.assign(feed_create(), old_feed, new_feed);
  merged_feed.urls = [...old_feed.urls];
  if (new_feed.urls) {
    for (const url_string of new_feed.urls) {
      feed_append_url(merged_feed, new URL(url_string));
    }
  }

  return merged_feed;
}

export function feed_append_url(feed, url) {
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

// TODO: should rename feed_id_is_valid to is_valid_feed_id
export function feed_id_is_valid(id) {
  return Number.isInteger(id) && id > 0;
}

export function coerce_feed(parsed_feed, fetch_info) {
  const request_url = fetch_info.request_url;
  const response_url = fetch_info.response_url;
  const response_last_modified_date = fetch_info.response_last_modified_date;

  assert(request_url instanceof URL);
  assert(response_url instanceof URL);

  const feed = feed_create();

  if (parsed_feed.type) {
    feed.type = parsed_feed.type;
  }

  feed_append_url(feed, request_url);
  feed_append_url(feed, response_url);

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
