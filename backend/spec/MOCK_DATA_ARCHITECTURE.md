# Voyago — Mock Data Architecture & Implementation Plan

## Overview

Voyago is a portfolio/learning project. We don't have access to real booking APIs
(Amadeus for flights, IRCTC for trains, RedBus for buses, etc.). We also can't get
real-time availability, room counts, seat inventory, or pricing from free APIs.

**Solution:** Use real APIs where they exist for base data, then enrich results with
deterministic mock data. The mock layer is generated on-the-fly using a hash-seed
algorithm — no local maps, no pre-stored data, no manual entries.

---

## Core Principle: Deterministic Seed-Based Mock Generation

Every entity (hotel, flight, bus, train, movie) has a unique ID from its source API.
We hash that ID to produce a deterministic seed, then use that seed to generate
consistent, unique mock data.

```
uniqueId → hash(seed) → deterministic random values → room types, prices, availability, etc.
```

**Properties:**
- Same ID → always same mock data (deterministic)
- Different ID → always different mock data (unique)
- Works globally — no location-specific hardcoding
- No storage, no maps, no maintenance
- Works for any entity the API returns, even ones we've never seen before

---

## Currency Handling

The only hard-coded mapping is country → currency + price multiplier.
This is ~10-15 lines and is the ONLY location-specific code.

```ts
const CURRENCY_MAP: Record<string, { symbol: string; multiplier: number }> = {
    IN: { symbol: '₹', multiplier: 1 },
    JP: { symbol: '¥', multiplier: 0.08 },
    US: { symbol: '$', multiplier: 0.65 },
    FR: { symbol: '€', multiplier: 0.60 },
    DE: { symbol: '€', multiplier: 0.60 },
    GB: { symbol: '£', multiplier: 0.55 },
    AE: { symbol: 'د.إ', multiplier: 2.40 },
    TH: { symbol: '฿', multiplier: 0.42 },
    SG: { symbol: 'S$', multiplier: 0.87 },
    AU: { symbol: 'A$', multiplier: 0.95 },
    // ... add more as needed
};
```

**How it works:**
1. Geoapify/TMDB returns `country` field
2. Look up currency and multiplier from CURRENCY_MAP
3. Apply multiplier to the generated base price
4. Display with correct currency symbol

---

## Module-by-Module Architecture

---

### 1. Hotels

**Real API:** Geoapify Places API (already implemented)
**What Geoapify gives:** name, address, coordinates, categories, placeId
**What Geoapify does NOT give:** room types, pricing, availability, amenities, ratings, images

#### Data Flow

```
User searches: city=Delhi, checkIn=2026-07-01, checkOut=2026-07-07, guests=2
  ↓
GeocodingHelper.getCityCoordinates("Delhi") → { lat: 28.6139, lon: 77.2090 }
  ↓
Geoapify Places API → returns N hotels with placeId, name, address, coords, categories
  ↓
HotelEnrichmentService.enrich(hotel) for each result:
  - Hash placeId → seed
  - Generate room types (2-6 types based on seed)
  - Generate price per night (based on seed + country multiplier)
  - Generate available rooms (5-50 based on seed)
  - Generate amenities subset from pool
  - Generate rating (3.0-5.0 based on seed)
  - Attach thumbnail placeholder or real image if available
  ↓
Return enriched results to frontend
```

#### Mock Data Per Hotel

```ts
interface EnrichedHotel {
    // From Geoapify (real)
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lon: number;
    country: string;

    // Mock enrichment
    roomTypes: RoomType[];
    rating: number;          // 3.0 - 5.0
    totalReviews: number;    // 50 - 2000
    amenities: string[];     // subset of pool, gym, wifi, spa, restaurant, parking, bar, room-service, breakfast
    images: string[];        // placeholder URLs
    currency: string;        // from CURRENCY_MAP
}

interface RoomType {
    id: string;
    name: string;            // "Standard", "Deluxe", "Suite", "Premium", "Executive"
    pricePerNight: number;   // in local currency
    availableRooms: number;  // 5 - 50
    maxGuests: number;       // 1 - 4
    bedType: string;         // "Single", "Double", "King", "Twin"
}
```

