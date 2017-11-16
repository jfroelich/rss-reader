// This is a wrapper around parse-feed.js that customizes the parsed feed format to the app's feed
// format.

// TODO: after module transition rename to parse-feed.js and put in app folder or something similar

import assert from "/src/assert.js";
import * as Entry from "/src/entry.js";
import * as Feed from "/src/feed.js";
import parseFeed from "/src/parse-feed.js";
import {isCanonicalURLString} from "/src/url-string.js";

// Parses an xml input string representing a feed. Returns a result with a
// feed object and an array of entries.
export function readerParseFeed(xmlString, requestURL, responseURL, lastModDate, processEntries) {
  const result = {feed: undefined, entries: []};
  const parseResult = parseFeed(xmlString);
  const feed = parseResult.feed;
  setupFeed(feed, requestURL, responseURL, lastModDate);
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
      resolveFeed(entry, baseURL);
      coerceEntry(entry);
    }

    result.entries = dedupEntries(entries);
  }

  return result;
}

function setupFeed(feed, requestURL, responseURL, lastModDate) {
  // Compose fetch urls as the initial feed urls
  Feed.appendURL(feed, requestURL);
  Feed.appendURL(feed, responseURL);

  // Normalize feed link if set and valid, otherwise set to undefined
  if(feed.link && isCanonicalURLString(feed.link)) {
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


// If the entry has a link property, canonicalize and normalize it baseURL is optional, generally
// should be feed.link
function resolveFeed(entry, baseURL) {
  assert(Entry.isEntry(entry));
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

// entries are fetched as objects with a link property. for each entry that has a link, convert it
// into the app's storage format that uses a urls array. this tolerates entries that do not have
// links
function coerceEntry(entry) {
  if(entry.link) {
    try {
      Entry.appendURL(entry, entry.link);
    } catch(error) {
      console.warn('failed to coerce link to url', entry.link);
    }

    delete entry.link;
  }
}

// Filter duplicate entries by comparing urls
function dedupEntries(entries) {
  const distinctEntries = [];
  const seenURLs = [];

  for(const entry of entries) {

    // Retain entries without urls in the output without comparison
    if(!Entry.hasURL(entry)) {
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
