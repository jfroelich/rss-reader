'use strict';

// import base/status.js
// import dom/image.js
// import dom/visibility.js

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
// @param doc {Document}
// @param url {String} canonical document url
function lonestar_filter(doc, url) {
  console.assert(doc instanceof Document);

  // Analysis is limited to descendants of body
  if(!doc.body) {
    return STATUS_OK;
  }

  const url_object = new URL(url);

  // Telemetry images are usually hidden, so treat visibility as an indicator.
  // False positives are probably not too harmful. Removing images based on
  // visibility overlaps with sanitization, but this is intentionally naive
  // regarding what other filters are applied to the document.

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(visibility_element_is_hidden_inline(image) ||
      lonestar_image_is_pixel(image) ||
      lonestar_image_has_telemetry_source(image, url_object.origin)) {

      console.debug('lonestar_filter_telemetry_images', image.outerHTML);

      image_remove(image);
    }
  }

  return STATUS_OK;
}

function lonestar_image_is_pixel(image) {
  return image.hasAttribute('src') &&
    image.hasAttribute('width') &&
    image.width < 2 &&
    image.hasAttribute('height') &&
    image.height < 2;
}

// @param image {Image}
// @param document_origin {String}
function lonestar_image_has_telemetry_source(image, document_origin) {
  console.assert(image instanceof Element);
  console.assert(typeof document_origin === 'string');

  let image_url = image.getAttribute('src');
  // Ignore images without a src attribute, or an empty value
  if(!image_url) {
    return false;
  }

  image_url = image_url.trim();
  // Ignore images with an empty src attribute
  if(!image_url) {
    return false;
  }

  // TODO: probably some part of these conditions should be delegated
  // to url.js

  // Ignore very short urls
  if(image_url.length < 2) {
    return false;
  }

  // Ignore images with a src value containing an inner space, as this is
  // probably not a valid url
  if(image_url.includes(' ')) {
    return false;
  }

  // Ignore non-canonical images, including urls that start with '//'
  // Ignore urls with a data protocol
  // TODO: make non-capturing for better performance?
  const URL_START_PATTERN = /^(http:\/\/|https:\/\/|\/\/)/i;
  if(!URL_START_PATTERN.test(image_url)) {
    return false;
  }

  // Ignore images from the same origin as the document
  // This should never throw
  const image_url_object = new URL(image_url);
  const image_origin = image_url_object.origin;

  // TEMP: testing new functionality
  console.debug('document_origin %s image_origin', document_origin,
    image_origin);

  // TODO: just realized, origin includes protocol, which means http !==
  // https, which isn't what I want. I should be using hostname, not origin.

  if(image_origin === document_origin) {
    return false;
  }

  // If the url matches one of the patterns then it is a telemetry image
  // TODO: use image_origin now that it is available for faster matching? It
  // would not work for facebook/tr though.
  for(const pattern of LONESTAR_PATTERNS) {
    if(pattern.test(image_url)) {
      return true;
    }
  }

  return false;
}
