# Voyago — Trains Module

## Overview

The Trains module is **fully mock** — IRCTC has no public API. It uses a pre-defined
catalog of famous Indian railway trains and generates realistic train data
deterministically using hash-seed algorithms.

The module covers Indian railway classes (Sleeper, 3AC, 2AC, 1AC, CC, EC) with
realistic pricing, seat availability, and status indicators.

---

## Data Flow

```
User: origin=Delhi, destination=Mumbai, date=2026-07-15
  ↓
Filter train catalog for matching route
  Check if train runs on searched day of week
  ↓
For each matching train:
  → Hash(trainNumber + date) for deterministic seed
  → Generate per-class data (seats, pricing, status)
  ↓
Return enriched train results
```

---

## Train Catalog

Hard-coded list of ~30 famous Indian trains.

```ts
interface TrainRoute {
    trainNumber: string;
    trainName: string;
    origin: string;
    originCode: string;
    destination: string;
    destinationCode: string;
    distance: number;          // km
    baseDuration: number;      // minutes
    runsDays: string[];        // ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    classes: string[];         // Available classes
    type: 'express' | 'shatabdi' | 'rajdhani' | 'duronto' | 'superfast';
}
```

### Rajdhani Express Trains

| Number | Name | Route | Distance | Duration | Days |
|--------|------|-------|----------|----------|------|
| 12951 | Rajdhani Express | Delhi → Mumbai | 1,384 km | 15h 35m | Daily |
| 12301 | Howrah Rajdhani | Delhi → Howrah | 1,443 km | 17h 00m | Daily |
| 22691 | Rajdhani Express | Delhi → Bangalore | 2,150 km | 25h 10m | Daily |
| 12953 | August Kranti Rajdhani | Delhi → Mumbai | 1,384 km | 16h 05m | Daily |
| 12433 | Chennai Rajdhani | Delhi → Chennai | 2,180 km | 28h 00m | Mon, Fri |
| 12309 | Rajendra Nagar Rajdhani | Delhi → Rajendra Nagar | 1,000 km | 12h 30m | Daily |

### Shatabdi Express Trains

| Number | Name | Route | Distance | Duration | Days |
|--------|------|-------|----------|----------|------|
| 12002 | Bhopal Shatabdi | Delhi → Bhopal | 700 km | 8h 00m | Mon-Sat |
| 12010 | Ahmedabad Shatabdi | Delhi → Ahmedabad | 930 km | 10h 00m | Mon-Sat |
| 12026 | Pune Shatabdi | Delhi → Pune | 1,400 km | 15h 30m | Mon-Sat |
| 12004 | Lucknow Shatabdi | Delhi → Lucknow | 555 km | 6h 30m | Mon-Sat |
| 12020 | Ranchi Shatabdi | Delhi → Ranchi | 1,100 km | 12h 00m | Mon-Sat |

### Duronto Express Trains

| Number | Name | Route | Distance | Duration | Days |
|--------|------|-------|----------|----------|------|
| 12259 | Sealdah Duronto | Delhi → Sealdah | 1,443 km | 16h 30m | Daily |
| 12267 | Mumbai Duronto | Delhi → Mumbai | 1,384 km | 15h 00m | Daily |
| 12269 | Chennai Duronto | Delhi → Chennai | 2,180 km | 27h 00m | Mon, Wed, Fri |

### Superfast / Express Trains

| Number | Name | Route | Distance | Duration | Days |
|--------|------|-------|----------|----------|------|
| 12625 | Kerala Express | Delhi → Trivandrum | 2,950 km | 44h 00m | Daily |
| 12621 | Tamil Nadu Express | Delhi → Chennai | 2,180 km | 33h 00m | Daily |
| 12313 | Sealdah Rajdhani | Delhi → Sealdah | 1,443 km | 17h 30m | Daily |
| 12802 | Purushottam Express | Delhi → Puri | 1,700 km | 26h 00m | Daily |
| 12426 | Jammu Rajdhani | Delhi → Jammu | 580 km | 8h 00m | Daily |
| 14004 | NDLS-Builders Express | Delhi → Howrah | 1,443 km | 20h 00m | Mon, Thu |
| 12381 | Poorva Express | Delhi → Howrah | 1,443 km | 21h 00m | Mon, Wed, Thu, Sat |
| 12472 | Swaraj Express | Delhi → Mumbai | 1,384 km | 18h 00m | Tue, Fri, Sun |
| 12450 | Sampark Kranti | Delhi → Bangalore | 2,150 km | 30h 00m | Mon, Wed, Fri |
| 12218 | Kerala Sampark Kranti | Delhi → Trivandrum | 2,950 km | 42h 00m | Tue, Fri |
| 12488 | Seemanchal Express | Delhi → Jogbani | 1,100 km | 18h 00m | Daily |
| 14006 | Lichchavi Express | Delhi → Sitamarhi | 1,050 km | 16h 00m | Daily |
| 12558 | Sapta Kranti Express | Delhi → Muzaffarpur | 1,000 km | 15h 00m | Daily |
| 12311 | Kalka Mail | Delhi → Howrah | 1,500 km | 24h 00m | Daily |
| 14258 | Kashi Vishwanath Exp | Delhi → Varanasi | 750 km | 12h 00m | Daily |

