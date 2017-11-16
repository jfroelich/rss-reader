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

  let urlString = Entry.peekURL(entry);

  // If a url parsing error occurs, it is fatal to polling the entry.
  const urlObject = new URL(urlString);

  // If a rewrite error occurs, it is fatal to polling the entry
  const rewrittenURL = rewriteURL(urlObject.href);
  if(rewrittenURL && urlObject.href !== rewrittenURL) {
    // If an appendURL error occrs, it is fatal to polling the entry
    Entry.appendURL(entry, rewrittenURL);
    setURLHrefProperty(urlObject, rewrittenURL);
  }

  if(!await isPollableEntryURL(urlObject, this.readerConn)) {
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
      if(!await isPollableEntryURL(new URL(response.responseURL), this.readerConn)) {
        return false;
      }

      Entry.appendURL(entry, response.responseURL);

      // TODO: attempt to rewrite the redirected url as well?

      // Change urlObject to the redirected url
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

  // Only use the document for lookup if it was fetched
  const lookupDocument = response ? entryDocument : undefined;
  try {
    await updateEntryIcon.call(this, entry, lookupDocument);
  } catch(error) {
    // Ignore icon update failure
  }

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

// @param entry {Object} a feed entry
// @param document {Document} optional, pre-fetched document
async function updateEntryIcon(entry, document) {
  assert(Entry.isEntry(entry));
  assert(this instanceof PollEntryContext);

  if(document) {
    assert(document instanceof Document);
  }

  // TODO: this should be a parameter of type URL and done externally
  const pageURL = new URL(Entry.peekURL(entry));


  let iconURL;

  const query = new FaviconLookup();
  query.cache = this.iconCache;
  query.skipURLFetch = true;
  try {
    iconURL = await query.lookup(pageURL, document);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      console.debug(error);// temp
      // lookup error is non-fatal
      // fall through leaving iconURL undefined
    }
  }

  entry.faviconURLString = iconURL || this.feedFaviconURL;
}

// @param url {URL}
async function isPollableEntryURL(url, conn) {

  // TODO: rather than separate functions, use a single list that flags the reason each url
  // is in the list?

  if(isInterstitialURL(url)) {
    return false;
  }
  if(isScriptedURL(url)) {
    return false;
  }
  if(isPaywallURL(url)) {
    return false;
  }
  if(isRequiresCookieURL(url)) {
    return false;
  }
  if(sniffIsBinaryURL(url)) {
    return false;
  }

  // TODO: this should be a call to something like "hasEntry" that abstracts how entry comparison
  // works
  // TODO: this is the only reason this function is async. It kind of doesn't need to be async if
  // I move this call out of here.
  // TODO: more than that, this doesn't even belong to isPollableEntryURL, it is outside the
  // scope of the test's meaning

  // If a database error occurs, allow it to bubble
  const exists = await rdb.findEntryByURL(conn, url.href);
  return !exists;
}

function isInterstitialURL(url) {
  const hosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  return hosts.includes(url.hostname);
}

function isScriptedURL(url) {
  const hosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  return hosts.includes(url.hostname);
}

function isPaywallURL(url) {
  const hosts = [
    'www.nytimes.com',
    'myaccount.nytimes.com',
    'open.blogs.nytimes.com'
  ];
  return hosts.includes(url.hostname);
}

function isRequiresCookieURL(url) {
  const hosts = [
    'www.heraldsun.com.au',
    'ripe73.ripe.net'
  ];
  return hosts.includes(url.hostname);
}
