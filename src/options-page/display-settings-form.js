import * as config from '/src/config.js';

export default function DisplaySettingsForm() {}

DisplaySettingsForm.prototype.init = function displaySettingsFormInit(parent) {
  // TODO: setting class on every td is redundant, much simpler to specify
  // "table td" rule in CSS

  const heading = document.createElement('h1');
  heading.textContent = 'Display Settings';
  parent.append(heading);

  const table = document.createElement('table');
  table.setAttribute('id', 'options-table');

  // Initialize the entry margins setting
  let row = document.createElement('tr');
  let cell = document.createElement('td');
  cell.setAttribute('class', 'options-text');
  const label = document.createTextNode('Margins:');
  cell.append(label);
  row.append(cell);

  cell = document.createElement('td');
  let input = document.createElement('input');
  input.setAttribute('type', 'range');
  input.setAttribute('id', 'entry-margin');
  input.setAttribute('min', '0');
  input.setAttribute('max', '300');
  input.setAttribute('step', '1');
  input.onchange = this.entryMarginSliderOnchange.bind(this);

  const currentEntryMargin = config.readInt('padding', 0);
  if (!isNaN(currentEntryMargin)) {
    input.value = currentEntryMargin;
  }

  cell.append(input);
  row.append(cell);
  table.append(row);

  // Initialize the background image setting
  row = document.createElement('tr');
  cell = document.createElement('td');
  cell.setAttribute('class', 'options-text');
  cell.textContent = 'Background Image:';
  row.append(cell);

  cell = document.createElement('td');
  const backgroundImageSelect = document.createElement('select');
  backgroundImageSelect.setAttribute('id', 'entry-background-image');
  backgroundImageSelect.onchange = this.backgroundImageOnChange.bind(this);

  const option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  backgroundImageSelect.append(option);

  const currentBackgroundImagePath = config.readString('bg_image');
  const backgroundImagePaths = config.readArray('background_images');
  for (const backgroundImagePath of backgroundImagePaths) {
    const option = document.createElement('option');
    option.value = backgroundImagePath;
    option.textContent = backgroundImagePath;
    option.selected = currentBackgroundImagePath === backgroundImagePath;
    backgroundImageSelect.append(option);
  }
  cell.append(backgroundImageSelect);
  row.append(cell);
  table.append(row);

  // Initialize the background color setting
  row = document.createElement('tr');
  cell = document.createElement('td');
  cell.textContent = 'Background color:';
  row.append(cell);
  cell = document.createElement('td');

  input = document.createElement('input');
  input.setAttribute('id', 'entry-background-color');
  input.setAttribute('type', 'color');
  input.oninput = this.entryBackgroundColorOninput.bind(this);

  const backgroundColor = config.readString('bg_color');
  if (backgroundColor) {
    input.value = backgroundColor;
  }

  cell.append(input);
  row.append(cell);
  table.append(row);

  // Init header size range
  row = document.createElement('tr');
  cell = document.createElement('td');
  cell.textContent = 'Header size';
  row.append(cell);

  cell = document.createElement('td');

  input = document.createElement('input');
  input.setAttribute('type', 'range');
  input.setAttribute('id', 'header-font-size');
  input.setAttribute('min', '0');
  input.setAttribute('max', '200');
  input.setAttribute('step', '1');

  input.onchange = this.headerFontSizeOnchange.bind(this);

  const headerFontSize = config.readInt('header_font_size');
  if (!isNaN(headerFontSize)) {
    input.value = headerFontSize;
  }
  cell.append(input);
  row.append(cell);
  table.append(row);

  row = document.createElement('tr');
  cell = document.createElement('td');
  cell.textContent = 'Body font size:';
  row.append(cell);

  cell = document.createElement('td');
  input = document.createElement('input');
  input.setAttribute('type', 'range');
  input.setAttribute('id', 'body-font-size');
  input.setAttribute('min', '0');
  input.setAttribute('max', '200');
  input.setAttribute('step', '1');
  input.onchange = this.bodyFontSizeOnchange.bind(this);

  const bodyFontSize = config.readInt('body_font_size');
  if (!isNaN(bodyFontSize)) {
    input.value = bodyFontSize;
  }
  cell.append(input);
  row.append(cell);
  table.append(row);

  row = document.createElement('tr');
  cell = document.createElement('td');

  input = document.createElement('input');
  input.setAttribute('type', 'checkbox');
  input.setAttribute('id', 'justify-text');
  input.style.width = '20px';
  input.onchange = this.justifyTextOnchange.bind(this);
  input.checked = config.readBoolean('justify_text');

  cell.append(input);
  cell.append('Justify text');
  row.append(cell);
  table.append(row);

  row = document.createElement('tr');
  cell = document.createElement('td');
  cell.textContent = 'Body line height';
  row.append(cell);
  cell = document.createElement('td');

  input = document.createElement('input');
  input.setAttribute('type', 'range');
  input.setAttribute('id', 'body-line-height');
  input.setAttribute('min', '0');
  input.setAttribute('max', '200');
  input.setAttribute('step', '1');

  input.oninput = this.bodyLineHeightOninput.bind(this);

  const bodyLineHeight = config.readInt('body_line_height');
  if (!isNaN(bodyLineHeight)) {
    input.value = bodyLineHeight;
  }
  cell.append(input);
  row.append(cell);
  table.append(row);

  row = document.createElement('tr');
  cell = document.createElement('td');
  cell.textContent = 'Column count:';
  row.append(cell);
  cell = document.createElement('td');

  const select = document.createElement('select');
  select.setAttribute('id', 'column-count');
  select.onchange = this.columnCountOnchange.bind(this);

  const columnCountOptions = [1, 2, 3];
  const currentColumnCount = config.readInt('column_count');
  for (const column_count of columnCountOptions) {
    const option = document.createElement('option');
    option.value = column_count;
    option.selected = column_count === currentColumnCount;
    option.textContent = column_count;
    select.append(option);
  }
  cell.append(select);
  row.append(cell);
  table.append(row);

  parent.append(table);
};

