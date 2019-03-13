import * as config from '/src/config/config.js';

export function GeneralSettingsForm() {}

GeneralSettingsForm.prototype.init = async function(parent) {
  const heading = document.createElement('h1');
  heading.textContent = 'General Settings';
  parent.appendChild(heading);

  const table = document.createElement('table');
  table.setAttribute('id', 'general-settings-table');

  let row = document.createElement('tr');
  let cell = document.createElement('td');
  cell.setAttribute('colspan', '2');
  cell.setAttribute('class', 'option-text');
  let input = document.createElement('input');
  input.setAttribute('type', 'checkbox');
  input.setAttribute('id', 'enable-notifications');

  input.onclick = event => {
    config.write_boolean('show_notifications', event.target.checked);
  };

  input.checked = config.read_boolean('show_notifications');

  let label = document.createTextNode('Enable notifications');
  cell.appendChild(input);
  cell.appendChild(label);
  row.appendChild(cell);
  table.appendChild(row);

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
  input.checked = await has_permission('background');
  input.onclick = event => {
    if (event.target.checked) {
      request_permission('background');
    } else {
      remove_permission('background');
    }
  };

  label = document.createTextNode(
      'Permit this extension to check for updates in the background if ' +
      'Chrome is configured to allow background processing.');
  cell.appendChild(input);
  cell.appendChild(label);
  row.appendChild(cell);
  table.appendChild(row);

  row = document.createElement('tr');
  cell = document.createElement('td');
  cell.setAttribute('colspan', '2');
  cell.setAttribute('class', 'option-text');
  input = document.createElement('input');
  input.setAttribute('type', 'checkbox');
  input.setAttribute('id', 'enable-idle-check');

  input.checked = config.read_boolean('only_poll_if_idle');
  input.onclick = event =>
      config.write_boolean('only_poll_if_idle', event.target.checked);

  label =
      document.createTextNode('Only check for updates when my device is idle');
  cell.appendChild(input);
  cell.appendChild(label);
  row.appendChild(cell);
  table.appendChild(row);

  parent.appendChild(table);
};

function request_permission(name) {
  return new Promise(
      resolve => chrome.permissions.request({permissions: [name]}, resolve));
}

function remove_permission(name) {
  return new Promise(
      resolve => chrome.permissions.remove({permissions: [name]}, resolve));
}

function has_permission(name) {
  return new Promise(
      resolve => chrome.permissions.contains({permissions: [name]}, resolve));
}
