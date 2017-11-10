'use strict';

function optionsPageErrorMessageShow(message, fade) {
  optionsPageErrorMessageHide();

  const errorElement = document.createElement('div');
  errorElement.setAttribute('id','options-error-message');

  const messageElement = document.createElement('span');
  messageElement.textContent = message;
  errorElement.appendChild(messageElement);

  const dismissButton = document.createElement('button');
  dismissButton.setAttribute('id', 'dismiss-error-button');
  dismissButton.textContent = 'Dismiss';
  dismissButton.onclick = optionsPageErrorMessageHide;
  errorElement.appendChild(dismissButton);

  if(fade) {
    errorElement.style.opacity = '0';
    document.body.appendChild(errorElement);
    const duration = 1, delay = 0;
    domFade(container, duration, delay);
  } else {
    errorElement.style.opacity = '1';
    errorElement.style.display = 'block';
    document.body.appendChild(errorElement);
  }
}

function optionsPageErrorMessageHide() {
  const errorMessageElement = document.getElementById('options-error-message');
  if(!errorMessageElement) {
    return;
  }

  const dismissButton = document.getElementById('dismiss-error-button');
  if(dismissButton) {
    dismissButton.removeEventListener('click', optionsPageErrorMessageHide);
  }
  errorMessageElement.remove();
}
