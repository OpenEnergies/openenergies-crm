/**
 * Fetches ALL rows from a Supabase query by paginating through
 * PostgREST's max-rows limit (default 1000 in hosted Supabase).
 *
 * PostgREST caps each response to `max-rows` rows regardless of the
 * Range header. This utility fetches in consecutive batches of
 * `batchSize` rows and concatenates results.
 *
 * Usage:
 *   const data = await fetchAllRows<MyType>(
 *     supabase.from('table').select('*').eq('active', true).order('name')
 *   );
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  batchSize = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await query.range(offset, offset + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as T[]));
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  return allRows;
}
