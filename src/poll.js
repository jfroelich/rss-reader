// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: remove async dependency
// TODO: remove reliance on Feed.forEach, do explicit iteration here,
// or maybe make a function that generates the initial request at least, and
// then do the iteration (e.g. db_get_feeds_request)
// TODO: do not augment certain urls, such as links to google groups pages

// Requires: /lib/async.js
// Requires: /lib/parse-srcset.js
// Requires: /src/db.js
// Requires: /src/image.js
// Requires: /src/fetch-feed.js
// Requires: /src/notrack.js
// Requires: /src/resolve-urls.js
// Requires: /src/utils.js

function poll_start() {
  console.log('Starting poll ...');

  if(!poll_is_online()) {
    console.debug('Polling canceled because offline');
    return;
  }

  chrome.permissions.contains({permissions: ['idle']},
    poll_on_check_idle_permission);
}

function poll_is_online() {
  if(!navigator) {
    return true;
  }

  if(!navigator.hasOwnProperty('onLine')) {
    return true;
  }

  return navigator.onLine;
}

function poll_on_check_idle_permission(permitted) {
  const IDLE_PERIOD_IN_SECONDS = 60 * 5; // 5 minutes

  // If we are permitted to check idle state, then check it. Otherwise,
  // immediately continue to polling.
  if(permitted) {
    chrome.idle.queryState(IDLE_PERIOD_IN_SECONDS, poll_on_query_idle_state);
  } else {
    db.open(poll_iterate_feeds);
  }
}

function poll_on_query_idle_state(state) {
  if(state === 'locked' || state === 'idle') {
    // If we appear to be idle then start polling
    db.open(poll_iterate_feeds);
  } else {
    // We are not idle, so end polling
    console.debug('Polling canceled because not idle');
    poll_on_complete();
  }
}

// Iterate over the feeds in the database, and update each feed.
function poll_iterate_feeds(event) {
  // Exit early if there was a database connection error
  if(event.type !== 'success') {
    console.debug(event);
    poll_on_complete();
    return;
  }

  // TODO: rather than delegate iteration to the database, i would prefer to
  // control iteration here. However, we can still delegate the generation
  // of the cursor request to an external db function


  const connection = event.target.result;
  const boundFetchFeed = poll_fetch_feed.bind(null, connection);
  Feed.forEach(connection, boundFetchFeed, false, poll_on_complete);
}

function poll_fetch_feed(connection, feed) {
  const timeout = 10 * 1000;
  const onFetchFeedBound = poll_on_fetch_feed.bind(null, connection, feed);
  fetchFeed(feed.url, timeout, onFetchFeedBound);
}

function poll_on_fetch_feed(connection, feed, event, remoteFeed) {
  // Exit early if an error occurred while fetching. This does not
  // continue processing the feed or its entries. The event is only defined
  // if there was a fetch error.
  // TODO: rather than check if event is defined or not, check if event
  // has the proper type (e.g. type === 'load') or whatever it is
  if(event) {
    console.debug('Error fetching:', feed.url);
    console.dir(event);
    return;
  }

  // TODO: if we are cleaning up the properties in Feed.put,
  // are we properly cascading those cleaned properties to the entries?
  // is there any sanitization there that would need to be propagated?
  // maybe sanitization isn't a function of storage, and storage just
  // stores, and so this should be calling sanitize_before_store or
  // something to that effect that prepares a feed object for storage. in
  // fact that function creates a new storable object
  // TODO: also, it still is really unclear which feed is which, what is
  // feed and what is remoteFeed? How much of the original feed do I need?

  const onStoreFeedBound = poll_on_store_feed.bind(null, connection, feed,
    remoteFeed);
  Feed.put(connection, feed, remoteFeed, onStoreFeedBound);
}

// TODO: what's with the _?
function poll_on_store_feed(connection, feed, remoteFeed, _) {
  // TODO: stop using the async lib. Do custom async iteration here.

  async.forEach(remoteFeed.entries,
    poll_find_entry_by_link.bind(null, connection, feed),
    poll_on_entries_updated.bind(null, connection));
}

