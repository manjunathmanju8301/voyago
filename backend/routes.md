# Voyago API Routes

## Base URL
development: http://localhost:3000/api/v1
production: TBD

## Health
| Method | Route | Auth Required | Description |
|--------|-------|---------------|-------------|
| GET | /health | No | Health check |

## Hotels
| Method | Route | Auth Required | Description |
|--------|-------|---------------|-------------|
| GET | /hotels/search | No | Search hotels by city |

### Hotels Search Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| city | string | Yes | - | City name to search hotels in |
| checkIn | string | Yes | - | Check-in date (YYYY-MM-DD) |
| checkOut | string | Yes | - | Check-out date (YYYY-MM-DD) |
| guests | number | No | 1 | Number of guests |
| limit | number | No | 20 | Number of results to return |

---
More modules will be added as they are implemented:
- Auth
- Users
- Buses
- Trains
- Flights
- Movies
- Bookings
- Payments
- Helpdesk