DisplaySettingsForm.prototype.entryMarginSliderOnchange = function displaySettingsFormEntryMarginOnchange(event) {
  const margin = event.target.value;
  if (margin) {
    config.writeString('padding', margin);
  } else {
    config.remove('padding');
  }
};

DisplaySettingsForm.prototype.backgroundImageOnChange = function (event) {
  const path = event.target.value;
  if (path) {
    config.writeString('bg_image', path);
  } else {
    config.remove('bg_image');
  }
};

DisplaySettingsForm.prototype.entryBackgroundColorOninput = function (event) {
  const color = event.target.value;
  if (color) {
    config.writeString('bg_color', color);
  } else {
    config.remove('bg_color');
  }
};

DisplaySettingsForm.prototype.headerFontSizeOnchange = function (event) {
  const size = event.target.value;
  if (size) {
    config.writeString('header_font_size', size);
  } else {
    config.remove('header_font_size');
  }
};

DisplaySettingsForm.prototype.bodyFontSizeOnchange = function (event) {
  const size = event.target.value;
  if (size) {
    config.writeString('body_font_size', size);
  } else {
    config.remove('body_font_size');
  }
};

DisplaySettingsForm.prototype.justifyTextOnchange = function (event) {
  config.writeBoolean('justify_text', event.target.checked);
};

DisplaySettingsForm.prototype.bodyLineHeightOninput = function (event) {
  const height = event.target.value;
  if (height) {
    config.writeString('body_line_height', height);
  } else {
    config.remove('body_line_height');
  }
};

DisplaySettingsForm.prototype.columnCountOnchange = function (event) {
  const count = event.target.value;
  if (count) {
    config.writeString('column_count', count);
  } else {
    config.remove('column_count');
  }
};
