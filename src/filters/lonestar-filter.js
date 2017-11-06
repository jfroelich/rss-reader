'use strict';

// import rbl.js
// import net/url-utils.js
// import dom.js

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
// pollDocumentFilter to pass in base_url. The url parsing work
// only is done once then instead of multiple times.

// Removes some telemetry data from a document.
// @param doc {Document}
// @param url {String} canonical document url
function lonestarFilter(doc, url) {
  assert(doc instanceof Document);
  assert(URLUtils.isCanonical(url));

  // Analysis is limited to descendants of body
  if(!doc.body) {
    return;
  }

  // Telemetry images are usually hidden, so treat visibility as an indicator.
  // False positives are probably not too harmful. Removing images based on
  // visibility overlaps with sanitization, but this is intentionally naive
  // regarding what other filters are applied to the document.

  const documentHostname = URLUtils.getHostname(url);
  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(domIsHiddenInline(image) ||
      lonestarFilterIsPixel(image) ||
      lonestarFilterHasTelemetrySource(image, documentHostname)) {
      console.debug('lonestarFilter filtering', image.outerHTML);
      domRemoveImage(image);
    }
  }
}

// Returns true if an image is a pixel-sized image
function lonestarFilterIsPixel(image) {
  return image.hasAttribute('src') &&
    image.hasAttribute('width') &&
    image.width < 2 &&
    image.hasAttribute('height') &&
    image.height < 2;
}

// @param image {Image}
// @param documentHostname {String}
function lonestarFilterHasTelemetrySource(image, documentHostname) {
  assert(image instanceof Element);
  assert(typeof documentHostname === 'string');

  // This only looks at the src attribute. Using srcset or picture source is
  // exceedlingly rare mechanism for telemetry so ignore those channels.

  let imageSource = image.getAttribute('src');
  // Ignore images without a src attribute, or an empty value
  if(!imageSource) {
    return false;
  }

  imageSource = imageSource.trim();
  // Ignore images with an empty src attribute
  if(!imageSource) {
    return false;
  }

  // TODO: probably some part of these conditions should be delegated
  // to url-utils.js

  // Ignore very short urls
  if(imageSource.length < 2) {
    return false;
  }

  // Ignore images with a src value containing an inner space, as this is
  // probably not a valid url
  if(imageSource.includes(' ')) {
    return false;
  }

  // Ignore non-canonical images, including urls that start with '//'
  // Ignore urls with a data protocol
  // TODO: make non-capturing for better performance?
  const URL_START_PATTERN = /^(http:\/\/|https:\/\/|\/\/)/i;
  if(!URL_START_PATTERN.test(imageSource)) {
    return false;
  }

  // Ignore 'same-origin' urls. Except I use hostname instead of origin because
  // of the common practice of including insecure images in a secure domain
  // TODO: only compare by TLD and whatever next-level-domain-part is, ignore
  // subdomains as well in comparison
  const imageHostname = URLUtils.getHostname(imageSource);
  if(imageHostname === documentHostname) {
    return false;
  }

  // If the url matches one of the patterns then it is a telemetry image
  for(const pattern of LONESTAR_PATTERNS) {
    if(pattern.test(imageSource)) {
      return true;
    }
  }

  return false;
}