### Class Definitions

| Code | Full Name | Typical Seats | Price/km (INR) |
|------|-----------|---------------|----------------|
| SL | Sleeper | 72 per coach | ₹0.50 - ₹0.80 |
| 3A | 3-Tier AC | 64 per coach | ₹1.20 - ₹1.80 |
| 2A | 2-Tier AC | 46 per coach | ₹1.80 - ₹2.50 |
| 1A | First AC | 24 per coach | ₹2.50 - ₹3.50 |
| CC | Chair Car | 78 per coach | ₹1.00 - ₹1.50 |
| EC | Executive Chair | 56 per coach | ₹2.00 - ₹3.00 |

CC and EC are typically available on Shatabdi and Rajdhani trains.

---

## Train Generation Algorithm

### Seed

```ts
const seed = hashSeed(`${train.trainNumber}-${date}`);
```

### Day Check

```ts
const searchDate = new Date(date);
const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][searchDate.getDay()];
const runsOnDay = train.runsDays.includes(dayOfWeek);
// Skip train if it doesn't run on searched day
```

### Per-Class Data

For each class the train supports:

```ts
interface TrainClass {
    code: string;              // "SL", "3A", "2A", "1A", "CC", "EC"
    name: string;              // "Sleeper", "3 Tier AC", etc.
    price: number;             // Calculated
    currency: string;
    seatsAvailable: number;
    totalSeats: number;
    status: string;            // "Available", "RAC 12", "WL 5"
    tatkalAvailable: boolean;
    waitingListCount: number;
}
```

### Seat Availability

```ts
totalSeats = classDef.typicalSeats × numberOfCoaches; // 2-6 coaches
bookedPercentage = seededRandom(seed, classIndex) * 0.8; // 0-80% booked
booked = Math.floor(totalSeats * bookedPercentage);
available = totalSeats - booked;
```

### Status Determination

```ts
if (available > 10) {
    status = 'Available';
} else if (available > 0) {
    status = `RAC ${Math.floor(seededRandom(seed, classIndex + 10) * 15) + 1}`;
} else {
    waitingList = Math.floor(seededRandom(seed, classIndex + 20) * 30) + 1;
    status = `WL ${waitingList}`;
}
```

### Pricing

```
pricePerKm = classDef.basePricePerKm
hashVariance = 0.85 + seededRandom(seed, classIndex) * 0.3  // 0.85 - 1.15
finalPrice = train.distance × pricePerKm × hashVariance
```

### Tatkal

```ts
const tatkalAvailable = seededRandom(seed, 50) > 0.4; // 60% have tatkal
```

### Additional Data

```ts
const pantryAvailable = train.type === 'rajdhani' || seededRandom(seed, 51) > 0.5;
const runningLate = seededRandom(seed, 52) > 0.7
    ? Math.floor(seededRandom(seed, 53) * 60)  // 0-60 minutes late
    : 0;  // 30% chance of being on time
const platformNumber = Math.floor(seededRandom(seed, 54) * 16) + 1; // 1-16
```

---

## Search DTO

```ts
class SearchTrainsDto {
    @IsString() @IsNotEmpty()
    origin: string;                    // City name: "Delhi"

    @IsString() @IsNotEmpty()
    destination: string;               // City name: "Mumbai"

    @IsString() @IsNotEmpty()
    date: string;                      // YYYY-MM-DD

    @IsString() @IsOptional()
    class?: string;                    // "SL", "3A", "2A", "1A" (preference)

    @IsBoolean() @IsOptional()
    tatkalOnly?: boolean;              // Only show trains with tatkal
}
```

---

## Controller

### GET /api/v1/trains/search

```ts
@ApiTags('Trains')
@Controller('trains')
export class TrainsController {
    @Get('search')
    @HttpCode(200)
    @ApiOperation({ summary: 'Search trains between stations' })
    @ApiResponse({ status: 200, description: TRAINS_SEARCH_SUCCESS })
    async searchTrains(@Query() dto: SearchTrainsDto) {
        const data = await this.trainsService.searchTrains(dto);
        return { message: TRAINS_SEARCH_SUCCESS, data };
    }
}
```

---

## API Response Format

