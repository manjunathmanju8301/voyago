# Voyago — Hotels Module

## Overview

The Hotels module provides hotel search functionality using a **hybrid approach**:
real geographic data from Geoapify Places API, enriched with deterministic mock
data for booking-specific fields (room types, pricing, availability, amenities).

This gives users realistic search results — real hotel names in real cities —
while simulating the inventory data that no free API provides.

---

## Data Flow

```
User: city=Delhi, checkIn=2026-07-01, checkOut=2026-07-07, guests=2
  ↓
GeocodingHelper.getCityCoordinates("Delhi")
  → Geoapify Geocode API
  → { lat: 28.6139, lon: 77.2090, city: "Delhi", country: "IN" }
  ↓
Geoapify Places API
  → categories=accommodation.hotel
  → filter=circle:77.2090,28.6139,10000 (10km radius)
  → returns N hotels with placeId, name, address, coords, categories
  ↓
HotelEnrichmentService.enrich(hotel) for each result:
  → Hash placeId → deterministic seed
  → Generate room types, pricing, availability, amenities, rating
  ↓
CurrencyHelper.format(price, country)
  → Apply country multiplier, format with currency symbol
  ↓
Return enriched results to frontend
```

---

## Geoapify Integration

### API Used

- **Geocode**: `https://api.geoapify.com/v1/geocode/search` — convert city name to coordinates
- **Places**: `https://api.geoapify.com/v2/places` — search for hotels near coordinates

### Search Parameters

```
categories: accommodation.hotel
filter: circle:{lon},{lat},10000    (10km radius from city center)
limit: {N}                          (20 default, max 50)
lang: en
apiKey: {GEOAPIFY_API_KEY}
```

### What Geoapify Returns Per Hotel

```ts
{
    place_id: string;           // Unique identifier (used as seed)
    name: string | null;        // Hotel name
    formatted: string;          // Full formatted address
    address_line1: string;
    address_line2: string;
    city: string | null;
    state: string | null;
    country: string;            // Country code (for currency)
    lat: number;
    lon: number;
    categories: string[];       // ["accommodation", "accommodation.hotel"]
}
```

### What Geoapify Does NOT Give

- Room types and counts
- Pricing
- Availability / inventory
- Amenities
- Ratings / reviews
- Images

These are all provided by the enrichment layer.

---

## HotelEnrichmentService

### Purpose

Takes raw Geoapify results and enriches them with realistic, deterministic mock
data for all booking-specific fields.

### Hash-Seed Algorithm

```ts
function hashSeed(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function seededRandom(seed: number, index: number = 0): number {
    const x = Math.sin(seed + index * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}
```

Each hotel's `placeId` is hashed to produce a deterministic seed. The same hotel
always generates the same mock data. Different hotels always generate different data.

### Room Type Generation

**Pool of possible room types:**
```
Budget:     Standard, Economy, Basic
Mid-range:  Deluxe, Superior, Classic
Luxury:     Suite, Premium, Executive, Royal
```

**Number of room types per hotel:** 2-6 (determined by hash)

**Room type details:**

```ts
interface RoomType {
    id: string;                // "room_abc123_0"
    name: string;              // "Deluxe"
    description: string;       // "Spacious room with city view"
    pricePerNight: number;     // In local currency
    availableRooms: number;    // 5 - 50
    maxGuests: number;         // 1 - 4
    bedType: string;           // "Single", "Double", "King", "Twin"
    size: string;              // "280 sq ft", "450 sq ft"
    amenities: string[];       // Subset: AC, TV, minibar, safe, balcony
}
```

### Price Generation

**Base price range by Geoapify category:**

| Category Tag | Base Range (INR) |
|---|---|
| `accommodation.luxury` | ₹4,000 - ₹15,000 |
| `accommodation` (default) | ₹1,500 - ₹6,000 |
| `accommodation.budget` | ₹500 - ₹2,000 |

**Price calculation:**
```
basePrice = randomInRange(min, max)  // based on category
hashVariance = 0.8 to 1.2           // hash-based multiplier
finalPrice = basePrice × hashVariance
```

