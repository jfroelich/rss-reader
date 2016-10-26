// See license.md

'use strict';

// TODO: use async

function fetch_feed(req_url, exclude_entries = false, log = SilentConsole) {
  return new Promise(function(resolve, reject) {
    if(!parse_feed)
      reject(new ReferenceError());

    fetch_xml(req_url, log, on_fetch_xml);

    function on_fetch_xml(event) {
      if(event.type !== 'success')
        reject(new Error(event.type));

      let result = null;
      try {
        result = parse_feed(event.document, exclude_entries);
      } catch(error) {
        reject(error);
        return;
      }

      const feed = result.feed;
      add_feed_url(feed, req_url.href);
      if(event.responseURLString)
        add_feed_url(feed, event.responseURLString);
      feed.dateFetched = new Date();
      feed.dateLastModified = event.lastModifiedDate;
      log.debug('Fetched feed', get_feed_url(feed));
      const output = {};
      output.feed = feed;
      if(!exclude_entries)
        output.entries = result.entries;
      resolve(output);
    }
  });
}
