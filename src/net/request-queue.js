'use strict';

// Just random brainstorming, not usable

const REQUEST_QUEUE = [];

function request_queue_item() {
  this.request = undefined;
  this.expire_cb = undefined;
  this.expire_timer = undefined;
}

function request_queue_enqueue(url) {

  const current_item = request_queue_find_request_by_url(url)
  if(current_item) {
    request_queue_join(current_item);
    return;
  }

  const item = new request_queue_item();
  item.url = url;
  item.request = request;
  REQUEST_QUEUE.push(item);

  request_queue_schedule_expiration(item);
}

function request_queue_schedule_expiration(item) {
  const timer = setTimeout(function() {
    REQUEST_QUEUE.slice(index_of_item);
  });
}
