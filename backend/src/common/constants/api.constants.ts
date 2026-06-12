export enum ApiTags {
    HEALTH = 'Health',
    AUTH = 'Auth',
    USERS = 'Users',
    HOTELS = 'Hotels',
    BUSES = 'Buses',
    TRAINS = 'Trains',
    FLIGHTS = 'Flights',
    MOVIES = 'Movies',
    BOOKINGS = 'Bookings',
    PAYMENTS = 'Payments',
    HELPDESK = 'Helpdesk',
    NOTIFICATIONS = 'Notifications',
}

export enum ApiRoutes {
    HEALTH = 'health',
    AUTH = 'auth',
    USERS = 'users',
    HOTELS = 'hotels',
    BUSES = 'buses',
    TRAINS = 'trains',
    FLIGHTS = 'flights',
    MOVIES = 'movies',
    BOOKINGS = 'bookings',
    PAYMENTS = 'payments',
    HELPDESK = 'helpdesk',
}

export enum ApiOperation {
    HEALTH_CHECK = 'Health check',
    
    // Auth operations
    AUTH_REGISTER = 'Register a new user',
    AUTH_LOGIN = 'Login and get tokens',
    AUTH_REFRESH = 'Refresh access token',
    AUTH_LOGOUT = 'Logout and revoke token',
    AUTH_ME = 'Get current user',

    // User operations
    USERS_GET_ME = 'Get own profile',
    USERS_UPDATE_ME = 'Update own profile',

    // Hotel operations
    HOTELS_LIST = 'List all hotels',
    HOTELS_GET_BY_ID = 'Get hotel by ID',
    HOTELS_SEARCH = 'Search hotels',
    HOTELS_CHECK_AVAILABILITY = 'Check hotel room availability',

    // Bus operations
    BUSES_LIST = 'List all buses',
    BUSES_SEARCH = 'Search bus routes',
    BUSES_GET_BY_ID = 'Get bus details by ID',

    // Train operations
    TRAINS_LIST = 'List all trains',
    TRAINS_SEARCH = 'Search train routes',
    TRAINS_GET_BY_ID = 'Get train details by ID',

    // Flight operations
    FLIGHTS_LIST = 'List all flights',
    FLIGHTS_SEARCH = 'Search flights',
    FLIGHTS_GET_BY_ID = 'Get flight details by ID',

    // Movie operations
    MOVIES_LIST = 'List all movies',
    MOVIES_GET_BY_ID = 'Get movie details by ID',
    MOVIES_SEARCH = 'Search movies and shows',

    // Booking operations
    BOOKINGS_CREATE = 'Create a new booking',
    BOOKINGS_GET = 'Get booking details by ID',
    BOOKINGS_CANCEL = 'Cancel a booking',
    BOOKINGS_LIST = 'List all user bookings',

    // Payment operations
    PAYMENTS_INITIATE = 'Initiate a new payment transaction',
    PAYMENTS_VERIFY = 'Verify payment status',
    PAYMENTS_REFUND = 'Request a refund',

    // Helpdesk operations
    HELPDESK_CREATE_TICKET = 'Create a support ticket',
    HELPDESK_GET_TICKET = 'Get ticket status by ID',
    HELPDESK_CHAT = 'Interact with helpdesk support',
}

export const HEALTH_SUCCESS_MESSAGE = 'Health check passed';

// Success Messages
export const REGISTER_SUCCESS = 'User registered successfully';
export const LOGIN_SUCCESS = 'User logged in successfully';
export const ME_SUCCESS = 'User fetched successfully';
export const REFRESH_SUCCESS = 'Token refreshed successfully';
export const LOGOUT_SUCCESS = 'Logged out successfully';

export const GET_ME_SUCCESS = 'Profile retrieved successfully';
export const UPDATE_ME_SUCCESS = 'Profile updated successfully';

export const HOTELS_LIST_SUCCESS = 'Hotels list retrieved successfully';
export const HOTELS_GET_SUCCESS = 'Hotel details retrieved successfully';
export const HOTELS_SEARCH_SUCCESS = 'Hotels searched successfully';
export const HOTELS_AVAILABILITY_SUCCESS = 'Room availability checked successfully';

export const BUSES_LIST_SUCCESS = 'Buses list retrieved successfully';
export const BUSES_SEARCH_SUCCESS = 'Buses searched successfully';
export const BUSES_GET_SUCCESS = 'Bus details retrieved successfully';

export const TRAINS_LIST_SUCCESS = 'Trains list retrieved successfully';
export const TRAINS_SEARCH_SUCCESS = 'Trains searched successfully';
export const TRAINS_GET_SUCCESS = 'Train details retrieved successfully';

export const FLIGHTS_LIST_SUCCESS = 'Flights list retrieved successfully';
export const FLIGHTS_SEARCH_SUCCESS = 'Flights searched successfully';
export const FLIGHTS_GET_SUCCESS = 'Flight details retrieved successfully';

export const MOVIES_LIST_SUCCESS = 'Movies list retrieved successfully';
export const MOVIES_GET_SUCCESS = 'Movie details retrieved successfully';
export const MOVIES_SEARCH_SUCCESS = 'Movies searched successfully';

export const BOOKING_CREATED_SUCCESS = 'Booking created successfully';
export const BOOKING_RETRIEVED_SUCCESS = 'Booking details retrieved successfully';
export const BOOKING_CANCELLED_SUCCESS = 'Booking cancelled successfully';
export const BOOKINGS_LIST_SUCCESS = 'Bookings list retrieved successfully';

export const PAYMENT_INITIATED_SUCCESS = 'Payment initiated successfully';
export const PAYMENT_VERIFIED_SUCCESS = 'Payment verified successfully';
export const PAYMENT_REFUNDED_SUCCESS = 'Payment refunded successfully';

export const HELPDESK_TICKET_CREATED = 'Support ticket created successfully';
export const HELPDESK_TICKET_RETRIEVED = 'Support ticket retrieved successfully';
export const HELPDESK_CHAT_SUCCESS = 'Helpdesk chat request completed';

// Error Messages
export const NOT_FOUND = 'Resource not found';
export const UNAUTHORIZED = 'Unauthorized access';
export const FORBIDDEN = 'Forbidden request';
export const BAD_REQUEST = 'Bad request';
export const INTERNAL_ERROR = 'Internal server error';

export const SEAT_UNAVAILABLE = 'Requested seat or room is no longer available';
export const BOOKING_NOT_FOUND = 'Booking not found';
export const BOOKING_ALREADY_CANCELLED = 'This booking has already been cancelled';
export const BOOKING_CANNOT_CANCEL = 'This booking cannot be cancelled in its current state';

export const PAYMENT_FAILED = 'Payment transaction failed';
export const INVALID_AMOUNT = 'Invalid payment amount specified';
export const REFUND_FAILED = 'Refund request failed';

export const successResponseSchema = (dataSchema: Record<string, unknown>, message: string) => ({
    schema: {
        type: 'object',
        properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: message },
            data: dataSchema,
        },
    },
});
