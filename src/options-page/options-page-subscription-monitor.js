'use strict';

// import dom.js

// TODO: instead of removing and re-adding, reset and reuse
function options_page_subscription_monitor_show() {
  let monitor_element = document.getElementById('submon');
  if(monitor_element) {
    monitor_element.remove();
  }

  monitor_element = document.createElement('div');
  monitor_element.setAttribute('id', 'submon');
  monitor_element.style.opacity = '1';
  document.body.appendChild(monitor_element);

  const progress_element = document.createElement('progress');
  progress_element.textContent = 'Working...';
  monitor_element.appendChild(progress_element);
}


function options_page_subscription_monitor_append_message(message) {
  const message_element = document.createElement('p');
  message_element.textContent = message;
  const monitor_element = document.getElementById('submon');
  monitor_element.appendChild(message_element);
}

async function options_page_subscription_monitor_hide() {
  const monitor_element = document.getElementById('submon');
  const duration = 2, delay = 1;
  await dom_fade(monitor_element, duration, delay);
  monitor_element.remove();
}
