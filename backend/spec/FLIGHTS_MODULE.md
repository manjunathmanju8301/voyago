# Voyago — Flights Module

## Overview

The Flights module is **fully mock** — no free flight search API exists. It uses a
pre-defined route catalog of realistic flight routes and generates flight data
deterministically using hash-seed algorithms.

The mock data is realistic: real airline names, real IATA codes, real aircraft types,
and pricing that scales with distance and class.

---

## Data Flow

```
User: origin=DEL, destination=BOM, date=2026-07-15, passengers=2, class=Economy
  ↓
Filter route catalog for matching origin/destination
  ↓
Generate 8-15 flights per matching route:
  → Hash(route + date + index) for deterministic seed
  → Pick airline, departure time, duration, stops, classes, pricing
  ↓
CurrencyHelper.format(price, origin country)
  ↓
Return enriched flight results
```

---

## Route Catalog

Hard-coded list of ~35 realistic routes. This is reference data, not mock data.

```ts
interface FlightRoute {
    origin: string;          // IATA code
    originCity: string;
    destination: string;     // IATA code
    destinationCity: string;
    distance: number;        // km
    baseDuration: number;    // minutes
    type: 'domestic' | 'international';
}
```

### Domestic Indian Routes

| Origin | Destination | Distance (km) | Duration |
|--------|-------------|----------------|----------|
| DEL | BOM | 1,150 | 2h 10m |
| DEL | BLR | 1,740 | 2h 45m |
| DEL | MAA | 1,750 | 2h 50m |
| DEL | CCU | 1,300 | 2h 15m |
| DEL | HYD | 1,260 | 2h 10m |
| DEL | GOI | 1,580 | 2h 30m |
| BOM | BLR | 840 | 1h 30m |
| BOM | GOI | 425 | 1h 10m |
| BOM | CCU | 1,660 | 2h 40m |
| BLR | MAA | 350 | 1h 00m |
| BLR | HYD | 500 | 1h 15m |
| CCU | HYD | 1,200 | 2h 05m |
| DEL | PAT | 850 | 1h 35m |
| DEL | SXR | 650 | 1h 20m |
| BOM | JAI | 920 | 1h 40m |

### International Routes

| Origin | Destination | Distance (km) | Duration |
|--------|-------------|----------------|----------|
| DEL | LHR | 6,720 | 9h 15m |
| DEL | DXB | 2,190 | 3h 30m |
| DEL | SIN | 4,150 | 5h 30m |
| DEL | BKK | 2,900 | 4h 15m |
| BOM | LHR | 7,200 | 9h 40m |
| BOM | DXB | 1,930 | 3h 10m |
| BLR | SIN | 3,400 | 4h 45m |
| JFK | LAX | 3,980 | 5h 30m |
| JFK | LHR | 5,540 | 7h 00m |
| LAX | NRT | 8,780 | 11h 30m |
| CDG | NRT | 9,720 | 12h 10m |
| LHR | SIN | 10,850 | 13h 00m |
| SIN | NRT | 5,300 | 7h 00m |
| DXB | LHR | 5,490 | 7h 05m |
| SYD | SIN | 6,300 | 8h 00m |

---

## Flight Generation Algorithm

### Seed

```ts
const seed = hashSeed(`${route.origin}-${route.destination}-${date}-${index}`);
```

### Airlines

**Domestic:**
```ts
const domesticAirlines = [
    { name: 'IndiGo', code: '6E', logo: 'indigo' },
    { name: 'Air India', code: 'AI', logo: 'air-india' },
    { name: 'Vistara', code: 'UK', logo: 'vistara' },
    { name: 'SpiceJet', code: 'SG', logo: 'spicejet' },
    { name: 'GoFirst', code: 'G8', logo: 'gofirst' },
    { name: 'AirAsia India', code: 'I5', logo: 'airasia' },
];
```

