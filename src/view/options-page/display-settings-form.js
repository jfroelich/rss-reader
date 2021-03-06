import * as localStorageUtils from '/src/lib/local-storage-utils.js';

export default function DisplaySettingsForm() { }

DisplaySettingsForm.prototype.init = function (parent) {
  // TODO: setting class on every td is redundant, much simpler to specify "table td" rule in CSS

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

  const currentEntryMargin = localStorageUtils.readInt('padding');
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

  const currentBackgroundImagePath = localStorageUtils.readString('bg_image');
  const backgroundImagePaths = localStorageUtils.readArray('background_images');
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

  const backgroundColor = localStorageUtils.readString('bg_color');
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

  const headerFontSize = localStorageUtils.readInt('header_font_size');
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

  const bodyFontSize = localStorageUtils.readInt('body_font_size');
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
  input.checked = localStorageUtils.readBoolean('justify_text');

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

  const bodyLineHeight = localStorageUtils.readInt('body_line_height');
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
  const currentColumnCount = localStorageUtils.readInt('column_count');
  for (const columnCount of columnCountOptions) {
    const option = document.createElement('option');
    option.value = columnCount;
    option.selected = columnCount === currentColumnCount;
    option.textContent = columnCount;
    select.append(option);
  }
  cell.append(select);
  row.append(cell);
  table.append(row);

  parent.append(table);
};

DisplaySettingsForm.prototype.entryMarginSliderOnchange = function (event) {
  const margin = event.target.value;
  if (margin) {
    localStorageUtils.writeString('padding', margin);
  } else {
    localStorageUtils.remove('padding');
  }
};

DisplaySettingsForm.prototype.backgroundImageOnChange = function (event) {
  const path = event.target.value;
  if (path) {
    localStorageUtils.writeString('bg_image', path);
  } else {
    localStorageUtils.remove('bg_image');
  }
};

DisplaySettingsForm.prototype.entryBackgroundColorOninput = function (event) {
  const color = event.target.value;
  if (color) {
    localStorageUtils.writeString('bg_color', color);
  } else {
    localStorageUtils.remove('bg_color');
  }
};

DisplaySettingsForm.prototype.headerFontSizeOnchange = function (event) {
  const size = event.target.value;
  if (size) {
    localStorageUtils.writeString('header_font_size', size);
  } else {
    localStorageUtils.remove('header_font_size');
  }
};

DisplaySettingsForm.prototype.bodyFontSizeOnchange = function (event) {
  const size = event.target.value;
  if (size) {
    localStorageUtils.writeString('body_font_size', size);
  } else {
    localStorageUtils.remove('body_font_size');
  }
};

DisplaySettingsForm.prototype.justifyTextOnchange = function (event) {
  localStorageUtils.writeBoolean('justify_text', event.target.checked);
};

DisplaySettingsForm.prototype.bodyLineHeightOninput = function (event) {
  const height = event.target.value;
  if (height) {
    localStorageUtils.writeString('body_line_height', height);
  } else {
    localStorageUtils.remove('body_line_height');
  }
};

DisplaySettingsForm.prototype.columnCountOnchange = function (event) {
  const count = event.target.value;
  if (count) {
    localStorageUtils.writeString('column_count', count);
  } else {
    localStorageUtils.remove('column_count');
  }
};
