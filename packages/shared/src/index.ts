export type EntityId = string;

export type ApiResult<T> = {
  data: T;
  message?: string;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
};
