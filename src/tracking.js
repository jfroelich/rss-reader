// See license.md

'use strict';

// TODO: hosts should be defined externally so that if i want to
// change it, I don't have to change the code

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

function filterTrackingImages(doc) {
  const images = doc.querySelectorAll('img[src]');
  for(let image of images) {
    if(isTrackingImage(image)) {
      image.remove();
    }
  }
}

function hasCandidateURL(image) {
  let src = image.getAttribute('src');
  if(!src) {
    return false;
  }

  src = src.trim();
  if(!src) {
    return false;
  }

  const minlen = 'http://a.d/a'.length;
  if(src.length < minlen) {
    return false;
  }

  if(src.includes(' ')) {
    return false;
  }

  if(!/^https?:/i.test(src)) {
    return false;
  }
  return true;
}

function isTrackingImage(image) {
  if(!hasCandidateURL(image)) {
    return false;
  }

  const src = image.getAttribute('src');
  let url;
  try {
    url = new URL(src);
  } catch(error) {
    return false;
  }

  return hosts.includes(url.hostname);
}

this.filterTrackingImages = filterTrackingImages;

}
