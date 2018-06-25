import * as config from '/src/config.js';
import * as color from '/src/lib/color.js';

// React to the extension being installed or updated, or when chrome is updated,
// to do config related things. Note that this listener should be bound before
// other listeners that depend on configuration setup.
export function install_listener(event) {
  if (event.reason === 'install') {
    init_config(event);
  } else {
    update_config(event);
  }
}

// TODO: updates get fired for many reasons, such as when reloading the
// extension from the extensions page. This does not indicate a version
// change. Removing legacy keys should be based on extension version change.
// I always forget what this is, and might use it in the future
// const previous_version_string = event.previousVersion;
function update_config(event) {
  config.remove('debug');
  config.remove('refresh_badge_delay');
  config.remove('db_name');
  config.remove('db_version');
  config.remove('db_open_timeout');
  config.remove('channel_name');

  rename('LAST_ALARM', 'last_alarm');
  rename(
      'sanitize_document_image_size_fetch_timeout', 'set_image_sizes_timeout');
  rename(
      'sanitize_document_low_contrast_default_matte', 'contrast_default_matte');
  rename('sanitize_document_emphasis_max_length', 'emphasis_max_length');
  rename('sanitize_document_table_scan_max_rows', 'table_scan_max_rows');
  rename('article_title_display_max_length', 'entry_title_max_length');
  rename('MIN_CONTRAST_RATIO', 'min_contrast_ratio');
  rename('PADDING', 'padding');
  rename('BG_IMAGE', 'bg_image');
  rename('BG_COLOR', 'bg_color');
  rename('HEADER_FONT_FAMILY', 'header_font_family');
  rename('HEADER_FONT_SIZE', 'header_font_size');
  rename('BODY_FONT_FAMILY', 'body_font_family');
  rename('BODY_FONT_SIZE', 'body_font_size');
  rename('BODY_LINE_HEIGHT', 'body_line_height');
  rename('JUSTIFY_TEXT', 'justify_text');
  rename('COLUMN_COUNT', 'column_count');
  rename('SHOW_NOTIFICATIONS', 'show_notifications');
  rename('ONLY_POLL_IF_IDLE', 'only_poll_if_idle');
}

export function init_config(event) {
  // General settings
  config.write_boolean('show_notifications', true);

  // Poll settings
  config.write_boolean('only_poll_if_idle', true);

  // Content filter settings
  config.write_int('contrast_default_matte', color.WHITE);
  config.write_int('emphasis_max_length', 200);
  config.write_int('table_scan_max_rows', 20);
  config.write_float('min_contrast_ratio', 4.5);
  config.write_int('set_image_sizes_timeout', 300);
  config.write_int('initial_entry_load_limit', 3);

  // View settings
  config.write_int('entry_title_max_length', 300);
  config.write_int('padding', 150);
  config.write_string('bg_color', '#fefdfd');
  config.write_string('header_font_family', 'Open Sans Regular');
  config.write_int('header_font_size', 40);
  config.write_string('body_font_family', 'Edward Tufte Roman');
  config.write_int('body_font_size', 28);
  config.write_int('body_line_height', 16);
  config.write_int('column_count', 1);
  config.write_boolean('justify_text', false);

  // Install default background images
  // clang-format off
  const background_images = [
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
  // clang-format on
  config.write_array('background_images', background_images);

  // Install default fonts
  // clang-format off
  const fonts = [
    'ArchivoNarrow-Regular',
    'Arial',
    'Calibri',
    'Cambria',
    'CartoGothicStd',
    'Edward Tufte Roman',
    'Fanwood',
    'Georgia',
    'League Mono Regular',
    'League Spartan',
    'Montserrat',
    'Noto Sans',
    'Open Sans Regular',
    'PathwayGothicOne',
    'PlayfairDisplaySC',
    'Roboto Regular'
  ];
  // clang-format on
  config.write_array('fonts', fonts);
}

// Rename a configuration key.
function rename(from, to) {
  // There is no need to do any type coercion. Maintain fidelity by using the
  // string type, because everything in and out of config is derivative of
  // of the string type.
  const value = config.read_string(from);

  // Avoid creating the new key if the value is undefined. If the value is
  // undefined then rename devolves into a remove decorator. Note that due to
  // the strictness of this check, empty strings are retained, even though they
  // are not visibly different from undefined in devtools
  if (typeof value !== 'undefined') {
    config.write_string(to, value);
  }

  config.remove(from);
}
