(function(exports){
'use strict';

const DEFAULT_PATTERNS = [
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

function transform_telemetry_elements(doc) {
  let num_elements_modified = 0;
  if(!doc.body)
    return num_elements_modified;

  const anchor_elements = doc.body.getElementsByTagName('a');
  for(const anchor_element of anchor_elements) {
    anchor_element.removeAttribute('ping');
    anchor_element.setAttribute('rel', 'noreferrer');
    num_elements_modified++;
  }

  const image_elements = doc.body.querySelectorAll('img');
  for(const image_element of image_elements) {
    if(image_has_telemetry(image_element)) {
      DEBUG('removing telemetry image', image_element.outerHTML);
      image_element.remove();
      num_elements_modified++;
    }
  }
  return num_elements_modified;
}

function image_has_telemetry(image) {
  return is_hidden_element(image) || image_is_pixel(image) ||
    image_has_telemetry_source(image);
}

function image_is_pixel(image) {
  return image.hasAttribute('src') &&
    image.hasAttribute('width') &&
    image.width < 2 &&
    image.hasAttribute('height') &&
    image.height < 2;
}

function image_has_telemetry_source(image) {
  const URL_START_PATTERN = /^(http:\/\/|https:\/\/|\/\/)/i;

  const src = (image.getAttribute('src') || '').trim();
  if(src.length > 2 && !src.includes(' ') && URL_START_PATTERN.test(src)) {
    for(const pattern of DEFAULT_PATTERNS)
      if(pattern.test(src))
        return true;
  }
}

exports.transform_telemetry_elements = transform_telemetry_elements;

}(this));
