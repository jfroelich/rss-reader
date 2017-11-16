// This is a wrapper around parse-feed.js that customizes the parsed feed format to the app's feed
// format.

// TODO: I do not love the processEntries parameter. While processing entries is surely related to
// post-fetch processing that needs to be done, I do not think it fits here. Rather than pass a
// flag, the caller should merely decide whether to call a separate function. Not calling the
// function is equivalent to setting processEntries flag to false, and calling the function is
// equivalent to setting the flag to true. On the other hand, this means the caller has to
// juggle the entries object externally. Also, it means this cannot wrap parseFeed, because
// parseFeed includes entries in its result, and there is no other way to get entries. I could go
// back to saying that an entries array is a property of the parsed feed, and have parseFeed (the
// internal) just yield a properties object. That is technically ok.
// Or, I could also just have two coercion functions. Require the caller to call parseFeed
// directly. Pass the result to a function like coerceFeed. And then, if the caller wants to
// process entries, pass the result to a function like coerceEntries. The caller would also need
// to pass the coerced feed result to the coerceEntries function.
// I do not love how much extra work is being placed on the caller in these alternate scenarios.
// I want to minimize the knowledge and abstract away from the messiness of it. That is kind of
// what this function does right now. I just hate the boolean.
// At the same time this function has problems because it is mixing concerns. The fact that it
// requires response parameters like urls and file modification date are a signal that the
// abstraction is wrong. It is marrying the wrong things together. There are different stages to
// the pipeline of feed processing, and it feels like this is taking bits from stage 2 and 3 and 4
// and calling it step 1.5.


import assert from "/src/assert.js";
import * as Entry from "/src/entry.js";
import * as Feed from "/src/feed.js";
import parseFeed as internalParseFeed from "/src/parse-feed.js";
import {isCanonicalURLString} from "/src/url-string.js";

// Parses an xml input string representing a feed. Returns a result with a feed object and an array
// of entries.
export default function parseFeed(xmlString, requestURL, responseURL, lastModDate,
  processEntries) {

  const result = {feed: undefined, entries: []};

  const feed = internalParseFeed(xmlString);

  // Pull the entries property out of the parsed object
  const entries = feed.entries;
  delete feed.entries;

  //const parseResult = internalParseFeed(xmlString);

  // Setup the feed property of the result
  //const feed = parseResult.feed;

  // Compose fetch urls as the initial feed urls
  Feed.appendURL(feed, requestURL);
  Feed.appendURL(feed, responseURL);

  // Normalize feed link if set and valid, otherwise set to undefined. Save a reference to the
  // url so that it can be used to resolve entry links later.
  let feedLinkURL;
  if(feed.link && isCanonicalURLString(feed.link)) {
    try {
      feedLinkURL = new URL(feed.link);

      // Overwrite with the normalized version of the string
      feed.link = feedLinkURL.href;
    } catch(error) {
      // Unset if invalid
      feed.link = undefined;
    }
  } else {
    // Unset if not canonical
    feed.link = undefined;
  }

  // Supply today's date as the date the feed was published if the feed did not provide a date
  if(!feed.datePublished) {
    feed.datePublished = new Date();
  }

  // TODO: setting the date the feed was fetched is something else's concern
  feed.dateFetched = new Date();

  // TODO: setting the date the feed xml file was last modified is something else's concern
  feed.dateLastModified = lastModDate;

  result.feed = feed;

  if(!processEntries) {
    return result;
  }

  for(const entry of entries) {
    resolveEntryLink(entry, feedLinkURL);
    convertEntryLinkToURL(entry);
  }

  result.entries = dedupEntries(entries);
  return result;
}

// If the entry has a link property, canonicalize and normalize it, baseURL is optional, generally
// should be feed.link
function resolveEntryLink(entry, baseURL) {
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
function convertEntryLinkToURL(entry) {
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
