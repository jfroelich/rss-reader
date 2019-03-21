import * as config from '/src/config/config.js';

// Add a new font to the registered font list
export default function register_font_command(new_font_name) {
  console.log('Registering font', new_font_name);

  const fonts = config.read_array('fonts');

  const normal_new_name = new_font_name.toLowerCase();

  for (const existing_font_name of fonts) {
    const normal_existing_name = existing_font_name.toLowerCase();
    if (normal_existing_name === normal_new_name) {
      console.warn(
          'Failed to register font %s. A similar font already exists.',
          new_font_name);
      return;
    }
  }

  fonts.push(new_font_name);
  config.write_array('fonts', fonts);
  console.log('Registered font', new_font_name);
}
