// See license.md

'use strict';

const config = {};

config.db_name = 'reader';
config.db_version = 20;

// How many seconds must elapse before checking idle state yields idle result
config.poll_feeds_idle_period_secs = 30;

// How many ms must elapse before a feed is not ignored when polling
config.min_time_since_last_poll = 5 * 60 * 1000;//ms

// 1 day in ms
config.archive_default_entry_max_age = 1 * 24 * 60 * 60 * 1000;

// TODO: remove some of these backgrounds, I went overboard
config.bg_img_paths = [
  '/images/bgfons-paper_texture318.jpg',
  '/images/CCXXXXXXI_by_aqueous.jpg',
  '/images/paper-backgrounds-vintage-white.jpg',
  '/images/pickering-texturetastic-gray.png',
  '/images/reusage-recycled-paper-white-first.png',
  '/images/subtle-patterns-beige-paper.png',
  '/images/subtle-patterns-cream-paper.png',
  '/images/subtle-patterns-exclusive-paper.png',
  '/images/subtle-patterns-groove-paper.png',
  '/images/subtle-patterns-handmade-paper.png',
  '/images/subtle-patterns-paper-1.png',
  '/images/subtle-patterns-paper-2.png',
  '/images/subtle-patterns-paper.png',
  '/images/subtle-patterns-rice-paper-2.png',
  '/images/subtle-patterns-rice-paper-3.png',
  '/images/subtle-patterns-soft-wallpaper.png',
  '/images/subtle-patterns-white-wall.png',
  '/images/subtle-patterns-witewall-3.png',
  '/images/thomas-zucx-noise-lines.png'
];

// TODO: move font license comments to license.md
// TODO: remove support for some of these fonts that are not very readable
config.font_families = [
  'ArchivoNarrow-Regular',
  'Arial, sans-serif',
  'Calibri',
  'Calibri Light',
  'Cambria',
  'CartoGothicStd',
  //http://jaydorsey.com/free-traffic-font/
  //Clearly Different is released under the SIL Open Font License (OFL) 1.1.
  //Based on http://mutcd.fhwa.dot.gov/pdfs/clearviewspacingia5.pdf
  'Clearly Different',
  /* By John Stracke, Released under the OFL. Downloaded from his website */
  'Essays1743',
  // Downloaded free font from fontpalace.com, unknown author
  'FeltTip',
  'Georgia',
  'Montserrat',
  'MS Sans Serif',
  'News Cycle, sans-serif',
  'Noto Sans',
  'Open Sans Regular',
  'PathwayGothicOne',
  'PlayfairDisplaySC',
  'Raleway, sans-serif',
  // http://www.google.com/design/spec/resources/roboto-font.html
  'Roboto Regular'
];

// Functionality that deals with html images will look for these attributes
// containing an alternate url when an image is missing a src
config.lazy_image_attr_names = [
  'load-src',
  'data-src',
  'data-original-desktop',
  'data-baseurl',
  'data-lazy',
  'data-img-src',
  'data-original',
  'data-adaptive-img',
  'data-imgsrc',
  'data-default-src'
];

config.paywall_hosts = [
  'www.nytimes.com',
  'myaccount.nytimes.com',
  'open.blogs.nytimes.com'
];

config.interstitial_hosts = [
  'www.forbes.com',
  'forbes.com'
];

config.script_generated_hosts = [
  'productforums.google.com',
  'groups.google.com'
];

config.requires_cookies_hosts = [
  'www.heraldsun.com.au',
  'ripe73.ripe.net'
];

config.tracking_hosts = [
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
