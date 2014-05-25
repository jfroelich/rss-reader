
var errorMessageBox = {};

errorMessageBox.hide = function(event) {
  var container = document.getElementById('options_error_message');
  if(!container) return;
  var dismissButton = document.getElementById('options_dismiss_error_button');
  if(dismissButton) {
    dismissButton.removeEventListener('click', errorMessageBox.hide);
  }

  container.parentNode.removeChild(container);
};

errorMessageBox.show = function(message) {
  errorMessageBox.hide();

  var container = document.createElement('div');
  var elMessage = document.createElement('span');
  var dismissButton = document.createElement('button');
  
  container.setAttribute('id','options_error_message');
  container.style.opacity = '0';
  elMessage.textContent = message
  container.appendChild(elMessage);
  dismissButton.setAttribute('id','options_dismiss_error_button');
  dismissButton.textContent = 'Dismiss';
  dismissButton.onclick = errorMessageBox.hide;
  container.appendChild(dismissButton);
  document.body.appendChild(container);
  fx.fade(container, 2, 0);  
};