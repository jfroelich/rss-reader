const container = document.getElementById('error-message-container');

export function error_message_show(message_text) {
  container.textContent = message_text;
  container.style.display = 'block';
}

function error_message_onclick(event) {
  container.style.display = 'none';
}

// On module load
container.onclick = error_message_onclick;
