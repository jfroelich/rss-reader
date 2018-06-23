import * as color from '/src/argb8888/argb8888.js';
import * as badge from '/src/control/badge-control.js';
import * as config_control from '/src/control/config-control.js';
import * as cron_control from '/src/control/cron-control.js';
import {ReaderDAL} from '/src/dal/dal.js';
import * as favicon from '/src/favicon/favicon.js';

export async function oninstalled(event) {
  // See https://developer.chrome.com/extensions/runtime#event-onInstalled
  // String. Indicates the previous version of the extension, which has just
  // been updated. This is present only if 'reason' is 'update'.
  const prev_version = event.previousVersion;
  // String. The reason that this event is being dispatched.
  // "install", "update", "chrome_update", or "shared_module_update"
  const reason = event.reason;

  if (reason === 'install') {
    // This must occur first, because the later calls rely on configuration
    // settings being setup
    config_oninstall();

    // Explicitly create the reader database
    const dal = new ReaderDAL();
    await dal.connect();
    dal.close();

    // Setup the favicon database explicitly
    conn = await favicon.open();
    conn.close();

    badge.refresh(location.pathname);

    cron_control.create_alarms();
  } else if (reason === 'update') {
    config_onupdate(prev_version);
    cron_control.update_alarms(prev_version);

    // Without this call the badge loses its text on extension reload
    badge.refresh(location.pathname);
  } else {
    console.warn('Unhandled oninstalled event', event);
  }
}

function config_onupdate(prev_version) {
  // clang-format off
  const legacy_keys = [
    'debug',
    'refresh_badge_delay',
    'sanitize_document_image_size_fetch_timeout'
  ];
  // clang-format on
  config_control.remove_all(legacy_keys);

  // Currently does not do anything else, but probably will in the future
}

function config_oninstall() {
  config_control.write_string('db_name', 'reader');
  config_control.write_int('db_version', 24);
  config_control.write_int('db_open_timeout', 500);
  config_control.write_string('channel_name', 'reader');
  config_control.write_int(
      'sanitize_document_low_contrast_default_matte', color.WHITE);
  config_control.write_int('sanitize_document_emphasis_max_length', 200);
  config_control.write_int('sanitize_document_table_scan_max_rows', 20);
  // TODO: lowercase
  config_control.write_float('MIN_CONTRAST_RATIO', 4.5);
  config_control.write_int('set_image_sizes_timeout', 300);
  config_control.write_int('initial_entry_load_limit', 3);

  // Using a longer delay than near-0 to increase cancelation frequency. The
  // delay is in milliseconds. Using asap delay (setting delay to 0 or
  // undefined) was leading to obverably nothing getting canceled and everything
  // getting scheduled too quickly and reaching its end of deferrment and
  // starting and therefore everything was running concurrently. So now this
  // imposes a fake delay on unread count updating that is probably higher than
  // the default near-0 delay. I don't think it will be noticeable but not sure.
  // It turns out that the cross-tab channel messages get sent faster than I
  // expected. Comp specs and load might be a factor I am not accounting for.
  config_control.write_int('refresh_badge_delay', 20);
  config_control.write_int('article_title_display_max_length', 300);

  // TODO: the following display configuration properties should also be
  // initialized or possibly updated at this time
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
  config_control.write_array('background_images', background_images);

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
  config_control.write_array('fonts', fonts);
}
