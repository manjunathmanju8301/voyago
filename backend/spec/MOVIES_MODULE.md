# Voyago — Movies Module

## Overview

The Movies module uses a **hybrid approach**: real movie data from TMDB API
(title, poster, rating, synopsis, genres), enriched with deterministic mock data
for booking-specific fields (theaters, showtimes, seat availability, ticket pricing).

This gives users real movie information with simulated booking data.

---

## Data Flow

```
User: city=Delhi, date=2026-07-15
  ↓
TMDB API → /movie/now_playing (real movie data)
  ↓
MovieEnrichmentService.enrich(movie) for each result:
  → Hash movieId → deterministic seed
  → Generate 3-6 theaters with showtimes
  → Generate seat layout per showtime
  → Generate ticket pricing based on format
  ↓
Return enriched results
```

---

## TMDB Integration

### API Details

- **Base URL:** `https://api.themoviedb.org/3`
- **API Key:** via `TMDB_API_KEY` environment variable
- **Language:** `en-US`

### Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `/movie/now_playing` | Currently playing movies |
| `/movie/popular` | Popular movies |
| `/search/movie?query=X` | Text search |
| `/movie/{id}` | Movie detail |
| `/movie/{id}/credits` | Cast and crew |
| `/genre/movie/list` | Genre IDs to names |

### What TMDB Gives

```ts
{
    id: number;
    title: string;
    poster_path: string;        // "/path/to/poster.jpg"
    backdrop_path: string;      // "/path/to/backdrop.jpg"
    overview: string;
    vote_average: number;       // 0-10
    genre_ids: number[];
    release_date: string;
    runtime: number;            // minutes
    original_language: string;
}
```

### What TMDB Does NOT Give

- Theaters / cinemas
- Showtimes
- Ticket pricing
- Seat availability
- Screen formats (2D, 3D, IMAX)

These are provided by the enrichment layer.

---

## MovieEnrichmentService

### Purpose

Takes TMDB results and enriches them with realistic, deterministic mock data
for all booking-specific fields.

### Hash-Seed Algorithm

Same as other modules:

```ts
const seed = hashSeed(String(movieId));
```

---

### Theater Generation

**Theater name pools by country:**

```ts
const THEATER_POOLS: Record<string, string[]> = {
    IN: ['PVR', 'INOX', 'Carnival', 'Cinepolis', 'Movie Time', 'Miraj'],
    US: ['AMC', 'Regal', 'Cinemark', 'Landmark', 'Alamo Drafthouse'],
    JP: ['TOHO Cinemas', 'Shochiku', 'Toei Cinema', 'United Cinemas'],
    GB: ['ODEON', 'Vue', 'Cineworld', 'Curzon', 'Everyman'],
    DE: ['Cineworld', 'UCI', 'Kinopolis', 'CinemaxX'],
    FR: ['Pathé', 'Gaumont', 'UGC', 'MK2'],
    KR: ['CGV', 'Lotte Cinema', 'MEGABOX'],
    AU: ['Hoyts', 'Event Cinemas', 'Palace', 'Village'],
    AE: ['VOX Cinemas', 'Reel Cinemas', 'Novo Cinemas'],
    SG: ['Shaw Theatres', 'Golden Village', 'Cathay Cineplexes'],
};
```

**Number of theaters per movie:** 3-6 (hash determines)

**Theater naming:**
```ts
const theaterName = `${pool[hash % pool.length]} ${citySuffix}`;
// e.g., "PVR Select Citywalk", "INOX Nehru Place", "Carnival Cinemas"
```

---

### Showtime Generation

Each theater gets 4-8 showtimes spread across the day.

**Standard showtime slots:**
```
Morning:    09:00, 09:30, 10:00, 10:30
Matinee:    12:30, 13:00, 13:30
Afternoon:  15:30, 16:00, 16:30
Evening:    18:30, 19:00, 19:30, 20:00
Night:      21:30, 22:00, 22:30
```

The hash determines which 4-8 slots each theater gets.

**Showtime structure:**
```ts
interface Showtime {
    id: string;
    time: string;            // "10:30 AM"
    format: string;          // "2D", "3D", "IMAX", "4DX"
    price: number;
    currency: string;
    seatsAvailable: number;
    totalSeats: number;
    screenNumber: number;
}
```

---

### Format & Pricing

**Formats available per showtime (hash determines):**

| Format | Price Range (INR) | Total Seats |
|--------|-------------------|-------------|
| 2D | ₹150 - ₹350 | 180 - 300 |
| 3D | ₹200 - ₹500 | 150 - 250 |
| IMAX | ₹300 - ₹700 | 250 - 400 |
| 4DX | ₹400 - ₹900 | 80 - 150 |

