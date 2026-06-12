export interface IHotelResult {
    placeId: string;
    name: string | null;
    address: string;
    addressLine1: string;
    addressLine2: string;
    city: string | null;
    state: string | null;
    country: string;
    lat: number;
    lon: number;
    categories: string[];
}

export interface IHotelSearchResponse {
    hotels: IHotelResult[];
    total: number;
    city: string;
    checkIn: string;
    checkOut: string;
    guests: number;
}
