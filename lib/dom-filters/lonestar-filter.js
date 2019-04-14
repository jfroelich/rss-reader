import * as imageUtils from '/lib/image-utils.js';
import assert from '/lib/assert.js';
import isHiddenElement from '/lib/is-hidden-inline.js';

// The lonestar filter is tasked with jamming radars. A guide to anti-telemetry
// can be found here: https://youtu.be/rGvblGCD7qM

const hostPatterns = [
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

// Assume the document has a valid base uri
export default function removeTelemetryElements(doc) {
  const documentURL = new URL(doc.baseURI);

  // Remove images that look like telemetry beacons
  const images = doc.querySelectorAll('img');
  for (const image of images) {
    if (isTelemetric(image, documentURL, false)) {
      imageUtils.removeImage(image);
    }
  }

  // Specify all hyperlink anchors as noreferrer
  const anchors = doc.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }

  // Remove ping attributes from anchors
  const pingAnchors = doc.querySelectorAll('a[ping]');
  for (const anchor of pingAnchors) {
    anchor.removeAttribute('ping');
  }
}

// TODO: whether an element is hidden does not indicate it is telemetric. The lonestar filter should
// treat hidden elements precisely like visible elements. Whether an element is hidden is some other
// filter's concern.
// TODO: create another helper function that labels the section of code that determines whether an
// image is an external image.
// TODO: think of how to improve the consistency of the helper function names.
// TODO: exclude popular CDNs or anything with CDN in its url?
export function isTelemetric(element, documentURL, isStrict) {
  if (isHiddenElement(element)) {
    return true;
  }

  if (elementIsTrackingPixel(element)) {
    return true;
  }

  // Look for cross origin images
  if (element.localName === 'img' && element.hasAttribute('src')) {
    const src = element.getAttribute('src');
    let url;
    try {
      url = new URL(src, documentURL);
    } catch (error) {
      // Ignore
    }

    if (url) {
      // jshint -W107
      // eslint-disable-next-line no-script-url
      const localProtocols = ['data:', 'mailto:', 'tel:', 'javascript:'];
      if (!localProtocols.includes(url.protocol)) {
        if (isStrict) {
          if (documentURL.origin !== url.origin) {
            return true;
          }
        } else if (urlGetUpperDomain(documentURL) !== urlGetUpperDomain(url)) {
          return true;
        }
      }

      for (const pattern of hostPatterns) {
        if (pattern.test(src)) {
          return true;
        }
      }
    }
  }

  return false;
}

// Returns whether the given element looks like a tracking pixel.
// TODO: introduce a new heuristic to match common names for pixel images like "pixel.gif". For
// example, I think facebook uses "/p"
function elementIsTrackingPixel(element) {
  return element.localName === 'img' && element.hasAttribute('src') && element.width < 2 &&
    element.height < 2;
}

// Ignores port. Exported for testing.
export function urlGetUpperDomain(url) {
  assert(url instanceof URL);
  if (hostnameIsIPv4(url.hostname) || hostnameIsIPv6(url.hostname)) {
    return url.hostname;
  }

  const levels = url.hostname.split('.');

  // Handle the simple case of localhost or example.com
  if (levels.length < 3) {
    return url.hostname;
  }

  // Using a full geo-suffix list is overkill so use tld length to guess
  const topLevelDomain = levels[levels.length - 1];
  const reverseOffset = topLevelDomain.length === 2 ? -3 : -2;
  return levels.slice(reverseOffset).join('.');
}

// Exported for testing
export function hostnameIsIPv4(string) {
  if (typeof string !== 'string') {
    return false;
  }

  const parts = string.split('.');
  if (parts.length !== 4) {
    return false;
  }

  for (const part of parts) {
    const digit = parseInt(part, 10);
    if (isNaN(digit) || digit < 0 || digit > 255) {
      return false;
    }
  }

  return true;
}

// Exported for testing
export function hostnameIsIPv6(value) {
  return typeof value === 'string' && value.includes(':');
}
