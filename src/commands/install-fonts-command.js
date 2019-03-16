import * as config from '/src/config/config.js';

// TODO: the functionality for installing fonts probably should not exist
// in config, it should be here in the calling context

export default function install_fonts_command() {
  config.install_fonts();
}
