// TODO: share the container variable here everywhere

export function error_message_show(message_text) {
  const container = document.getElementById('error-message-container');
  container.textContent = message_text;
  container.style.display = 'block';
}

function error_message_onclick(event) {
  const container = document.getElementById('error-message-container');
  container.style.display = 'none';
}


// Attach listeners on module load
const error_container = document.getElementById('error-message-container');
error_container.onclick = error_message_onclick;
