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
    console.warn('canceled pollEntry, readerConn connection not open');
    return;
  }

  // Cannot assume entry has url
  if(!Entry.hasURL(entry)) {
    return false;
  }

  let url = Entry.peekURL(entry);

  // TODO: I think that by this point I should be able to assume that if the entry has a url,
  // then it is a valid url, because invalid urls are weeded out earlier. I should clarify that
  // behavior. In any event, because of that assumption, this should technically be an assert
  // because this should never be true.
  if(!isValidURLString(url)) {
    return false;
  }

  const rewrittenURL = rewriteURL(url);
  if(rewrittenURL && url !== rewrittenURL) {
    Entry.appendURL(entry, rewrittenURL);
    url = rewrittenURL;
  }

  if(!await isPollableEntryURL(url, this.readerConn)) {
    return false;
  }

  const response = await pollEntryFetch(url, this.fetchHTMLTimeoutMs);
  let entryContent = entry.content;
  if(response) {
    if(response.redirected) {
      if(!await isPollableEntryURL(response.responseURL, this.readerConn)) {
        return false;
      }

      Entry.appendURL(entry, response.responseURL);
      // TODO: attempt to rewrite the redirected url as well?
      url = response.responseURL;
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
    await filterDocument(entryDocument, url, this.fetchImageTimeoutMs);

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

// TODO: this should accept a URL object as input
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
