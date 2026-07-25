export const ROOM_CORE_DEFAULT_PAGE_SIZE = 24;
export const ROOM_CORE_MAX_PAGE_SIZE = 48;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function corePagingFromSearchParams(searchParams) {
  return {
    page: boundedInteger(searchParams?.get?.("page"), 1, 1, 100000),
    pageSize: boundedInteger(
      searchParams?.get?.("limit"),
      ROOM_CORE_DEFAULT_PAGE_SIZE,
      1,
      ROOM_CORE_MAX_PAGE_SIZE
    ),
  };
}

export function normalizeCorePaging(value = {}) {
  return {
    page: boundedInteger(value.page, 1, 1, 100000),
    pageSize: boundedInteger(
      value.pageSize,
      ROOM_CORE_DEFAULT_PAGE_SIZE,
      1,
      ROOM_CORE_MAX_PAGE_SIZE
    ),
  };
}

export function corePageRange(page, pageSize) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function corePageInfo(totalValue, requestedPage, pageSize, itemCount) {
  const totalItems = Math.max(0, Number(totalValue ?? 0));
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(totalItems, from + itemCount - 1);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    from,
    to,
  };
}

export function pageBoundedRows(rows, pagingInput = {}) {
  const paging = normalizeCorePaging(pagingInput);
  const totalItems = Array.isArray(rows) ? rows.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / paging.pageSize));
  const page = Math.min(paging.page, totalPages);
  const range = corePageRange(page, paging.pageSize);
  const items = (Array.isArray(rows) ? rows : []).slice(range.from, range.to + 1);
  return {
    items,
    pageInfo: corePageInfo(totalItems, page, paging.pageSize, items.length),
  };
}

export async function loadCorePage(runQuery, pagingInput = {}) {
  const paging = normalizeCorePaging(pagingInput);
  let page = paging.page;
  let range = corePageRange(page, paging.pageSize);
  let result = await runQuery(range);
  if (result.error) return { result, pageInfo: null };

  const totalItems = Math.max(0, Number(result.count ?? 0));
  const totalPages = Math.max(1, Math.ceil(totalItems / paging.pageSize));
  if (page > totalPages) {
    page = totalPages;
    range = corePageRange(page, paging.pageSize);
    result = await runQuery(range);
    if (result.error) return { result, pageInfo: null };
  }

  const rows = result.data ?? [];
  return {
    result,
    pageInfo: corePageInfo(totalItems, page, paging.pageSize, rows.length),
  };
}
