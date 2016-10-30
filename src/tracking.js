// See license.md

'use strict';


// TODO: <img height="1" width="1" alt="" style="display:none"
// src="https://www.facebook.com/tr?id=619966238105738&amp;ev=PixelInitialized">
// - side note, this was revealed as non-html, I think from noscript
// <img src="http://dbg52463.moatads.com/?a=033f43a2ddba4ba592b52109d2ccf5ed"
// style="display:none;">
// <img src="http://d5i9o0tpq9sa1.cloudfront.net/
// ?a=033f43a2ddba4ba592b52109d2ccf5ed" style="display:none;">

// TODO: maybe I need to use array of regexes instead of simple strings array
// and iterate over the array instead of using array.includes(str)

// NOTE: this should only be called after img src urls have been resolved,
// because it assumes that all image src urls are absolute.
// NOTE: this should be called before image dimensions are checked, because
// checking image dimensions requires fetching images, which defeats the
// purpose of avoiding fetching
function filter_tracking_images(doc, hosts, log) {
  const min_valid_url_len = 3; // hostname.domain
  const images = doc.querySelectorAll('img[src]');
  let src, url;
  for(let image of images) {
    src = image.getAttribute('src');
    if(!src) continue;
    src = src.trim();
    if(!src) continue;
    if(src.length < min_valid_url_len) continue;
    if(src.includes(' ')) continue;
    if(!/^https?:/i.test(src)) continue;
    try {
      url = new URL(src);
    } catch(error) {
      continue;
    }
    if(hosts.includes(url.hostname))
      image.remove();
  }
}
