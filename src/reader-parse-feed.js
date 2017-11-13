// This is a wrapper around FeedParser that customizes the parsed feed format to the app's feed
// format.

// TODO: after module transition rename to parse-feed and put in app folder or something like that
// TODO: after module transition rename non-exported globals

import {assert} from "/src/assert.js";
import {entryAppendURL, entryHasURL, entryIsEntry} from "/src/entry.js";
import {feedAppendURL} from "/src/feed.js";
import {FeedParser} from "/src/feed-parser.js";
import {isCanonicalURL} from "/src/url.js";


// Parses an xml input string representing a feed. Returns a result with a
// feed object and an array of entries.
export function readerParseFeed(xmlString, requestURL, responseURL, lastModDate, processEntries) {
  const result = {feed: undefined, entries: []};
  const parser = new FeedParser();
  const parseResult = parser.parseFromString(xmlString);
  const feed = parseResult.feed;
  readerParseFeedSetupFeed(feed, requestURL, responseURL, lastModDate);
  result.feed = feed;

  let baseURL;
  try {
    baseURL = new URL(feed.link);
  } catch(error) {
    // Ignore
  }

  if(processEntries) {
    let entries = parseResult.entries;
    for(const entry of entries) {
      readerParseFeedResolve(entry, baseURL);
      readerParseFeedCoerceEntry(entry);
    }

    result.entries = readerParseFeedDedup(entries);
  }

  return result;
}

function readerParseFeedSetupFeed(feed, requestURL, responseURL, lastModDate) {

  // Compose fetch urls as the initial feed urls
  feedAppendURL(feed, requestURL);
  feedAppendURL(feed, responseURL);

  // Normalize feed link if set and valid, otherwise set to undefined
  if(feed.link && isCanonicalURL(feed.link)) {
    try {
      const feedLinkURL = new URL(feed.link);
      feed.link = feedLinkURL.href;
    } catch(error) {
      console.debug('error parsing feed link url', feed.link, error);
      feed.link = undefined;
    }
  } else {
    feed.link = undefined;
  }

  if(!feed.datePublished) {
    feed.datePublished = new Date();
  }

  feed.dateFetched = new Date();
  feed.dateLastModified = lastModDate;
}


// If the entry has a link property, canonicalize and normalize it
// baseURL is optional, generally should be feed.link
function readerParseFeedResolve(entry, baseURL) {
  assert(entryIsEntry(entry));
  if(entry.link) {
    try {
      const url = new URL(entry.link, baseURL);
      entry.link = url.href;
    } catch(error) {
      console.debug(entry.link, error);
      entry.link = undefined;
    }
  }
}

// entries are fetched as objects with a link property. for each entry that
// has a link, convert it into the app's storage format that uses a urls
// array. this tolerates entries that do not have links
function readerParseFeedCoerceEntry(entry) {
  if(entry.link) {
    try {
      entryAppendURL(entry, entry.link);
    } catch(error) {
      console.warn('failed to coerce link to url', entry.link);
    }

    delete entry.link;
  }
}

// Filter duplicate entries by comparing urls
function readerParseFeedDedup(entries) {
  const distinctEntries = [];
  const seenURLs = [];

  for(const entry of entries) {

    // Retain entries without urls in the output without comparison
    if(!entryHasURL(entry)) {
      distinctEntries.push(entry);
      continue;
    }

    let isSeenURL = false;

    for(const urlString of entry.urls) {
      if(seenURLs.includes(urlString)) {
        isSeenURL = true;
        break;
      }
    }

    if(!isSeenURL) {
      distinctEntries.push(entry);
      seenURLs.push(...entry.urls);
    }
  }

  return distinctEntries;
}
