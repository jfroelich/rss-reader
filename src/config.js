// The config module provides a single point of access to configure the app,
// which is simpler to maintain and tweak than hunting down settings dispersed
// across files.

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
