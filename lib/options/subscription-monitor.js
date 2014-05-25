// TODO: instead of removing and re-adding, reset and reuse

var subscriptionMonitor = {};

subscriptionMonitor.show = function() {
  subscriptionMonitor.reset();
  var container = document.createElement('div');
  container.setAttribute('id', 'options_subscription_monitor');
  container.style.opacity = '1';
  document.body.appendChild(container);
};

subscriptionMonitor.reset = function() {
  var element = document.getElementById('options_subscription_monitor');
  if(element) {
    element.parentNode.removeChild(element);
  }  
};

// Add a message to the subscription monitor element
subscriptionMonitor.update = function (message) {
  var container = document.getElementById('options_subscription_monitor');
  if(!container) {
    return;
  }

  var elMessage = document.createElement('p');
  elMessage.appendChild(document.createTextNode(message));
  container.appendChild(elMessage);
}

subscriptionMonitor.hide = function(onComplete, fadeOut) {
  var container = document.getElementById('options_subscription_monitor');
  if(!container) {
    if(onComplete) onComplete();
    return;
  }

  if(fadeOut) {
    fx.fade(container, 2, 1, function() {
      document.body.removeChild(container);
      if(onComplete) onComplete();
    });    
  } else {
    document.body.removeChild(container);
    if(onComplete) onComplete();
  }
};