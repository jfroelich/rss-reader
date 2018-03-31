import {PollService} from '/src/operations/rdr-poll-feeds/poll-service.js';

export function rdr_poll_feeds(rconn, iconn, channel, console, options = {}) {
  const ps = new PollService();
  ps.rconn = rconn;
  ps.iconn = iconn;
  ps.channel = channel;
  ps.console = console;

  ps.ignore_recency_check = options.ignore_recency_check;
  ps.ignore_modified_check = options.ignore_modified_check;
  ps.notify = options.notify;

  return ps.poll_feeds();
}
