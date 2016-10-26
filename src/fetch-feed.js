// See license.md

'use strict';

// TODO: test without try/catch, learn more about how promises work with
// uncaught exceptions

function fetch_feed(url, exclude_entries = false, log = SilentConsole) {
  return new Promise(fetch_feed_impl.bind(undefined, url,
    exclude_entries, log));
}

async function fetch_feed_impl(url, exclude_entries, log, resolve, reject) {
  try {
    const fetch_result = await fetch_xml(url, log);
    const parse_result = parse_feed(fetch_result.document, exclude_entries);
    const feed = parse_result.feed;
    add_feed_url(feed, url.href);
    log.debug('Fetched feed', get_feed_url(feed));
    if(fetch_result.responseURLString)
      add_feed_url(feed, fetch_result.responseURLString);
    feed.dateFetched = new Date();
    feed.dateLastModified = fetch_result.lastModifiedDate;
    const output = {};
    output.feed = feed;
    if(!exclude_entries)
      output.entries = parse_result.entries;
    resolve(output);
  } catch(error) {
    reject(error);
  }
}
