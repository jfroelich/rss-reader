// This is a wrapper around parse-feed.js that customizes the parsed feed format to the app's feed
// format.

// TODO: this is currently located in /src/reader because it differentiates from app-specific
// functionality and general purpose utilities. At least, that is the idea. However, at the moment
// I have not moved any other functionality into /src/reader, so it looks rather awkward. I do plan
// to move other functionality into reader. But first, I have to make up my mind. I am currently
// sitting on the fence regarding whether it makes sense to distinguish between app-specific
// functionality and general purpose functionality. In a way, everything is app-specific. There are
// non-generic opinions scattered throughout the so-called "general purpose" modules. Therefore,
// attempting to distinguish between two things that are essentially the same is stupid. Quite
// stupid. This is a great example of a decision I sincerely struggle with, to me this is currently
// a great unanswered question that I think requires more personal learning. Clearly something is
// not clicking with me. One of the key features of an API is how well organized its surface is,
// and all programming code that is publicly-accessible is API surface, so I really dislike how
// seemingly arbitrary is the current organization. But a flattened hierarchy is a copout; just an
// admission that I didn't bother to organize. While I wait for this stuff to magically sort itself
// out, I am keeping this here. One to server as a reminder. Two because I obviously cannot have
// two things named parse-feed.js in the same folder. Keep in mind this may be the wrong
// abstraction, and may be going away, so it may become a non-issue. Regarding divide and conquer,
// this is a divide issue.


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
// TODO: I think it would make sense to clearly enumerate the use cases, then revisit how well the
// abstraction responds to each case.

import assert from "/src/utils/assert.js";
import * as Entry from "/src/entry.js";
import * as Feed from "/src/feed.js";
import {parseFeed as parseFeedImpl} from "/src/parse-feed/parse-feed.js";
import {isCanonicalURLString} from "/src/url/url-string.js";

// Parses an xml input string representing a feed. Returns a result with a feed object and an array
// of entries. Throws both checked and unchecked errors.
export default function parseFeed(xmlString, requestURL, responseURL, lastModDate, processEntries) {
  const result = {feed: undefined, entries: []};

  // Any errors produced by this call are not caught here and are passed upward
  const feed = parseFeedImpl(xmlString);

  // Pull the entries property out of the parsed feed. The interal parser includes the entries
  // array as a part of the parsed feed, but the app's storage format does not store entries per
  // feed, it stores feeds and entries separately, and the feeds it stores do not have an entries
  // property.
  const entries = feed.entries;
  delete feed.entries;

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

  // TODO: I am not sure that filtering out duplicate entries should be a concern of this function.
  // In fact I think it shouldn't. This is another instance of mixing together too many concerns.
  // Dedup should be some kind of explicit step in the feed processing pipeline. I am just not
  // sure where. And I don't like the amount of boilerplate it introduces because at some point
  // the caller will have so much responsibility and so many concerns to take care of that the
  // caller will probably be making mistakes.
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
