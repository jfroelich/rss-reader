import * as favicon from '/src/lib/favicon.js';

export default async function clear_favicons_command() {
  console.log('Clearing favicon cache...');

  const conn = await favicon.open();
  await favicon.clear(conn);
  conn.close();

  console.log('Cleared favicon cache');
}
