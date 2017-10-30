'use strict';

// import entry.js
// import feed.js
// import feed-parse.js


// TODO: if feed_parse_from_string produced a parsed_feed object, then feed.js
// could have a function like feed_from_parsed_feed(parse_result) that would
// make more sense than this function. It would be an explicit format conversion
// from the format produced by parsing to the format for processing and storage
// used by the rest of the extension. I like the idea of making the coercion,
// and the fact that two formats exist, very explicit. I also like how the
// parser is only concerned with producing a parsed feed result, and has
// no concern at all over how the rest of the app works. The reason I say
// object in the first sentence here is because of this lack of concern, I
// should be creating an actual function object. Function objects cannot be
// stored in indexedDB, but that is a concern of other parts of the app. For
// that matter, the parser should probably not even produce a 'feed'. It should
// produce an object that contains channel properties and an array of items.

// TODO: basically just break apart this entire awkward function

// TODO: do the parsing externally and accept a parse result as input

// TODO: this should not be handling both feed and entries at the same
// time. The entry processing should happen separately. So, break into 3
// parts. one function that does the parsing. That is basically 1 line here.
// Move that into caller to get parse result.  Then, create two functions.
// One that operates on feed parse result (and response), and one that
// operates on entries.

// Post fetch processing that coerces a fetched feed into the app's internal
// format.
function feed_coerce_from_response(xml_string, request_url, response_url,
  last_modified_date) {

  const output = {
    'status': undefined,
    'feed': undefined,
    'entries': undefined
  };

  let parse_result;
  try {
    parse_result = feed_parse_from_string(xml_string);
  } catch(error) {
    console.warn(error);

    output.status = ERR_PARSE;
    return output;
  }

  const feed = parse_result.feed;

  // Double check. This should never happen because the error should have been
  // thrown. This is a temporary check present while doing refactoring that
  // can eventually be removed.
  console.assert(typeof feed === 'object');

  // Reject feeds that do not have a link attribute. The spec says
  // link is required, this should mostly conform to the spec, and a valid
  // link is needed later.
  if(typeof feed.link !== 'string') {
    console.debug('rejecting feed, link property undefined or wrong type');
    output.status = ERR_PARSE;
    return output;
  }

  // Validate and normalize the link attribute. If invalid, then reject for
  // the same reasons as a missing link.

  // First try a lighter weight approach before fully parsing the url
  if(!url_is_canonical(feed.link)) {
    console.debug('feed.link is relativeURI:', feed.link);
    output.status = ERR_PARSE;
    return output;
  }

  let feed_link_url;
  try {
    feed_link_url = new URL(feed.link);
  } catch(error) {
    console.debug('feed.link malformed url', feed.link, error);
    output.status = ERR_PARSE;
    return output;
  }

  // Set feed link to the canonical, normalized form
  feed.link = feed_link_url.href;

  if(!feed.datePublished) {
    feed.datePublished = new Date();
  }

  feed_append_url(feed, request_url);
  feed_append_url(feed, response_url);
  feed.dateFetched = new Date();
  feed.dateLastModified = last_modified_date;

  let entries = parse_result.entries;
  const entries_with_links = [];
  for(const entry of entries) {
    if(entry.link) {
      entries_with_links.push(entry);
    } else {
      console.debug('entry missing link', entry);
    }
  }
  entries = entries_with_links;

  // Double check (at least for now during dev)
  console.assert(feed_link_url);

  // Normalize and canonicalize and filter entry links
  const entries_with_valid_links = [];
  for(const entry of entries) {
    try {
      const entry_link_url = new URL(entry.link, feed_link_url);

      // temp debugging. change if original diff than canonical, or if relative
      if(entry_link_url.href !== entry.link) {
        console.debug('entry link changing', entry.link, entry_link_url.href);
      }

      entry.link = entry_link_url.href;
      entries_with_valid_links.push(entry);
    } catch(error) {
      console.debug('entry link invalid', entry.link, error);
    }
  }
  entries = entries_with_valid_links;

  // Now that we have entries with valid link fields, coerce them into
  // the storage format
  for(const entry of entries) {
    entry_append_url(entry, entry.link);

    // The link property does not exist in the storage format. Cannot maintain
    // v8 object shape.
    delete entry.link;
  }

  // Cascade date published of channel to items
  for(const entry of entries) {
    if(!entry.datePublished) {
      entry.datePublished = feed.datePublished;
    }
  }

  output.status = STATUS_OK;
  output.feed = feed;
  output.entries = entries;
  return output;
}
