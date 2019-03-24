import open from '/src/db/ops/open.js';
import RecordingChannel from '/src/lib/recording-channel.js';

// A simple decorator of the open op to simplify connecting to the database in
// tests.
export default function test_open(database_name) {
  let version, upgrade_handler, timeout;
  let channel_name = 'test-channel';
  return open(
      database_name, version, upgrade_handler, timeout, channel_name,
      RecordingChannel);
}
