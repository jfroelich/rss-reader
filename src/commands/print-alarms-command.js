export default async function print_alarms_command() {
  console.group('Enumerating alarms...');
  const alarms = await get_all_alarms();
  for (const alarm of alarms) {
    console.log('Alarm:', alarm.name);
  }
  console.groupEnd();
}

function get_all_alarms() {
  return new Promise(resolve => chrome.alarms.getAll(resolve));
}
