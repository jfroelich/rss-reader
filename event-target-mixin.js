/**
 * EventTargetMixin - add eventtarget functionality to a function object.
 *
 * Usage:
 *
 * EventTargetMixin.call(SomeTargetFunction.prototype);
 *
 * Based on a mixin design pattern from
 * http://javascriptweblog.wordpress.com/2011/05/31/a-fresh-look-at-javascript-mixins/
 *
 * The method behavior is based in part on
 * https://github.com/mrdoob/eventdispatcher.js
 *
 * NOTE: mixing this in will lazily define a 'listeners'
 * instance variable (type is object literal) within the
 * target object/function. It will separately define
 * methods on the prototype when the above call
 * method is used. Mostly doing it this way because I suck
 * at understanding how to clearly and appropriately
 * define instance variables within the target from here.
 * But it has also been designed so that there is no need
 * to define per instance variables in some kind of
 * upfront init/constructor/apply/superClass thing. We
 * use lazy instantiation of the 'listeners' instance
 * member in the call to addEventListener.
 *
 * NOTE: I actually don't love setting instance variables
 * in the 'host' object because I feel like it risks
 * something that is the equivalent of non-namespace
 * collisions (e.g. some of same issues of global scope
 * variables in apps that use multiple libraries). At the same
 * time, this doc declares the intrusion here so it is OK? Maybe just
 * using an EventTarget object that is its own instance variable
 * and then using decorator methods in the target object is better?
 *
 * NOTE: there is no simply way to track the number of properties
 * in an object. I could wrap the object but for now I am not. Instead,
 * I just store a _numListeners property in the object. The object stores
 * event types as properties. This means callers need to avoid defining
 * a '_numListeners' event type or bad things happen.
 */

var EventTargetMixin = (function() {

function addEventListener(type, listener) {
  this.listeners = this.listeners || {
  	_numListeners: 0
  };

  var listeners = this.listeners[type];
  if(!listeners) {
  	listeners = this.listeners[type] = [];
  }

  if(listeners.indexOf(listener) == -1) {
  	listeners.push(listener);
  	this.listeners._numListeners++;
  }
}

function removeEventListener(type, listener) {

  var listeners = this.listeners[type];
  var index = listeners.indexOf(listener);
  listeners.splice(index, 1);
  this.listeners._numListeners--;
  if(!listeners.length) {
  	delete this.listeners[type];

  	if(!this.listeners._numListeners) {
  	  delete this.listeners;
  	}
  }
}

function dispatchEvent(event) {
  if(!this.listeners || !this.listeners._numListeners) {
    return;
  }

  var listeners = this.listeners[event.type];
  if(!listeners || !listeners.length) {
  	return;
  }

  event.target = this;

  for(var i = 0, len = listeners.length; i < len; i++) {
    listeners[i].call(this, event);
  }
}

return function() {
  this.addEventListener = addEventListener;
  this.removeEventListener = removeEventListener;
  this.dispatchEvent = dispatchEvent;
};
}());