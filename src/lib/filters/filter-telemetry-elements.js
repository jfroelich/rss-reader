import {element_is_hidden_inline} from '/src/content-filters/utils.js';
import {is_external_url} from '/src/lib/cross-site.js';
import {remove as remove_image} from '/src/lib/image.js';

const telemetry_host_patterns = [
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

// Removes some telemetry data from a document.
// @param document {Document}
// @param document_url {URL} canonical document url
export function filter_telemetry_elements(document, document_url) {
  // TODO: deprecate use of assert, just throw a type error?
  assert(document_url instanceof URL);

  // Analysis is limited to descendants of body
  if (!document.body) {
    return;
  }

  // Telemetry images are usually hidden, so treat visibility as an indicator.
  // False positives are probably not too harmful. Removing images based on
  // visibility overlaps with sanitization, but this is intentionally naive
  // regarding what other filters are applied to the document.
  const images = document.body.querySelectorAll('img');
  for (const image of images) {
    if (element_is_hidden_inline(image) || image_is_pixel(image) ||
        image_has_telemetry_source(image, document_url)) {
      remove_image(image);
    }
  }
}

// Returns true if an image is a pixel-sized image
function image_is_pixel(image) {
  return image.hasAttribute('src') && image.hasAttribute('width') &&
      image.width < 2 && image.hasAttribute('height') && image.height < 2;
}

// This test only considers the src attribute. Using srcset or picture source
// is exceedingly rare mechanism for telemetry so ignore those channels.
// @param image {Image}
// @param document_url {URL}
function image_has_telemetry_source(image, document_url) {
  let src = image.getAttribute('src');
  if (!src) {
    return false;
  }

  src = src.trim();
  if (!src) {
    return false;
  }

  // Very short urls are probably not telemetry
  // TODO: actually this might produce too many false negatives?
  const MIN_IMAGE_URL_LENGTH = 's.gif'.length;
  if (src.length < MIN_IMAGE_URL_LENGTH) {
    return false;
  }

  // Prior to parsing the url, try and exclude some of the url strings to avoid
  // the parsing cost.

  // TODO: all these attempts to avoid parsing are probably silly when it
  // isn't even clear that this is slow. Just parse the url. It is simpler. This
  // feels like premature optimization

  // Ignore urls that appear invalid. Invalid urls are not a telemetry concern
  // because requests will presumably fail.
  if (src.includes(' ')) {
    return false;
  }

  // For protocol-relative urls, allow them and continue.
  // TODO: but that just fails in the URL parser ....? Need to revisit this.
  // Basically I want to be able to match and reject protocol relative urls.
  // But I want to work with a URL object. Perhaps I should substitute in http
  // automatically? Or require base url here when constructing the url?

  // Relative urls are generally not telemetry urls.
  // Urls using the 'data:' protocol are generally not telemetry
  // urls because no networking is involved. Basically only look at http and
  // https
  // TODO: make non-capturing regex
  const URL_START_PATTERN = /^(http:\/\/|https:\/\/|\/\/)/i;
  if (!URL_START_PATTERN.test(src)) {
    return false;
  }

  let image_url;
  try {
    image_url = new URL(src);
  } catch (error) {
    // It is a relative url, or an invalid url of some kind. It is probably not
    // telemetry, or at least, not a telemetry concern.
    return false;
  }

  // Ignore 'internal' urls.
  if (!is_external_url(document_url, image_url)) {
    return false;
  }

  for (const pattern of telemetry_host_patterns) {
    if (pattern.test(src)) {
      return true;
    }
  }

  return false;
}


function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
