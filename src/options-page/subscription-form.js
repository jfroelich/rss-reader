import assert from '/lib/assert.js';
import {is_assert_error} from '/lib/assert.js';
import {Deadline} from '/lib/deadline.js';
import fade_element from '/lib/fade-element.js';
import * as favicon from '/lib/favicon.js';
import * as db from '/src/db/db.js';
import subscribe from '/src/subscribe.js';

export default function SubscriptionForm() {
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
  parent.append(heading);

  const form_element = document.createElement('form');
  form_element.id = 'subscription-form';

  const url_element = document.createElement('input');
  url_element.setAttribute('type', 'search');
  url_element.setAttribute('id', 'subscribe-url');
  url_element.setAttribute('placeholder', 'http://example.com/feed.rss');
  url_element.setAttribute('required', '');
  form_element.append(url_element);

  this.url_element = url_element;

  const submit_button = document.createElement('input');
  submit_button.setAttribute('type', 'submit');
  submit_button.setAttribute('value', 'Subscribe');
  form_element.append(submit_button);

  form_element.onsubmit = this.onsubmit.bind(this);

  parent.append(form_element);
};

SubscriptionForm.prototype.showMonitor = function() {
  const monitor_element = document.createElement('div');
  this.monitor_element = monitor_element;

  monitor_element.setAttribute('id', 'submon');
  monitor_element.style.opacity = '1';

  const progress_element = document.createElement('progress');
  progress_element.textContent = 'Working...';
  monitor_element.append(progress_element);

  document.body.append(monitor_element);
};

SubscriptionForm.prototype.appendMonitorMessage = function(message) {
  assert(this.monitor_element);

  const message_element = document.createElement('p');
  message_element.textContent = message;
  this.monitor_element.append(message_element);
};

SubscriptionForm.prototype.onsubmit = async function(event) {
  // Prevent the form from submitting as we plan to handle it ourselves
  event.preventDefault();

  // TODO: get this working, nothing actually sets this to true at the moment
  // if (this.subscription_in_progress) {
  //  console.debug('Ignoring form submission, subscription already in
  //  progress'); return;
  //}

  const value = this.url_element.value;
  let url = undefined;
  try {
    url = new URL(value);
  } catch (error) {
    console.debug(error);
    return;
  }

  console.debug('Subscribing to', url.href);

  this.url_element.value = '';
  this.showMonitor();
  this.appendMonitorMessage(`Subscribing to ${url.href}`);

  const promises = [db.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(promises);

  try {
    await subscribe(
        conn, iconn, url, this.fetch_feed_timeout, true,
        this.onFeedStored.bind(this));
  } catch (error) {
    console.debug(error);

    if (is_assert_error(error)) {
      throw error;
    }

    if (error instanceof db.errors.ConstraintError) {
      console.debug('Already subscribed to feed', url.href);
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
  }
};

SubscriptionForm.prototype.onFeedStored = function(feed) {
  this.appendMonitorMessage('Subscribed to ' + db.get_url_string(feed));
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
