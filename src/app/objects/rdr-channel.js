const CHANNEL_NAME = 'reader';

export function rdr_channel_open() {
  return new BroadcastChannel(CHANNEL_NAME);
}

export function rdr_channel_close(channel) {
  if (channel) {
    console.debug('Closing channel', channel.name);
    channel.close();
  }
}
