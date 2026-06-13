# Voyago — Buses Module

## Overview

The Buses module is **fully mock** — no free bus booking API exists. It uses a
pre-defined catalog of Indian intercity bus routes and generates realistic bus
data deterministically using hash-seed algorithms.

The module focuses on Indian bus travel, which has a massive market with operators
like Volvo, KSRTC, APSRTC, VRL, SRS, and more.

---

## Data Flow

```
User: origin=Delhi, destination=Jaipur, date=2026-07-15, seats=2
  ↓
Filter route catalog for matching origin/destination
  ↓
Generate 5-20 buses per matching route:
  → Hash(route + date + index) for deterministic seed
  → Pick operator, bus type, departure time, pricing, amenities
  ↓
Return enriched bus results with boarding/dropping points
```

---

## Route Catalog

Hard-coded list of ~45 realistic Indian intercity routes.

```ts
interface BusRoute {
    origin: string;
    destination: string;
    distance: number;          // km
    baseDuration: number;      // minutes
    popularRoute: boolean;     // affects number of buses generated
}
```

### Popular Routes (generate 12-20 buses)

| Origin | Destination | Distance (km) | Duration |
|--------|-------------|----------------|----------|
| Delhi | Jaipur | 270 | 5h 30m |
| Delhi | Shimla | 370 | 7h 30m |
| Delhi | Dehradun | 250 | 5h 00m |
| Delhi | Manali | 540 | 10h 00m |
| Mumbai | Pune | 150 | 3h 30m |
| Mumbai | Goa | 590 | 10h 00m |
| Bangalore | Chennai | 350 | 6h 00m |
| Bangalore | Coorg | 260 | 5h 30m |
| Hyderabad | Vijayawada | 275 | 5h 00m |
| Kolkata | Bhubaneswar | 465 | 8h 30m |

### Regular Routes (generate 5-10 buses)

| Origin | Destination | Distance (km) | Duration |
|--------|-------------|----------------|----------|
| Delhi | Lucknow | 555 | 8h 00m |
| Delhi | Chandigarh | 240 | 4h 30m |
| Delhi | Agra | 230 | 4h 00m |
| Mumbai | Nashik | 170 | 3h 30m |
| Mumbai | Ahmedabad | 530 | 8h 30m |
| Mumbai | Indore | 610 | 10h 00m |
| Bangalore | Mangalore | 350 | 6h 30m |
| Bangalore | Ooty | 300 | 6h 00m |
| Bangalore | Hyderabad | 570 | 8h 30m |
| Chennai | Pondicherry | 150 | 3h 00m |
| Chennai | Coimbatore | 510 | 8h 00m |
| Kolkata | Siliguri | 570 | 10h 00m |
| Kolkata | Puri | 500 | 9h 00m |
| Kolkata | Digha | 180 | 4h 00m |
| Hyderabad | Tirupati | 800 | 12h 00m |
| Hyderabad | Bangalore | 570 | 8h 30m |
| Jaipur | Udaipur | 390 | 6h 30m |
| Jaipur | Jodhpur | 340 | 5h 30m |
| Ahmedabad | Rajkot | 220 | 4h 00m |
| Ahmedabad | Vadodara | 100 | 2h 00m |
| Pune | Goa | 450 | 8h 00m |
| Pune | Nashik | 210 | 4h 00m |
| Lucknow | Varanasi | 320 | 5h 30m |
| Lucknow | Allahabad | 200 | 3h 30m |
| Chandigarh | Amritsar | 230 | 4h 00m |
| Bhopal | Indore | 195 | 3h 30m |
| Bhopal | Jabalpur | 330 | 5h 30m |

---

## Bus Generation Algorithm

### Seed

```ts
const seed = hashSeed(`${route.origin}-${route.destination}-${date}-${index}`);
```

### Operators