Each room type within a hotel gets a progressively higher price:
```
Room 0 (cheapest): basePrice × 1.0
Room 1: basePrice × 1.3
Room 2: basePrice × 1.7
Room 3: basePrice × 2.2
Room 4: basePrice × 2.8
Room 5 (most expensive): basePrice × 3.5
```

### Rating Generation

```
rating = 3.0 + seededRandom(seed, 0) × 2.0    // Range: 3.0 - 5.0
totalReviews = 50 + seededRandom(seed, 1) × 1950  // Range: 50 - 2000
```

### Amenity Generation

**Full amenity pool:**
```
wifi, parking, breakfast, gym, pool, spa, restaurant, bar,
room-service, laundry, airport-shuffle, concierge,
business-center, meeting-rooms, elevator, fireplace
```

Each hotel gets 6-10 amenities (hash determines which and how many).

Luxury hotels are more likely to get premium amenities (spa, pool, concierge).
Budget hotels get basics (wifi, parking, breakfast).

### Image Placeholders

```ts
const PLACEHOLDER_IMAGES = [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800',
    // ... 10-15 hotel images
];
```

Each hotel gets 3-5 images from this pool (hash-selected).

---

## Currency Handling

### CURRENCY_MAP

```ts
const CURRENCY_MAP: Record<string, { symbol: string; code: string; multiplier: number }> = {
    IN: { symbol: '₹', code: 'INR', multiplier: 1 },
    JP: { symbol: '¥', code: 'JPY', multiplier: 0.08 },
    US: { symbol: '$', code: 'USD', multiplier: 0.65 },
    FR: { symbol: '€', code: 'EUR', multiplier: 0.60 },
    DE: { symbol: '€', code: 'EUR', multiplier: 0.60 },
    GB: { symbol: '£', code: 'GBP', multiplier: 0.55 },
    AE: { symbol: 'د.إ', code: 'AED', multiplier: 2.40 },
    TH: { symbol: '฿', code: 'THB', multiplier: 0.42 },
    SG: { symbol: 'S$', code: 'SGD', multiplier: 0.87 },
    AU: { symbol: 'A$', code: 'AUD', multiplier: 0.95 },
    IT: { symbol: '€', code: 'EUR', multiplier: 0.60 },
    ES: { symbol: '€', code: 'EUR', multiplier: 0.60 },
    MY: { symbol: 'RM', code: 'MYR', multiplier: 0.10 },
    ID: { symbol: 'Rp', code: 'IDR', multiplier: 0.0047 },
    TR: { symbol: '₺', code: 'TRY', multiplier: 0.021 },
};
```

### Price Formatting

```ts
function formatPrice(price: number, country: string): { amount: number; symbol: string; currency: string } {
    const config = CURRENCY_MAP[country] ?? CURRENCY_MAP['IN'];
    const converted = Math.round(price * config.multiplier);
    return { amount: converted, symbol: config.symbol, currency: config.code };
}
```

---

## Caching Strategy

| Cache Key | TTL | Description |
|---|---|---|
| `cache:hotels:search:{city}:{checkIn}:{checkOut}` | 5 min | Search results |
| `cache:hotels:detail:{placeId}` | 10 min | Single hotel detail |
| `cache:hotels:availability:{placeId}` | 1 min | Room availability (short TTL — changes on booking) |

---

## DTO & Validation

### SearchHotelsDto

```ts
class SearchHotelsDto {
    @IsString() @IsNotEmpty()
    city: string;                    // Required. e.g., "Delhi"

    @IsString() @IsNotEmpty()
    checkIn: string;                 // Required. Format: YYYY-MM-DD

    @IsString() @IsNotEmpty()
    checkOut: string;                // Required. Format: YYYY-MM-DD

    @IsNumber() @IsOptional()
    @Type(() => Number)
    guests?: number = 1;             // Default: 1

    @IsNumber() @IsOptional()
    @Type(() => Number)
    limit?: number = 20;             // Default: 20, Max: 50
}
```

---

## Controller

### GET /api/v1/hotels/search

