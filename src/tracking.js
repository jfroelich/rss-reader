// See license.md

'use strict';

// TODO: hosts should be defined externally so that if i want to
// change it, I don't have to change the code
// TODO: I am not seeing any of the last 4 urls here being filtered. Maybe
// I am looking for the wrong thing? I have not seen these occur even
// once? Are they just script origins?
// TODO: reintroduce logging

{

const hosts = [
  'ad.doubleclick.net',
  'b.scorecardresearch.com',
  'googleads.g.doubleclick.net',
  'me.effectivemeasure.net',
  'pagead2.googlesyndication.com',
  'pixel.quantserve.com',
  'pixel.wp.com',
  'pubads.g.doubleclick.net',
  'sb.scorecardresearch.com'
];

function filter_tracking_images(doc) {
  const images = doc.querySelectorAll('img[src]');
  for(let image of images) {
    if(is_tracking_img(image)) {
      image.remove();
    }
  }
}

function has_candidate_url(image) {
  let src = image.getAttribute('src');
  if(!src)
    return false;
  src = src.trim();
  if(!src)
    return false;
  const minlen = 'http://a.d/a'.length;
  if(src.length < minlen)
    return false;
  if(src.includes(' '))
    return false;
  if(!/^https?:/i.test(src))
    return false;
  return true;
}

function is_tracking_img(image) {
  if(!has_candidate_url(image))
    return false;
  const src = image.getAttribute('src');
  let url = null;
  try {
    url = new URL(src);
  } catch(error) {
    return false;
  }
  return hosts.includes(url.hostname);
}

this.filter_tracking_images = filter_tracking_images;

}
