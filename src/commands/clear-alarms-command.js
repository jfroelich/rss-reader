export default async function clear_alarms_command() {
  console.log('Clearing alarms...');
  const cleared = await clear_alarms();
  console.log('Cleared alarms (cleared=%s)', cleared);
}

function clear_alarms() {
  return new Promise(resolve => chrome.alarms.clearAll(resolve));
}
