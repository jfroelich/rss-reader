var app = chrome.extension.getBackgroundPage();

// TODO: I cannot seem to find where this is in use. I think this is an
// artifact from when I showed and managed settings inside the view, 
// before the options page. I think this should be deleted.

function showErrorMessage(msg) {
  var messageElement = document.getElementById('errorMessage');
  messageElement.innerHTML = msg;
  var container = document.getElementById('errorMessageContainer');
  if(container.style.display != 'block') {
    container.style.opacity = 0.0;
    container.style.display = 'block';
    fx.fade(container,0.1, 0, 50);
  }
}

function hideErrorMessage(event) {
  document.getElementById('errorMessageContainer').style.display = 'none';
}

function onViewLoad(event) {
  document.removeEventListener('DOMContentLoaded', onViewLoad);
  document.getElementById('dismiss').onclick = hideErrorMessage;
}

document.addEventListener('DOMContentLoaded', onViewLoad);