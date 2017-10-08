// Schwartz-wielding anti-telemetry lib

// Dependencies:
// debug.js
// element.js

// TODO: put element_is_hidden into its own lib and include only it?
// TODO: move patterns into an external configuration file of some sort? or
// see if patterns can be configured within manifest.json and loaded from there?

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

// Removes telemetry information from a document. This includes ping attributes,
// sets link rel attribute to noreferrer, and removes various suspicious images
// See also:
// https://blog.fastmail.com/2016/06/20/everything-you-could-ever-want-to-know-and-more-about-controlling-the-referer-header/
// http://w3c.github.io/html/links.html#link-type-noreferrer
// TODO: tests
// TODO: deal with the new <picture> element
// TODO: rename to something like lonestar prefix
function lonestar_transform_document(doc) {
  'use strict';
  let num_elements_modified = 0;

  // Analysis is limited to descendants of body, as the document is assumed
  // to be well-formed
  if(!doc.body)
    return num_elements_modified;

  // Using getElementsByTagName over querySelectorAll for alleged speed and
  // because this does not remove elements while iterating
  const anchor_elements = doc.body.getElementsByTagName('a');
  for(const anchor_element of anchor_elements) {
    anchor_element.removeAttribute('ping');
    anchor_element.setAttribute('rel', 'noreferrer');
    num_elements_modified++;
  }

  const num_images_removed = lonestar_filter_telemetry_images(doc);
  num_elements_modified += num_images_removed;

  return num_elements_modified;
}

function lonestar_filter_telemetry_images(doc) {
  'use strict';
  let num_elements_modified = 0;
  const image_elements = doc.body.querySelectorAll('img');
  for(const image_element of image_elements) {
    if(lonestar_image_is_telemetry(image_element)) {
      DEBUG('removing telemetry image', image_element.outerHTML);
      image_element.remove();
      num_elements_modified++;
    }
  }
  return num_elements_modified;
}

function lonestar_image_is_telemetry(image) {
  'use strict';
  // Telemetry images are usually hidden, so treat visibility as an indicator.
  // False positives are probably not too harmful. Removing images based on
  // visibility overlaps with sanitization, but this is intentionally naive.
  return element_is_hidden(image) || lonestar_image_is_pixel(image) ||
    lonestar_image_has_telemetry_source(image);
}

function lonestar_image_is_pixel(image) {
  'use strict';
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
  'use strict';
  const URL_START_PATTERN = /^(http:\/\/|https:\/\/|\/\/)/i;

  const src = (image.getAttribute('src') || '').trim();
  if(src.length > 2 && !src.includes(' ') && URL_START_PATTERN.test(src)) {
    for(const pattern of LONESTAR_PATTERNS)
      if(pattern.test(src))
        return true;
  }
  return false;
}
