export const BETS_PER_PAGE = 20;

export function paginateBets(bets, requestedPage, pageSize = BETS_PER_PAGE) {
  const rows = Array.isArray(bets) ? bets : [];
  const safePageSize = Math.max(1, Math.trunc(Number(pageSize)) || BETS_PER_PAGE);
  const pageCount = Math.max(1, Math.ceil(rows.length / safePageSize));
  const parsedPage = Math.trunc(Number(requestedPage)) || 1;
  const page = Math.min(Math.max(parsedPage, 1), pageCount);
  return {
    page,
    pageCount,
    items: rows.slice((page - 1) * safePageSize, page * safePageSize),
  };
}
