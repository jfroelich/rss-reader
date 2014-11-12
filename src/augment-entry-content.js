// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Replaces the content of each entry with the html of its link.
 * If there is failure to fetch the html the content is left as is.
 * Each entry's link value may be rewritten: either by the rewrite
 * function or (possibly in the future) be set to the post-redirect-url
 *
 * NOTE: entries is 'pass-by-ref' so there is no need to pass it back
 * to onComplete since it is available and updated within the caller
 * context. That is, unless, I were to decide to return a new array
 * instead of the original? More like a async-map function?
 *
 * TODO: dont forget this is new file that must be included if used
 *
 * TODO: if pdf content type then maybe we embed iframe with src
 * to PDF? also, we should not even be trying to fetch pdfs? is this
 * just a feature of fetchHTML or does it belong here?
 *
 *
 * TODO: I think this should actually be a function that applies to
 * one entry at a time instead because it is async
 */
lucu.augmentEntryContent = function(entries, timeout, onComplete) {
  'use strict';

  // TODO: should the caller be responsible for filtering entries without
  // links? Is link the entry GUID now? Will it be in the future?

  // TODO: does link rewriting belong here? Is it really integral to
  // this particular function at this particular time? Clearly it has
  // to happen prior to this being called.

  // NOTE: this no longer checks whether an entry already exists
  // in the database. This just blindly fetches the html for
  // each entry. Why was I doing it? I think it is because I always
  // get a feed object when polling feeds and updating them, and
  // many of the entries already exist in the database for these.
  // I need to think of a better way to filter out entries from the
  // feed object that do not need to be fetched here. Perhaps as a
  // separate preprocessing step that occurs after fetching
  // the feed.
  // So really, this function should work off an array of feed
  // entries, not a feed object, because it does not need to be aware
  // of the other feed properties. Some other function should be
  // responsible for pre-filtering those entries that should not be
  // fetched here. This should just blindly fetch the html for all
  // entries in the array.

  // NOTE: setting image dimensions requires a live host document
  // to trigger fetches for images from each inert fetched
  // document. So we get a reference to one here. Right now this
  // using window explicitly, but I eventually want to not
  // reference it explicitly. I may not even want to declare it
  // here, but instead require the caller to set it as an
  // explicit parameter dependency.
  var hostDocument = window.document;

  lucu.asyncForEach(entries.filter(function (entry) {
    return entry.link;
  }).map(function (entry) {
    entry.link = lucu.rewriteURL(entry.link);
    return entry;
  }), function(entry, callback) {

    // TODO: set entry.link to responseURL??? Need to think about
    // whether and where this should happen. This also changes the result
    // of the exists-in-db call. In some sense, exists-in-db would have
    // to happen before?  Or maybe we just set redirectURL as a separate
    // property? We use the original url as id still? Still seems wrong.
    // It sseems like the entries array should be preprocessed each and
    // every time. Because two input links after redirect could point to
    // same url. So the entry-merge algorithm needs alot of thought. It
    // is not inherent to this function, but for the fact that resolving
    // redirects requires an HTTP request, and if not done around this
    // time, requires redundant HTTP requests.

    // if we rewrite then we cannot tell if exists pre/post fetch
    // or something like that. so really we just want redirect url
    // for purposes of resolving stuff and augmenting images.

    // we also want redirect url for detecting dups though. like if two
    // feeds (or even the same feed) include entries that both post-redirect
    //resolve to the same url then its a duplicate entry
    lucu.fetchHTML(entry.link, timeout, function (document, responseURL) {

      lucu.resolveElements(document, responseURL);

      var images = document.body.getElementsByTagName('img');
      lucu.asyncForEach(images,
        lucu.fetchImageDimensions.bind(this, hostDocument),
        function () {
        entry.content = document.body.innerHTML ||
          'Unable to download the full text of this article';
        callback();
      });

    }, function (error) {
      // TODO: set the entry content here to an error message?
      console.dir(error);
      callback();
    });
  }, onComplete);
};