function poll_on_entries_updated(connection) {
  // Update the number of unread entries now that the number possibly changed
  // Pass along the current connection so that utils.updateBadgeText does not
  // have to create a new one.
  utils.updateBadgeText(connection);
}

// For an entry in the feed, check whether an entry with the same link
// already exists.
function poll_find_entry_by_link(connection, feed, entry, callback) {
  const transaction = connection.transaction('entry');
  const entries = transaction.objectStore('entry');
  const links = entries.index('link');
  const request = links.get(entry.link);

  const onFindEntryBound = poll_on_find_entry.bind(null, connection, feed,
    entry, callback);
  request.onsuccess = onFindEntryBound;
}

// If an existing entry was found, then exit early (callback with no args to
// async.forEach which means continue to the next entry). Otherwise, the entry
// doesn't exist. Get the full html of the entry. Update the properties of the
// entry. Then store the entry, and then callback to async.forEach.
function poll_on_find_entry(connection, feed, entry, callback, event) {
  const getEntryRequest = event.target;
  const localEntry = getEntryRequest.result;

  if(localEntry) {
    callback();
  } else {
    const timeout = 20 * 1000;
    poll_augment_entry_content(entry, timeout, onAugment);
  }

  function onAugment(event) {
    poll_cascade_feed_properties(feed, entry);
    Entry.put(connection, entry, callback);
  }
}

// Copy some properties from feed into entry prior to storage
function poll_cascade_feed_properties(feed, entry) {
  entry.feed = feed.id;

  // Denormalize now to avoid doing the lookup on render
  entry.feedLink = feed.link;
  entry.feedTitle = feed.title;

  // Use the feed's date for undated entries
  if(!entry.pubdate && feed.date) {
    entry.pubdate = feed.date;
  }
}

// The entire poll completed
function poll_on_complete() {
  console.log('Polling completed');
  localStorage.LAST_POLL_DATE_MS = '' +Date.now();
  utils.showNotification('Updated articles');
}

// TODO: move this into a separate lib?
// Fetch the full content for the entry
function poll_augment_entry_content(entry, timeout, callback) {
  const onFetchHTMLBound = poll_on_fetch_html.bind(null, entry, callback);
  poll_fetch_html(entry.link, timeout, onFetchHTMLBound);
}


// TODO: what is the default behavior of XMLHttpRequest? If responseType
// defaults to document and by default fetches HTML, do we even need to
// specify the type?
// TODO: instead of creating an error object when document is undefined, maybe
// this should create an event object so that it is minimally consistent with
// the other types of the first argument when the callback is called due to
// another type of error. I could use a plain javascript object with just the
// desired relevant properties, or I could research how to create custom
// events.
function poll_fetch_html(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = function on_timeout(event) {
    callback(event, null, request.responseURL);
  };
  request.onerror = function on_error(event) {
    callback(event, null, request.responseURL);
  };
  request.onabort = function on_abort(event) {
    callback(event, null, request.responseURL);
  };
  request.onload = function on_load(event) {
    let error = null;
    const document = request.responseXML;
    if(!document) {
      error = new Error('Undefined document for url ' + url);
    } else if(!document.documentElement) {
      error = new Error('Undefined document element for url ' + url);
    }
    callback(error, document, request.responseURL);
  };
  request.open('GET', url, true);
  request.responseType = 'document';
  request.send();
}

// If an error occurred when fetching the full html, exit early with a no-args
// callback to signal to async.forEach to continue to the next entry.
// Otherwise, clean up the html. Remove urls, set image sizes, resolve urls.
function poll_on_fetch_html(entry, callback, error, document, responseURL) {
  if(error) {
    console.debug(error);
    callback();
    return;
  }

  // TODO: eventually do something with this?
  if(responseURL !== entry.link) {
    console.debug('Response URL changed from %s to %s', entry.link,
      responseURL);
  }

  no_track_filter_elements(document);
  image_transform_lazily_loaded(document);
  resolve_urls(document, responseURL);
  const onSetDimensions = poll_on_set_image_dimensions.bind(null, entry,
    document, callback);
  image_dimensions_set_all(document, onSetDimensions);
}

