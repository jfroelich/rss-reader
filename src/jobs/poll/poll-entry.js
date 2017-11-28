import assert from "/src/assert/assert.js";
import {INACCESSIBLE_CONTENT_DESCRIPTORS} from "/src/config.js";
import * as Entry from "/src/reader-db/entry.js";
import {check, isUncheckedError} from "/src/utils/errors.js";
import FaviconLookup from "/src/favicon/lookup.js";
import fetchHTML from "/src/fetch/fetch-html.js";
import applyAllDocumentFilters from "/src/filters/apply-all.js";
import parseHTML from "/src/html/parse.js";
import entryAdd from "/src/reader-db/entry-add.js";
import findEntryIdByURLInDb from "/src/reader-db/find-entry-id-by-url.js";
import rewriteURL from "/src/jobs/poll/rewrite-url.js";
import sniffIsBinaryURL from "/src/url/sniff.js";
import {setURLHrefProperty} from "/src/url/url.js";
import {isValidURLString} from "/src/url/url-string.js";
import * as idb from "/src/utils/indexeddb-utils.js";

export class Context {
  constructor() {
    this.readerConn = null;
    this.iconCache = null;
    this.feedFaviconURL = null;
    this.fetchHTMLTimeoutMs = undefined;
    this.fetchImageTimeoutMs = undefined;
  }
}

// Returns the added entry if added. Otherwise returns undefined if the entry already existed
// or was otherwise not pollable. Throws various errors.
// @param this {Context}
export async function pollEntry(entry) {
  assert(this instanceof Context);
  assert(idb.isOpen(this.readerConn));
  assert(Entry.isEntry(entry));

  // Cannot assume entry has url (not an error)
  if(!Entry.hasURL(entry)) {
    return;
  }

  const url = new URL(Entry.peekURL(entry));
  const rewrittenURL = rewriteURL(url.href);
  if(rewrittenURL && url.href !== rewrittenURL) {
    Entry.appendURL(entry, rewrittenURL);
    setURLHrefProperty(url, rewrittenURL);
  }

  if(isInaccessibleContentURL(url) || sniffIsBinaryURL(url)) {
    return;
  }

  if(await findEntryIdByURLInDb(this.readerConn, url.href)) {
    return;
  }

  let response;
  try {
    response = await fetchHTML(url.href, this.fetchHTMLTimeoutMs);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore, not fatal
    }
  }

  let entryContent = entry.content;
  if(response) {
    if(response.redirected) {
      const responseURL = new URL(response.responseURL);

      if(isInaccessibleContentURL(responseURL) || sniffIsBinaryURL(responseURL)) {
        return;
      }

      if(await findEntryIdByURLInDb(this.readerConn, responseURL.href)) {
        return;
      }

      Entry.appendURL(entry, response.responseURL);

      // TODO: attempt to rewrite the redirected url as well?

      setURLHrefProperty(url, response.responseURL);
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
      // Ignore, not fatal
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
    iconURL = await query.lookup(url, lookupDocument);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore, not fatal
    }
  }
  entry.faviconURLString = iconURL || this.feedFaviconURL;

  // Filter the entry content
  if(entryDocument) {
    await applyAllDocumentFilters(entryDocument, url, this.fetchImageTimeoutMs);
    entry.content = entryDocument.documentElement.outerHTML.trim();
  } else {
    entry.content = 'Empty or malformed content';
  }

  return await entryAdd(entry, this.readerConn);
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
