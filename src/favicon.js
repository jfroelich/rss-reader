// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Returns a url string pointing to the favicon associated with the input
// url string.
// NOTE: I originally rolled my own thing that did url parsing and
// looked for a url. I gave up on that and just use Google's own
// favicon service. I am still considering my own local service.
// TODO: this doesn't cache, which means every image request is going out,
// and the browser might cache, but otherwise it is providing tracking
// information. So maybe this should be async and store a local cache.
// TODO: I should probably store the post-redirect url as a feed property and
// query against that property on display, instead of calling this function
// per article.
function favicon_get_url(urlString) {

  if(urlString) {
    return 'http://www.google.com/s2/favicons?domain_url=' +
      encodeURIComponent(urlString);
  } else {
    return '/images/rss_icon_trans.gif';
  }
}

/////// BELOW IS BRAINSTORMING CODE
// The idea is to provide a self-contained service that provides fav-icon
// functionality.

function FavIcon() {

}

// Returns the url string of the favicon corresponding to the domain of the
// url string. If an error occurs, then this returns undefined.
// Actually this has to consider async behavior, so it needs a callback.
// Do I want to return a default url here? Or is that the responsibility of the
// caller? Or maybe it is an instance variable of FavIcon?
// Do I want to return a URL object? Is that possible? Has the URL object
// stabilized?
// https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
// Do I want to store urls in the database, so that live requests still go out,
// or do I want to instead store data url objects and instead serialize those
// in the database and work completely offline and not send additional requests?
// There is something with meta tags or link rel attribute i think that I have
// to consider

// This expects a URL object, not a url string
// TODO: or maybe I should expect a string and internally convert it to a
// url? That way the caller doesn't need the try catch around the constructor
// because it throws a malformed url error?

FavIcon.prototype.getFavIconURLString = function(urlObject, callback) {
  const toString = Object.prototype.toString;

  if(!callback) {
    console.log('callback is undefined:', callback);
    return;
  }

  if(toString.call(callback) !== '[object Function]') {
    console.log('callback is not a function:', callback);
    return;
  }

  if(!urlObject) {
    console.log('urlObject is undefined:', urlObject);
    callback();
    return;
  }

  if(toString.call(urlObject) !== '[object URL]') {
    console.debug('urlObject is not of type URL:', urlObject);
    callback();
    return;
  }

  // TODO: Do an implementation that properly follows the spec first, then
  // think about performance improvements. What are the key requirements?

  // One idea is that I could just check the cache. If the icon is present in
  // the cache, return it. Otherwise, I could queue it for eventual update so
  // that at some point later it will still be in the cache.

  // Also, I am not sure what I want to cache. Maybe I want a data uri stored
  // instead of the raw url. That way there are no additional http requests.
  // On the other hand, the browser naturally caches such requests and so
  // I wouldn't be pinging much of the time.


  //https://www.w3.org/TR/html5/links.html#rel-icon
  // "In the absence of a link with the icon keyword, for Documents obtained
  // over HTTP or HTTPS, user agents may instead attempt to fetch and use an
  // icon with the absolute URL obtained by resolving the URL "/favicon.ico"
  // against the document's address, as if the page had declared that icon
  // using the icon keyword."


  // So that is the problem, I really do not want to send out extra requests.
  // In fact I already retrieved page some time earlier. Maybe I can request
  // a cache update there when the page is retrieved?


  // Get the origin of the url
  const originString = urlObject.origin;
  if(!originString) {
    // ...
  }


  // Look in the cached fav icon url for the domain. If it is found, return it
  // and exit.
  // Check whether we are online using navigator.onLine. If we are unable to
  // check that we are online, continue. If we are online, continue. If we
  // are offline, then exit.
  // If it is not found, lookup the favicon for the domain online.
  // If a domain is present and has a favicon, update the cache and return
  // the favicon url and exit.
  // When updating the cache, store the date last updated.
  // If it is not found online, callback with an error.
};

// The idea here is that I may want to reset the cache occassionally during
// testing. This would simply clear all the data.
FavIcon.prototype.reset = function() {
  throw new Error('Not yet implemented');
};

// This is a function that can be called on a schedule, it would update the
// cache.
FavIcon.prototype.refresh = function() {
  throw new Error('Not yet implemented');
};
