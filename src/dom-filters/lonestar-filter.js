import {assert} from '/src/assert.js';
import {is_hidden_inline} from '/src/dom-filters/dom-visibility.js';
import * as image_utils from '/src/dom-filters/image-utils.js';

// The lonestar filter is tasked with jamming radars. A guide to anti-telemetry
// can be found here: https://youtu.be/rGvblGCD7qM

const host_patterns = [
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

export function lonestar_filter(doc) {
  assert(doc.baseURI);
  const doc_url = new URL(doc.baseURI);

  // Remove images that look like telemetry beacons
  const images = doc.querySelectorAll('img');
  for (const image of images) {
    if (is_telemetric(image, doc_url, false)) {
      image_utils.remove_image(image);
    }
  }

  // Specify all hyperlink anchors as noreferrer
  const anchors = doc.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }

  // Remove ping attributes from anchors
  const ping_anchors = doc.querySelectorAll('a[ping]');
  for (const anchor of ping_anchors) {
    anchor.removeAttribute('ping');
  }
}

function is_telemetric(element, doc_url, is_strict) {
  if (is_hidden_inline(element)) {
    return true;
  }

  // TODO: introduce a new heuristic to match common names for pixel images like
  // "pixel.gif", and I think facebook uses "/p"

  // Look for tracking pixels
  if (element.localName === 'img' && element.hasAttribute('src') &&
      element.width < 2 && element.height < 2) {
    return true;
  }

  // TODO: exclude popular CDNs or anything with CDN in its url?

  // Look for cross origin images
  if (element.localName === 'img' && element.hasAttribute('src')) {
    const src = element.getAttribute('src');
    let url;
    try {
      url = new URL(src, doc_url);
    } catch (error) {
      // Ignore
    }

    if (url) {
      const local_protocols = ['data:', 'mailto:', 'tel:', 'javascript:'];
      if (!local_protocols.includes(url.protocol)) {
        if (is_strict) {
          if (doc_url.origin !== url.origin) {
            return true;
          }
        } else {
          if (url_get_upper_domain(doc_url) !== url_get_upper_domain(url)) {
            return true;
          }
        }
      }

      for (const pattern of host_patterns) {
        if (pattern.test(src)) {
          return true;
        }
      }
    }
  }

  return false;
}

// Ignores port. Exported for testing.
export function url_get_upper_domain(url) {
  assert(url instanceof URL);
  if (hostname_is_ipv4(url.hostname) || hostname_is_ipv6(url.hostname)) {
    return url.hostname;
  }

  const levels = url.hostname.split('.');

  // Handle the simple case of localhost or example.com
  if (levels.length < 3) {
    return url.hostname;
  }

  // Using a full geo-suffix list is overkill so use tld length to guess
  const top_level = levels[levels.length - 1];
  const reverse_offset = top_level.length === 2 ? -3 : -2;
  return levels.slice(reverse_offset).join('.');
}

// Exported for testing
export function hostname_is_ipv4(string) {
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
export function hostname_is_ipv6(value) {
  return typeof value === 'string' && value.includes(':');
}