**International:**
```ts
const internationalAirlines = [
    { name: 'Emirates', code: 'EK', logo: 'emirates' },
    { name: 'Qatar Airways', code: 'QR', logo: 'qatar' },
    { name: 'Lufthansa', code: 'LH', logo: 'lufthansa' },
    { name: 'Singapore Airlines', code: 'SQ', logo: 'singapore' },
    { name: 'British Airways', code: 'BA', logo: 'ba' },
    { name: 'ANA', code: 'NH', logo: 'ana' },
    { name: 'Cathay Pacific', code: 'CX', logo: 'cathay' },
    { name: 'Etihad', code: 'EY', logo: 'etihad' },
];
```

Airline is selected via `seededRandom(seed, 0)` to pick from the array.

### Flight Number

```ts
const flightNumber = `${airline.code}${1000 + Math.floor(seededRandom(seed, 1) * 9000)}`;
// e.g., "6E2347", "AI1089", "EK512"
```

### Departure Times

Spread across 6:00 AM - 11:00 PM. The hash determines the slot:

```ts
const hour = 6 + Math.floor(seededRandom(seed, 2) * 17);  // 6-22
const minute = Math.floor(seededRandom(seed, 3) * 4) * 15; // 0, 15, 30, 45
const departureTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
```

### Duration

```ts
const variance = (seededRandom(seed, 4) - 0.5) * 30; // ±15 minutes
const durationMinutes = route.baseDuration + variance;
```

### Stops

```ts
const stops = seededRandom(seed, 5) < 0.7 ? 0 : 1;
// 70% direct, 30% one-stop
```

For one-stop flights, a stop city is selected from a realistic list based on route.

### Aircraft

```ts
const domesticAircraft = ['Boeing 737-800', 'Airbus A320', 'Airbus A320neo', 'ATR 72-600'];
const internationalAircraft = ['Boeing 777-300ER', 'Boeing 787-9', 'Airbus A350-900', 'Airbus A380', 'Boeing 737 MAX 8'];
```

### Classes & Pricing

**Available classes per flight (hash determines subset):**

| Class | Seats Range | Multiplier | Baggage | Meal |
|-------|-------------|------------|---------|------|
| Economy | 30-45 | 1.0x | 15kg + 7kg cabin | Paid |
| Premium Economy | 12-24 | 1.5x | 20kg + 7kg cabin | Complimentary |
| Business | 6-16 | 3.0x | 32kg + 12kg cabin | Complimentary |
| First | 2-6 | 5.0x | 40kg + 12kg cabin | Complimentary |

**Price calculation:**
```
basePricePerKm = 5  // INR per km for Economy
classMultiplier = { Economy: 1.0, Premium: 1.5, Business: 3.0, First: 5.0 }
hashVariance = 0.8 + seededRandom(seed, classIndex) * 0.6  // 0.8 - 1.4

basePrice = route.distance × basePricePerKm
finalPrice = basePrice × classMultiplier × hashVariance
```

---

## Currency Handling

Same `CURRENCY_MAP` as hotels module. The origin country determines the currency.

---

## Search DTO

```ts
class SearchFlightsDto {
    @IsString() @IsNotEmpty()
    origin: string;                    // IATA code: "DEL"

    @IsString() @IsNotEmpty()
    destination: string;               // IATA code: "BOM"

    @IsString() @IsNotEmpty()
    date: string;                      // YYYY-MM-DD

    @IsNumber() @IsOptional()
    @Type(() => Number)
    passengers?: number = 1;           // Default: 1

    @IsString() @IsOptional()
    class?: string;                    // "economy", "business", etc. (preference, not filter)

    @IsNumber() @IsOptional()
    @Type(() => Number)
    maxStops?: number;                 // 0 for direct only
}
```

---

## Controller

### GET /api/v1/flights/search

```ts
@ApiTags('Flights')
@Controller('flights')
export class FlightsController {
    @Get('search')
    @HttpCode(200)
    @ApiOperation({ summary: 'Search flights between cities' })
    @ApiResponse({ status: 200, description: FLIGHTS_SEARCH_SUCCESS })
    async searchFlights(@Query() dto: SearchFlightsDto) {
        const data = await this.flightsService.searchFlights(dto);
        return { message: FLIGHTS_SEARCH_SUCCESS, data };
    }
}
```

---

## API Response Format

