import * as badge from '/src/badge.js';
import * as config from '/src/config/config.js';
import * as cron_control from '/src/cron/cron.js';
import * as extension from '/src/extension.js';
import * as platform from '/src/platform.js';
import {Model} from '/src/model/model.js';

// Open a channel with a lifetime equal to the background page lifetime.
const channel = new BroadcastChannel('reader');
channel.onmessage = function(event) {
  // Ensure the badge is refreshed when an entry changes and only the background
  // page is loaded
  const types = ['entry-created', 'entry-updated', 'entry-deleted'];
  if (event.isTrusted && event.data && types.includes(event.data.type)) {
    badge.badge_refresh().catch(console.warn);
  }
};

// TODO: re-inline the listener here
platform.alarm.add_listener(cron_control.alarm_listener);

platform.lifecycle.add_startup_listener(event => {
  badge.badge_refresh().catch(console.warn);
});

platform.lifecycle.add_install_listener(function(event) {
  if (event.reason === 'install') {
    config.init(event);
  } else {
    config.update(event);
  }
});

platform.lifecycle.add_install_listener(async function(event) {
  if (event.reason === 'install') {
    const session = new Model();
    await session.open();
    session.close();
  }
});

platform.lifecycle.add_install_listener(event => {
  if (event.reason === 'install') {
    cron_control.create_alarms();
  } else {
    cron_control.update_alarms(event.previousVersion).catch(console.warn);
  }
});

// Refresh for both install and update event types. While it would seem like
// we only need to do this on install, reloading the extension from Chrome's
// extensions page triggers an update event where for some reason the badge
// text is unset.
platform.lifecycle.add_install_listener(
    _ => badge.badge_refresh().catch(console.warn));

platform.badge.add_listener(_ => extension.open_view().catch(console.warn));
