import * as config from '/src/config.js';

// TODO: after some reflection, I no longer think database constants should be
// stored in configuration. These should be hardcoded and not configurable. This
// has the added benefit of removing the data access layer's reliance on the
// config module.

// React to the extension being installed or updated, or when chrome is updated,
// to do config related things. Note that this listener should be bound before
// other listeners that depend on configuration setup.
export function install_listener(event) {
  if (event.reason === 'install') {
    extension_oninstall(event);
  } else {
    extension_onupdate(event);
  }
}

// When the extension is updated, do some housekeeping of changes to
// configuration
function extension_onupdate(event) {
  // Not currently in use, but I always forget what it is, and might use it in
  // the future
  // const previous_version_string = event.previousVersion;

  // TODO: updates get fired for many reasons, such as when reloading the
  // extension from the extensions page. This does not indicate a version
  // change. Removing legacy keys should be based on extension version change.

  // Remove any legacy keys
  config.remove('debug');
  config.remove('refresh_badge_delay');
  config.remove('sanitize_document_image_size_fetch_timeout');
}

// When the extension is installed, record some initial settings
function extension_oninstall(event) {
  config.write_string('db_name', 'reader');
  config.write_int('db_version', 24);
  config.write_int('db_open_timeout', 500);
  config.write_string('channel_name', 'reader');
  config.write_int('sanitize_document_low_contrast_default_matte', color.WHITE);
  config.write_int('sanitize_document_emphasis_max_length', 200);
  config.write_int('sanitize_document_table_scan_max_rows', 20);
  // TODO: lowercase
  config.write_float('MIN_CONTRAST_RATIO', 4.5);
  config.write_int('set_image_sizes_timeout', 300);
  config.write_int('initial_entry_load_limit', 3);

  // Using a longer delay than near-0 to increase cancelation frequency. The
  // delay is in milliseconds. Using asap delay (setting delay to 0 or
  // undefined) was leading to obverably nothing getting canceled and everything
  // getting scheduled too quickly and reaching its end of deferrment and
  // starting and therefore everything was running concurrently. So now this
  // imposes a fake delay on unread count updating that is probably higher than
  // the default near-0 delay. I don't think it will be noticeable but not sure.
  // It turns out that the cross-tab channel messages get sent faster than I
  // expected. Comp specs and load might be a factor I am not accounting for.
  config.write_int('refresh_badge_delay', 20);
  config.write_int('article_title_display_max_length', 300);

  // TODO: the following display configuration properties should also be
  // initialized
  // TODO: once working, then lowercase in a later commit and deprecate upper
  // case keys.

  // localStorage.PADDING
  // localStorage.BG_IMAGE
  // localStorage.BG_COLOR
  // localStorage.HEADER_FONT_FAMILY
  // localStorage.HEADER_FONT_SIZE
  // localStorage.BODY_FONT_FAMILY
  // localStorage.BODY_FONT_SIZE
  // localStorage.JUSTIFY_TEXT
  // localStorage.BODY_LINE_HEIGHT
  // localStorage.COLUMN_COUNT

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
