export const ROOM_STUDIO_DEFAULT_PAGE_SIZE = 24;
export const ROOM_STUDIO_MAX_PAGE_SIZE = 48;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function studioPagingFromSearchParams(searchParams) {
  return {
    page: boundedInteger(searchParams?.get?.("page"), 1, 1, 100000),
    pageSize: boundedInteger(
      searchParams?.get?.("limit"),
      ROOM_STUDIO_DEFAULT_PAGE_SIZE,
      1,
      ROOM_STUDIO_MAX_PAGE_SIZE
    ),
  };
}

export function normalizeStudioPaging(value = {}) {
  return {
    page: boundedInteger(value.page, 1, 1, 100000),
    pageSize: boundedInteger(
      value.pageSize,
      ROOM_STUDIO_DEFAULT_PAGE_SIZE,
      1,
      ROOM_STUDIO_MAX_PAGE_SIZE
    ),
  };
}

export function studioPageRange(page, pageSize) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function studioPageInfo(totalValue, requestedPage, pageSize, itemCount) {
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

export async function loadStudioPage(runQuery, pagingInput = {}) {
  const paging = normalizeStudioPaging(pagingInput);
  let page = paging.page;
  let range = studioPageRange(page, paging.pageSize);
  let result = await runQuery(range);
  if (result.error) return { result, pageInfo: null };

  const totalItems = Math.max(0, Number(result.count ?? 0));
  const totalPages = Math.max(1, Math.ceil(totalItems / paging.pageSize));
  if (page > totalPages) {
    page = totalPages;
    range = studioPageRange(page, paging.pageSize);
    result = await runQuery(range);
    if (result.error) return { result, pageInfo: null };
  }

  const rows = result.data ?? [];
  return {
    result,
    pageInfo: studioPageInfo(totalItems, page, paging.pageSize, rows.length),
  };
}
