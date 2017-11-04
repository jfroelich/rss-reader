'use strict';

// import base/assert.js
// import base/errors.js
// import net/fetch.js
// import net/url-utils.js
// import poll/poll-document-filter.js
// import entry.js
// import favicon.js
// import feed.js
// import html.js
// import reader-db.js
// import reader-storage.js
// import rewrite-url-utils.js

class PollEntryContext {
  constructor() {
    this.readerConn = null;
    this.iconConn = null;
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
  if(!URLUtils.isValid(url)) {
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
    entryDocument = htmlParseFromString(entryContent);
  } catch(error) {
    if(error instanceof AssertionError) {
      throw error;
    } else {
      // ignore parse error
    }
  }

  // Only use the document for lookup if it was fetched
  const lookupDocument = response ? entryDocument : undefined;
  // Ignore icon update failure, do not need to check status
  await pollEntryUpdateIcon.call(this, entry, lookupDocument);

  let status;
  // Filter the entry content
  if(entryDocument) {
    status = await pollDocumentFilter(entryDocument, url,
      this.fetchImageTimeoutMs);

    if(status !== RDR_OK) {
      return false;
    }

    entry.content = entryDocument.documentElement.outerHTML.trim();
  } else {
    entry.content = 'Empty or malformed content';
  }

  status = await readerStorageAddEntry(entry, this.readerConn);
  if(status !== RDR_OK) {
    return false;
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

  const query = new FaviconQuery();
  query.conn = this.iconConn;
  query.url = new URL(entryPeekURL(entry));
  query.skipURLFetch = true;
  query.document = document;

  // TODO: once faviconLookup returns status, then no need for try/catch. Until
  // then, trap the exception to prevent this function from throwing in the
  // ordinary case.

  let iconURL;
  try {
    iconURL = await faviconLookup(query);
  } catch(error) {
    console.warn(error);
    // lookup error is non-fatal
  }

  entry.faviconURLString = iconURL || this.feedFaviconURL;
  return RDR_OK;
}

async function pollEntryPollable(url, conn) {
  const urlObject = new URL(url);
  const hostname = urlObject.hostname;

  if(pollEntryURLIsInterstitial(urlObject)) {
    console.debug('interstitial', url);
    return false;
  }

  if(pollEntryURLIsScripted(urlObject)) {
    console.debug('script-generated-content', url);
    return false;
  }

  if(pollEntryURLIsPaywall(hostname)) {
    console.debug('paywall', url);
    return false;
  }

  if(pollEntryURLRequiresCookie(hostname)) {
    console.debug('requires cookie', url);
    return false;
  }

  if(URLUtils.sniffIsBinary(urlObject)) {
    console.debug('binary resource', url);
    return false;
  }

  // TODO: this should be a call to something like
  // reader_storage_contains_entry that abstracts how
  // entry comparison works

  let exists;
  try {
    exists = await readerDbFindEntryByURL(conn, url);
  } catch(error) {
    console.warn(error);
    return false;
  }

  return !exists;
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
