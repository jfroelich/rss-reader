import * as favicon from '/src/favicon.js';

export async function install_listener(event) {
  if (event.reason === 'install') {
    const conn = await favicon.open();
    conn.close();
  }
}
