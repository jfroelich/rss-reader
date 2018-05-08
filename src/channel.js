const CHANNEL_NAME = 'reader';

// TODO: rename file to channel.js

export function create_channel() {
  return new BroadcastChannel(CHANNEL_NAME);
}
