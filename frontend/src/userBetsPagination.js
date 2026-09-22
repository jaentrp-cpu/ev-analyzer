export const USER_BETS_PAGE_SIZE = 1000;

export async function loadPagedRows(fetchPage, pageSize = USER_BETS_PAGE_SIZE) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return {
    data: Array.from(new Map(rows.map(row => [String(row.id), row])).values()),
    error: null,
  };
}