```json
{
    "success": true,
    "message": "Trains searched successfully",
    "data": {
        "trains": [
            {
                "trainNumber": "12951",
                "trainName": "Rajdhani Express",
                "origin": "New Delhi",
                "originCode": "NDLS",
                "destination": "Mumbai Central",
                "destinationCode": "BCT",
                "departureTime": "2026-07-15T16:25:00",
                "arrivalTime": "2026-07-16T08:00:00",
                "duration": "15h 35m",
                "distance": 1384,
                "type": "rajdhani",
                "daysOfOperation": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                "pantryAvailable": true,
                "runningLate": 0,
                "platformNumber": 5,
                "classes": [
                    {
                        "code": "3A",
                        "name": "3 Tier AC",
                        "price": 2076,
                        "currency": "INR",
                        "seatsAvailable": 42,
                        "totalSeats": 128,
                        "status": "Available",
                        "tatkalAvailable": true,
                        "waitingListCount": 0
                    },
                    {
                        "code": "2A",
                        "name": "2 Tier AC",
                        "price": 2950,
                        "currency": "INR",
                        "seatsAvailable": 8,
                        "totalSeats": 92,
                        "status": "RAC 3",
                        "tatkalAvailable": true,
                        "waitingListCount": 0
                    },
                    {
                        "code": "1A",
                        "name": "First AC",
                        "price": 4844,
                        "currency": "INR",
                        "seatsAvailable": 0,
                        "totalSeats": 48,
                        "status": "WL 7",
                        "tatkalAvailable": false,
                        "waitingListCount": 7
                    }
                ]
            },
            {
                "trainNumber": "12953",
                "trainName": "August Kranti Rajdhani Express",
                "origin": "Hazrat Nizamuddin",
                "originCode": "NZM",
                "destination": "Mumbai Central",
                "destinationCode": "BCT",
                "departureTime": "2026-07-15T17:40:00",
                "arrivalTime": "2026-07-16T09:45:00",
                "duration": "16h 05m",
                "distance": 1384,
                "type": "rajdhani",
                "daysOfOperation": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                "pantryAvailable": true,
                "runningLate": 15,
                "platformNumber": 2,
                "classes": [
                    {
                        "code": "3A",
                        "name": "3 Tier AC",
                        "price": 1988,
                        "currency": "INR",
                        "seatsAvailable": 55,
                        "totalSeats": 128,
                        "status": "Available",
                        "tatkalAvailable": true,
                        "waitingListCount": 0
                    },
                    {
                        "code": "2A",
                        "name": "2 Tier AC",
                        "price": 2840,
                        "currency": "INR",
                        "seatsAvailable": 15,
                        "totalSeats": 92,
                        "status": "Available",
                        "tatkalAvailable": true,
                        "waitingListCount": 0
                    },
                    {
                        "code": "1A",
                        "name": "First AC",
                        "price": 4650,
                        "currency": "INR",
                        "seatsAvailable": 3,
                        "totalSeats": 48,
                        "status": "Available",
                        "tatkalAvailable": false,
                        "waitingListCount": 0
                    }
                ]
            }
        ],
        "total": 8,
        "origin": "Delhi",
        "destination": "Mumbai",
        "date": "2026-07-15"
    }
}
```

---

## Caching

| Cache Key | TTL | Description |
|---|---|---|
| `cache:trains:search:{origin}:{dest}:{date}` | 5 min | Search results |
| `cache:trains:detail:{trainNumber}` | 10 min | Single train detail |
| `cache:trains:availability:{trainNumber}:{date}` | 1 min | Seat availability (changes on booking) |

---

## Module Structure

```
src/modules/trains/
├── dto/
│   ├── index.ts
│   └── search-trains.dto.ts
├── types/
│   ├── index.ts
│   └── train.types.ts
├── data/
│   └── train-catalog.ts           ← Train catalog
├── trains.service.ts
├── trains.controller.ts
├── trains.module.ts
└── index.ts
```

---

## Implementation Checklist

### Phase 1: Core
- [ ] Create `data/train-catalog.ts` with train catalog
- [ ] Create `types/train.types.ts` with interfaces
- [ ] Create `dto/search-trains.dto.ts` with validation
- [ ] Create `TrainsService` with generation algorithm
- [ ] Implement day-of-week check
- [ ] Implement per-class seat/status generation
- [ ] Wire up `TrainsController`

### Phase 2: Polish
- [ ] Add caching layer
- [ ] Add Swagger documentation
- [ ] Add class filter
- [ ] Add sorting (price, duration, departure)
- [ ] Write unit tests

### Phase 3: Advanced
- [ ] Add seat selection endpoint
- [ ] Add PNR status mock
- [ ] Add live running status mock
- [ ] Add fare comparison across classes
