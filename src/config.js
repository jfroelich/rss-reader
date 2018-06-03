import * as color from '/src/lib/color.js';

// The config module is a global app module depended upon by several other app
// modules. It provides constant settings. The module exists because it provides
// a single point of access to modify settings, which is simpler to change than
// hunting down settings dispersed among many files. In other words this design
// is easier to maintain over time.

// TODO: use local storage instead and deprecate this partially

// Article backgrounds
// TODO: the path should not be a part of the value?
export const background_images = [
  '/images/bgfons-paper_texture318.jpg', '/images/CCXXXXXXI_by_aqueous.jpg',
  '/images/paper-backgrounds-vintage-white.jpg',
  '/images/pickering-texturetastic-gray.png',
  '/images/reusage-recycled-paper-white-first.png',
  '/images/subtle-patterns-beige-paper.png',
  '/images/subtle-patterns-cream-paper.png',
  '/images/subtle-patterns-exclusive-paper.png',
  '/images/subtle-patterns-groove-paper.png',
  '/images/subtle-patterns-handmade-paper.png',
  '/images/subtle-patterns-paper-1.png', '/images/subtle-patterns-paper-2.png',
  '/images/subtle-patterns-paper.png',
  '/images/subtle-patterns-rice-paper-2.png',
  '/images/subtle-patterns-rice-paper-3.png',
  '/images/subtle-patterns-soft-wallpaper.png',
  '/images/subtle-patterns-white-wall.png',
  '/images/subtle-patterns-witewall-3.png',
  '/images/thomas-zucx-noise-lines.png'
];

// Fonts the user can select from to customize the display of content
export const fonts = [
  'ArchivoNarrow-Regular', 'Arial', 'Calibri', 'Cambria', 'CartoGothicStd',
  'Edward Tufte Roman', 'Fanwood', 'Georgia', 'League Mono Regular',
  'League Spartan', 'Montserrat', 'Noto Sans', 'Open Sans Regular',
  'PathwayGothicOne', 'PlayfairDisplaySC', 'Roboto Regular'
];

// These descriptors represent hosts that should be excluded when fetching new
// articles
export const inaccessible_content_descriptors = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'},
  {pattern: /foxnews.com$/i, reason: 'fake'}
];
