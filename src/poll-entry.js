// For polling an individual entry when polling feeds

import assert from "/src/assert.js";
import * as Entry from "/src/entry.js";
import {isUncheckedError} from "/src/errors.js";
import FaviconLookup from "/src/favicon-lookup.js";
import {fetchHTML} from "/src/fetch.js";
import filterDocument from "/src/filter-document.js";
import parseHTML from "/src/parse-html.js";
import * as rdb from "/src/rdb.js";
import {entryAdd} from "/src/reader-storage.js";
import rewriteURL from "/src/rewrite-url.js";
import {sniffIsBinaryURL} from "/src/url.js";
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

// @param this {PollEntryContext}
export async function pollEntry(entry) {
  assert(this instanceof PollEntryContext);
  assert(Entry.isEntry(entry));

  // TEMP: researching undesired behavior. After fetch error either here or in poll-feeds, I am not
  // sure which, causes connection to be closed before calls to storing entry. So detect if
  // connection closed and exit. This error is most likely related to recent switch to module
  // transition, I screwed something up and not sure what. Or this error has always been present
  // and I am only now experiencing it. I cannot reproduce it easily at the moment.
  if(!rdb.isOpen(this.readerConn)) {
    console.warn('canceled pollEntry, readerConn not open');
    return;
  }

  // Cannot assume entry has url. There are no earlier steps in the pipeline of processing a
  // feed that guarantee this.
  // TODO: maybe this should be an exception?
  if(!Entry.hasURL(entry)) {
    return false;
  }

  let urlString = Entry.peekURL(entry);

  // This is declared let instead of const currently due to issues with changing the href property
  // of a url object. This may change in the future.
  // If a url parsing error occurs, it is fatal to polling the entry.
  let urlObject = new URL(urlString);

  const rewrittenURL = rewriteURL(urlObject.href);
  if(rewrittenURL && urlObject.href !== rewrittenURL) {
    Entry.appendURL(entry, rewrittenURL);

    // TODO: maybe it makes sense to make some kind of helper function in url.js that makes the
    // issue with setting the href very explicit. Revisit this after finishing the transition to
    // using urlObject in place of urlString.

    // Even though it would make more sense to simply set the href property of the urlObject and
    // not create a new object, the href setter does not seem to undergo the same checks that are
    // done in the URL constructor. For example, setting the href happily allows me to destroy the
    // validity of the url. Compare new URL("not a url!") to url.href = "not a url!".  Therefore,
    // I am changing the url by pointing it to a new object.
    urlObject = new URL(rewrittenURL);
  }

  if(!await isPollableEntryURL(urlObject.href, this.readerConn)) {
    return false;
  }

  const response = await pollEntryFetch(urlObject.href, this.fetchHTMLTimeoutMs);
  let entryContent = entry.content;
  if(response) {
    if(response.redirected) {
      if(!await isPollableEntryURL(response.responseURL, this.readerConn)) {
        return false;
      }

      Entry.appendURL(entry, response.responseURL);
      // TODO: attempt to rewrite the redirected url as well?

      // TODO: see earlier notes in this function on changing url
      urlObject = new URL(response.responseURL);
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
      // Ignore parse error
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

async function pollEntryFetch(url, timeout) {
  let response;
  try {
    response = await fetchHTML(url, timeout);
  } catch(error) {
  }
  return response;
}

// @param entry {Object} a feed entry
// @param document {Document} optional, pre-fetched document
async function updateEntryIcon(entry, document) {
  assert(Entry.isEntry(entry));
  assert(this instanceof PollEntryContext);

  if(document) {
    assert(document instanceof Document);
  }

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

// TODO: this should accept a URL object as input. I am currently in the process of doing this.
// In order to do this I first have to change the caller to work with a url object.
async function isPollableEntryURL(url, conn) {
  const urlObject = new URL(url);
  const hostname = urlObject.hostname;

  if(isInterstitialURL(urlObject)) {
    return false;
  }

  if(isScriptedURL(urlObject)) {
    return false;
  }

  if(isPaywallURL(hostname)) {
    return false;
  }

  if(isRequiresCookieURL(hostname)) {
    return false;
  }

  if(sniffIsBinaryURL(urlObject)) {
    return false;
  }

  // TODO: this should be a call to something like "hasEntry" that abstracts how entry comparison
  // works
  try {
    const exists = await rdb.findEntryByURL(conn, url);
    return !exists;
  } catch(error) {
    console.warn(error);
    return false;
  }
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

function isPaywallURL(hostname) {
  const hosts = [
    'www.nytimes.com',
    'myaccount.nytimes.com',
    'open.blogs.nytimes.com'
  ];
  return hosts.includes(hostname);
}

function isRequiresCookieURL(hostname) {
  const hosts = [
    'www.heraldsun.com.au',
    'ripe73.ripe.net'
  ];
  return hosts.includes(hostname);
}
