export interface IListing {
  id: string;
  source: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  listedDate: string;
  status: "active" | "pending" | "sold";
  description: string;
  relevanceScore: number;
}
