const CHANNEL_NAME = 'reader';

export function create_channel() {
  return new BroadcastChannel(CHANNEL_NAME);
}