**Price calculation:**
```
basePrice = randomInRange(format.min, format.max)
hashVariance = 0.9 + seededRandom(seed, showtimeIndex) * 0.2  // 0.9 - 1.1
finalPrice = basePrice × hashVariance
```

---

### Seat Layout & Availability

**Seat sections per screen:**

```ts
interface SeatSection {
    section: string;         // "Recliner", "Premium", "Classic"
    price: number;           // Multiplier applied to base
    rows: number;
    seatsPerRow: number;
    totalSeats: number;
    available: number;
}
```

**Section configuration:**

| Section | Price Multiplier | Typical Rows |
|---------|-----------------|--------------|
| Recliner | 2.0x | 2-3 rows |
| Premium | 1.5x | 4-6 rows |
| Classic | 1.0x | 8-12 rows |

**Availability:**
```
bookedPercentage = 20% + seededRandom(seed, index) * 50%  // 20-70% booked
available = totalSeats × (1 - bookedPercentage)
```

---

### Movie-Specific Seeding

Different movies get different theater configurations:

```ts
// Popular movies get more theaters and higher occupancy
const popularity = movie.vote_average;  // from TMDB
const theaterCount = 3 + Math.floor(seededRandom(seed, 0) * 4);  // 3-6
const occupancyBias = popularity > 7.0 ? 0.15 : 0;  // popular movies more filled
```

---

## Search Flow

### Text Search

```
User query: "Dune"
  ↓
TMDB /search/movie?query=Dune
  ↓
Returns: Dune (2021), Dune: Part Two (2024), etc.
  ↓
Enrich each with theaters/showtimes
```

### Now Playing

```
User: city=Delhi, date=2026-07-15
  ↓
TMDB /movie/now_playing?region=IN
  ↓
Returns: currently playing movies in India
  ↓
Enrich each with theaters/showtimes
```

---

## Search DTO

```ts
class SearchMoviesDto {
    @IsString() @IsOptional()
    query?: string;                    // Text search: "Dune", "Batman"

    @IsString() @IsOptional()
    city?: string;                     // City for theater results

    @IsString() @IsOptional()
    date?: string;                     // YYYY-MM-DD for showtimes
}
```

---

## Controller Endpoints

### GET /api/v1/movies/search

```ts
@ApiTags('Movies')
@Controller('movies')
export class MoviesController {
    @Get('search')
    @HttpCode(200)
    @ApiOperation({ summary: 'Search movies and shows' })
    @ApiResponse({ status: 200, description: MOVIES_SEARCH_SUCCESS })
    async searchMovies(@Query() dto: SearchMoviesDto) {
        const data = await this.moviesService.searchMovies(dto);
        return { message: MOVIES_SEARCH_SUCCESS, data };
    }
}
```

### GET /api/v1/movies/:id

```ts
    @Get(':id')
    @HttpCode(200)
    @ApiOperation({ summary: 'Get movie details by ID' })
    @ApiResponse({ status: 200, description: MOVIES_GET_SUCCESS })
    async getMovie(@Param('id', ParseIntPipe) id: number) {
        const data = await this.moviesService.getMovie(id);
        return { message: MOVIES_GET_SUCCESS, data };
    }
```

### GET /api/v1/movies/:id/showtimes

```ts
    @Get(':id/showtimes')
    @HttpCode(200)
    @ApiOperation({ summary: 'Get showtimes for a movie' })
    @ApiResponse({ status: 200, description: 'Showtimes retrieved successfully' })
    async getShowtimes(
        @Param('id', ParseIntPipe) id: number,
        @Query('city') city?: string,
        @Query('date') date?: string,
    ) {
        const data = await this.moviesService.getShowtimes(id, city, date);
        return { message: 'Showtimes retrieved successfully', data };
    }
```

---

## API Response Format

### Search Response