#### Room Type Pool

```
Standard, Economy, Basic         → budget hotels (hash selects 1-2)
Deluxe, Superior, Classic        → mid-range (hash selects 2-3)
Suite, Premium, Executive, Royal → luxury (hash selects 2-4)
```

#### Amenity Pool

```
wifi, parking, breakfast, gym, pool, spa, restaurant, bar, room-service,
laundry, airport-shuffle, concierge, business-center, meeting-rooms
```

Each hotel gets a random subset (6-10 amenities) based on its seed.

#### Price Ranges by Category (before multiplier)

Geoapify category tags influence the base range:
- `accommodation.luxury` → ₹4,000 - ₹15,000
- `accommodation` (default) → ₹1,500 - ₹6,000
- `accommodation.budget` → ₹500 - ₹2,000

---

### 2. Flights

**Real API:** None (no free flight search API)
**Approach:** Fully mock with realistic route data

#### Data Architecture

Flight data is generated from a pre-defined route catalog. Unlike hotels where
Geoapify provides real entities, flights are entirely mock — but with realistic
attributes.

#### Route Catalog (hard-coded, ~50-100 routes)

```ts
interface FlightRoute {
    origin: string;        // IATA code: "DEL"
    originCity: string;    // "Delhi"
    destination: string;   // IATA code: "BOM"
    destinationCity: string; // "Mumbai"
    distance: number;      // km
    baseDuration: number;  // minutes
}
```

**Sample routes:**
```
DEL → BOM  (Delhi → Mumbai)       1,150 km   2h 10m
DEL → BLR  (Delhi → Bangalore)    1,740 km   2h 45m
BOM → GOI  (Mumbai → Goa)          425 km    1h 10m
DEL → LHR  (Delhi → London)       6,720 km   9h 15m
JFK → LAX  (New York → LA)        3,980 km   5h 30m
CDG → NRT  (Paris → Tokyo)        9,720 km  12h 10m
```

#### Flight Generation

```
User searches: from=DEL, to=BOM, date=2026-07-15, passengers=2
  ↓
Filter route catalog for matching origin/destination
  ↓
Generate 8-15 flights per route:
  - Hash(route + date + index) → seed
  - Airlines: IndiGo, Air India, Vistara, SpiceJet, GoFirst (domestic)
             Emirates, Qatar Airways, Lufthansa, Singapore Airlines (international)
  - Departure times: spread across 6AM - 11PM (hash determines slot)
  - Duration: baseDuration ± 15min (hash determines variance)
  - Price: basePrice × multiplier × (1 + hash-based variance)
  - Stops: 0 (70% chance) or 1 (30% chance)
  - Class: Economy, Premium Economy, Business, First (hash determines availability)
  - Seats available: 3-45 per class (hash determines)
```

#### Mock Data Per Flight

```ts
interface EnrichedFlight {
    flightId: string;          // generated: "{airline}{number}"
    airline: string;
    airlineLogo: string;       // placeholder
    origin: string;            // IATA
    originCity: string;
    destination: string;       // IATA
    destinationCity: string;
    departureTime: string;     // ISO
    arrivalTime: string;       // ISO
    duration: string;          // "2h 15m"
    stops: number;             // 0 or 1
    stopCity?: string;         // if 1 stop
    classes: FlightClass[];
    aircraft: string;          // "Boeing 737", "Airbus A320", etc.
    baggage: string;           // "15 kg check-in, 7 kg cabin"
    mealIncluded: boolean;
}

interface FlightClass {
    name: string;              // "Economy", "Business", etc.
    price: number;
    seatsAvailable: number;
    currency: string;
}
```

#### Pricing Logic

