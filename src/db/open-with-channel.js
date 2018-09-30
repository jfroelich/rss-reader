import {open} from '/src/db/open.js';

// Return a session with a channel. Channel name is optional.
export async function open_with_channel(
    name, version, timeout, channel_name = 'reader') {
  const session = await open(name, version, timeout);
  session.channel = new BroadcastChannel(channel_name);
  return session;
}
