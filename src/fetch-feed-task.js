// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// API for fetching a feed. Calls back with the fetched feed
function FetchFeedTask() {
  this.log = new LoggingService();
  this.isURLObject = ReaderUtils.isURLObject;
  this.parseFeed = FeedParser.parse;
  this.fetchXMLTask = new FetchXMLTask();

  this.Feed = Feed;
}

FetchFeedTask.prototype.start = function(requestURL, excludeEntries, callback) {
  this.log.log('GET', requestURL.toString());

  const ctx = {
    'requestURL': requestURL,
    'excludeEntries': excludeEntries,
    'callback': callback
  };
  this.fetchXMLTask.start(requestURL, this._onFetchXML.bind(this, ctx));
};

FetchFeedTask.prototype._onFetchXML = function(ctx, event) {
  if(event.type !== 'success') {
    ctx.callback({'type': event.type});
    return;
  }

  let parseResult = null;
  try {
    parseResult = this.parseFeed(event.document, ctx.excludeEntries);
  } catch(error) {
    this.log.warn(error);
    ctx.callback({'type': 'ParseError'});
    return;
  }

  const feed = parseResult.feed;

  // Set the feed's intial url to the request url. parseFeed is not aware of
  // the feed's url, so it is this task's responsibility.
  this.Feed.addURL(feed, ctx.requestURL.href);

  // If a response url is available, append the response url.
  // parseFeed is not aware of a feed's urls, so it is this task's
  // responsibility.
  if(event.responseURLString) {
    this.Feed.addURL(feed, event.responseURLString);
  }

  // The fetch task introduces this property.
  feed.dateFetched = new Date();

  // The date the feed's xml file was last modified is only available from
  // the response headers. This is different than a last modified date provided
  // as a part of the feed's data. The parser does not set this, so it only
  // makes sense to set it here.
  feed.dateLastModified = event.lastModifiedDate;

  // Build the output event for a successful fetch
  const successEvent = {};
  successEvent.type = 'success';
  successEvent.feed = feed;
  if(!ctx.excludeEntries) {
    successEvent.entries = parseResult.entries;
  }

  ctx.callback(successEvent);
};
