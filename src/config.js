export const config_db_name = 'reader';
export const config_db_version = 24;
export const config_db_open_timeout = 500;

// The name of the broadcast channel through which the app sends and receives
// messages.
export const config_channel_name = 'reader';


// Various article backgrounds
export const config_background_images = [
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

// Various fonts the user can select from to customize the display of content
export const config_fonts = [
  'ArchivoNarrow-Regular', 'Arial, sans-serif', 'Calibri', 'Cambria',
  'CartoGothicStd', 'Fanwood', 'Georgia', 'League Mono Regular',
  'League Spartan', 'Montserrat', 'Noto Sans', 'Open Sans Regular',
  'PathwayGothicOne', 'PlayfairDisplaySC', 'Roboto Regular'
];

// These descriptors represent hosts that should be excluded when polling
export const config_inaccessible_content_descriptors = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'},
  {pattern: /foxnews.com$/i, reason: 'fake'}
];
