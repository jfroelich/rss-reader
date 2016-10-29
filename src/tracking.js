// See license.md

'use strict';


// NOTE: this should only be called after img src urls have been resolved
// TODO: I am not seeing any of the last 4 urls here being filtered. Maybe
// I am looking for the wrong thing? I have not seen these occur even
// once? Are they just script origins?
function filter_tracking_images(doc, hosts, log) {
  const images = doc.querySelectorAll('img[src]');
  for(let image of images) {
    if(!has_tracking_candidate_url(image))
      continue;

    const src = image.getAttribute('src');
    let url;
    try {
      url = new URL(src);
    } catch(error) {
    }

    if(url && hosts.includes(url.hostname))
      image.remove();
  }
}

// TODO: revert to inline in above fn
function has_tracking_candidate_url(image) {
  let src = image.getAttribute('src');
  if(!src)
    return false;
  src = src.trim();
  if(!src)
    return false;
  const min_valid_url_len = 3; // hostname.domain
  if(src.length < min_valid_url_len)
    return false;
  if(src.includes(' '))
    return false;
  if(!/^https?:/i.test(src))
    return false;
  return true;
}
