import { useState } from 'react'

export function usePageSlice<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pageItems = items.slice(currentPage * pageSize, currentPage * pageSize + pageSize)
  return { page: currentPage, setPage, pageCount, pageItems }
}
