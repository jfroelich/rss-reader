// See license.md
'use strict';

function filter_tracking_imgs(doc, verbose) {
  const telemetry_hosts = [
    'ad.doubleclick.net',
    'b.scorecardresearch.com',
    'googleads.g.doubleclick.net',
    'me.effectivemeasure.net',
    'pagead2.googlesyndication.com',
    'pixel.quantserve.com',
    'pixel.wp.com',
    'pubads.g.doubleclick.net',
    'sb.scorecardresearch.com',
    'stats.bbc.co.uk'
  ];

  const min_url_length = 3;// 1char hostname . 1char domain
  const images = doc.querySelectorAll('img[src]');
  for(const img_element of images) {
    let url_string = img_element.getAttribute('src');
    if(!url_string)
      continue;
    url_string = url_string.trim();
    if(!url_string)
      continue;
    else if(url_string.length < min_url_length)
      continue;
    else if(url_string.includes(' '))
      continue;
    else if(!/^https?:/i.test(url_string))
      continue;

    let url_object;
    try {
      url_object = new URL(url_string);
    } catch(error) {
      continue;
    }

    if(telemetry_hosts.includes(url_object.hostname)) {
      if(verbose)
        console.debug('Removing telemetry image element', img_element);
      img_element.remove();
    }
  }
}
