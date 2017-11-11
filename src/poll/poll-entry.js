'use strict';

// import poll/poll-document-filter.js
// import entry.js
// import favicon-cache.js
// import favicon-lookup.js
// import feed.js
// import fetch.js
// import html.js
// import html-parser.js
// import rbl.js
// import reader-db.js
// import reader-storage.js
// import rewrite-url.js
// import url.js

class PollEntryContext {
  constructor() {
    this.readerConn = null;
    this.iconCache = null;
    this.feedFaviconURL = null;
    this.fetchHTMLTimeoutMs = undefined;
    this.fetchImageTimeoutMs = undefined;
  }
}

// @param this {PollEntryContext}
// @throws AssertionError
async function pollEntry(entry) {
  assert(this instanceof PollEntryContext);
  assert(entryIsEntry(entry));

  // Cannot assume entry has url
  if(!entryHasURL(entry)) {
    return false;
  }

  let url = entryPeekURL(entry);
  if(!isValidURL(url)) {
    return false;
  }

  const rewrittenURL = rewriteURL(url);
  if(rewrittenURL && url !== rewrittenURL) {
    entryAppendURL(entry, rewrittenURL);
    url = rewrittenURL;
  }

  if(!await pollEntryPollable(url, this.readerConn)) {
    return false;
  }

  const response = await pollEntryFetch(url, this.fetchHTMLTimeoutMs);
  let entryContent = entry.content;
  if(response) {
    if(response.redirected) {
      if(!await pollEntryPollable(response.responseURL, this.readerConn)) {
        return false;
      }

      entryAppendURL(entry, response.responseURL);
      // TODO: attempt to rewrite the redirected url as well?
      url = response.responseURL;
    }

    // Use the full text of the response in place of the in-feed content
    entryContent = await response.text();
  }

  let entryDocument;
  try {
    entryDocument = HTMLParser.parseDocumentFromString(entryContent);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // ignore parse error
    }
  }

  // Only use the document for lookup if it was fetched
  const lookupDocument = response ? entryDocument : undefined;

  try {
    await pollEntryUpdateIcon.call(this, entry, lookupDocument);
  } catch(error) {
    // Ignore icon update failure
  }


  // Filter the entry content
  if(entryDocument) {
    await pollDocumentFilter(entryDocument, url, this.fetchImageTimeoutMs);

    entry.content = entryDocument.documentElement.outerHTML.trim();
  } else {
    entry.content = 'Empty or malformed content';
  }

  try {
    await readerStorageAddEntry(entry, this.readerConn);
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
async function pollEntryUpdateIcon(entry, document) {
  assert(entryIsEntry(entry));
  assert(this instanceof PollEntryContext);

  if(document) {
    assert(document instanceof Document);
  }

  const query = new FaviconLookup();
  query.cache = this.iconCache;
  query.skipURLFetch = true;

  let iconURL;
  try {
    iconURL = await query.lookup(new URL(entryPeekURL(entry)), document);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      console.debug(error);
      // lookup error is non-fatal
      // fall through leaving iconURL undefined
    }
  }

  entry.faviconURLString = iconURL || this.feedFaviconURL;
}

async function pollEntryPollable(url, conn) {
  const urlObject = new URL(url);
  const hostname = urlObject.hostname;

  if(pollEntryURLIsInterstitial(urlObject)) {
    return false;
  }

  if(pollEntryURLIsScripted(urlObject)) {
    return false;
  }

  if(pollEntryURLIsPaywall(hostname)) {
    return false;
  }

  if(pollEntryURLRequiresCookie(hostname)) {
    return false;
  }

  if(sniffIsBinaryURL(urlObject)) {
    return false;
  }

  // TODO: this should be a call to something like
  // readerStorageHasEntry that abstracts how entry comparison works
  try {
    const exists = await readerDbFindEntryByURL(conn, url);
    return !exists;
  } catch(error) {
    console.warn(error);
    return false;
  }
}

function pollEntryURLIsInterstitial(url) {
  const hosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  return hosts.includes(url.hostname);
}

function pollEntryURLIsScripted(url) {
  const hosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  return hosts.includes(url.hostname);
}

function pollEntryURLIsPaywall(hostname) {
  const hosts = [
    'www.nytimes.com',
    'myaccount.nytimes.com',
    'open.blogs.nytimes.com'
  ];
  return hosts.includes(hostname);
}

function pollEntryURLRequiresCookie(hostname) {
  const hosts = [
    'www.heraldsun.com.au',
    'ripe73.ripe.net'
  ];
  return hosts.includes(hostname);
}
