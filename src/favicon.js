// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.favicon = {};

/**
 * Returns a URL string pointing to the fav icon for a url. If url is
 * undefined/empty, the locally stored default fav icon url is returned
 * instead.
 *
 * NOTE: chrome://favicons/url only works for urls present in
 * history, so it is useless.
 * TODO: this should be using a callback, to allow for more seamless
 * transition to async service call.
 * TODO: support offline. right now this returns a remote url which
 * then causes images to not load later if offline.
 * TODO: this is should be refactored to look more like a wrapper call
 * to a service from which urls are fetched.
 * TODO: does it matter whether we use http or https?
 * TODO: does fetching involve CORS issues or need to change manifest
 * or similar issues? If I ever want to stop using all_urls, the
 * URLs used here would maybe need to be explicit in manifest?
 *
 * @param url {String} the url of a webpage for which to find the
 * corresponding fav icon.
 * @return {String} the url of the favicon
 */
lucu.favicon.getURL = function(url) {
  return url ?
    'http://www.google.com/s2/favicons?domain_url=' + encodeURIComponent(url) :
    lucu.favicon.DEFAULT_URL;
};

lucu.favicon.DEFAULT_URL  = '/media/rss_icon_trans.gif';
