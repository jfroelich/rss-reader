'use strict';

// import feed.js
// import feed-parse.js

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

  if(!feed.datePublished) {
    feed.datePublished = new Date();
  }

  if(feed.link) {
    try {
      const feed_link_object = new URL(feed.link);
      feed.link = feed_link_object.href;
    } catch(error) {
      feed.link = undefined;
    }
  }

  feed_append_url(feed, request_url);
  feed_append_url(feed, response_url);
  feed.dateFetched = new Date();
  feed.dateLastModified = last_modified_date;

  const entries = parse_result.entries;
  for(const entry of entries) {
    if(!entry.datePublished) {
      entry.datePublished = feed.datePublished;
    }
  }

  for(const entry of entries) {
    if(entry.link) {
      entry_append_url(entry, entry.link);
      delete entry.link;
    }
  }

  output.status = STATUS_OK;
  output.feed = feed;
  output.entries = entries;
  return output;
}
