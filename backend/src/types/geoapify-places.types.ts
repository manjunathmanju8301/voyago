export interface IGeoapifyPlacesFeatureProperties {
    place_id: string;
    name?: string;
    formatted: string;
    address_line1: string;
    address_line2: string;
    city?: string;
    state?: string;
    country: string;
    lat: number;
    lon: number;
    categories: string[];
}

export interface IGeoapifyPlacesFeature {
    type: string;
    properties: IGeoapifyPlacesFeatureProperties;
}

export interface IGeoapifyPlacesResponse {
    type: string;
    features: IGeoapifyPlacesFeature[];
}
