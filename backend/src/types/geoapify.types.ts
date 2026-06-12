export interface IGeoapifyFeatureProperties {
    lat: number;
    lon: number;
    city?: string;
    state?: string;
    country?: string;
}

export interface IGeoapifyFeature {
    type: string;
    properties: IGeoapifyFeatureProperties;
}

export interface IGeoapifyResponse {
    type: string;
    features: IGeoapifyFeature[];
}
