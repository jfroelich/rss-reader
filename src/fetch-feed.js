// See license.md

'use strict';

// Resolves with a basic object with properties feed and entries
// feed is a feed object. entries is an array of entry objects, that is always
// defined but may be zero length.
function fetch_feed(url, exclude_entries = false, log = SilentConsole) {
  return new Promise(async function impl(resolve, reject) {
    try {
      const fetch_result = await fetch_xml(url, log);
      const parse_result = parse_feed(fetch_result.document, exclude_entries);
      const feed = parse_result.feed;
      add_feed_url(feed, url.href);
      log.debug('Fetched feed', get_feed_url(feed));
      if(fetch_result.response_url_str)
        add_feed_url(feed, fetch_result.response_url_str);
      feed.dateFetched = new Date();
      feed.dateLastModified = fetch_result.last_modified_date;
      const output = {};
      output.feed = feed;
      if(!exclude_entries)
        output.entries = parse_result.entries;
      resolve(output);
    } catch(error) {
      reject(error);
    }
  });
}
