import * as color from '/src/lib/color.js';

// The config module is a global app module depended upon by several other app
// modules. It provides constant settings. The module exists because it provides
// a single point of access to modify settings, which is simpler to change than
// hunting down settings dispersed among many files. In other words this design
// is easier to maintain over time.

// This module has low coherency and high coupling, but it is ok to break the
// conventional wisdom in this case. Note the difference between a constant
// setting here, and some constant defined in some module. This is not a global
// 'constants' file. That would be bad. 'constants' in the sense of variable
// values that do not change for the program's lifetime, that are not intended
// to be exposed as configurable, should not be stored in a file like this.
// These settings are different than such constants because these ARE intended
// to be easily configurable. The reason I initially avoided a config module was
// because of the fear of using a constants file. After some reflection, I think
// there is a difference, and that using a global configuration file is not a
// bad thing.

// Regarding the dependence of this module on other modules, I prefer this
// module minimize its dependencies to zero. However, it is ok for this module
// to depend on libraries (modules in the lib folder), because libraries never
// depend on app modules, and this is an app module.

// I've made some attempt to co-locate settings that are used together and label
// them. This is only a weakly-enforced convention that suffices for current
// needs.

// TODO: drop the config prefix where used. As I need to continually remind
// myself, with modular Javascript, the caller decides whether a namespace is
// needed. The source module author should not have naming anxiety regarding
// usage. This is overly defensive. Hard to break old habits, I suppose it is
// residue of the issues back when a variable in any file could pollute global
// namespace. This will also increase naming consistency.

// TODO: if settings are indeed 'related', it may make more sense to use a
// hierarchy. I could group similar settings into plain objects, like
// sub-namespaces. If this file grows to an unweildy size, I think this is the
// way to go. At the moment I have no idea how large this will become. I do
// think that having the caller have to use an extra prefix when referencing is
// not too great of a burden. It may even increase readability. I don't think it
// will have any material performance impact.

// TODO: it is possible that this module should be redesigned to store values
// within localStorage. At the moment this is just something to ponder. Reading
// numbers would become less convenient. Initialization and lifetime management
// is also unclear.


// Document-filters settings
// The matte is the default background color used by the low-contrast pass
export const contrast_default_matte = color.WHITE;
// The maximum number of characters emphasized before unwrapping emphasis
export const emphasis_max_length = 200;
// The maximum number of rows to scan ahead when analyzing tables
export const table_scan_max_rows = 20;
// How long to wait (in ms) before failing when fetching images when setting
// image sizes
export const config_image_size_fetch_timeout = 3000;

// Database connection settings
export const config_db_name = 'reader';
export const config_db_version = 24;
export const config_db_open_timeout = 500;

// The name of the broadcast channel through which the app sends and receives
// messages.
export const config_channel_name = 'reader';

// Article backgrounds
// TODO: the path should not be a part of the value?
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

// Fonts the user can select from to customize the display of content
export const config_fonts = [
  'ArchivoNarrow-Regular', 'Arial, sans-serif', 'Calibri', 'Cambria',
  'CartoGothicStd', 'Fanwood', 'Georgia', 'League Mono Regular',
  'League Spartan', 'Montserrat', 'Noto Sans', 'Open Sans Regular',
  'PathwayGothicOne', 'PlayfairDisplaySC', 'Roboto Regular'
];

// These descriptors represent hosts that should be excluded when fetching new
// articles
export const config_inaccessible_content_descriptors = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'},
  {pattern: /foxnews.com$/i, reason: 'fake'}
];
