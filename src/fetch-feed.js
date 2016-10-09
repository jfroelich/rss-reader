// See license.md

'use strict';

/*
- date file modified should probably be passed back as an event property and
not set on the feed. it is a property of the response that i happen to shove
into a feed
*/

{

function fetchFeed(requestURL, excludeEntries, verbose, callback) {

  // Guard because only seen in try/catch for different exception type that
  // is otherwise non-fatal
  if(!FeedParser) {
    throw new ReferenceError('missing dep FeedParser');
  }

  const log = new LoggingService();
  log.verbose = verbose;
  log.log('GET', requestURL.toString());

  const ctx = {
    'requestURL': requestURL,
    'excludeEntries': excludeEntries,
    'callback': callback,
    'log': log
  };

  const fetchXMLVerbose = false;
  fetchXML(requestURL, fetchXMLVerbose, onFetchXML.bind(ctx));
}

function onFetchXML(event) {
  if(event.type !== 'success') {
    this.callback({'type': event.type});
    return;
  }

  let parseResult = null;
  try {
    parseResult = FeedParser.parse(event.document, this.excludeEntries);
  } catch(error) {
    this.log.warn(error);
    this.callback({'type': 'ParseError'});
    return;
  }

  const feed = parseResult.feed;

  Feed.addURL(feed, this.requestURL.toString());
  if(event.responseURLString) {
    Feed.addURL(feed, event.responseURLString);
  }

  feed.dateFetched = new Date();
  feed.dateLastModified = event.lastModifiedDate;

  const successEvent = {};
  successEvent.type = 'success';
  successEvent.feed = feed;
  if(!this.excludeEntries) {
    successEvent.entries = parseResult.entries;
  }

  this.callback(successEvent);
}

this.fetchFeed = fetchFeed;

}
