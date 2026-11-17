import type { IListing } from "./Listing";

export interface ISearchResponse {
  items: IListing[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
