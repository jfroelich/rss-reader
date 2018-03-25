
const CHANNEL_NAME = 'reader';

export function channel_open() {
  return new BroadcastChannel(CHANNEL_NAME);
}

export function channel_close(handle) {
  if (handle) {
    console.debug('Closing channel', handle.name);
    handle.close();
  }
}
