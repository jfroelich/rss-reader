'use strict';

// import base/number.js
// import base/string.js
// import net/url.js
// import favicon.js
// import html.js

function feed_create() {
  return {};
}

function feed_is_feed(feed) {
  return typeof feed === 'object';
}

function feed_is_valid_feed_id(id) {
  return number_is_positive_integer(id);
}

function feed_has_url(feed) {
  console.assert(feed_is_feed(feed));
  return feed.urls && feed.urls.length;
}

// Returns the last url in the feed's url list as a string
// @param feed {Object} a feed object
// @returns {String} the last url in the feed's url list
function feed_get_top_url(feed) {
  console.assert(feed && feed.urls && feed.urls.length);
  return feed.urls[feed.urls.length - 1];
}

// Appends a url to the feed's internal list. Lazily creates the list if needed
// @param feed {Object} a feed object
// @param url_string {String}
function feed_append_url(feed, url_string) {
  feed.urls = feed.urls || [];
  const url_object = new URL(url_string);
  const norm_url_string = url_object.href;
  if(feed.urls.includes(norm_url_string)) {
    return false;
  }

  feed.urls.push(norm_url_string);
  return true;
}

// Returns the url used to lookup a feed's favicon
// @returns {URL}
function feed_create_icon_lookup_url(feed) {
  console.assert(feed_is_feed(feed));

  // First, prefer the link, as this is the url of the webpage that is
  // associated with the feed. Cannot assume the link is set or valid
  if(feed.link) {
    // If feed.link is set it should always be canonical
    console.assert(url_is_canonical(feed.link));
    try {
      return new URL(feed.link);
    } catch(error) {
      // If feed.link is set it should always be valid
      console.warn(error);
    }
  }

  // If the link is missing or invalid then use the origin of the feed's
  // xml url. Assume the feed always has a url.
  const url_string = feed_get_top_url(feed);
  const url_object = new URL(url_string);
  return new URL(url_object.origin);
}

// Update's a feed's faviconURLString property (not persisted to db)
async function feed_update_favicon(feed, icon_conn) {

  const query = new FaviconQuery();
  query.conn = icon_conn;
  query.url = feed_create_icon_lookup_url(feed);

  let icon_url;
  try {
    icon_url = await favicon_lookup(query);
  } catch(error) {
    console.warn(error);
    // TODO: use a more accurate error code
    return RDR_ERR_DB;
  }

  feed.faviconURLString = icon_url;
  return RDR_OK;
}

// TODO: include this in places where sanitize is called
// TODO: assert required properties are present
// TODO: assert type, if set, is one of the valid types
// TODO: assert feed has one or more urls
// TODO: assert the type of each property?
function feed_has_valid_props(feed) {
  console.assert(feed_is_feed(feed));

  if('id' in feed) {
    if(!number_is_positive_integer(feed.id)) {
      return false;
    }
  }

  if('type' in feed) {
    const types = ['feed', 'rss', 'rdf'];
    console.assert(types.includes(feed.type));
  }

  return true;
}

// Returns a shallow copy of the input feed with sanitized properties
function feed_sanitize(feed, title_max_length, desc_max_length) {
  console.assert(feed_is_feed(feed));

  const DEFAULT_TITLE_MAX_LEN = 1024;
  const DEFAULT_DESC_MAX_LEN = 1024 * 10;

  if(typeof title_max_length === 'undefined') {
    title_max_length = DEFAULT_TITLE_MAX_LEN;
  } else {
    console.assert(number_is_positive_integer(title_max_length));
  }

  if(typeof desc_max_length === 'undefined') {
    desc_max_length = DEFAULT_DESC_MAX_LEN;
  } else {
    console.assert(number_is_positive_integer(desc_max_length));
  }

  const output_feed = Object.assign({}, feed);
  const tag_replacement = '';
  const suffix = '';

  if(output_feed.title) {
    let title = output_feed.title;
    title = string_filter_control_chars(title);
    title = html_replace_tags(title, tag_replacement);
    title = string_condense_whitespace(title);
    title = html_truncate(title, title_max_length, suffix);
    output_feed.title = title;
  }

  if(output_feed.description) {
    let desc = output_feed.description;
    desc = string_filter_control_chars(desc);
    desc = html_replace_tags(desc, tag_replacement);
    desc = string_condense_whitespace(desc);
    desc = html_truncate(desc, desc_max_length, suffix);
    output_feed.description = desc;
  }

  return output_feed;
}

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for urls, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference.
function feed_merge(old_feed, new_feed) {
  const merged_feed_object = Object.assign({}, old_feed, new_feed);

  // After assignment, the merged feed has only the urls from the new feed.
  // So the output feed's url list needs to be fixed. First copy over the old
  // feed's urls, then try and append each new feed url.
  merged_feed_object.urls = [...old_feed.urls];

  if(new_feed.urls) {
    for(const url_string of new_feed.urls) {
      feed_append_url(merged_feed_object, url_string);
    }
  }

  return merged_feed_object;
}
