import * as config from '/src/config.js';

export default function GeneralSettingsForm() {}

GeneralSettingsForm.prototype.init = async function (parent) {
  const heading = document.createElement('h1');
  heading.textContent = 'General Settings';
  parent.append(heading);

  const table = document.createElement('table');
  table.setAttribute('id', 'general-settings-table');

  let row = document.createElement('tr');
  let cell = document.createElement('td');
  cell.setAttribute('colspan', '2');
  cell.setAttribute('class', 'option-text');
  let input = document.createElement('input');
  input.setAttribute('type', 'checkbox');
  input.setAttribute('id', 'enable-notifications');

  input.onclick = function inputOnclick(event) {
    config.writeBoolean('notifications_enabled', event.target.checked);
  };

  input.checked = config.readBoolean('notifications_enabled');

  let label = document.createTextNode('Enable notifications');
  cell.append(input);
  cell.append(label);
  row.append(cell);
  table.append(row);

  row = document.createElement('tr');
  cell = document.createElement('td');
  cell.setAttribute('colspan', '2');
  cell.setAttribute('class', 'option-text');
  input = document.createElement('input');
  input.setAttribute('type', 'checkbox');
  input.setAttribute('id', 'enable-background');

  // background is configured as an optional permission in the extension's
  // manifest, so it is addable and removable
  // TODO: this should be using a configuration variable and instead the
  // permission should be permanently defined.
  input.checked = await hasPermission('background');
  input.onclick = (event) => {
    if (event.target.checked) {
      requestPermission('background');
    } else {
      removePermission('background');
    }
  };

  label = document.createTextNode('Permit this extension to check for updates in the background if Chrome is configured to allow background processing.');
  cell.append(input);
  cell.append(label);
  row.append(cell);
  table.append(row);

  row = document.createElement('tr');
  cell = document.createElement('td');
  cell.setAttribute('colspan', '2');
  cell.setAttribute('class', 'option-text');
  input = document.createElement('input');
  input.setAttribute('type', 'checkbox');
  input.setAttribute('id', 'enable-idle-check');

  input.checked = config.readBoolean('only_poll_if_idle');
  input.onclick = event => config.writeBoolean('only_poll_if_idle', event.target.checked);

  label = document.createTextNode('Only check for updates when my device is idle');
  cell.append(input);
  cell.append(label);
  row.append(cell);
  table.append(row);

  parent.append(table);
};

function requestPermission(name) {
  return new Promise(resolve => chrome.permissions.request({ permissions: [name] }, resolve));
}

function removePermission(name) {
  return new Promise(resolve => chrome.permissions.remove({ permissions: [name] }, resolve));
}

function hasPermission(name) {
  return new Promise(resolve => chrome.permissions.contains({ permissions: [name] }, resolve));
}
