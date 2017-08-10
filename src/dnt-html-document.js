// See license.md
'use strict';

{ // Begin file block scope

function remove_telemtry_elements(doc, min_dimension, verbose) {
  remove_ping_attr_from_anchor_elements(doc);
  add_no_referrer_to_anchor_elements(doc);
  remove_images_by_visibility(doc, verbose);
  remove_images_by_size(doc, min_dimension, verbose);
  remove_images_by_url(doc, verbose);
}

function remove_ping_attr_from_anchor_elements(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    anchor.removeAttribute('ping');
}

function add_no_referrer_to_anchor_elements(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    anchor.setAttribute('rel', 'noreferrer');
}

// Telemetry images are usually hidden, so treat visibility as a perfect
// indicator of telemetry. False positives are probably not too harmful as
// they do not add noise to the message.
// Removing images based on visibility may be redundant with some of the
// operations done when sanitizing a document. However, I am trying to make
// this function completely independent, and not assume this is done anywhere
// else.
function remove_images_by_visibility(doc, verbose) {
  const img_elements = doc.querySelectorAll('img');
  for(const img_element of img_elements) {
    if(is_hidden_element(img_element)) {
      if(verbose)
        console.debug('Removing tracking image (hidden)',
          img_element.outerHTML);
      img_element.remove();
    } else if(is_offscreen_element(img_element)) {
      if(verbose)
        console.debug('Removing tracking image (offscreen)',
          img_element.outerHTML);
    }
  }
}

// Not really sure what I am doing here or if this really has any effect,
// but I think it is harmless at the moment and am choosing to leave it in
// at least a reminder.
function is_offscreen_element(element) {
  if(element.hasAttribute('style') && element.style.position === 'absolute') {
    const radix = 10;
    const left = parseInt(element.style.left, radix);
    return !isNaN(left) && left < 0;
  }
}

function is_hidden_element(element) {
  return element.hasAttribute('style') &&
    (element.style.display === 'none' ||
    element.style.visibility === 'hidden');
}

function remove_images_by_size(doc, min_dimension, verbose) {
  const img_elements = doc.querySelectorAll('img');
  for(const img_element of img_elements) {
    if(is_tracking_img_from_size(img_element, min_dimension)) {
      if(verbose)
        console.debug('Removing tracking image (size)', img_element.outerHTML);
      img_element.remove();
    }
  }
}

function is_tracking_img_from_size(img_element, min_dimension) {
  // Even though I know of another part of the code that sets all sources,
  // we do not know if this is called before or after it, and it should not be
  // our concern.
  // If an image has no source information, there is no concern, because no
  // ping can occur, so classify as not tracking.
  // TODO: what about <picture>?
  if(!img_element.hasAttribute('src') && !img_element.hasAttribute('srcset'))
    return false;

  // An element object's properties are initialized during initial parsing
  // (via innerHTML or DOMParser) only if attributes are present.
  // Previously this made the mistake of relying on properties, which initialize
  // to 0 when no attributes are present, upon which incorrect conclusions are
  // made.
  let width_string = img_element.getAttribute('width') || '';
  let height_string = img_element.getAttribute('height') || '';

  // Attribute values may have excess whitespace or consist only of whitespace.
  // In the case of only whitespace a parsing error occurs and the property
  // is initialized to 0 (well it is left as its initial value of 0), which
  // would lead to a false positive. Removing the whitespace increases the
  // accuracy of checking if the attribute had a real value that should parse to
  // a non-0 integer, which leads to fewer false positives. This differentiates
  // between "0" initializing to 0, and "" initializing to 0. Several pages
  // attempt to use "0" for telemetry, so it is important.
  width_string = width_string.trim();
  height_string = height_string.trim();

  // TODO: consider going further and checking if attribute values are valid.
  // The increase in accuracy may only be marginal though, so I've deferred for
  // the time being.

  // If the element had an explicit width or height attribute, then the
  // corresponding property will be initialized to a number during parsing, so
  // rather than explicitly parse we can just rely on the property value.
  // The sizes are checked independently, as a matter of policy. I prefer to
  // catch more telemetry images that are false positives over missing more
  // single-explicit-dimension telemetry images. Some telemetry images only
  // set one dimension, probably as a bandwidth saving technique.

  // TODO: the thing is, I am picking several spacer elements. The goal here is
  // not to remove spacer elements. That is a concern belonging to sanitize
  // or condense filters or something like that. So maybe it is more correct
  // to require both.

  if(width_string && img_element.width < min_dimension)
    return true;
  if(height_string && img_element.height < min_dimension)
    return true;

  // TODO: can also possibly find size in inline style attribute. This is
  // extremely rare so deferring this for the moment.
  // TODO: can also possibly find size in srcset, but this might be pointless
  // because tracking images almost never have srcsets.
  return false;
}

function remove_images_by_url(doc, verbose) {
  const img_elements = doc.querySelectorAll('img[src]');
  for(const img_element of img_elements) {
    if(is_tracking_img_from_url(img_element)) {
      if(verbose)
        console.debug('Removing tracking image (url)', img_element.outerHTML);
      img_element.remove();
    }
  }
}

function is_tracking_img_from_url(img_element) {
  let url_string = img_element.getAttribute('src');
  if(!url_string)
    return false;

  url_string = url_string.trim();
  if(!url_string)
    return false;

  // A heuristic for validating urls quickly. If the src attribute value is
  // very short, it probably is not a valid url.
  const min_url_length = 3;// 1char hostname . 1char domain
  if(url_string.length < min_url_length)
    return false;

  // A heuristic for validating urls quickly. If the src attribute has a space
  // after trimming, it is invalid.
  if(url_string.includes(' '))
    return false;

  // Infer a fake protocol for semi-relative urls missing protocol. This is not
  // expected to be 100% accurate. This allows the protocol check to pass
  // and allows get_url_hostname to work.
  const default_protocol = 'http:';
  if(/^\/\//.test(url_string))
    url_string = default_protocol + url_string;

  // Another attempt at quickly validating the url. Tracking images are only
  // http and https. data is not a concern.
  if(!/^https?:/i.test(url_string))
    return false;

  const url_object = parse_url(url_string);
  if(!url_object)
    return false;

  if(is_telemetry_hostname(url_object.hostname))
    return true;
  if(/cloudfront\.net$/.test(url_object.hostname))
    return true;
  if(/moatads\.com$/i.test(url_object.hostname))
    return true;
  if(/2o7\.net$/i.test(url_object.hostname))
    return true;
  if(url_object.hostname === 'www.facebook.com' &&
    url_object.pathname === '/tr')
    return true;

  return false;
}

function is_telemetry_hostname(hostname) {
  const telemetry_hosts = [
    'ad.doubleclick.net',
    'ad.linksynergy.com',
    'analytics.twitter.com',
    'anon-stats.eff.org',
    'bat.bing.com',
    'b.scorecardresearch.com',
    'googleads.g.doubleclick.net',
    'in.getclicky.com',
    'insight.adsrvr.org',
    'me.effectivemeasure.net',
    'metrics.foxnews.com',
    'pagead2.googlesyndication.com',
    'pixel.quantserve.com',
    'pixel.wp.com',
    'pubads.g.doubleclick.net',
    'sb.scorecardresearch.com',
    'stats.bbc.co.uk',
    't.co'
  ];
  return telemetry_hosts.includes(hostname);
}


function parse_url(url_string) {
  let url_object;
  try {
    url_object = new URL(url_string);
  } catch(error) {
  }
  return url_object;
}

this.remove_telemtry_elements = remove_telemtry_elements;

} // End file block scope