// Upon setting the sizes of images, replace the content property of the entry,
// and then callback without arguments to signal to async.forEach to continue.
function poll_on_set_image_dimensions(entry, document, callback) {
  const documentElement = document.documentElement;
  if(documentElement) {
    const fullDocumentHTMLString = documentElement.outerHTML;
    if(fullDocumentHTMLString) {
      // Check for content length. This should reduce the number of empty
      // articles.
      // TODO: maybe I should be checking the content of body. In fact if
      // there is no body element, maybe this shouldn't even be replacing
      // entry.content at all. Maybe documentElement is the wrong thing
      // to consider. Maybe I want to check body but use the full content
      // of documentElement.
      // Also, maybe I want to use an substitute message.
      const trimmedString = fullDocumentHTMLString.trim();
      if(trimmedString) {
        entry.content = fullDocumentHTMLString;
      }
    }
  }

  callback();
}

/*

TODO:

- remove reliance on async so iteratefeeds knows when to stop

From augment-entry-content:
// Replaces the content property of an entry with the full text of its
// corresponding link url. The full text is modified so that it can be
// embedded and displayed locally. Relative urls are changed to absolute
// urls. Images without express dimensions are fetched and each image element's
// width and height attribtues are set.
// TODO: I'd prefer this function pass back any errors to the callback. This
// would require the caller that wants to not break from async.forEach early
// wrap the call.
// TODO: remove the interaction with async. I think rolling my own local
// iteration is sufficient and perhaps clearer.
// TODO: consider embedding/sandboxing iframes? This is currently handled at
// display time by filter-frame-elements.js. Because it is async and slow,
// maybe it makes more sense to do it here instead.
// TODO: would it make sense to store only the compressed html, after it has
// been 'scrubbed', prior to storage? it probably would. however, while i am
// debugging the scrubbing functionality, i am doing this when the page is
// displayed instead of before it is stored.
// TODO: scrubbing/html-tidy (e.g. remove images without src attribute?), note
// this ties into lazy-load-transform and also filter-tracer-elements. perhaps
// the sourceless images transform should be decoupled from filter-tracer to
// make it clearer. and lazy-load-transform should be somehow coupled with
// removing sourceless? or it should be run before.
// TODO: if pdf content type then maybe we embed iframe with src
// to PDF? also, we should not even be trying to fetch pdfs or similar non-html
// media formats?
// TODO: in hindsight, this function is just an arbitary composition of several
// steps that take place in the polling context, and maybe it shouldn't exist

// Temporary, testing responseURL ideas

// Observed cases:
// Response URL changed from http://priceonomics.tumblr.com/post/136338670161
// to
// http://priceonomics.tumblr.com/post/136338670161/the-rise-of-the-bomb-dog

// TODO: i have observed that sometimes the url changes simply because
// the trailing #hash was removed from the url, in which it is not
// really a redirect, so think about the appropriate behavior

// I suppose we could do a HEAD request earlier, but because we do not,
// and do not really need to do it earlier, I suppose that we could treat
// the current context as the first time we find the actual url of the
// article. Therefore, this _should_ be happening BEFORE we do a databasae
// lookup that checks whether an article already exists based on its URL,
// and this _should_ also obviously be happening before the article is ever
// stored. So actually, maybe doing an earlier HEAD request _is_ important,
// because of how this function is used within the caller context, its
// position in the chain of continuations that occur.

// So really, this functionality is outside the purpose of this function.
// It is the responsibility of the caller. But I really, really hate the
// idea of doing a HEAD request, because that leads to a ton of
// unnecessary HEAD requests when the article already exists, that leads to
// both a HEAD and a GET request when the article doesn't exist.

// With that approach, for as long as the article's original url is in the
// feed, we are going to be doing a HEAD request for it per poll, which is
// horrible. The only resource we want to hit repeatedly in a poll is
// the single feed file itself.

// Maybe we could slightly reduce the request count by doing two checks
// for existence. First we check if the original url exists. If it does,
// we can assume a no-redirect situation, and exit early. But if it does
// not exist, then we have to do GET, then a check for redirect, change if
// redirect, then check again for existence, and then do the processing.
// so really, this 'augment' code is coupling stuff

// But there is still a problem, in that for every article that does
// a redirect, we are forever thereafter doing a GET request to the original
// url. So this is still wrong. So basically, while url serves as a useful
// 'unique' id for purposes of storage and lookup of articles, it isn't good
// so actually, we want to go back to something else that checks for
// whether an article already exists. That something else is probably a
// hash of the content. Furthermore, we want to do a hash of the original
// content from within the feed (???), not the downloaded content, because
// that is only accessible after doing the GET request? Wait that is still
// messed up kind of. Hashing the original feed content does not really tell
// us whether two web pages (pointed to by entry.link) are actually the same
// document. It just says that the two feed entries are similar. But we still
// have the case where multiple articles in the same or different feeds by
// the same or different authors point to the same single web document,
// which is precisely the one we want to avoid doing duplicate requests
// against.

// Maybe there is some way of telling once an article has first been tested
// for whether it redirects, to flag it as such in storage, and then
// use that as an indicator that we shouldn't try to do new redirect tests?
// But that doesn't seem quite right. Multiple different original urls can
// redirect to the same url. And we cant tell that without doing a request.

// What if we store both the pre-redirect url, and the post-redirect url,
// in the article. We download the feed. For each entry, we check its
// link url against both properties to check for existence. If it exists,
// we are done with that entry. If it does not exist, we do a GET request.
// Then we do a second check. We check if the pre url matches the post
// url. If it matches, we proceed as normal, storing the new article. If
// it does not match, then we have to investigate further. The article
// could potentially already exist. Check post-redirect-url.
// If found, the article already exists, but it didn't pass the first check
// earlier ... so ... ? That means what? I think this is the route? Need
// to finish this thought but lost focus.
//  --- how did post-redirect-url get set in the first place
//  --- we can assume a original url's redirect is never changed to point to
//      a diff post-redirect url
// If not found, then store the new article (and include both pre and post
// properties)

// From fetch-image-dimensions:

// TODO: this also serves to check if an image's src is correct. consider
// removing 404 images or replacing them with an error message.
// so maybe this has to be a more general process-images document-transform?
// The idea is that we only want to touch images once.
// TODO: this needs to consider srcset, which makes it much more tricky,
// because there could be multiple dimensions to consider, and also, because
// filterSourcelessImages delegates responsive design loading mechanics to
// the browser. The current design makes this nearly impossible, e.g.
// shouldFetchImage doesn't even make sense
// TODO: decouple async to allow for passing parameters to callback

// From poll-feeds:
// TODO: customizable update schedules per feed
// TODO: backoff per feed if poll did not find updated content
// TODO: de-activation of feeds with 404s
// TODO: de-activation of too much time elapsed since feed had new articles
// TODO: only poll if feed is active
// TODO: store de-activated reason code
// TODO: store de-activated date
// TODO: pass along a stats histogram object that trackers poll stats
// TODO: navigator should be a dependency injection so it can be mocked?
// TODO: Database should be a dependency injection
// TODO: FeedStore should be a dependency injection
// TODO: FeedRequest should be a dependency injection
// TODO: EntryUtils should be a dependency injection
// TODO: showNotification should be a dependency injection
// TODO: async should be a dependncy injection? Maybe? Or maybe I should
// just completely get rid of this and roll my own like before, because
// I am not sure it is adding that much simplicity, and as noted, I
// am having trouble tracking when all requests are complete (see later)
// TODO: due to the large number of dependencies, make I should make
// it an object where the state is the dependencies? Maybe it would
// reduce the number of parameters passed around in continuations

// TODO: some entry link URLs from feeds are pre-chain-of-redirect-resolution,
// and are technically duplicates because each redirects to the same URL at the
// end of the redirect chain. Therefore we should be storing the terminal link,
// not the source link. Or maybe we should be storing both. That way a lookup
// will detect the article already exists and we store fewer dups
// I think that fetching does use responseURL, but we end up not using response
// URL at some point later in processing. Basically, the responseURL has to be
// detected at the point of augment, and we want to rewrite at that point
// So this note is here but technically this note belongs to several issues in
// the holistic view of the update process. Maybe it does not belong to subscribe
// and only to poll because maybe only poll should be downloading and augmenting
// entries, and subscribe should just add the feed and not add any entries because
// subscribe should be near instant. So subscribe should store the feed and then
// enqueue a one-feed poll update.

// TODO: i need to figure out how to bypass feedproxy.google.com and rewrite
// the url properly, because it is screwing up everything. not to mention it
// is tracking clicks.

// TODO: maybe have an option to exclude PDFs or embed PDFs as iframes or
// something like that

// TODO: use the new, more global, navigator.permission check instead of
// the extension API


--------
from transformLazyImages

// Eventually, this could be designed to work off a collection of rules
// Or we could look for all url-like attributes?
// http://stackoverflow.com/questions/1500260

// TODO: I am very sloppily just adding rules here as I find them. There is
// probably overlap and stuff is a bit off, overly specific or overly general.
// i will eventually have to pick the appropriate granularity.

// TODO: maybe i should check that the new url being chosen looks like an
// image url.
// we could impose the requirements that it either ends in a known image
// format, or has a ? indicating some type of cgi-generated image. it would
// fail sometimes but work most of the time. the result would be that we
// make fewer mistakes to creating requests to invalid urls
// NOTES: the common theme seems to be using a dataset property
// and missing a source (except in case 3 so far), so maybe we unify the
// rules? how general/specific do we want the transform? only observed cases?
// TODO: i would like to make this easily extendable without writing code,
// what is a good way to do that? use an array of rules?

------------

// from merge-multiple-page-document
// Note currently implemented. Just a placeholder for now. The idea is
// to investigate whether a page looks like it is spread over
// multiple pages, and if so, to get those other pages, merge
// them all together, and remove the paging elements
// Because we will be fetching other pages, this will be async, so we
// will use a callback that is called when the whole op completes
// The code for fetching a document may need to be made more general
// so that it can also be used here, although it is really rather
// simple html fetching

// TODO: think of a better name
// TODO: compare to domdistiller's technique
// TODO: compare to readability's technique

function mergeMultiplePageDocument(document, callback) {
}

------------
from resolveDocumentURLs

// TODO: fully support img srcset
// TODO: support style.backgroundImage?
// NOTE: not supporting applet
// NOTE: iframe.srcdoc?
// NOTE: ignores param values with URIs
// NOTE: not entirely sure why i have this see also comment, i think
// it was help in defining the attribute map below
// See also https://github.com/kangax/html-minifier/blob/
// gh-pages/src/htmlminifier.js
// NOTE: could stripping the base tag could lead to invalid urls???
// Should the base tag, if present, be considered when resolving elements?
// Also note that there could be multiple base tags, the logic for
// handling it properly is all laid out in some RFC standard somewhere,
// and is probably present in Webkit source.


// TODO: this should probably be rewritten to only inspect relevant attributes
// per element type, instead of a general map?

// TODO: use a more qualified or clearer function name for resolveElement,
this resolves the
// value for a particular url-containing attribute of the element

// from resolve image src set:
// TODO: now that this allows srcset, it needs to also resolve srcset urls,
// because they are leading to bad images:
// e.g.: <img width="18" height="18" src="/Design/graphics/icon/reddit.png"
// srcset="/Design/graphics/icon/reddit.svg" alt="reddit"> becomes
// <img src="http://www.theregister.co.uk/Design/graphics/icon/reddit.png"
// srcset="/Design/graphics/icon/reddit.svg" alt="reddit">
// and the srcset prevails (takes priority?) but is not an absolute url
// TODO: another idea is to have a transform that looks for both src and
// srcset, and if src is present, removes srcset
// NOTE: the caller only passes images that have a srcset attribute
// NOTE: this may also require https://github.com/mathiasbynens/he
// which is an html entity encoder/decoder
// which i have not tested or incorporated yet,
// i am basing that idea on the fact that alex's tests do
// encoding before calling parseSrcset
// as seen in
// https://github.com/albell/parse-srcset/blob/master/tests/unit/ps.js

----
fetch image notes
// NOTE: setting the src property of an HTMLImageElement has no
// effect if the document containing the image is inert, such as one
// created by createHTMLDocument or by XMLHttpRequest. So we implicitly
// create a new image element within the host document of this source
// file, which we assume is not inert.
// In onFetchImage, if event.type === 'error',
// It serves as a hint that the url is invalid however
// (even though it could be valid but temporarily unreachable)
*/
