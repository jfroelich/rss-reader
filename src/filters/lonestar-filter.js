'use strict';

// import base/status.js
// import dom/image.js
// import dom/visibility.js
// import url.js

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

// TODO: switch to accepting url object instead, then update
// poll_document_filter to pass in base_url. The url parsing work
// only is done once then instead of multiple times.

// Removes some telemetry data from a document.
// @param doc {Document}
// @param url {String} canonical document url
function lonestar_filter(doc, url) {
  console.assert(doc instanceof Document);
  console.assert(url_is_canonical(url));

  // Analysis is limited to descendants of body
  if(!doc.body) {
    return STATUS_OK;
  }

  // Telemetry images are usually hidden, so treat visibility as an indicator.
  // False positives are probably not too harmful. Removing images based on
  // visibility overlaps with sanitization, but this is intentionally naive
  // regarding what other filters are applied to the document.

  const document_hostname = url_get_hostname(url);
  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(visibility_element_is_hidden_inline(image) ||
      lonestar_filter_is_pixel(image) ||
      lonestar_filter_has_telemetry_source(image, document_hostname)) {

      console.debug('lonestar_filter_telemetry_images filtering',
        image.outerHTML);

      image_remove(image);
    }
  }

  return STATUS_OK;
}

// Returns true if an image is a pixel-sized image
function lonestar_filter_is_pixel(image) {
  return image.hasAttribute('src') &&
    image.hasAttribute('width') &&
    image.width < 2 &&
    image.hasAttribute('height') &&
    image.height < 2;
}

// @param image {Image}
// @param document_hostname {String}
function lonestar_filter_has_telemetry_source(image, document_hostname) {
  console.assert(image instanceof Element);
  console.assert(typeof document_hostname === 'string');

  // This only looks at the src attribute. Using srcset or picture source is
  // exceedlingly rare mechanism for telemetry so ignore those channels.

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

  // Ignore 'same-origin' urls. Except I use hostname instead of origin because
  // of the common practice of including insecure images in a secure domain
  const image_hostname = url_get_hostname(image_url);
  if(image_hostname === document_hostname) {
    return false;
  }

  // If the url matches one of the patterns then it is a telemetry image
  for(const pattern of LONESTAR_PATTERNS) {
    if(pattern.test(image_url)) {
      return true;
    }
  }

  return false;
}
