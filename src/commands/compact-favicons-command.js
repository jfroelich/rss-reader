import * as favicon from '/src/favicon/favicon.js';

export default async function compact_favicons_command() {
  console.log('Compacting favicon cache...');
  const conn = await favicon.open();
  await favicon.compact(conn);
  conn.close();
  console.log('Compacted favicon cache');
}
