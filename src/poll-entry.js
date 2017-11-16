// For polling an individual entry when polling feeds

import assert from "/src/assert.js";
import * as Entry from "/src/entry.js";
import {check, isUncheckedError} from "/src/errors.js";
import FaviconLookup from "/src/favicon-lookup.js";
import {fetchHTML} from "/src/fetch.js";
import filterDocument from "/src/filter-document.js";
import parseHTML from "/src/parse-html.js";
import * as rdb from "/src/rdb.js";
import {entryAdd} from "/src/reader-storage.js";
import rewriteURL from "/src/rewrite-url.js";
import {setURLHrefProperty, sniffIsBinaryURL} from "/src/url.js";
import {isValidURLString} from "/src/url-string.js";

export class PollEntryContext {
  constructor() {
    this.readerConn = null;
    this.iconCache = null;
    this.feedFaviconURL = null;
    this.fetchHTMLTimeoutMs = undefined;
    this.fetchImageTimeoutMs = undefined;
  }
}

// TODO: change pollEntry to stop trying not to throw exceptions. Instead, pollEntry should be
// called with promiseEvery instead of Promise.all. pollEntry should through some kind error in
// cases where it encounters a problem polling the entry and should stop trying to trap its errors
// internally. Make its return value the stored entry object. So it either always reaches the end
// and stores an entry object, or it encounters an error and throws and thereby exits early. The
// current behavior of returning false and such is a remnant of an older approach where I tried to
// avoid throwing an error at all costs. But the new approach embraces the exception throwing
// nature of JavaScript functions, so this should also embrace that style.

// @param this {PollEntryContext}
export async function pollEntry(entry) {
  assert(this instanceof PollEntryContext);
  assert(rdb.isOpen(this.readerConn));
  assert(Entry.isEntry(entry));

  // Cannot assume entry has url. There are no earlier steps in the pipeline of processing a
  // feed that guarantee this. However, a url is required for polling, so throw an error
  check(Entry.hasURL(entry), undefined, 'entry has no url');

  // If a url parsing error occurs, it is fatal to polling the entry.
  // If peekURL fails it is fatal to polling the entry
  const urlObject = new URL(Entry.peekURL(entry));

  // If a rewrite error occurs, it is fatal to polling the entry
  const rewrittenURL = rewriteURL(urlObject.href);
  if(rewrittenURL && urlObject.href !== rewrittenURL) {
    // If an appendURL error occrs, it is fatal to polling the entry
    Entry.appendURL(entry, rewrittenURL);
    setURLHrefProperty(urlObject, rewrittenURL);
  }

  if(isUnpollableURL(urlObject)) {
    return false;
  }

  if(await entryExists(urlObject, this.readerConn)) {
    return false;
  }

  let response;
  try {
    response = await fetchHTML(urlObject.href, this.fetchHTMLTimeoutMs);
  } catch(error) {
    // Ignore, not fatal to poll
  }

  let entryContent = entry.content;
  if(response) {
    if(response.redirected) {
      if(isUnpollableURL(new URL(response.responseURL))) {
        return false;
      }

      if(await entryExists(new URL(response.responseURL), this.readerConn)) {
        return false;
      }

      Entry.appendURL(entry, response.responseURL);

      // TODO: attempt to rewrite the redirected url as well?

      setURLHrefProperty(urlObject, response.responseURL);
    }

    // Use the full text of the response in place of the in-feed content
    entryContent = await response.text();
  }

  let entryDocument;
  try {
    entryDocument = parseHTML(entryContent);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore parse error, leave entryDocument undefined and continue
    }
  }

  // Lookup and set the entry's favicon
  let iconURL;
  const query = new FaviconLookup();
  query.cache = this.iconCache;
  query.skipURLFetch = true;
  // Only use the document for lookup if it was fetched
  const lookupDocument = response ? entryDocument : undefined;
  try {
    iconURL = await query.lookup(urlObject, lookupDocument);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // lookup error is non-fatal
      // fall through leaving iconURL undefined
    }
  }
  entry.faviconURLString = iconURL || this.feedFaviconURL;

  // Filter the entry content
  if(entryDocument) {
    await filterDocument(entryDocument, urlObject.href, this.fetchImageTimeoutMs);
    entry.content = entryDocument.documentElement.outerHTML.trim();
  } else {
    entry.content = 'Empty or malformed content';
  }

  try {
    await entryAdd(entry, this.readerConn);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      return false;
    }
  }

  return true;
}

// TODO: inline?
function entryExists(url, conn) {
  return rdb.findEntryByURL(conn, url.href);
}

// TODO: inline?
// Return true if url should not be polled
// @param url {URL}
function isUnpollableURL(url) {
  return isInaccessibleContentURL(url) || sniffIsBinaryURL(url);
}

// Return true if url contains inaccessible content
function isInaccessibleContentURL(url) {
  for(const descriptor of INACCESSIBLE_CONTENT_DESCRIPTORS) {
    if(descriptor.hostname === url.hostname) {
      return true;
    }
  }
  return false;
}

// TODO: this should be configured somewhere else, I don't know, config.js or something
// TODO: should not have to enumerable subdomains, compare top domains, use the function
// getUpperDomain from url.js (currently not exported). Or use regexs

const INACCESSIBLE_CONTENT_DESCRIPTORS = [
  {hostname: 'www.forbes.com', reason: 'interstitial'},
  {hostname: 'www.forbes.com', reason: 'interstitial'},
  {hostname: 'productforums.google.com', reason: 'script-generated'},
  {hostname: 'groups.google.com', reason: 'script-generated'},
  {hostname: 'www.nytimes.com', reason: 'paywall'},
  {hostname: 'nytimes.com', reason: 'paywall'},
  {hostname: 'myaccount.nytimes.com', reason: 'paywall'},
  {hostname: 'open.blogs.nytimes.com', reason: 'paywall'},
  {hostname: 'www.heraldsun.com.au', reason: 'requires-cookies'},
  {hostname: 'ripe73.ripe.net', reason: 'requires-cookies'}
];
