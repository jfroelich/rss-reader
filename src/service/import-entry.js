import * as db from '/src/db/db.js';
import * as favicon from '/src/lib/favicon.js';
import * as rss from '/src/service/resource-storage-service.js';
import * as urlSniffer from '/src/lib/url-sniffer.js';
import { INDEFINITE } from '/src/lib/deadline.js';
import { applyAllDOMFilters } from '/src/lib/dom-filters/dom-filters.js';
import fetchHTML from '/src/lib/fetch-html.js';
import parseHTML from '/src/lib/parse-html.js';
import setBaseURI from '/src/lib/set-base-uri.js';

export function ImportEntryArgs() {
  this.entry = undefined;
  this.feed = undefined;
  this.conn = undefined;
  this.iconn = undefined;
  this.rewriteRules = [];
  this.inaccessibleContentDescriptors = [];
  this.fetchHTMLTimeout = INDEFINITE;
}

// Imports the entry into the model if it does not already exist. Returns the new entry's id if the
// entry was added. Throws a NotFoundError if the entry exists.
export async function importEntry(args) {
  const { entry } = args;

  console.debug('Importing entry', entry);

  // Rewrite the entry's url. This is always done before processing, so there
  // no need to check whether the original url exists in the database.
  const originalURL = db.getURL(entry);
  const rewrittenURL = rewriteURL(originalURL, args.rewriteRules);
  db.setURL(entry, rewrittenURL);

  // Check if the entry with the possibly rewritten url already exists
  const afterRewriteURL = db.getURL(entry);
  const existingEntry = await rss.getEntry(args.conn, {
    mode: 'url', url: afterRewriteURL, keyOnly: true
  });

  if (existingEntry) {
    const message = `The entry with url ${afterRewriteURL.href} already exists.`;
    throw new db.ConstraintError(message);
  }

  // Fetch the entry's full content. Rethrow any errors.
  const fetchURL = db.getURL(entry);
  const response = await fetchEntryHTML(fetchURL, args.fetchHTMLTimeout,
    args.inaccessibleContentDescriptors);

  // Handle redirection
  if (response) {
    const responseURL = new URL(response.url);
    if (fetchURL.href !== responseURL.href) {
      db.setURL(entry, responseURL);

      const rewrittenURL = rewriteURL(responseURL, args.rewriteRules);
      db.setURL(entry, rewrittenURL);

      const existingEntry = rss.getEntry(args.conn, {
        mode: 'url', url: rewrittenURL, keyOnly: true
      });
      if (existingEntry) {
        const message = `The entry with url ${rewrittenURL.href} already exists.`;
        throw new db.ConstraintError(message);
      }
    }
  }

  // Get the full text as a Document. Favor the fetched full text over the in-feed-xml summary. We
  // do this before the favicon lookup so as to provide favicon lookup the ability to inspect the
  // document header.
  let doc;
  if (response) {
    const fullText = await response.text();
    doc = parseHTML(fullText);
  } else {
    doc = parseHTML(entry.content || '');
  }

  // This must occur before doing favicon lookups because the lookup may inspect the document and
  // expects DOM element property getters like image.src to have the proper base uri set.
  setBaseURI(doc, db.getURL(entry));

  if (args.iconn) {
    // Only provide if doc came from remote. If it came from feed-xml then it will not have embedded
    // favicon link.
    const lookupDocument = response ? doc : undefined;
    await setEntryFavicon(entry, args.iconn, lookupDocument);
  }

  // If title was not present in the feed xml, try and pull it from fetched content
  if (!entry.title && response && doc) {
    const titleElement = doc.querySelector('html > head > title');
    if (titleElement) {
      entry.title = titleElement.textContent.trim();
    }
  }

  await applyAllDOMFilters(doc, args.filterOptions);
  entry.content = doc.documentElement.outerHTML;

  entry.type = 'entry';
  return db.createResource(args.conn, entry);
}

async function setEntryFavicon(entry, conn, doc) {
  const request = new favicon.LookupRequest();
  request.url = db.getURL(entry);
  request.conn = conn;
  request.document = doc;
  const iconURL = await favicon.lookup(request);
  if (iconURL) {
    entry.favicon_url = iconURL.href;
  }
}

function fetchEntryHTML(url, timeout, inaccessibleContentDescriptors) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    return undefined;
  }

  const sniffedResourceClass = urlSniffer.classify(url);
  if (sniffedResourceClass === urlSniffer.BINARY_CLASS) {
    return undefined;
  }

  // Avoid fetching if url matches one of the descriptors
  for (const desc of inaccessibleContentDescriptors) {
    if (desc.pattern && desc.pattern.test(url.hostname)) {
      return undefined;
    }
  }

  const fetchOptions = {};
  fetchOptions.timeout = timeout;
  // allow for text/plain as web page mime type
  fetchOptions.allowText = true;

  return fetchHTML(url, fetchOptions);
}

export function rewriteURL(url, rules) {
  let prev = url;
  let next = url;
  for (const rule of rules) {
    prev = next;
    next = rule(prev) || prev;
  }
  return next;
}