```ts
const operators = [
    { name: 'Volvo Bus Services', tier: 'premium' },
    { name: 'KSRTC', tier: 'standard' },
    { name: 'APSRTC', tier: 'standard' },
    { name: 'RSRTC', tier: 'standard' },
    { name: 'VRL Travels', tier: 'premium' },
    { name: 'SRS Travels', tier: 'standard' },
    { name: 'Neeta Bus', tier: 'premium' },
    { name: 'Paulo Travels', tier: 'standard' },
    { name: 'RedBus Express', tier: 'budget' },
    { name: 'Hans Travels', tier: 'standard' },
    { name: 'Dhindwal Travels', tier: 'budget' },
    { name: 'Blue Arrow Express', tier: 'premium' },
];
```

### Bus Types

| Bus Type | Seats | Multiplier | Amenities Level |
|----------|-------|------------|-----------------|
| Non-AC Seater | 45 | 1.0x | Basic |
| Non-AC Sleeper | 30 | 1.2x | Basic |
| AC Seater | 40 | 1.5x | Standard |
| AC Sleeper | 28 | 1.8x | Standard |
| Volvo AC | 32 | 2.2x | Premium |
| Premium 2+1 | 24 | 2.5x | Premium |

### Departure Times

Most Indian buses depart in the evening/night for long routes:

```ts
const isLongRoute = route.distance > 300;

if (isLongRoute) {
    // Evening/Night departures: 6PM - 11PM
    hour = 18 + Math.floor(seededRandom(seed, 2) * 5);
} else {
    // Spread across day: 6AM - 10PM
    hour = 6 + Math.floor(seededRandom(seed, 2) * 16);
}
```

### Duration

```ts
const variance = (seededRandom(seed, 3) - 0.5) * 60; // ±30 minutes
const durationMinutes = route.baseDuration + variance;
```

### Pricing

```
basePricePerKm = 5  // INR
busTypeMultiplier = { Non-AC Seater: 1.0, ..., Premium 2+1: 2.5 }
hashVariance = 0.85 + seededRandom(seed, 4) * 0.3  // 0.85 - 1.15

basePrice = route.distance × basePricePerKm
finalPrice = basePrice × busTypeMultiplier × hashVariance
```

### Seats

```ts
totalSeats = busType.totalSeats;  // from bus type definition
bookedSeats = Math.floor(seededRandom(seed, 5) * totalSeats * 0.7); // 0-70% booked
availableSeats = totalSeats - bookedSeats;
```

### Amenities Pool

```ts
const amenitiesPool = [
    'wifi', 'charging-point', 'blanket', 'water-bottle',
    'reading-light', 'GPS-tracking', 'CCTV', 'fire-extinguisher',
    'first-aid', 'reclining-seats', 'curtains', 'individual-lights'
];
```

Each bus gets 4-8 amenities based on tier:
- Budget: 4-5 basics
- Standard: 5-7 standard
- Premium: 7-8 including premium items

### Rating

```ts
rating = 3.0 + seededRandom(seed, 6) * 1.8;  // 3.0 - 4.8
```

### Live Tracking

```ts
const liveTracking = seededRandom(seed, 7) > 0.3;  // 70% have live tracking
```

---

## Boarding & Dropping Points

Each bus generates 2-4 boarding points and 2-3 dropping points.

### Boarding Points

```ts
const boardingPointTemplates = [
    '{origin} Main Bus Stand',
    '{origin} ISBT',
    '{origin} Railway Station',
    '{origin} Metro Station',
    '{origin} Highway Toll Plaza',
    '{origin} City Center',
];
```

Each boarding point gets a time (departure time minus offset) and a location description.

### Dropping Points

```ts
const droppingPointTemplates = [
    '{destination} Main Bus Stand',
    '{destination} ISBT',
    '{destination} Railway Station',
    '{destination} City Center',
    '{destination} Highway Toll Plaza',
];
```

---

## Search DTO

