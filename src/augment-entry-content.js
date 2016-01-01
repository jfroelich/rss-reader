// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

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

function augmentEntryContent(entry, timeout, callback) {
  fetchHTML(entry.link, timeout,
    onFetchHTML.bind(null, entry, callback));
}

this.augmentEntryContent = augmentEntryContent;

function onFetchHTML(entry, callback, error, document, responseURL) {
  if(error) {
    console.debug(error);
    callback();
    return;
  }

  // Temporary, testing responseURL ideas

  // Observed cases:
  // Response URL changed from http://priceonomics.tumblr.com/post/136338670161 to
  // http://priceonomics.tumblr.com/post/136338670161/the-rise-of-the-bomb-dog

  if(responseURL !== entry.link) {
    console.debug('Response URL changed from %s to %s',
      entry.link,
      responseURL);

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
  }

  // Before calling resolveDocumentURLs, we try and do some minor scrubbing
  // of the document. For example, we try and fix the attributes of image
  // elements where some type of lazy-loading technique is occurring.
  transformLazyImages(document);

  resolveDocumentURLs(document, responseURL);
  fetchImageDimensions(document,
    onFetchImageDimensions.bind(null, entry, document, callback));
}

function onFetchImageDimensions(entry, document, callback) {
  const content = document.documentElement.innerHTML;
  if(content) {
    entry.content = content;
  }
  callback();
}

} // END ANONYMOUS NAMESPACE
