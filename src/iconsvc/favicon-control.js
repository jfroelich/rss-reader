import * as favicon from '/src/iconsvc/favicon.js';

export async function install_listener(event) {
  if (event.reason === 'install') {
    const conn = await favicon.open();
    conn.close();
  }
}
