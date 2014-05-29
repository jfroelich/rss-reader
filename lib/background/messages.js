var messages = {};

messages.onMessageReceived = function(message) {
  if('subscribe' == message.type) {
    
    
  } else if('unsubscribe' == message.type) {
    messages.onUnsubscribe(message);
  } else if('pollCompleted' == message.type) {
    messages.onPollCompleted(message);
  } else {
    console.log('messages.onMessage unhandled message: %s', JSON.stringify(message));
  }
};

messages.onSubscribe = function(message) {
  console.log('Received subscribe message %s', JSON.stringify(message));
  browserAction.updateBadge();
};

messages.onUnsubscribe = function(message) {
    console.log('Received unsubscribe message %s', JSON.stringify(message));
    browserAction.updateBadge();
};

messages.onPollCompleted = function(message) {
  
};

chrome.runtime.onMessage.addListener(messages.onMessageReceived);