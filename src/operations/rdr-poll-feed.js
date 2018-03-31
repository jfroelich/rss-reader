import {PollService} from '/src/operations/rdr-poll-feeds/poll-service.js';

export function rdr_poll_feed(rconn, iconn, channel, console, options, feed) {
  const ps = new PollService();
  ps.rconn = rconn;
  ps.iconn = iconn;
  ps.channel = channel;
  ps.console = console;
  ps.ignore_recency_check = options.ignore_recency_check;
  ps.ignore_modified_check = options.ignore_modified_check;
  ps.notify = options.notify;
  const poll_feed_promise = ps.poll_feed(feed);
  return poll_feed_promise;
}
