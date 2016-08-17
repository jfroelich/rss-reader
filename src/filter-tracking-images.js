// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: hosts should be defined externally somehow so that if i want to
// change it, I don't have to change the code

// Use all lowercase to match hostname getter normalization
const HOSTS = new Set([
  'b.scorecardresearch.com',
  'googleads.g.doubleclick.net',
  'me.effectivemeasure.net',
  'pagead2.googlesyndication.com',
  'pixel.quantserve.com',
  'pixel.wp.com',
  'pubads.g.doubleclick.net',
  'sb.scorecardresearch.com'
]);

// Approximate
const MIN_LEN = 'http://a.tld/a'.length;

// TODO: can i just access image.src property to get hostname
// instead of creating url from attribute value?
// TODO: restrict to http(s)? (by protocol value)?
this.filter_tracking_images = function(document) {
  const images = document.querySelectorAll('img[src]');
  for(let image of images) {
    const src = image.getAttribute('src');
    if(src && src.length > MIN_LEN) {
      const url = to_url(src);
      if(url && HOSTS.has(url.hostname)) {
        image.remove();
      }
    }
  }
};

function to_url(urlString) {
  try { return new URL(urlString); } catch(error) {}
}

} // End file block scope