```json
{
    "success": true,
    "message": "Flights searched successfully",
    "data": {
        "flights": [
            {
                "flightId": "6E2347",
                "airline": "IndiGo",
                "airlineLogo": "https://assets.voyago.com/airlines/indigo.svg",
                "origin": "DEL",
                "originCity": "Delhi",
                "destination": "BOM",
                "destinationCity": "Mumbai",
                "departureTime": "2026-07-15T06:30:00",
                "arrivalTime": "2026-07-15T08:45:00",
                "duration": "2h 15m",
                "stops": 0,
                "stopCity": null,
                "aircraft": "Airbus A320neo",
                "baggage": "15 kg check-in, 7 kg cabin",
                "mealIncluded": false,
                "classes": [
                    {
                        "name": "Economy",
                        "price": 5400,
                        "currency": "INR",
                        "seatsAvailable": 32,
                        "baggage": "15 kg check-in, 7 kg cabin"
                    },
                    {
                        "name": "Business",
                        "price": 16200,
                        "currency": "INR",
                        "seatsAvailable": 8,
                        "baggage": "32 kg check-in, 12 kg cabin"
                    }
                ]
            },
            {
                "flightId": "AI1089",
                "airline": "Air India",
                "airlineLogo": "https://assets.voyago.com/airlines/air-india.svg",
                "origin": "DEL",
                "originCity": "Delhi",
                "destination": "BOM",
                "destinationCity": "Mumbai",
                "departureTime": "2026-07-15T09:15:00",
                "arrivalTime": "2026-07-15T11:20:00",
                "duration": "2h 05m",
                "stops": 0,
                "stopCity": null,
                "aircraft": "Boeing 787-9",
                "baggage": "20 kg check-in, 7 kg cabin",
                "mealIncluded": true,
                "classes": [
                    {
                        "name": "Economy",
                        "price": 6100,
                        "currency": "INR",
                        "seatsAvailable": 28,
                        "baggage": "20 kg check-in, 7 kg cabin"
                    },
                    {
                        "name": "Premium Economy",
                        "price": 9150,
                        "currency": "INR",
                        "seatsAvailable": 14,
                        "baggage": "25 kg check-in, 7 kg cabin"
                    },
                    {
                        "name": "Business",
                        "price": 18300,
                        "currency": "INR",
                        "seatsAvailable": 6,
                        "baggage": "32 kg check-in, 12 kg cabin"
                    }
                ]
            }
        ],
        "total": 12,
        "origin": "DEL",
        "destination": "BOM",
        "date": "2026-07-15",
        "passengers": 1
    }
}
```

---

## Caching

| Cache Key | TTL | Description |
|---|---|---|
| `cache:flights:search:{origin}:{dest}:{date}` | 5 min | Search results |
| `cache:flights:detail:{flightId}` | 10 min | Single flight detail |

---

## Module Structure

```
src/modules/flights/
├── dto/
│   ├── index.ts
│   └── search-flights.dto.ts
├── types/
│   ├── index.ts
│   └── flight.types.ts
├── data/
│   └── flight-routes.ts           ← Route catalog
├── flights.service.ts
├── flights.controller.ts
├── flights.module.ts
└── index.ts
```

### New Files

| File | Purpose |
|---|---|
| `data/flight-routes.ts` | Hard-coded route catalog (~35 routes) |
| `flights.service.ts` | Generation algorithm + search logic |
| `dto/search-flights.dto.ts` | Search validation |
| `types/flight.types.ts` | EnrichedFlight, FlightClass interfaces |

---

## Implementation Checklist

### Phase 1: Core
- [ ] Create `data/flight-routes.ts` with route catalog
- [ ] Create `types/flight.types.ts` with interfaces
- [ ] Create `dto/search-flights.dto.ts` with validation
- [ ] Create `FlightsService` with generation algorithm
- [ ] Wire up `FlightsController`

### Phase 2: Polish
- [ ] Add caching layer
- [ ] Add Swagger documentation
- [ ] Add one-way vs round-trip support
- [ ] Add fare class filtering
- [ ] Write unit tests

### Phase 3: Advanced
- [ ] Add price alerts endpoint
- [ ] Add airline filter
- [ ] Add departure time filter
- [ ] Add sorting (price, duration, departure)
