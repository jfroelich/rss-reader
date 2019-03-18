import {ConstraintError} from '/src/db/errors.js';
import db_open from '/src/db/ops/open.js';
import assert from '/src/lib/assert.js';
import {is_assert_error_like} from '/src/lib/assert.js';
import {Deadline} from '/src/lib/deadline.js';
import fade_element from '/src/lib/fade-element.js';
import * as favicon from '/src/lib/favicon/favicon.js';
import {subscribe} from '/src/ops/subscribe/subscribe.js';

export function SubscriptionForm() {
  // Default to a reasonable amount of time. The user can optionally override
  // this. Use Deadline(0) or undefined to not impose a time limit.
  this.fetch_feed_timeout = new Deadline(8000);

  this.url_element = undefined;
  this.monitor_element = undefined;
  // Optional callback that is invoked with the subscribed feed, prior to all
  // entries being imported.
  this.onsubscribe = undefined;
}

SubscriptionForm.prototype.init = function(parent) {
  const heading = document.createElement('h1');
  heading.textContent = 'Add a subscription';
  parent.appendChild(heading);

  const form_element = document.createElement('form');
  form_element.id = 'subscription-form';

  const url_element = document.createElement('input');
  url_element.setAttribute('type', 'search');
  url_element.setAttribute('id', 'subscribe-url');
  url_element.setAttribute('placeholder', 'http://example.com/feed.rss');
  url_element.setAttribute('required', '');
  form_element.appendChild(url_element);

  this.url_element = url_element;

  const submit_button = document.createElement('input');
  submit_button.setAttribute('type', 'submit');
  submit_button.setAttribute('value', 'Subscribe');
  form_element.appendChild(submit_button);

  form_element.onsubmit = this.onsubmit.bind(this);

  parent.appendChild(form_element);
};

SubscriptionForm.prototype.showMonitor = function() {
  const monitor_element = document.createElement('div');
  this.monitor_element = monitor_element;

  monitor_element.setAttribute('id', 'submon');
  monitor_element.style.opacity = '1';

  const progress_element = document.createElement('progress');
  progress_element.textContent = 'Working...';
  monitor_element.appendChild(progress_element);

  document.body.appendChild(monitor_element);
};

SubscriptionForm.prototype.appendMonitorMessage = function(message) {
  assert(this.monitor_element);

  const message_element = document.createElement('p');
  message_element.textContent = message;
  this.monitor_element.appendChild(message_element);
};

SubscriptionForm.prototype.onsubmit = async function(event) {
  event.preventDefault();
  assert(this.url_element);

  if (this.subscription_in_progress) {
    console.debug('Subscription already in progress');
    return;
  }

  const value = (this.url_element.value || '').trim();
  if (!value) {
    return;
  }

  let url = undefined;
  try {
    url = new URL(value);
  } catch (error) {
    console.debug(error);
    return;
  }

  this.url_element.value = '';
  this.showMonitor();
  this.appendMonitorMessage(`Subscribing to ${url.href}`);

  const promises = [db_open(), favicon.open()];
  const [conn, iconn] = await Promise.all(promises);
  const channel = new BroadcastChannel('reader');

  try {
    await subscribe(
        conn, iconn, channel, url, this.fetch_feed_timeout, true,
        this.onFeedStored.bind(this));
  } catch (error) {
    if (is_assert_error_like(error)) {
      throw error;
    }

    if (error instanceof ConstraintError) {
      this.appendMonitorMessage(
          'Already subscribed to feed with similar url ' + url.href);
      this.hideMonitor();
    } else {
      console.debug(error);
      this.appendMonitorMessage('An unknown error occurred while subscribing');
    }
  } finally {
    conn.close();
    iconn.close();
    channel.close();
  }
};

SubscriptionForm.prototype.onFeedStored = function(feed) {
  this.appendMonitorMessage('Subscribed to ' + feed.getURLString());
  this.hideMonitor();
  if (this.onsubscribe) {
    this.onsubscribe(feed);
  }
};

SubscriptionForm.prototype.hideMonitor = async function() {
  assert(this.monitor_element);
  const duration_secs = 2, delay_secs = 1;
  await fade_element(this.monitor_element, duration_secs, delay_secs);
  this.monitor_element.remove();
  this.monitor_element = undefined;
};