```ts
@ApiTags('Hotels')
@Controller('hotels')
export class HotelsController {
    @Get('search')
    @HttpCode(200)
    @ApiOperation({ summary: 'Search hotels by city' })
    @ApiResponse({ status: 200, description: HOTELS_SEARCH_SUCCESS })
    async searchHotels(@Query() dto: SearchHotelsDto) {
        const data = await this.hotelsService.searchHotels(dto);
        return { message: HOTELS_SEARCH_SUCCESS, data };
    }
}
```

---

## API Response Format

### Success Response

```json
{
    "success": true,
    "message": "Hotels retrieved successfully",
    "data": {
        "hotels": [
            {
                "placeId": "Q2hJQWj8Nmz8W5a",
                "name": "The Taj Mahal Hotel",
                "address": "1 Mansingh Road, New Delhi, 110011, India",
                "lat": 28.6139,
                "lon": 77.2090,
                "country": "IN",
                "rating": 4.7,
                "totalReviews": 1243,
                "currency": "INR",
                "roomTypes": [
                    {
                        "id": "room_abc123_0",
                        "name": "Standard",
                        "pricePerNight": 3200,
                        "availableRooms": 12,
                        "maxGuests": 2,
                        "bedType": "Double",
                        "size": "280 sq ft",
                        "amenities": ["AC", "TV", "WiFi"]
                    },
                    {
                        "id": "room_abc123_1",
                        "name": "Deluxe",
                        "pricePerNight": 5100,
                        "availableRooms": 8,
                        "maxGuests": 2,
                        "bedType": "King",
                        "size": "380 sq ft",
                        "amenities": ["AC", "TV", "WiFi", "Minibar"]
                    },
                    {
                        "id": "room_abc123_2",
                        "name": "Suite",
                        "pricePerNight": 8500,
                        "availableRooms": 3,
                        "maxGuests": 4,
                        "bedType": "King",
                        "size": "650 sq ft",
                        "amenities": ["AC", "TV", "WiFi", "Minibar", "Balcony", "Safe"]
                    }
                ],
                "amenities": ["wifi", "pool", "spa", "restaurant", "gym", "parking", "room-service", "breakfast"],
                "images": [
                    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
                    "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800",
                    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800"
                ]
            }
        ],
        "total": 25,
        "city": "Delhi",
        "checkIn": "2026-07-01",
        "checkOut": "2026-07-07",
        "guests": 2
    }
}
```

---

## Module Structure

```
src/modules/hotels/
├── dto/
│   ├── index.ts
│   └── search-hotels.dto.ts
├── types/
│   ├── index.ts
│   └── hotel.types.ts
├── services/
│   ├── hotels.service.ts
│   └── hotel-enrichment.service.ts
├── hotels.controller.ts
├── hotels.controller.spec.ts
├── hotels.service.spec.ts
├── hotels.module.ts
└── index.ts
```

### New Files to Create

| File | Purpose |
|---|---|
| `services/hotel-enrichment.service.ts` | Core enrichment logic — hash-seed, room generation, pricing |
| Update `services/hotels.service.ts` | Call enrichment service after Geoapify |

---

## Implementation Checklist

### Phase 1: Enrichment Core
- [ ] Create `hashSeed` and `seededRandom` helpers in `src/common/helpers/mock-seed.helper.ts`
- [ ] Create `CURRENCY_MAP` and `formatPrice` in `src/common/helpers/currency.helper.ts`
- [ ] Create `HotelEnrichmentService` with room type generation
- [ ] Add price generation with category-based ranges
- [ ] Add rating and review count generation
- [ ] Add amenity subset selection
- [ ] Add image placeholder assignment

### Phase 2: Integration
- [ ] Update `HotelsService.searchHotels` to call enrichment
- [ ] Add caching layer (Redis)
- [ ] Add Swagger documentation to controller
- [ ] Write unit tests for enrichment service

### Phase 3: Polish
- [ ] Add hotel detail endpoint (GET /api/v1/hotels/:id)
- [ ] Add availability check endpoint (GET /api/v1/hotels/:id/availability)
- [ ] Handle edge cases (no results, API failures)
- [ ] Add rate limiting awareness
