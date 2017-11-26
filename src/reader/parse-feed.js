import assert from "/src/assert.js";
import * as Entry from "/src/storage/entry.js";
import * as Feed from "/src/storage/feed.js";
import {parseFeed as parseFeedImpl} from "/src/parse-feed/parse-feed.js";
import {isCanonicalURLString} from "/src/url/url-string.js";

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
// TODO: I think it would make sense to clearly enumerate the use cases, then revisit how well the
// abstraction responds to each case.


// Parses an xml input string representing a feed. Returns a result with a feed object and an array
// of entries. Throws both checked and unchecked errors.
export default function parseFeed(xmlString, requestURL, responseURL, lastModDate, processEntries) {
  const result = {feed: undefined, entries: []};

  // Any errors produced by this call are not caught here and are passed upward
  const feed = parseFeedImpl(xmlString);

  // Pull the entries property out of the parsed feed. The interal parser includes the entries
  // array as a part of the parsed feed, but the app's storage format does not store entries per
  // feed, it stores feeds and entries separately, and the feeds it stores do not have an entries
  // property. We have to do this now, even if entries are not processed later, because entries
  // cannot be defined as a feed property.
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


  // Whereever entries came from earlier, it should be defined at this point.
  assert(Array.isArray(entries));

  // parseFeed warrants that if entries are parsed, that the entries property of the output
  // object is a defined array; albeit possibly empty. Using map implicitly warrants this.
  result.entries = entries.map(coerceEntry.bind(null, feedLinkURL));

  // TODO: I am not sure that filtering out duplicate entries should be a concern of this function.
  // In fact I think it shouldn't. This is another instance of mixing together too many concerns.
  // Dedup should be some kind of explicit step in the feed processing pipeline. I am just not
  // sure where. And I don't like the amount of boilerplate it introduces because at some point
  // the caller will have so much responsibility and so many concerns to take care of that the
  // caller will probably be making mistakes.
  // On the other hand, pretty much every caller wants to make uses of this functionality at this
  // stage of the pipeline. All I would be doing is placing more burden on the caller by making
  // more pipeline steps explicit?
  result.entries = dedupEntries(result.entries);
  return result;
}

// Coerce a parsed entry object into a reader storage entry object.
function coerceEntry(feedLinkURL, parsedEntry) {

  // Create a blank storable entry, and copy over all properties from the parsed entry
  const storableEntry = Object.assign(Entry.createEntry(), parsedEntry);

  // Mutate the storable entry
  resolveEntryLink(storableEntry, feedLinkURL);
  convertEntryLinkToURL(storableEntry);
  return storableEntry;
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
      console.warn('failed to coerce entry link to url', entry.link);
    }

    // Regardless of above success, unset
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
