export const CACHE_KEYS = {
    HOTELS_LIST: 'cache:hotels:list',
    HOTEL_DETAIL: 'cache:hotels:detail',
    HOTEL_AVAILABILITY: 'cache:hotels:availability',
    
    BUS_ROUTES_LIST: 'cache:buses:list',
    BUS_ROUTE_DETAIL: 'cache:buses:detail',
    
    TRAIN_ROUTES_LIST: 'cache:trains:list',
    TRAIN_ROUTE_DETAIL: 'cache:trains:detail',
    
    FLIGHTS_LIST: 'cache:flights:list',
    FLIGHT_DETAIL: 'cache:flights:detail',
    
    MOVIES_LIST: 'cache:movies:list',
    MOVIE_DETAIL: 'cache:movies:detail',
    MOVIE_SHOWTIMES: 'cache:movies:showtimes',
    
    USER_PROFILE: 'cache:users:profile',
} as const;

export const CACHE_TTL = {
    HOTELS_LIST: 300_000,
    HOTEL_DETAIL: 600_000,
    HOTEL_AVAILABILITY: 60_000,
    
    BUS_ROUTES_LIST: 300_000,
    BUS_ROUTE_DETAIL: 600_000,
    
    TRAIN_ROUTES_LIST: 300_000,
    TRAIN_ROUTE_DETAIL: 600_000,
    
    FLIGHTS_LIST: 300_000,
    FLIGHT_DETAIL: 600_000,
    
    MOVIES_LIST: 300_000,
    MOVIE_DETAIL: 600_000,
    MOVIE_SHOWTIMES: 60_000,
    
    USER_PROFILE: 300_000,
} as const;
