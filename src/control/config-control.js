import * as color from '/src/lib/color.js';
import * as config from '/src/config.js';

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
  config.writeBoolean('reuse_newtab', true);
  config.writeBoolean('notifications_enabled', true);
  config.writeBoolean('only_poll_if_idle', true);
  config.writeInt('idle_poll_secs', 30);
  config.writeInt('contrast_default_matte', color.WHITE);
  config.writeInt('emphasis_max_length', 200);
  config.writeInt('table_scan_max_rows', 20);
  config.writeFloat('min_contrast_ratio', 4.5);
  config.writeInt('set_image_sizes_timeout', 300);
  config.writeInt('initial_entry_load_limit', 3);
  config.writeFloat('slide_transition_duration', 0.16);
  config.writeInt('padding', 180);
  config.writeString('bg_color', '#fefdfd');
  config.writeString('header_font_family', 'Open Sans Regular');
  config.writeInt('header_font_size', 70);
  config.writeString('body_font_family', 'Edward Tufte Roman');
  config.writeInt('body_font_size', 36);
  config.writeInt('body_line_height', 46);
  config.writeInt('column_count', 1);
  config.writeBoolean('justify_text', false);
  config.writeArray('backgroundImageFilenames', backgroundImageFilenames);

  // NOTE: this is within an init context, so we disregard any existing value
  // and overwrite the value with the defaults. this will cause any custom
  // registered fonts to no longer exist
  config.writeArray('fonts', defaultFontNames);
}

// The extension updated, or the background page was reloaded
function configOnUpdate() {
  const deprecatedKeys = [
    'channel_name', 'db_name', 'db_open_timeout', 'db_version', 'debug',
    'entry_title_max_length', 'refresh_badge_delay', 'last_poll_date'
  ];

  for (const key of deprecatedKeys) {
    config.remove(key);
  }

  config.rename('LAST_ALARM', 'last_alarm');
  config.rename('sanitize_document_image_size_fetch_timeout', 'set_image_sizes_timeout');
  config.rename('sanitize_document_low_contrast_default_matte', 'contrast_default_matte');
  config.rename('sanitize_document_emphasis_max_length', 'emphasis_max_length');
  config.rename('sanitize_document_table_scan_max_rows', 'table_scan_max_rows');
  config.rename('article_title_display_max_length', 'entry_title_max_length');
  config.rename('MIN_CONTRAST_RATIO', 'min_contrast_ratio');
  config.rename('PADDING', 'padding');
  config.rename('BG_IMAGE', 'bg_image');
  config.rename('BG_COLOR', 'bg_color');
  config.rename('HEADER_FONT_FAMILY', 'header_font_family');
  config.rename('HEADER_FONT_SIZE', 'header_font_size');
  config.rename('BODY_FONT_FAMILY', 'body_font_family');
  config.rename('BODY_FONT_SIZE', 'body_font_size');
  config.rename('BODY_LINE_HEIGHT', 'body_line_height');
  config.rename('JUSTIFY_TEXT', 'justify_text');
  config.rename('COLUMN_COUNT', 'column_count');
  config.rename('SHOW_NOTIFICATIONS', 'notifications_enabled');
  config.rename('ONLY_POLL_IF_IDLE', 'only_poll_if_idle');
  config.rename('show_notifications', 'notifications_enabled');

  // Strip old path from bg_image setting
  const path = config.readString('bg_image');
  if (path && path.startsWith('/images/')) {
    config.writeString('bg_image', path.substring('/images/'.length));
  }
}