```
basePrice = distance × 0.08 (per km rate)
multiplier = CURRENCY_MAP[country].multiplier
hashVariance = 0.7 to 1.4 (hash-based)
finalPrice = basePrice × multiplier × hashVariance
```

---

### 3. Buses

**Real API:** None (RedBus/BusAPI not freely available)
**Approach:** Fully mock with realistic Indian intercity routes

#### Route Catalog (~80-100 Indian routes)

```ts
interface BusRoute {
    origin: string;
    destination: string;
    distance: number;       // km
    baseDuration: number;   // minutes
    popularRoute: boolean;  // affects number of buses generated
}
```

**Sample routes:**
```
Delhi → Jaipur          270 km   5h 30m   (popular)
Mumbai → Pune           150 km   3h 30m   (popular)
Bangalore → Chennai     350 km   6h 00m
Hyderabad → Vijayawada  275 km   5h 00m
Delhi → Shimla          370 km   7h 30m
Goa → Mumbai            590 km   10h 00m
Kolkata → Bhubaneswar   465 km   8h 30m
```

#### Bus Generation

```
User searches: from=Delhi, to=Jaipur, date=2026-07-15, seats=2
  ↓
Filter route catalog
  ↓
Generate 5-20 buses per route (more if popularRoute=true):
  - Hash(route + date + index) → seed
  - Operators: Volvo, KSRTC, APSRTC, RedBus, VRL, SRS, Neeta
  - Bus types: AC Seater, AC Sleeper, Non-AC Seater, Non-AC Sleeper, Volvo AC, Premium
  - Departure times: spread across 6PM - 11PM (most buses are overnight)
  - Duration: baseDuration ± 30min
  - Price: ₹3-8 per km × busTypeMultiplier × hashVariance
  - Seats available: 5-35 (hash determines)
  - Amenities subset: wifi, charging, blanket, water, TV, GPS tracking
```

#### Mock Data Per Bus

```ts
interface EnrichedBus {
    busId: string;
    operator: string;
    busType: string;            // "AC Sleeper", "Volvo AC", etc.
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    price: number;
    currency: string;
    seatsAvailable: number;
    totalSeats: number;
    amenities: string[];
    rating: number;
    liveTracking: boolean;
    boardingPoints: BoardingPoint[];
    droppingPoints: DroppingPoint[];
}

interface BoardingPoint {
    name: string;
    time: string;
    location: string;
}
```

#### Bus Type Pricing Multipliers

```
Non-AC Seater      → 1.0x base
Non-AC Sleeper     → 1.2x
AC Seater          → 1.5x
AC Sleeper         → 1.8x
Volvo AC           → 2.2x
Premium/Volvo 2+1 → 2.5x
```

---

### 4. Trains

**Real API:** None (IRCTC has no public API)
**Approach:** Fully mock with Indian railway routes

#### Train Catalog (~60-80 trains)

```ts
interface TrainRoute {
    trainNumber: string;
    trainName: string;
    origin: string;
    destination: string;
    distance: number;
    baseDuration: number;
    runsDays: string[];        // ["Mon", "Wed", "Fri"]
    classes: string[];         // ["SL", "3A", "2A", "1A"]
}
```

**Sample trains:**
```
12951  Rajdhani Express    Delhi → Mumbai       1,384 km  15h 35m  [Daily]
12002  Shatabdi Express    Delhi → Bhopal       700 km    8h 00m  [Mon-Sat]
12625  Kerala Express      Delhi → Trivandrum   2,950 km  44h 00m [Daily]
12953  August Kranti Raj   Delhi → Mumbai       1,384 km  16h 05m [Daily]
22691  Rajdhani Express    Delhi → Bangalore    2,150 km  25h 10m [Daily]
```

#### Train Generation

