import * as color from '/src/lib/color.js';
import * as localStorageUtils from '/src/lib/local-storage-utils.js';

const backgroundImageFilenames = [
  'bgfons-paper_texture318.jpg',
  'CCXXXXXXI_by_aqueous.jpg',
  'paper-backgrounds-vintage-white.jpg',
  'pickering-texturetastic-gray.png',
  'reusage-recycled-paper-white-first.png',
  'subtle-patterns-beige-paper.png',
  'subtle-patterns-cream-paper.png',
  'subtle-patterns-exclusive-paper.png',
  'subtle-patterns-groove-paper.png',
  'subtle-patterns-handmade-paper.png',
  'subtle-patterns-paper-1.png',
  'subtle-patterns-paper-2.png',
  'subtle-patterns-paper.png',
  'subtle-patterns-rice-paper-2.png',
  'subtle-patterns-rice-paper-3.png',
  'subtle-patterns-soft-wallpaper.png',
  'subtle-patterns-white-wall.png',
  'subtle-patterns-witewall-3.png',
  'thomas-zucx-noise-lines.png'
];

// These must correspond to the names used in CSS.
const defaultFontNames = [
  'ArchivoNarrow-Regular',
  'Arial',
  'Calibri',
  'Cambria',
  'CartoGothicStd',
  'Edward Tufte Roman',
  'Fanwood',
  'Georgia',
  'Inter',
  'League Mono Regular',
  'League Spartan',
  'Merriweather Regular',
  'Montserrat',
  'Noto Sans',
  'Open Sans Regular',
  'PathwayGothicOne',
  'PlayfairDisplaySC',
  'Roboto Regular'
];

export default function ConfigControl() { }

ConfigControl.prototype.init = function (bindOnInstalled) {
  if (bindOnInstalled) {
    chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
  }
};

ConfigControl.prototype.onInstalled = function (event) {
  if (event.reason === 'install') {
    initConfig(event);
  } else {
    configOnUpdate(event);
  }
};

function initConfig() {
  localStorageUtils.writeBoolean('reuse_newtab', true);
  localStorageUtils.writeBoolean('notifications_enabled', true);
  localStorageUtils.writeBoolean('only_poll_if_idle', true);
  localStorageUtils.writeInt('idle_poll_secs', 30);
  localStorageUtils.writeInt('contrast_default_matte', color.WHITE);
  localStorageUtils.writeInt('emphasis_max_length', 200);
  localStorageUtils.writeInt('table_scan_max_rows', 20);
  localStorageUtils.writeFloat('min_contrast_ratio', 4.5);
  localStorageUtils.writeInt('set_image_sizes_timeout', 300);
  localStorageUtils.writeInt('initial_entry_load_limit', 3);
  localStorageUtils.writeFloat('slide_transition_duration', 0.16);
  localStorageUtils.writeInt('padding', 180);
  localStorageUtils.writeString('bg_color', '#fefdfd');
  localStorageUtils.writeString('header_font_family', 'Open Sans Regular');
  localStorageUtils.writeInt('header_font_size', 70);
  localStorageUtils.writeString('body_font_family', 'Edward Tufte Roman');
  localStorageUtils.writeInt('body_font_size', 36);
  localStorageUtils.writeInt('body_line_height', 46);
  localStorageUtils.writeInt('column_count', 1);
  localStorageUtils.writeBoolean('justify_text', false);
  localStorageUtils.writeArray('backgroundImageFilenames', backgroundImageFilenames);

  // NOTE: this is within an init context, so we disregard any existing value and overwrite the
  // value with the defaults. this will cause any custom registered fonts to no longer exist
  localStorageUtils.writeArray('fonts', defaultFontNames);
}

// The extension updated, or the background page was reloaded
function configOnUpdate() {
  const deprecatedKeys = [
    'channel_name', 'db_name', 'db_open_timeout', 'db_version', 'debug',
    'entry_title_max_length', 'refresh_badge_delay', 'last_poll_date'
  ];

  for (const key of deprecatedKeys) {
    localStorageUtils.remove(key);
  }

  localStorageUtils.rename('LAST_ALARM', 'last_alarm');
  localStorageUtils.rename('sanitize_document_image_size_fetch_timeout', 'set_image_sizes_timeout');
  localStorageUtils.rename('sanitize_document_low_contrast_default_matte', 'contrast_default_matte');
  localStorageUtils.rename('sanitize_document_emphasis_max_length', 'emphasis_max_length');
  localStorageUtils.rename('sanitize_document_table_scan_max_rows', 'table_scan_max_rows');
  localStorageUtils.rename('article_title_display_max_length', 'entry_title_max_length');
  localStorageUtils.rename('MIN_CONTRAST_RATIO', 'min_contrast_ratio');
  localStorageUtils.rename('PADDING', 'padding');
  localStorageUtils.rename('BG_IMAGE', 'bg_image');
  localStorageUtils.rename('BG_COLOR', 'bg_color');
  localStorageUtils.rename('HEADER_FONT_FAMILY', 'header_font_family');
  localStorageUtils.rename('HEADER_FONT_SIZE', 'header_font_size');
  localStorageUtils.rename('BODY_FONT_FAMILY', 'body_font_family');
  localStorageUtils.rename('BODY_FONT_SIZE', 'body_font_size');
  localStorageUtils.rename('BODY_LINE_HEIGHT', 'body_line_height');
  localStorageUtils.rename('JUSTIFY_TEXT', 'justify_text');
  localStorageUtils.rename('COLUMN_COUNT', 'column_count');
  localStorageUtils.rename('SHOW_NOTIFICATIONS', 'notifications_enabled');
  localStorageUtils.rename('ONLY_POLL_IF_IDLE', 'only_poll_if_idle');
  localStorageUtils.rename('show_notifications', 'notifications_enabled');

  // Strip old path from bg_image setting
  const path = localStorageUtils.readString('bg_image');
  if (path && path.startsWith('/images/')) {
    localStorageUtils.writeString('bg_image', path.substring('/images/'.length));
  }
}
