
import {domFade} from "/src/dom.js";

// TODO: instead of removing and re-adding, reset and reuse
export function optionsPageSubscriptionMonitorShow() {
  let monitorElement = document.getElementById('submon');
  if(monitorElement) {
    monitorElement.remove();
  }

  monitorElement = document.createElement('div');
  monitorElement.setAttribute('id', 'submon');
  monitorElement.style.opacity = '1';
  document.body.appendChild(monitorElement);

  const progressElement = document.createElement('progress');
  progressElement.textContent = 'Working...';
  monitorElement.appendChild(progressElement);
}


export function optionsPageSubscriptionMonitorAppendMessage(message) {
  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  const monitorElement = document.getElementById('submon');
  monitorElement.appendChild(messageElement);
}

export async function optionsPageSubscriptionMonitorHide() {
  const monitorElement = document.getElementById('submon');
  const duration = 2, delay = 1;
  await domFade(monitorElement, duration, delay);
  monitorElement.remove();
}
