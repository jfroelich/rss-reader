// The lonestar filter is tasked with jamming radars. A guide to anti-telemetry
// can be found here: https://youtu.be/rGvblGCD7qM

import {assert} from '/src/assert/assert.js';
import {is_hidden_inline} from '/src/dom-visibility/dom-visibility.js';
import * as image_utils from '/src/image-utils/image-utils.js';
import * as url_utils from '/src/url-utils/url-utils.js';

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
          if (url_utils.url_get_upper_domain(doc_url) !==
              url_utils.url_get_upper_domain(url)) {
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