```ts
class SearchBusesDto {
    @IsString() @IsNotEmpty()
    origin: string;                    // City name: "Delhi"

    @IsString() @IsNotEmpty()
    destination: string;               // City name: "Jaipur"

    @IsString() @IsNotEmpty()
    date: string;                      // YYYY-MM-DD

    @IsNumber() @IsOptional()
    @Type(() => Number)
    seats?: number = 1;                // Default: 1

    @IsString() @IsOptional()
    busType?: string;                  // Filter: "ac-sleeper", "volvo", etc.

    @IsString() @IsOptional()
    operator?: string;                 // Filter by operator name
}
```

---

## Controller

### GET /api/v1/buses/search

```ts
@ApiTags('Buses')
@Controller('buses')
export class BusesController {
    @Get('search')
    @HttpCode(200)
    @ApiOperation({ summary: 'Search bus routes between cities' })
    @ApiResponse({ status: 200, description: BUSES_SEARCH_SUCCESS })
    async searchBuses(@Query() dto: SearchBusesDto) {
        const data = await this.busesService.searchBuses(dto);
        return { message: BUSES_SEARCH_SUCCESS, data };
    }
}
```

---

## API Response Format

```json
{
    "success": true,
    "message": "Buses searched successfully",
    "data": {
        "buses": [
            {
                "busId": "BUS-DEL-JAI-2026-07-15-001",
                "operator": "Volvo Bus Services",
                "busType": "Volvo AC Sleeper",
                "origin": "Delhi",
                "destination": "Jaipur",
                "departureTime": "2026-07-15T21:30:00",
                "arrivalTime": "2026-07-16T03:15:00",
                "duration": "5h 45m",
                "distance": 270,
                "price": 1250,
                "currency": "INR",
                "seatsAvailable": 18,
                "totalSeats": 32,
                "rating": 4.3,
                "liveTracking": true,
                "amenities": ["wifi", "charging-point", "blanket", "water-bottle", "reading-light", "GPS-tracking"],
                "boardingPoints": [
                    {
                        "name": "Delhi ISBT Kashmere Gate",
                        "time": "2026-07-15T21:15:00",
                        "location": "Kashmere Gate, Delhi"
                    },
                    {
                        "name": "Delhi Dhaula Kuan",
                        "time": "2026-07-15T21:45:00",
                        "location": "Dhaula Kuan, Delhi"
                    }
                ],
                "droppingPoints": [
                    {
                        "name": "Jaipur Main Bus Stand",
                        "time": "2026-07-16T03:00:00",
                        "location": "Sindhi Camp, Jaipur"
                    },
                    {
                        "name": "Jaipur Railway Station",
                        "time": "2026-07-16T03:15:00",
                        "location": "Near Railway Station, Jaipur"
                    }
                ]
            }
        ],
        "total": 14,
        "origin": "Delhi",
        "destination": "Jaipur",
        "date": "2026-07-15"
    }
}
```

---

## Caching

| Cache Key | TTL | Description |
|---|---|---|
| `cache:buses:search:{origin}:{dest}:{date}` | 5 min | Search results |
| `cache:buses:detail:{busId}` | 10 min | Single bus detail |

---

## Module Structure

```
src/modules/buses/
├── dto/
│   ├── index.ts
│   └── search-buses.dto.ts
├── types/
│   ├── index.ts
│   └── bus.types.ts
├── data/
│   └── bus-routes.ts              ← Route catalog
├── buses.service.ts
├── buses.controller.ts
├── buses.module.ts
└── index.ts
```

---

## Implementation Checklist

### Phase 1: Core
- [ ] Create `data/bus-routes.ts` with route catalog
- [ ] Create `types/bus.types.ts` with interfaces
- [ ] Create `dto/search-buses.dto.ts` with validation
- [ ] Create `BusesService` with generation algorithm
- [ ] Generate boarding/dropping points
- [ ] Wire up `BusesController`

### Phase 2: Polish
- [ ] Add caching layer
- [ ] Add Swagger documentation
- [ ] Add bus type filter
- [ ] Add operator filter
- [ ] Add sorting (price, duration, departure)
- [ ] Write unit tests

### Phase 3: Advanced
- [ ] Add seat selection endpoint
- [ ] Add bus tracking mock endpoint
- [ ] Add review/rating system
