// Filters various telemetry-inducing content from document content

import {removeImage} from "/src/dom/image.js";
import {isHiddenInlineElement} from "/src/dom/visibility.js";
import {isExternalURL} from "/src/url/url.js";
import {isCanonicalURLString} from "/src/url/url-string.js";
import assert from "/src/utils/assert.js";


// TODO: move to config.js?
const PATTERNS = [
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

// TODO: switch to accepting url object instead of url string

// Removes some telemetry data from a document.
// @param doc {Document}
// @param url {String} canonical document url
export default function lonestarFilter(doc, url) {
  assert(doc instanceof Document);
  assert(isCanonicalURLString(url));

  // Analysis is limited to descendants of body
  if(!doc.body) {
    return;
  }

  const documentURL = new URL(url);

  // Telemetry images are usually hidden, so treat visibility as an indicator. False positives are
  // probably not too harmful. Removing images based on visibility overlaps with sanitization, but
  // this is intentionally naive regarding what other filters are applied to the document.
  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(isHiddenInlineElement(image) || isPixel(image) || hasTelemetrySource(image, documentURL)) {
      removeImage(image);
    }
  }
}

// Returns true if an image is a pixel-sized image
function isPixel(image) {
  return image.hasAttribute('src') && image.hasAttribute('width') && image.width < 2 &&
    image.hasAttribute('height') && image.height < 2;
}

// This test only considers the src attribute. Using srcset or picture source is exceedingly rare
// mechanism for telemetry so ignore those channels.
// @param image {Image}
// @param documentURL {URL}
function hasTelemetrySource(image, documentURL) {
  assert(image instanceof Element);
  if(!image.hasAttribute('src')) {
    return false;
  }

  const src = image.getAttribute('src').trim();
  if(!src) {
    return false;
  }

  // TODO: probably some part of these conditions should be delegated to url.js
  // Prior to parsing the url, try and exclude some of the url strings to avoid the parsing cost.

  // Very short urls are probably not telemetry
  const MIN_IMAGE_URL_LENGTH = 's.gif'.length;
  if(src.length < MIN_IMAGE_URL_LENGTH) {
    return false;
  }

  // Ignore urls that appear invalid. Invalid urls are not a telemetry concern because requests will
  // presumably fail.
  if(src.includes(' ')) {
    return false;
  }

  // Relative urls are generally not telemetry urls.
  // Protocol-agnostic urls are considered canonical (not relative), which is notably different
  // behavior than isCanonicalURLString. Urls using the 'data:' protocol are generally not telemetry
  // urls because no networking is involved. Basically only look at http and https
  // TODO: make non-capturing regex
  const URL_START_PATTERN = /^(http:\/\/|https:\/\/|\/\/)/i;
  if(!URL_START_PATTERN.test(src)) {
    return false;
  }

  let imageURL;
  try {
    imageURL = new URL(src);
  } catch(error) {
    // It is a relative url, or an invalid url of some kind. It is probably not telemetry, or at
    // least, not a telemetry concern.
    return false;
  }

  // Ignore 'internal' urls.
  if(!isExternalURL(documentURL, imageURL)) {
    return false;
  }

  for(const pattern of PATTERNS) {
    if(pattern.test(src)) {
      return true;
    }
  }

  return false;
}
