import assert from '/src/lib/assert.js';
import fade_element from '/src/lib/fade-element.js';

// TODO: revisit this at some point, I rediscovered during the switch to this
// module that it is not actually in use. possibly deprecate

export function ErrorMessage() {
  this.container_element = undefined;
  this.dismiss_button = undefined;
}

ErrorMessage.prototype.show = function(message, fade_in) {
  assert(!this.container_element);

  const container = document.createElement('div');
  this.container_element = container;

  container.setAttribute('id', 'options-error-message');
  const message_element = document.createElement('span');
  message_element.textContent = message;
  container.append(message_element);

  const dismiss_button = document.createElement('button');
  dismiss_button.setAttribute('id', 'dismiss-error-button');
  dismiss_button.textContent = 'Dismiss';
  dismiss_button.onclick = this.hide;
  container.append(dismiss_button);

  container.style.opacity = '0';
  document.body.append(container);

  if (fade_in) {
    const duration = 1, delay = 0;
    fade_element(container, duration, delay);
  } else {
    container.style.opacity = '1';
  }
};

ErrorMessage.prototype.hide = function() {
  assert(this.container_element);
  assert(this.dismiss_button);
  this.dismiss_button.removeEventListener('click', this.hide);
  this.dimiss_button = undefined;
  this.container_element.remove();
  this.container_element = undefined;
};
