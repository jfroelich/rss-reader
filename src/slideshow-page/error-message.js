export function error_message_show(message_text) {
  const container = document.getElementById('error-message-container');
  container.textContent = message_text;
  container.style.display = 'block';
}

// TODO: obviously this needs to be renamed
export function error_message_container_onclick(event) {
  const container = document.getElementById('error-message-container');
  container.style.display = 'none';
}