```
User searches: from=Delhi, to=Mumbai, date=2026-07-15
  ↓
Filter train catalog (check if train runs on that day)
  ↓
For each matching train:
  - Hash(trainNumber + date) → seed
  - Available classes: subset of train's defined classes
  - Seats per class:
      SL  (Sleeper)     → 50-120 available
      3A (3-Tier AC)    → 20-60 available
      2A (2-Tier AC)    → 10-30 available
      1A (First AC)     → 2-12 available
      CC (Chair Car)    → 30-80 available (for Shatabdi types)
  - Pricing:
      SL  → ₹0.5-0.8 per km
      3A  → ₹1.2-1.8 per km
      2A  → ₹1.8-2.5 per km
      1A  → ₹2.5-3.5 per km
      CC  → ₹1.0-1.5 per km
  - Status: Available / RAC / Waitlist (hash determines)
```

#### Mock Data Per Train

```ts
interface EnrichedTrain {
    trainNumber: string;
    trainName: string;
    origin: string;
    originCode: string;
    destination: string;
    destinationCode: string;
    departureTime: string;
    arrivalTime: string;
    duration: string;
    distance: number;
    classes: TrainClass[];
    daysOfOperation: string[];
    pantryAvailable: boolean;
    runningLate: number;        // minutes (0 = on time)
}

interface TrainClass {
    code: string;               // "SL", "3A", "2A", "1A", "CC"
    name: string;               // "Sleeper", "3 Tier AC", etc.
    price: number;
    currency: string;
    seatsAvailable: number;
    totalSeats: number;
    status: string;             // "Available", "RAC 12", "WL 5"
    tatkalAvailable: boolean;
}
```

---

### 5. Movies

**Real API:** TMDB API (free tier — real movies, posters, ratings, synopses)
**What TMDB gives:** title, poster, rating, synopsis, genre, release date, cast
**What TMDB does NOT give:** showtimes, theaters, seat availability, ticket pricing

#### Data Flow

```
User searches: city=Delhi, date=2026-07-15
  ↓
TMDB API → Now Playing / Popular movies (real data)
  ↓
MovieEnrichmentService.enrich(movie) for each result:
  - Hash movieId → seed
  - Generate 3-6 theaters with showtimes
  - Generate seat layout per showtime
  - Generate ticket pricing based on format (2D/3D/IMAX)
  - Generate seat availability
  ↓
Return enriched results
```

#### Mock Data Per Movie

```ts
interface EnrichedMovie {
    // From TMDB (real)
    tmdbId: number;
    title: string;
    posterPath: string;
    backdropPath: string;
    overview: string;
    rating: number;             // TMDB vote_average
    genres: string[];
    releaseDate: string;
    runtime: number;

    // Mock enrichment
    theaters: Theater[];
    formats: string[];          // ["2D", "3D", "IMAX"]
}

interface Theater {
    id: string;
    name: string;               // "PVR Select Citywalk", "INOX Nehru Place"
    location: string;
    showtimes: Showtime[];
}

interface Showtime {
    id: string;
    time: string;               // "10:30 AM", "1:45 PM", "7:00 PM"
    format: string;             // "2D", "3D", "IMAX"
    price: number;
    currency: string;
    seatsAvailable: number;
    totalSeats: number;
    seatLayout: SeatSection[];
}

interface SeatSection {
    section: string;            // "Recliner", "Premium", "Classic"
    price: number;
    rows: number;
    seatsPerRow: number;
    available: number;
}
```

#### Theater Name Pool (per city)

```ts
const THEATER_POOLS: Record<string, string[]> = {
    IN: ["PVR", "INOX", "Carnival", "Cinepolis", "Movie Time"],
    US: ["AMC", "Regal", "Cinemark", "Landmark"],
    JP: ["TOHO", "Shochiku", "Toei"],
    GB: ["ODEON", "Vue", "Cineworld", "Curzon"],
    // ...
};
```

Each city gets a hash-based subset of theater names from its country pool,
combined with real city name for location context.

#### Ticket Pricing

```
2D     → ₹150-350 (INR base)
3D     → ₹200-500
IMAX   → ₹300-700
4DX    → ₹400-900

Multiplier applied based on country from CURRENCY_MAP.
```

