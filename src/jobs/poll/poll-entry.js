import assert from "/src/assert/assert.js";
import {INACCESSIBLE_CONTENT_DESCRIPTORS} from "/src/config.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import FeedStore from "/src/feed-store/feed-store.js";
import fetchHTML from "/src/fetch/fetch-html.js";
import applyAllDocumentFilters from "/src/filters/apply-all.js";
import parseHTML from "/src/html/parse.js";
import rewriteURL from "/src/jobs/poll/rewrite-url.js";
import * as Entry from "/src/feed-store/entry.js";
import sniffIsBinaryURL from "/src/url/sniff.js";
import {setURLHrefProperty} from "/src/url/url.js";
import {isValidURLString} from "/src/url/url-string.js";
import check from "/src/utils/check.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";

export class Context {
  constructor() {
    /* FeedStore */ this.feedStore;
    /* FaviconCache */ this.iconCache;
    /* BroadcastChannel */ this.channel;

    // TODO: this doesn't need to be called feedFaviconURL, it just represents the fallback url,
    // so it would be better named as something like defaultFaviconURL
    this.feedFaviconURL;
    this.fetchHTMLTimeoutMs = undefined;
    this.fetchImageTimeoutMs = undefined;
  }
}

// Returns the added entry if added. Otherwise returns undefined if the entry already existed
// or was otherwise not pollable. Throws various errors.
// @param this {Context}
export async function pollEntry(entry) {
  assert(this instanceof Context);
  assert(this.feedStore instanceof FeedStore);
  assert(this.feedStore.isOpen());
  assert(this.iconCache instanceof FaviconCache);
  assert(this.iconCache.isOpen());
  assert(Entry.isEntry(entry));

  // Cannot assume the entry has a url (not an error)
  if(!Entry.hasURL(entry)) {
    return;
  }

  // If the entry has a url, then assume it is absolute.
  const url = new URL(Entry.peekURL(entry));
  const rewrittenURL = rewriteURL(url.href);
  if(rewrittenURL && url.href !== rewrittenURL) {
    Entry.appendURL(entry, rewrittenURL);
    setURLHrefProperty(url, rewrittenURL);
  }

  if(isNonContentURL(url) || isInaccessibleContentURL(url) || sniffIsBinaryURL(url)) {
    return;
  }

  if(await this.feedStore.findEntryIdByURL(url.href)) {
    return;
  }

  let entryContent = entry.content;

  const response = await fetchHTMLHelper.call(this, url);
  if(response) {
    if(response.redirected) {
      const responseURL = new URL(response.responseURL);
      if(isNonContentURL(responseURL) || isInaccessibleContentURL(responseURL) ||
        sniffIsBinaryURL(responseURL)) {
        return;
      }

      if(await this.feedStore.findEntryIdByURL(responseURL.href)) {
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

  // TODO: if entry.title is undefined, try and extract it from entryDocument title element
  // For that matter, the whole 'set-entry-title' component should be abstracted into its own
  // module that deals with the concerns of the variety of sources for an entry?

  // Filter the entry content
  if(entryDocument) {
    await applyAllDocumentFilters(entryDocument, url, this.fetchImageTimeoutMs);
    entry.content = entryDocument.documentElement.outerHTML.trim();
  } else {
    entry.content = 'Empty or malformed content';
  }

  const newEntryId = await this.feedStore.addEntry(entry, this.channel);
  return newEntryId;
}

async function fetchHTMLHelper(url) {
  assert(this instanceof Context);
  assert(url instanceof URL);

  let response;
  try {
    response = await fetchHTML(url, this.fetchHTMLTimeoutMs);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore, not fatal
    }
  }

  return response;
}

// Return true if url contains inaccessible content
function isInaccessibleContentURL(url) {
  for(const desc of INACCESSIBLE_CONTENT_DESCRIPTORS) {
    if(desc.pattern && desc.pattern.test(url.hostname)) {
      return true;
    }
  }
  return false;
}

function isNonContentURL(url) {
  const protocols = ['tel:', 'mailto:', 'data:'];
  return protocols.includes(url.protocol);
}
