// See license.md

'use strict';

// Common post fetch processing. Returns a result object with properties feed
// and entries.

// @param response {Object} the result of calling fetchFeed
function parseFetchedFeed(response) {

  // Allow parse error to bubble
  const result = parseFeed(response.text);

  const feed = result.feed;

  if(!feed.datePublished) {
    feed.datePublished = new Date();
  }

  if(feed.link) {
    try {
      feed.link = new URL(feed.link).href;
    } catch(error) {
      // console.warn(error);
      delete feed.link;
    }
  }

  addFeedURLString(feed, response.requestURLString);
  addFeedURLString(feed, response.responseURLString);
  feed.dateFetched = new Date();
  feed.dateLastModified = response.lastModifiedDate;

  const entries = result.entries;
  for(let entry of entries) {
    if(!entry.datePublished) {
      entry.datePublished = feed.datePublished;
    }
  }

  for(let entry of entries) {
    if(entry.link) {
      addEntryURLString(entry, entry.link);
      delete entry.link;
    }
  }

  const output = {};
  output.feed = feed;
  output.entries = entries;
  return output;
}
