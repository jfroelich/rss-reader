import assert from "/src/utils/assert.js";
import {removeImage} from "/src/utils/dom/image.js";
import {isHiddenInlineElement} from "/src/utils/dom/visibility.js";
import parseInt10 from "/src/utils/parse-int-10.js";
import {isCanonicalURLString} from "/src/utils/url-string-utils.js";

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

  // TODO: does HTMLImageElement provide URL-like properties, similar to HTMLAnchorElement?

  // TODO: all these attempts to avoid parsing are probably silly when it isn't even clear
  // this is slow. Just parse the url. It is simpler. This was premature optimization

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

// Returns true if otherURL is 'external' to the documentURL. Inaccurate and insecure.
function isExternalURL(documentURL, otherURL) {
  // Certain protocols are never external in the sense that a network request is not performed
  const localProtocols = ['data:', 'mailto:', 'tel:', 'javascript:'];
  if(localProtocols.includes(otherURL.protocol)) {
    return false;
  }

  const docDomain = getUpperDomain(documentURL);
  const otherDomain = getUpperDomain(otherURL);
  return docDomain !== otherDomain;
}

// Returns the 1st and 2nd level domains as a string. Basically hostname without subdomains. This
// only does minimal symbolic validation of values, and is also inaccurate and insecure.
function getUpperDomain(url) {
  assert(url instanceof URL);

  // Treat IP as whole
  if(isIPv4Address(url.hostname) || isIPv6Address(url.hostname)) {
    return url.hostname;
  }

  const levels = url.hostname.split('.');

  // Handle the simple case of 'localhost'
  if(levels.length === 1) {
    return url.hostname;
  }

  // Handle the simple case of 'example.com'
  if(levels.length === 2) {
    return url.hostname;
  }

  // This isn't meant to be super accurate or professional. Using the full list from
  // https://publicsuffix.org/list/public_suffix_list.dat is overkill. As a compromise, just look
  // at tld character count.
  const level1 = levels[levels.length - 1];
  if(level1.length === 2) {
    // Infer it is ccTLD, return levels 3 + 2 + 1
    const usedLevels = levels.slice(-3);
    return usedLevels.join('.');
  } else {
    // Infer it is gTLD, returns levels 2 + 1
    const usedLevels = levels.slice(-2);
    return usedLevels.join('.');
  }
}

function isIPv4Address(string) {
  if(typeof string !== 'string') {
    return false;
  }

  const parts = string.split('.');
  if(parts.length !== 4) {
    return false;
  }

  for(const part of parts) {
    const digit = parseInt10(part);
    if(isNaN(digit) || digit < 0 || digit > 255) {
      return false;
    }
  }

  return true;
}

// Expects a hostname string property value from a URL object.
function isIPv6Address(hostname) {
  return typeof hostname === 'string' && hostname.includes(':');
}
