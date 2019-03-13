import {assert, AssertionError} from '/src/assert.js';
import {Deadline} from '/src/deadline.js';
import * as favicon from '/src/favicon/favicon.js';
import {ConstraintError, Model} from '/src/model/model.js';
import {subscribe} from '/src/ops/subscribe.js';
import {fade_element} from '/src/options-page/fade-element.js';

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

  monitor_element = document.createElement('div');
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

  const model = new Model();
  const promises = [model.open(), favicon.open()];
  const [_, iconn] = await Promise.all(promises);

  try {
    await subscribe(
        model, iconn, url, this.fetch_feed_timeout, true, this.onFeedStored);
  } catch (error) {
    if (error instanceof AssertionError) {
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
  }

  model.close();
  iconn.close();
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
