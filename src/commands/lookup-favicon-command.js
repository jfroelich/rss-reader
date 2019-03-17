import * as favicon from '/src/lib/favicon/favicon.js';

export default async function lookup_favicon_command(url_string, cached) {
  const request = new favicon.LookupRequest();
  request.conn = cached ? await favicon.open() : undefined;
  request.url = new URL(url_string);
  const result = await favicon.lookup(request);
  request.conn && request.conn.close();
  return result ? result.href : undefined;
}
