import * as dfu from '/src/dom-filters/dfu.js';

// The lonestar filter is tasked with jamming radars. A guide to anti-telemetry
// can be found here: https://youtu.be/rGvblGCD7qM

const EXTERNAL_MODE_UNKNOWN = 0;
const EXTERNAL_MODE_STRICT = 2;
const EXTERNAL_MODE_SLOPPY = 1;

// TODO: host patterns should come from config (think of the best way to
// serialize and deserialize regular expressions).
// TODO: host patterns should at least be defined externally, and instead be
// a parameter to this filter, so that the filter functionality is simple to
// extend.

// Raspberry expressions for radars
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
export function lonestar_filter(document) {
  // This filter now relies on having a baseURI in order to properly determine a
  // document's canonical location. This no longer has access to an explicit
  // document url parameter.

  // NOTE: I think that baseURI is pretty much always defined, even when no base
  // elements are present, but this is a paranoid check that clearly exposes
  // whatever rare/impossible case could happen. This currently has the added
  // effect of triggering an error when document is undefied or does not have
  // properties.

  // This is exception worthy because this indicates a programmer error, not
  // simply a bad data error. The programmer is responsible for calling this
  // filter correctly, with a document object in the correct state.

  // TODO: eventually remove this once I look into more, I think it is too
  // paranoid

  if (!document.baseURI) {
    throw new TypeError('document missing baseURI');
  }

  // This is a hackish fix to ensure that baseURI, if defined, is not set to
  // url of the page that is executing this script. If a base element exists,
  // then we can pretty much assume it is safe. The alternate method of
  // comparing baseURI to chrome.extension.getURL would cause tight coupling of
  // this library to the chrome extension context, which I do not want.
  // TODO: this is obviously not performant and should eventually be revised, I
  // just do not know of a better solution right now
  if (!document.querySelector('base')) {
    throw new TypeError('no base element found so baseURI invalid');
  }

  // Telemetry analysis is limited to descendants of body.
  if (!document.body) {
    return;
  }

  // TODO: this is a simple hack to keep the behavior stable, back when
  // document_url was a parameter to this function. This internal implementation
  // could probably be redesigned to avoid passing this along, and/or instead
  // only instantiating it later when needed. If it even is needed? On the other
  // hand, only creating it once is also preferable. Also keep in mind the
  // possibility of an error, now that this is done here, if url is not
  // well-formed/canonical.
  const document_url = new URL(document.baseURI);

  // This filter currently only focuses on images. Stylesheets are assumed to be
  // removed by other filters. Scripts are assumed to be removed by other
  // filters. Objects and pretty much any other type of resource are presumed
  // removed. Ping attributes are separately removed by another filter. So the
  // only surface still exposed is image requests.

  // Telemetry images are usually hidden, so treat visibility as an indicator.
  // False positives are probably not too harmful. Removing images based on
  // visibility overlaps with sanitization, but this is intentionally naive
  // regarding what other filters are applied to the document.
  const images = document.body.querySelectorAll('img');
  for (const image of images) {
    if (dfu.is_hidden_inline(image) || image_is_pixel(image) ||
        image_has_telemetry_source(image, document_url)) {
      dfu.remove_image(image);
    }
  }

  add_rel_noreferrer(document);
  remove_ping_attributes(document);
}

// Returns true if an image is a pixel-sized image
// NOTE: the document is presumed inert. Properties like naturalWidth and
// naturalHeight are not yet initialized.
function image_is_pixel(image) {
  return image.hasAttribute('src') && image.hasAttribute('width') &&
      image.width < 2 && image.hasAttribute('height') && image.height < 2;
}

// Returns whether the given image is a telemetry image, where the url of the
// image indicates that fetching it is primarily for the purpose of telemetry
// and not content.
//
// This test only considers the src attribute. Using srcset or picture source
// is exceedingly rare mechanism for telemetry so ignore those channels.
//
// @param image {Image}
// @param document_url {URL}
function image_has_telemetry_source(image, document_url) {
  let src = image.getAttribute('src');

  // An image without a src value will not involve the network, so it cannot
  // possibly be a telemetry risk
  if (!src) {
    return false;
  }

  // An image with an empty src value similarly is not a risk
  src = src.trim();
  if (!src) {
    return false;
  }

  // Very short urls are probably not telemetry. This check assumes the src
  // attribute value is not yet transformed into a canonical value. This check
  // is also done to reduce the number of calls to new URL later.
  //
  // Min length is an approximation. Obviously, even a single character could
  // constitute a valid image url. But that is rarely the case.

  // TODO: actually this might produce too many false negatives?
  // TODO: actually, is this a bad assumption? It seems like several short
  // paths could be telemetry. They may not have explicit GET params, but a
  // GET request without parameters still sends along client data.
  const image_url_min_length = 's.gif'.length;
  if (src.length < image_url_min_length) {
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

  // Ignore 'internal' urls. We only care about external urls as risks.
  // This occurs before the host pattern, because we want to allow hosts to
  // include their own images.

  if (!is_external_url(document_url, image_url)) {
    return false;
  }

  for (const pattern of telemetry_host_patterns) {
    if (pattern.test(src)) {
      return true;
    }
  }

  // Nothing indicated telemetry.
  return false;
}

// Specifies that all links are noreferrer
function add_rel_noreferrer(document) {
  if (document.body) {
    const anchors = document.body.getElementsByTagName('a');
    for (const anchor of anchors) {
      anchor.setAttribute('rel', 'noreferrer');
    }
  }
}

// Removes ping attributes from anchor elements
function remove_ping_attributes(document) {
  if (document.body) {
    const anchors = document.body.querySelectorAll('a[ping]');
    for (const anchor of anchors) {
      anchor.removeAttribute('ping');
    }
  }
}

// Returns true when the other_url is external to the document_url. A url is
// external when it comes from a different website. This could be because the
// origin is different. However, this may allow for ignoring differences in the
// subdomain, by only looking at the top domain.
// WARNING: this is insecure because it is approximate
function is_external_url(
    document_url, other_url, mode = EXTERNAL_MODE_UNKNOWN) {
  if (!(document_url instanceof URL)) {
    throw new TypeError('document_url is not a URL');
  }

  if (!(other_url instanceof URL)) {
    throw new TypeError('other_url is not a URL');
  }

  const local_protocols = ['data:', 'mailto:', 'tel:', 'javascript:'];
  if (local_protocols.includes(other_url.protocol)) {
    return false;
  }

  if (mode === EXTERNAL_MODE_STRICT) {
    return document_url.origin !== other_url.origin;
  }

  const doc_domain = url_get_upper_domain(document_url);
  const other_domain = url_get_upper_domain(other_url);
  return doc_domain !== other_domain;
}

// NOTE: ignores port
function url_get_upper_domain(url) {
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

function hostname_is_ipv4(string) {
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

function hostname_is_ipv6(value) {
  return typeof value === 'string' && value.includes(':');
}
