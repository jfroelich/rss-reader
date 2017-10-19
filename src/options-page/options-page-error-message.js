'use strict';


function options_page_error_message_show(message, fade) {
  options_page_error_message_hide();

  const error_element = document.createElement('div');
  error_element.setAttribute('id','options-error-message');

  const message_element = document.createElement('span');
  message_element.textContent = message;
  error_element.appendChild(message_element);

  const dismiss_error_button = document.createElement('button');
  dismiss_error_button.setAttribute('id', 'dismiss-error-button');
  dismiss_error_button.textContent = 'Dismiss';
  dismiss_error_button.onclick = options_page_error_message_hide;
  error_element.appendChild(dismiss_error_button);

  if(fade) {
    error_element.style.opacity = '0';
    document.body.appendChild(error_element);
    fade_element(container, 1,0);
  } else {
    error_element.style.opacity = '1';
    error_element.style.display = 'block';
    document.body.appendChild(error_element);
  }
}

function options_page_error_message_hide() {
  const error_message_element = document.getElementById(
    'options-error-message');
  if(!error_message_element) {
    return;
  }

  const dismiss_button = document.getElementById('dismiss-error-button');
  if(dismiss_button) {
    dismiss_button.removeEventListener('click',
      options_page_error_message_hide);
  }
  error_message_element.remove();
}
