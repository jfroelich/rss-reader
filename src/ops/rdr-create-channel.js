const CHANNEL_NAME = 'reader';

export function rdr_create_channel() {
  return new BroadcastChannel(CHANNEL_NAME);
}
