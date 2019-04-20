import * as db from '/src/db/db.js';
import * as favicon from '/src/lib/favicon.js';
import { Deadline } from '/src/lib/deadline.js';
import assert, { isAssertError } from '/src/lib/assert.js';
import fadeElement from '/src/lib/fade-element.js';
import subscribe from '/src/service/subscribe.js';

export default function SubscriptionForm() {
  // Default to a reasonable amount of time. The user can optionally override this. Use Deadline(0)
  // or undefined to not impose a time limit.
  this.fetchFeedTimeout = new Deadline(8000);

  this.urlElement = undefined;
  this.monitorElement = undefined;
  // Optional callback that is invoked with the subscribed feed, prior to all entries being
  // imported.
  this.onsubscribe = undefined;
}

async function subscriptionFormHideMonitor() {
  assert(this.monitorElement);
  const durationSeconds = 2;
  const delaySeconds = 1;
  await fadeElement(this.monitorElement, durationSeconds, delaySeconds);
  this.monitorElement.remove();
  this.monitorElement = undefined;
}

SubscriptionForm.prototype.init = function subscriptionFormInit(parent) {
  const heading = document.createElement('h1');
  heading.textContent = 'Add a subscription';
  parent.append(heading);

  const formElement = document.createElement('form');
  formElement.id = 'subscription-form';

  const urlElement = document.createElement('input');
  urlElement.setAttribute('type', 'search');
  urlElement.setAttribute('id', 'subscribe-url');
  urlElement.setAttribute('placeholder', 'http://example.com/feed.rss');
  urlElement.setAttribute('required', '');
  formElement.append(urlElement);

  this.urlElement = urlElement;

  const submitButton = document.createElement('input');
  submitButton.setAttribute('type', 'submit');
  submitButton.setAttribute('value', 'Subscribe');
  formElement.append(submitButton);

  formElement.onsubmit = this.onsubmit.bind(this);

  parent.append(formElement);
};

SubscriptionForm.prototype.showMonitor = function () {
  const monitorElement = document.createElement('div');
  this.monitorElement = monitorElement;

  monitorElement.setAttribute('id', 'submon');
  monitorElement.style.opacity = '1';

  const subscriptionProgressElement = document.createElement('progress');
  subscriptionProgressElement.textContent = 'Working...';
  monitorElement.append(subscriptionProgressElement);

  document.body.append(monitorElement);
};

SubscriptionForm.prototype.appendMonitorMessage = function (message) {
  assert(this.monitorElement);

  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  this.monitorElement.append(messageElement);
};

SubscriptionForm.prototype.onsubmit = async function (event) {
  // Prevent the form from submitting as we plan to handle it ourselves
  event.preventDefault();

  // TODO: get this working, nothing actually sets this to true at the moment
  // if (this.subscription_in_progress) {
  //  console.debug('Ignoring form submission, subscription already in
  //  progress'); return;
  // }

  const { value } = this.urlElement;
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    console.debug(error);
    return;
  }

  console.debug('Subscribing to', url.href);

  this.urlElement.value = '';
  this.showMonitor();
  this.appendMonitorMessage(`Subscribing to ${url.href}`);

  const promises = [db.open(), favicon.open()];
  const [conn, iconn] = await Promise.all(promises);

  try {
    await subscribe(
      conn, iconn, url, this.fetchFeedTimeout, true,
      this.onFeedStored.bind(this),
    );
  } catch (error) {
    console.debug(error);

    if (isAssertError(error)) {
      throw error;
    }

    if (error instanceof db.ConstraintError) {
      console.debug('Already subscribed to feed', url.href);
      this.appendMonitorMessage(
        `Already subscribed to feed with similar url ${url.href}`,
      );
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

SubscriptionForm.prototype.onFeedStored = function (feed) {
  const finalURLString = feed.urls[feed.urls.length - 1];
  this.appendMonitorMessage(`Subscribed to ${finalURLString}`);
  this.hideMonitor();
  if (this.onsubscribe) {
    this.onsubscribe(feed);
  }
};

SubscriptionForm.prototype.hideMonitor = subscriptionFormHideMonitor;