```json
{
    "success": true,
    "message": "Movies searched successfully",
    "data": {
        "movies": [
            {
                "tmdbId": 693134,
                "title": "Dune: Part Two",
                "posterPath": "https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nez7.jpg",
                "backdropPath": "https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
                "overview": "Follow the mythic journey of Paul Atreides...",
                "rating": 8.5,
                "genres": ["Science Fiction", "Adventure"],
                "releaseDate": "2024-02-27",
                "runtime": 166,
                "theaters": [
                    {
                        "id": "THR-001",
                        "name": "PVR Select Citywalk",
                        "location": "Saket, Delhi",
                        "showtimes": [
                            {
                                "id": "ST-001",
                                "time": "10:30 AM",
                                "format": "2D",
                                "price": 250,
                                "currency": "INR",
                                "seatsAvailable": 142,
                                "totalSeats": 280,
                                "screenNumber": 3
                            },
                            {
                                "id": "ST-002",
                                "time": "1:45 PM",
                                "format": "IMAX",
                                "price": 520,
                                "currency": "INR",
                                "seatsAvailable": 89,
                                "totalSeats": 350,
                                "screenNumber": 1
                            },
                            {
                                "id": "ST-003",
                                "time": "7:00 PM",
                                "format": "3D",
                                "price": 380,
                                "currency": "INR",
                                "seatsAvailable": 45,
                                "totalSeats": 220,
                                "screenNumber": 5
                            },
                            {
                                "id": "ST-004",
                                "time": "9:45 PM",
                                "format": "2D",
                                "price": 280,
                                "currency": "INR",
                                "seatsAvailable": 110,
                                "totalSeats": 280,
                                "screenNumber": 3
                            }
                        ]
                    },
                    {
                        "id": "THR-002",
                        "name": "INOX Nehru Place",
                        "location": "Nehru Place, Delhi",
                        "showtimes": [
                            {
                                "id": "ST-005",
                                "time": "11:00 AM",
                                "format": "2D",
                                "price": 220,
                                "currency": "INR",
                                "seatsAvailable": 165,
                                "totalSeats": 250,
                                "screenNumber": 2
                            },
                            {
                                "id": "ST-006",
                                "time": "4:15 PM",
                                "format": "3D",
                                "price": 350,
                                "currency": "INR",
                                "seatsAvailable": 78,
                                "totalSeats": 200,
                                "screenNumber": 4
                            },
                            {
                                "id": "ST-007",
                                "time": "7:30 PM",
                                "format": "4DX",
                                "price": 650,
                                "currency": "INR",
                                "seatsAvailable": 25,
                                "totalSeats": 100,
                                "screenNumber": 6
                            }
                        ]
                    },
                    {
                        "id": "THR-003",
                        "name": "Carnival Cinemas",
                        "location": "Rohini, Delhi",
                        "showtimes": [
                            {
                                "id": "ST-008",
                                "time": "10:00 AM",
                                "format": "2D",
                                "price": 180,
                                "currency": "INR",
                                "seatsAvailable": 190,
                                "totalSeats": 300,
                                "screenNumber": 1
                            },
                            {
                                "id": "ST-009",
                                "time": "6:00 PM",
                                "format": "2D",
                                "price": 200,
                                "currency": "INR",
                                "seatsAvailable": 130,
                                "totalSeats": 300,
                                "screenNumber": 1
                            }
                        ]
                    }
                ],
                "formats": ["2D", "3D", "IMAX", "4DX"]
            }
        ],
        "total": 15
    }
}
```

---

## Caching

| Cache Key | TTL | Description |
|---|---|---|
| `cache:movies:now-playing` | 30 min | TMDB now playing (rarely changes) |
| `cache:movies:popular` | 30 min | TMDB popular |
| `cache:movies:search:{query}` | 10 min | Search results |
| `cache:movies:detail:{id}` | 10 min | Movie detail |
| `cache:movies:showtimes:{id}:{city}:{date}` | 5 min | Showtimes (shorter — booking changes availability) |

---

## Module Structure

```
src/modules/movies/
├── dto/
│   ├── index.ts
│   └── search-movies.dto.ts
├── types/
│   ├── index.ts
│   └── movie.types.ts
├── movies.service.ts
├── movies-enrichment.service.ts
├── movies.controller.ts
├── movies.module.ts
└── index.ts
```

---

## Implementation Checklist

### Phase 1: TMDB Integration
- [ ] Create TMDB API client service
- [ ] Implement /movie/now_playing call
- [ ] Implement /search/movie call
- [ ] Implement /movie/:id detail call
- [ ] Handle TMDB errors gracefully

### Phase 2: Enrichment
- [ ] Create `MovieEnrichmentService`
- [ ] Implement theater generation
- [ ] Implement showtime generation
- [ ] Implement seat layout & availability
- [ ] Implement format-based pricing
- [ ] Integrate with CURRENCY_MAP

### Phase 3: Controllers
- [ ] Wire up search endpoint
- [ ] Wire up detail endpoint
- [ ] Wire up showtimes endpoint
- [ ] Add caching layer
- [ ] Add Swagger documentation

### Phase 4: Polish
- [ ] Add genre filter
- [ ] Add date filter for showtimes
- [ ] Add sorting (rating, price, showtime)
- [ ] Write unit tests