#### Seat Availability

```
Total seats per screen: 150-300 (hash determines)
Already booked: 20-70% (hash determines)
Available = Total - Booked
```

---

## Implementation Structure

### New Files to Create

```
src/
  common/
    helpers/
      mock-seed.helper.ts        ← Core hash-seed generator
      currency.helper.ts         ← Country → currency mapping + formatting
  modules/
    hotels/
      services/
        hotel-enrichment.service.ts  ← Enriches Geoapify results with mock data
    flights/
      flights.module.ts
      flights.controller.ts
      flights.service.ts
      flights-enrichment.service.ts
      dto/
        search-flights.dto.ts
      types/
        flight.types.ts
    buses/
      buses.module.ts
      buses.controller.ts
      buses.service.ts
      buses-enrichment.service.ts
      dto/
        search-buses.dto.ts
      types/
        bus.types.ts
    trains/
      trains.module.ts
      trains.controller.ts
      trains.service.ts
      trains-enrichment.service.ts
      dto/
        search-trains.dto.ts
      types/
        train.types.ts
    movies/
      movies.module.ts
      movies.controller.ts
      movies.service.ts
      movies-enrichment.service.ts
      dto/
        search-movies.dto.ts
      types/
        movie.types.ts
  data/
    routes/
      flight-routes.ts           ← Flight route catalog
      bus-routes.ts              ← Bus route catalog
      train-catalog.ts           ← Train catalog
```

### Core Seed Helper

```ts
// mock-seed.helper.ts
// Simple deterministic hash from string → number
export function hashSeed(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// Generate a deterministic random number between min and max
// Using the seed to create a simple PRNG
export function seededRandom(seed: number, index: number = 0): number {
    const x = Math.sin(seed + index * 12.9898) * 43758.5453;
    return x - Math.floor(x); // Returns 0-1
}

// Pick N items from an array deterministically
export function seededPick<T>(arr: T[], seed: string, count: number): T[] {
    const hash = hashSeed(seed);
    const shuffled = [...arr].sort((a, b) => {
        return seededRandom(hash + arr.indexOf(a)) - seededRandom(hash + arr.indexOf(b));
    });
    return shuffled.slice(0, count);
}
```

---

## API Endpoints Summary

| Module  | Method | Route                              | Auth   | Description                     |
|---------|--------|------------------------------------|--------|---------------------------------|
| Hotels  | GET    | /api/v1/hotels/search              | No     | Search enriched hotels          |
| Flights | GET    | /api/v1/flights/search             | No     | Search enriched flights         |
| Buses   | GET    | /api/v1/buses/search               | No     | Search enriched buses           |
| Trains  | GET    | /api/v1/trains/search              | No     | Search enriched trains          |
| Movies  | GET    | /api/v1/movies/search              | No     | Search enriched movies          |
| Movies  | GET    | /api/v1/movies/:id/showtimes       | No     | Get showtimes for a movie       |

---

## Booking Flow (All Modules)

```
1. Search → enriched results (mock data)
2. User selects an option
3. User selects seats/room/time
4. User proceeds to payment
5. Razorpay test mode payment
6. Booking saved to PostgreSQL (Booking + Payment tables)
7. Confirmation returned with booking reference
```

The booking flow is real — it persists to PostgreSQL and processes via Razorpay.
Only the search/inventory data is mocked.

---

## Key Design Decisions

1. **No local maps for entity data** — everything is hash-seeded from unique IDs
2. **Only currency mapping is hard-coded** — ~15 lines
3. **Route catalogs are hard-coded** — these are reference data, not mock data
4. **Real APIs used where free** — Geoapify (hotels), TMDB (movies)
5. **Deterministic** — same search always returns same results (important for UX)
6. **Scalable** — works for any entity the API returns, no manual additions needed
7. **Swappable** — enrichment services can be replaced with real API integrations later
