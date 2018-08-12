import {openModelAccess} from '/src/model-access.js';

export async function install_listener(event) {
  if (event.reason === 'install') {
    const channeled = false;
    const ma = await openModelAccess(channeled);
    ma.close();
  }
}
