import * as config from '/src/config.js';

export function DisplaySettingsForm() {}

DisplaySettingsForm.prototype.init = function(parent) {
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
  let label = document.createTextNode('Margins:');
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

  const current_entry_margin = config.read_int('padding', 0);
  if (!isNaN(current_entry_margin)) {
    input.value = current_entry_margin;
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
  const background_image_menu = document.createElement('select');
  background_image_menu.setAttribute('id', 'entry-background-image');
  background_image_menu.onchange = this.backgroundImageOnChange.bind(this);

  let option = document.createElement('option');
  option.value = '';
  option.textContent = 'Use background color';
  background_image_menu.append(option);

  const current_background_image_path = config.read_string('bg_image');
  const background_images = config.read_array('background_images');
  for (const background_image_path of background_images) {
    const option = document.createElement('option');
    option.value = background_image_path;
    option.textContent = background_image_path;
    option.selected = current_background_image_path === background_image_path;
    background_image_menu.append(option);
  }
  cell.append(background_image_menu);
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

  const background_color = config.read_string('bg_color');
  if (background_color) {
    input.value = background_color;
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

  const header_font_size = config.read_int('header_font_size');
  if (!isNaN(header_font_size)) {
    input.value = header_font_size;
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


  const body_font_size = config.read_int('body_font_size');
  if (!isNaN(body_font_size)) {
    input.value = body_font_size;
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
  input.checked = config.read_boolean('justify_text');

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

  const body_line_height = config.read_int('body_line_height');
  if (!isNaN(body_line_height)) {
    input.value = body_line_height;
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

  const column_count_options = [1, 2, 3];
  const current_column_count = config.read_int('column_count');
  for (const column_count of column_count_options) {
    const option = document.createElement('option');
    option.value = column_count;
    option.selected = column_count === current_column_count;
    option.textContent = column_count;
    select.append(option);
  }
  cell.append(select);
  row.append(cell);
  table.append(row);

  parent.append(table);
};

DisplaySettingsForm.prototype.entryMarginSliderOnchange = function(event) {
  const margin = event.target.value;
  if (margin) {
    config.write_string('padding', margin);
  } else {
    config.remove('padding');
  }
};

DisplaySettingsForm.prototype.backgroundImageOnChange = function(event) {
  const path = event.target.value;
  if (path) {
    config.write_string('bg_image', path);
  } else {
    config.remove('bg_image');
  }
};

DisplaySettingsForm.prototype.entryBackgroundColorOninput = function(event) {
  const color = event.target.value;
  if (color) {
    config.write_string('bg_color', color);
  } else {
    config.remove('bg_color');
  }
};

DisplaySettingsForm.prototype.headerFontSizeOnchange = function(event) {
  const size = event.target.value;
  if (size) {
    config.write_string('header_font_size', size);
  } else {
    config.remove('header_font_size');
  }
};

DisplaySettingsForm.prototype.bodyFontSizeOnchange = function(event) {
  const size = event.target.value;
  if (size) {
    config.write_string('body_font_size', size);
  } else {
    config.remove('body_font_size');
  }
};

DisplaySettingsForm.prototype.justifyTextOnchange = function(event) {
  config.write_boolean('justify_text', event.target.checked);
};

DisplaySettingsForm.prototype.bodyLineHeightOninput = function(event) {
  const height = event.target.value;
  if (height) {
    config.write_string('body_line_height', height);
  } else {
    config.remove('body_line_height');
  }
};

DisplaySettingsForm.prototype.columnCountOnchange = function(event) {
  const count = event.target.value;
  if (count) {
    config.write_string('column_count', count);
  } else {
    config.remove('column_count');
  }
};
