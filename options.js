// Options user interface lib
(function(exports){
'use strict';

// Handle of the background page
var app = app || chrome.extension.getBackgroundPage();

function showSubscriptionMonitor() {
  var oldContainer = document.getElementById('options_subscription_monitor');
  if(oldContainer) {
    console.log('old container still present');
    
    // Note: instead of removing think how to reuse so we avoid this
    // remove then add ugliness (in the UI, and the code too). Also do 
    // this for the error message code.
    // BUG: possible bug if container is concurrently fading out?
    oldContainer.parentNode.removeChild(oldContainer);
  }

  var container = document.createElement('div');
  container.setAttribute('id','options_subscription_monitor');
  container.style.opacity = '1';
  document.body.appendChild(container);
}

// Add a message to the subscription monitor element
function updateSubscriptionMonitor(message) {
  var container = document.getElementById('options_subscription_monitor');
  if(!container) {
    console.log('no subscription monitor container when trying to update');
    return;
  }

  var elMessage = document.createElement('p');
  elMessage.appendChild(document.createTextNode(message));
  container.appendChild(elMessage);
}

function hideSubscriptionMonitor(onComplete) {
  var container = document.getElementById('options_subscription_monitor');
  if(!container) {
    console.log('cannot hide monitor');
    if(onComplete) onComplete();
    return;
  }

  fade(container, 2, 2, function() {
    document.body.removeChild(container);
    if(onComplete) onComplete();
  });
}

function showErrorMessage(msg) {
  var dismissClickListener = function(event) {
    event.target.removeEventListener('click', dismissClickListener);
    if(container) {
      container.parentNode.removeChild(container);
    } else {
      console.error('container was undefined when clicking dismiss');
    }
  }

  var oldContainer = document.getElementById('options_error_message');
  if(oldContainer) {
    document.getElementById('options_dismiss_error_button').removeEventListener(
      'click', dismissClickListener);
    oldContainer.parentNode.removeChild(oldContainer);
  }

  var container = document.createElement('div');
  container.setAttribute('id','options_error_message');
  container.style.opacity = '0';

  var elMessage = document.createElement('span');
  elMessage.appendChild(document.createTextNode(msg));
  container.appendChild(elMessage);

  var elDismiss = document.createElement('input');
  elDismiss.setAttribute('type','button');
  elDismiss.setAttribute('id','options_dismiss_error_button');
  elDismiss.setAttribute('value','Dismiss');
  elDismiss.addEventListener('click', dismissClickListener);
  container.appendChild(elDismiss);
  document.body.appendChild(container);
  fade(container, 2, 0);
}


exports.showSubscriptionMonitor = showSubscriptionMonitor;
exports.updateSubscriptionMonitor = updateSubscriptionMonitor;
exports.hideSubscriptionMonitor = hideSubscriptionMonitor;
exports.showErrorMessage = showErrorMessage;
}(this));