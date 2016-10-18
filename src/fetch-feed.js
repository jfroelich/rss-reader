// See license.md

'use strict';

{

function fetch_feed(req_url, exclude_entries, log, callback) {
  if(!parse_feed) {
    throw new ReferenceError();
  }

  const ctx = {
    'req_url': req_url,
    'exclude_entries': exclude_entries,
    'callback': callback,
    'log': log || SilentConsole
  };

  fetch_xml(req_url, log, on_fetch_xml.bind(ctx));
}

function on_fetch_xml(event) {
  if(event.type !== 'success') {
    this.callback({'type': event.type});
    return;
  }

  let result = null;
  try {
    result = parse_feed(event.document, this.exclude_entries);
  } catch(error) {
    this.log.warn(error);
    this.callback({'type': 'ParseError'});
    return;
  }

  const feed = result.feed;
  add_feed_url(feed, this.req_url.toString());
  if(event.responseURLString)
    add_feed_url(feed, event.responseURLString);

  feed.dateFetched = new Date();
  feed.dateLastModified = event.lastModifiedDate;
  this.log.debug('Fetched feed', get_feed_url(feed));
  const success_event = {};
  success_event.type = 'success';
  success_event.feed = feed;
  if(!this.exclude_entries)
    success_event.entries = result.entries;
  this.callback(success_event);
}

this.fetch_feed = fetch_feed;

}
