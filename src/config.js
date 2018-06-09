import * as color from '/src/lib/color.js';

// The config module provides a single point of access to configure the app,
// which is simpler to maintain and tweak than hunting down settings dispersed
// across files.

// Slideshow slide background images
export const background_images = [
  'bgfons-paper_texture318.jpg', 'CCXXXXXXI_by_aqueous.jpg',
  'paper-backgrounds-vintage-white.jpg', 'pickering-texturetastic-gray.png',
  'reusage-recycled-paper-white-first.png', 'subtle-patterns-beige-paper.png',
  'subtle-patterns-cream-paper.png', 'subtle-patterns-exclusive-paper.png',
  'subtle-patterns-groove-paper.png', 'subtle-patterns-handmade-paper.png',
  'subtle-patterns-paper-1.png', 'subtle-patterns-paper-2.png',
  'subtle-patterns-paper.png', 'subtle-patterns-rice-paper-2.png',
  'subtle-patterns-rice-paper-3.png', 'subtle-patterns-soft-wallpaper.png',
  'subtle-patterns-white-wall.png', 'subtle-patterns-witewall-3.png',
  'thomas-zucx-noise-lines.png'
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
