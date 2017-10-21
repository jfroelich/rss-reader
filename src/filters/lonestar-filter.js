'use strict';

// import base/assert.js
// import base/debug.js
// import dom/element.js

// TODO: move todos to github issues

// TODO: move patterns into an external configuration file of some sort? or
// see if patterns can be configured within manifest.json and loaded from there?

// TODO: remove tracking parameters from anchor element href urls for
// certain origins. Use a blacklist approach that given a certain domain
// removes certain parameters, and otherwise tolerates all parameters

const LONESTAR_DEBUG = false;

const LONESTAR_PATTERNS = [
  /\/\/.*2o7\.net\//i,
  /\/\/ad\.doubleclick\.net\//i,
  /\/\/ad\.linksynergy\.com\//i,
  /\/\/analytics\.twitter\.com\//i,
  /\/\/anon-stats\.eff\.org\//i,
  /\/\/bat\.bing\.com\//i,
  /\/\/b\.scorecardresearch\.com\//i,
  /\/\/beacon\.gu-web\.net\//i,
  /\/\/.*cloudfront\.net\//,
  /\/\/googleads\.g\.doubleclick\.net\//i,
  /\/\/in\.getclicky\.com\//i,
  /\/\/insight\.adsrvr\.org\//i,
  /\/\/me\.effectivemeasure\.net\//i,
  /\/\/metrics\.foxnews\.com\//i,
  /\/\/.*moatads\.com\//i,
  /\/\/pagead2\.googlesyndication\.com\//i,
  /\/\/pixel\.quantserve\.com\//i,
  /\/\/pixel\.wp\.com\//i,
  /\/\/pubads\.g\.doubleclick\.net\//i,
  /\/\/sb\.scorecardresearch\.com\//i,
  /\/\/stats\.bbc\.co\.uk\//i,
  /\/\/statse\.webtrendslive\.com\//i,
  /\/\/pixel\.wp\.com\//i,
  /\/\/t\.co\//i,
  /\/\/www\.facebook\.com\/tr/i
];

// Removes telemetry images from a document.
// TODO: tests
// TODO: deal with the new <picture> element
function lonestar_filter(doc) {
  ASSERT(doc instanceof Document);

  let num_elements_modified = 0;

  // Analysis is limited to descendants of body
  if(!doc.body) {
    return num_elements_modified;
  }

  const num_images_removed = lonestar_filter_telemetry_images(doc);
  num_elements_modified += num_images_removed;

  return num_elements_modified;
}

function lonestar_filter_telemetry_images(doc) {
  let num_elements_modified = 0;
  const image_elements = doc.body.querySelectorAll('img');
  for(const image_element of image_elements) {
    if(lonestar_image_is_telemetry(image_element)) {

      if(LONESTAR_DEBUG) {
        DEBUG('removing telemetry image', image_element.outerHTML);
      }

      image_element.remove();
      num_elements_modified++;
    }
  }
  return num_elements_modified;
}

function lonestar_image_is_telemetry(image) {
  // Telemetry images are usually hidden, so treat visibility as an indicator.
  // False positives are probably not too harmful. Removing images based on
  // visibility overlaps with sanitization, but this is intentionally naive.
  return element_is_hidden(image) || lonestar_image_is_pixel(image) ||
    lonestar_image_has_telemetry_source(image);
}

function lonestar_image_is_pixel(image) {
  return image.hasAttribute('src') &&
    image.hasAttribute('width') &&
    image.width < 2 &&
    image.hasAttribute('height') &&
    image.height < 2;
}

// TODO: should accept a base url parameter, and should not filter images from
// that host. This way, images from that host still work. Alternatively, only
// remove images that are cross-origin
// TODO: look into bulk-regex-match, where I group the patterns into a single
// pattern beforehand (using strings and the RegExp constructor). See
// https://www.reddit.com/r/programming/comments/3c3vl0
function lonestar_image_has_telemetry_source(image) {
  const URL_START_PATTERN = /^(http:\/\/|https:\/\/|\/\/)/i;

  const src = (image.getAttribute('src') || '').trim();
  if(src.length > 2 && !src.includes(' ') && URL_START_PATTERN.test(src)) {
    for(const pattern of LONESTAR_PATTERNS)
      if(pattern.test(src))
        return true;
  }
  return false;
}
