import * as config from '/src/config.js';
import * as color from '/src/lib/color.js';

// React to the extension being installed or updated, or when chrome is updated,
// to do config related things. Note that this listener should be bound before
// other listeners that depend on configuration setup.
export function install_listener(event) {
  if (event.reason === 'install') {
    apply_defaults(event);
  } else {
    remove_legacy_keys(event);
  }
}

function remove_legacy_keys(event) {
  // TODO: updates get fired for many reasons, such as when reloading the
  // extension from the extensions page. This does not indicate a version
  // change. Removing legacy keys should be based on extension version change.
  // I always forget what this is, and might use it in the future
  // const previous_version_string = event.previousVersion;

  // no longer in use
  config.remove('debug');

  // no longer in use
  config.remove('refresh_badge_delay');

  // db info should not be configurable
  config.remove('db_name');
  config.remove('db_version');
  config.remove('db_open_timeout');

  // channel name should be hardcoded
  config.remove('channel_name');

  // use shorter names
  config.remove('sanitize_document_image_size_fetch_timeout');
  config.remove('sanitize_document_low_contrast_default_matte');
  config.remove('sanitize_document_emphasis_max_length');
  config.remove('sanitize_document_table_scan_max_rows');

  // use lowercase
  config.remove('MIN_CONTRAST_RATIO');

  // use a clearer name
  config.remove('article_title_display_max_length');
}

export function apply_defaults(event) {
  // Settings for content filters
  config.write_int('contrast_default_matte', color.WHITE);
  config.write_int('emphasis_max_length', 200);
  config.write_int('table_scan_max_rows', 20);
  config.write_float('min_contrast_ratio', 4.5);
  config.write_int('set_image_sizes_timeout', 300);
  config.write_int('initial_entry_load_limit', 3);

  // Settings for render
  config.write_int('entry_title_max_length', 300);

  // TODO: eventually lowercase the display settings

  config.write_int('PADDING', 150);
  // do not set BG_IMAGE, we default to using a color
  config.write_string('BG_COLOR', '#fefdfd');
  config.write_string('HEADER_FONT_FAMILY', 'Open Sans Regular');
  config.write_int('HEADER_FONT_SIZE', 40);
  config.write_string('BODY_FONT_FAMILY', 'Edward Tufte Roman');
  config.write_int('BODY_FONT_SIZE', 28);
  // do not set JUSTIFY_TEXT by default
  config.write_int('BODY_LINE_HEIGHT', 16);
  config.write_int('COLUMN_COUNT', 1);

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
