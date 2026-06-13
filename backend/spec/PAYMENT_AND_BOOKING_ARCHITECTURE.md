# Voyago — Payment & Booking Architecture

## Overview

Voyago uses **Razorpay** for payment processing in **test mode**. The payment flow
mirrors a real production setup — orders are created, payments are processed via
Razorpay's checkout, and transactions are verified server-side. All bookings and
payments are persisted to **PostgreSQL**.

This document covers the full payment lifecycle, booking management, refund flow,
and the supporting infrastructure (webhooks, idempotency, error handling).

---

## 1. Razorpay Integration

### Why Razorpay

- Free test mode with full API access
- Supports UPI, cards, netbanking, wallets
- Webhook support for async payment confirmation
- Indian market focus fits the project's primary audience
- Simple SDK (`razorpay` npm package — already in dependencies)

### Test Mode Credentials

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxx
```

Test mode accepts any card number (use `4111 1111 1111 1111` for success,
`4000 0000 0000 0002` for failure). No real money moves.

### Razorpay SDK Setup

```ts
// src/modules/payments/razorpay.client.ts
import Razorpay from 'razorpay';
import { ConfigService } from '@nestjs/config';

export const createRazorpayClient = (config: ConfigService) => {
    return new Razorpay({
        key_id: config.getOrThrow('RAZORPAY_KEY_ID'),
        key_secret: config.getOrThrow('RAZORPAY_KEY_SECRET'),
    });
};
```

---

## 2. Payment Flow — Full Lifecycle

### Step-by-Step

```
┌──────────────────────────────────────────────────────────────┐
│  1. USER SEARCHES & SELECTS                                   │
│     User finds a hotel/flight/bus/train/movie                 │
│     Selects seats/room/showtime                               │
│     Proceeds to checkout                                      │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  2. CLIENT CREATES BOOKING                                    │
│     POST /api/v1/bookings                                    │
│     Body: { type, itemId, metadata (seats, room, etc.) }     │
│     Backend creates Booking (status: PENDING) in PostgreSQL   │
│     Returns: bookingId + reference                            │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  3. CLIENT INITIATES PAYMENT                                  │
│     POST /api/v1/payments/initiate                           │
│     Body: { bookingId, amount, currency }                     │
│     Backend calls Razorpay API:                               │
│       razorpay.orders.create({ amount, currency, receipt })  │
│     Saves Payment record (status: PENDING) in PostgreSQL      │
│     Returns: { orderId, amount, currency, keyId }             │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  4. CLIENT OPENS RAZORPAY CHECKOUT                            │
│     Frontend uses Razorpay.js SDK:                            │
│       new Razorpay({ key, order_id, amount, ... })           │
│     User completes payment (card/UPI/netbanking)              │
│     Razorpay returns: { razorpay_payment_id,                 │
│       razorpay_order_id, razorpay_signature }                │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  5. CLIENT VERIFIES PAYMENT                                   │
│     POST /api/v1/payments/verify                             │
│     Body: { razorpay_payment_id, razorpay_order_id,          │
│             razorpay_signature, bookingId }                   │
│     Backend verifies signature HMAC:                          │
│       expected = HMAC_SHA256(order_id + "|" + payment_id,    │
│                              razorpay_secret)                │
│       if (expected === razorpay_signature) → SUCCESS          │
│     Updates Payment status → CAPTURED                         │
│     Updates Booking status → CONFIRMED                        │
│     Returns: { verified: true, bookingReference }             │
└──────────────────────┬───────────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────────┐
│  6. BOOKING CONFIRMED                                         │
│     User sees confirmation screen                             │
│     Booking data persisted with full history                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Database Models

### PostgreSQL Schema

```prisma
// prisma/schema.postgresql.prisma

model Booking {
    id            String    @id @default(uuid())
    userId        String
    type          String    // "hotel", "flight", "bus", "train", "movie"
    reference     String    @unique   // e.g., "VOY-2026-ABC123"
    status        String    @default("pending")
    // pending → confirmed → completed
    // pending → cancelled
    // confirmed → refund_requested → refunded
    amount        Decimal
    currency      String    @default("INR")
    metadata      Json?     // seats, room type, showtime, etc.
    createdAt     DateTime  @default(now())
    updatedAt     DateTime  @updatedAt

    payment       Payment?
}

model Payment {
    id              String    @id @default(uuid())
    bookingId       String    @unique
    booking         Booking   @relation(fields: [bookingId], references: [id])
    razorpayOrderId String    @unique
    razorpayPaymentId String? @unique
    amount          Decimal
    currency        String    @default("INR")
    status          String    @default("pending")
    // pending → captured → refunded
    // pending → failed
    paymentMethod   String?   // "card", "upi", "netbanking", "wallet"
    failureReason   String?
    metadata        Json?     // Razorpay response data
    createdAt       DateTime  @default(now())
    updatedAt       DateTime  @updatedAt
}
```

### Booking Status State Machine

```
                    ┌─────────────┐
                    │   PENDING    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ↓            ↓            ↓
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ CONFIRMED│ │ CANCELLED│ │  FAILED  │
        └────┬─────┘ └──────────┘ └──────────┘
             │
    ┌────────┴────────┐
    ↓                 ↓
┌──────────┐  ┌───────────────┐
│ COMPLETED│  │ REFUND_REQUESTED│
└──────────┘  └───────┬───────┘
                      ↓
               ┌──────────┐
               │ REFUNDED  │
               └──────────┘
```

### Payment Status State Machine

```
    ┌─────────┐
    │ PENDING  │
    └────┬────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌────────┐
│CAPTURED│ │ FAILED │
└───┬────┘ └────────┘
    │
    ↓
┌──────────┐
│ REFUNDED │
└──────────┘
```

---

## 4. API Endpoints

### Payments Module

| Method | Route                     | Auth | Description                    |
|--------|---------------------------|------|--------------------------------|
| POST   | /api/v1/payments/initiate | Yes  | Create Razorpay order          |
| POST   | /api/v1/payments/verify   | Yes  | Verify payment signature       |
| POST   | /api/v1/payments/refund   | Yes  | Request refund                 |
| GET    | /api/v1/payments/:id      | Yes  | Get payment status             |

### Bookings Module

| Method | Route                        | Auth | Description                 |
|--------|------------------------------|------|-----------------------------|
| POST   | /api/v1/bookings             | Yes  | Create a new booking        |
| GET    | /api/v1/bookings/:id         | Yes  | Get booking details         |
| GET    | /api/v1/bookings             | Yes  | List user's bookings        |
| PATCH  | /api/v1/bookings/:id/cancel  | Yes  | Cancel a booking            |

---

## 5. Backend Implementation

### 5.1 Create Booking

```ts
// POST /api/v1/bookings
// Body: { type, itemId, metadata }

async createBooking(dto: CreateBookingDto, user: IUserPayload) {
    const reference = this.generateReference(); // "VOY-2026-ABC123"

    const booking = await this.postgres.booking.create({
        data: {
            userId: user.id,
            type: dto.type,
            reference,
            amount: dto.amount,
            currency: dto.currency ?? 'INR',
            metadata: dto.metadata,
            status: 'pending',
        },
    });

    return { bookingId: booking.id, reference };
}

private generateReference(): string {
    const year = new Date().getFullYear();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `VOY-${year}-${random}`;
}
```

### 5.2 Initiate Payment

```ts
// POST /api/v1/payments/initiate
// Body: { bookingId, amount, currency }

async initiatePayment(dto: InitiatePaymentDto, user: IUserPayload) {
    // 1. Verify booking exists and belongs to user
    const booking = await this.postgres.booking.findUnique({
        where: { id: dto.bookingId },
    });

    if (!booking || booking.userId !== user.id) {
        throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'pending') {
        throw new BadRequestException('Booking is not in pending state');
    }

    // 2. Create Razorpay order
    const order = await this.razorpay.orders.create({
        amount: Math.round(dto.amount * 100), // Razorpay expects paise
        currency: dto.currency ?? 'INR',
        receipt: booking.reference,
        notes: {
            bookingId: booking.id,
            type: booking.type,
        },
    });

    // 3. Save payment record
    await this.postgres.payment.create({
        data: {
            bookingId: booking.id,
            razorpayOrderId: order.id,
            amount: dto.amount,
            currency: dto.currency ?? 'INR',
            status: 'pending',
        },
    });

    // 4. Return order details to frontend
    return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: this.configService.get('RAZORPAY_KEY_ID'),
    };
}
```

### 5.3 Verify Payment

```ts
// POST /api/v1/payments/verify
// Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature, bookingId }

async verifyPayment(dto: VerifyPaymentDto, user: IUserPayload) {
    // 1. Find the payment record
    const payment = await this.postgres.payment.findUnique({
        where: { razorpayOrderId: dto.razorpay_order_id },
        include: { booking: true },
    });

    if (!payment) {
        throw new NotFoundException('Payment not found');
    }

    if (payment.booking.userId !== user.id) {
        throw new ForbiddenException('Unauthorized');
    }

    // 2. Verify signature
    const body = `${dto.razorpay_order_id}|${dto.razorpay_payment_id}`;
    const expectedSignature = crypto
        .createHmac('sha256', this.configService.getOrThrow('RAZORPAY_KEY_SECRET'))
        .update(body)
        .digest('hex');

    if (expectedSignature !== dto.razorpay_signature) {
        // Signature mismatch — payment tampered
        await this.postgres.payment.update({
            where: { id: payment.id },
            data: { status: 'failed', failureReason: 'Signature verification failed' },
        });
        throw new BadRequestException('Payment verification failed');
    }

    // 3. Update payment status
    await this.postgres.payment.update({
        where: { id: payment.id },
        data: {
            status: 'captured',
            razorpayPaymentId: dto.razorpay_payment_id,
            paymentMethod: await this.fetchPaymentMethod(dto.razorpay_payment_id),
        },
    });

    // 4. Update booking status
    await this.postgres.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'confirmed' },
    });

    return {
        verified: true,
        bookingReference: payment.booking.reference,
    };
}

private async fetchPaymentMethod(paymentId: string): Promise<string> {
    try {
        const payment = await this.razorpay.payments.fetch(paymentId);
        return payment.method; // "card", "upi", "netbanking", "wallet"
    } catch {
        return 'unknown';
    }
}
```

### 5.4 Refund

```ts
// POST /api/v1/payments/refund
// Body: { bookingId, amount?, reason? }

async requestRefund(dto: RefundPaymentDto, user: IUserPayload) {
    const payment = await this.postgres.payment.findUnique({
        where: { bookingId: dto.bookingId },
        include: { booking: true },
    });

    if (!payment) {
        throw new NotFoundException('Payment not found');
    }

    if (payment.booking.userId !== user.id) {
        throw new ForbiddenException('Unauthorized');
    }

    if (payment.status !== 'captured') {
        throw new BadRequestException('Only captured payments can be refunded');
    }

    if (payment.booking.status === 'cancelled') {
        throw new BadRequestException('Booking is already cancelled');
    }

    // 1. Create refund on Razorpay
    const refund = await this.razorpay.payments.refund(payment.razorpayPaymentId!, {
        amount: dto.amount ? Math.round(dto.amount * 100) : undefined, // partial or full
        notes: { reason: dto.reason ?? 'Customer requested refund' },
    });

    // 2. Update payment status
    await this.postgres.payment.update({
        where: { id: payment.id },
        data: { status: 'refunded' },
    });

    // 3. Update booking status
    await this.postgres.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'refunded' },
    });

    return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100,
    };
}
```

### 5.5 Cancel Booking

```ts
// PATCH /api/v1/bookings/:id/cancel

async cancelBooking(bookingId: string, user: IUserPayload) {
    const booking = await this.postgres.booking.findUnique({
        where: { id: bookingId },
        include: { payment: true },
    });

    if (!booking) {
        throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== user.id) {
        throw new ForbiddenException('Unauthorized');
    }

    if (booking.status === 'cancelled') {
        throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === 'completed') {
        throw new BadRequestException('Cannot cancel a completed booking');
    }

    // If payment was captured, initiate refund
    if (booking.payment?.status === 'captured') {
        await this.requestRefund(
            { bookingId: booking.id, reason: 'Customer cancelled' },
            user
        );
    }

    // Update booking status
    await this.postgres.booking.update({
        where: { id: bookingId },
        data: { status: 'cancelled' },
    });

    return { cancelled: true, bookingReference: booking.reference };
}
```

---

## 6. Webhook Handling (Production-Ready)

Razorpay sends webhooks for async events. Even in test mode, implementing this
shows production-grade understanding.

### Webhook Endpoint

```ts
// POST /api/v1/payments/webhook
// Raw body + X-Razorpay-Signature header

@Post('webhook')
async handleWebhook(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('x-razorpay-signature') signature: string,
) {
    // 1. Verify webhook signature
    const body = req.rawBody?.toString() ?? '';
    const expectedSignature = crypto
        .createHmac('sha256', this.configService.getOrThrow('RAZORPAY_KEY_SECRET'))
        .update(body)
        .digest('hex');

    if (expectedSignature !== signature) {
        throw new UnauthorizedException('Invalid webhook signature');
    }

    // 2. Parse event
    const event = JSON.parse(body);

    // 3. Handle event types
    switch (event.event) {
        case 'payment.captured':
            await this.handlePaymentCaptured(event.payload.payment.entity);
            break;

        case 'payment.failed':
            await this.handlePaymentFailed(event.payload.payment.entity);
            break;

        case 'refund.created':
            await this.handleRefundCreated(event.payload.refund.entity);
            break;

        case 'refund.processed':
            await this.handleRefundProcessed(event.payload.refund.entity);
            break;
    }

    return { status: 'ok' };
}
```

### Webhook Event Handlers

```ts
private async handlePaymentCaptured(payment: RazorpayPayment) {
    await this.postgres.payment.update({
        where: { razorpayPaymentId: payment.id },
        data: {
            status: 'captured',
            paymentMethod: payment.method,
        },
    });

    // Find and confirm the associated booking
    const paymentRecord = await this.postgres.payment.findUnique({
        where: { razorpayPaymentId: payment.id },
    });

    if (paymentRecord) {
        await this.postgres.booking.update({
            where: { id: paymentRecord.bookingId },
            data: { status: 'confirmed' },
        });
    }
}

private async handlePaymentFailed(payment: RazorpayPayment) {
    await this.postgres.payment.update({
        where: { razorpayPaymentId: payment.id },
        data: {
            status: 'failed',
            failureReason: payment.error_description ?? 'Payment failed',
        },
    });

    const paymentRecord = await this.postgres.payment.findUnique({
        where: { razorpayPaymentId: payment.id },
    });

    if (paymentRecord) {
        await this.postgres.booking.update({
            where: { id: paymentRecord.bookingId },
            data: { status: 'failed' },
        });
    }
}

private async handleRefundCreated(refund: RazorpayRefund) {
    await this.postgres.payment.update({
        where: { razorpayPaymentId: refund.payment_id },
        data: { status: 'refunded' },
    });
}
```

---

## 7. Security Considerations

### Signature Verification (Critical)

Razorpay payments MUST be verified server-side. Never trust client-side payment
status alone.

```
Client completes payment → gets signature → sends to backend
Backend recomputes HMAC → compares with received signature
Match = payment is genuine
Mismatch = tampered/forged payment → reject
```

### Idempotency

Prevent duplicate charges by checking if a payment already exists for a booking
before creating a new order:

```ts
// In initiatePayment
const existingPayment = await this.postgres.payment.findFirst({
    where: {
        bookingId: dto.bookingId,
        status: { in: ['pending', 'captured'] },
    },
});

if (existingPayment) {
    // Return existing order instead of creating duplicate
    return {
        orderId: existingPayment.razorpayOrderId,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
        keyId: this.configService.get('RAZORPAY_KEY_ID'),
    };
}
```

### Webhook Secret

In production, store the webhook secret in environment variables:
```
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Test Mode Safety

- No real money moves in test mode
- Test card: `4111 1111 1111 1111` (always succeeds)
- Test card: `4000 0000 0000 0002` (always fails)
- Test UPI: `success@razorpay` (always succeeds)
- Test UPI: `failure@razorpay` (always fails)

---

## 8. Frontend Integration

### Razorpay Checkout Flow

```ts
// Frontend: src/services/payment.service.ts

export const initiatePayment = async (bookingId: string, amount: number) => {
    // 1. Get order from backend
    const { data } = await axios.post('/api/v1/payments/initiate', {
        bookingId,
        amount,
        currency: 'INR',
    });

    // 2. Open Razorpay checkout
    const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'Voyago',
        description: 'Booking Payment',
        order_id: data.orderId,
        handler: async (response: RazorpayResponse) => {
            // 3. Verify payment with backend
            await axios.post('/api/v1/payments/verify', {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                bookingId,
            });

            // 4. Redirect to confirmation
            router.push(`/booking/confirmed/${bookingId}`);
        },
        prefill: {
            name: user.name,
            email: user.email,
        },
        theme: {
            color: '#6c5ce7',
        },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
};
```

### Razorpay Script Loading

```html
<!-- index.html -->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

---

## 9. Error Handling

### Payment-Specific Errors

```ts
// Common Razorpay errors and how to handle them

enum PaymentError {
    ORDER_ALREADY_PAID = 'ORDER_ALREADY_PAID',
    PAYMENT_FAILED = 'PAYMENT_FAILED',
    SIGNATURE_MISMATCH = 'SIGNATURE_MISMATCH',
    BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
    BOOKING_NOT_PENDING = 'BOOKING_NOT_PENDING',
    PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
    REFUND_FAILED = 'REFUND_FAILED',
    DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
}
```

### Retry Logic

```ts
// If Razorpay API call fails, retry with exponential backoff
async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await this.sleep(Math.pow(2, attempt) * 1000); // 2s, 4s, 8s
        }
    }
    throw new Error('Max retries exceeded');
}
```

---

## 10. Module Structure

```
src/modules/
  payments/
    payments.module.ts
    payments.controller.ts
    payments.service.ts
    razorpay.client.ts
    webhook.controller.ts
    dto/
      initiate-payment.dto.ts
      verify-payment.dto.ts
      refund-payment.dto.ts
    types/
      payment.types.ts
  bookings/
    bookings.module.ts
    bookings.controller.ts
    bookings.service.ts
    dto/
      create-booking.dto.ts
      cancel-booking.dto.ts
    types/
      booking.types.ts
```

---

## 11. Implementation Checklist

### Phase 1: Core Payment Flow
- [ ] Create Payment and Booking DTOs with class-validator
- [ ] Implement Razorpay client factory
- [ ] Implement PaymentsService (initiate, verify, refund)
- [ ] Implement BookingsService (create, get, list, cancel)
- [ ] Wire up controllers with Swagger decorators
- [ ] Add ClerkAuthGuard to all booking/payment routes

### Phase 2: Webhook & Security
- [ ] Implement webhook endpoint with signature verification
- [ ] Add idempotency checks on payment initiation
- [ ] Add rate limiting on payment endpoints
- [ ] Implement retry logic for Razorpay API calls

### Phase 3: Frontend Integration
- [ ] Load Razorpay.js SDK
- [ ] Implement checkout flow component
- [ ] Add payment status polling (fallback for webhook delays)
- [ ] Build booking confirmation page

### Phase 4: Polish
- [ ] Add booking email confirmations (optional)
- [ ] Implement partial refund support
- [ ] Add payment history endpoint
- [ ] Add admin payment dashboard (optional)

---

## 12. Key Design Decisions

1. **PostgreSQL for payments/bookings** — relational data needs ACID guarantees
2. **Razorpay test mode** — full flow works without real money
3. **Server-side signature verification** — never trust client payment status
4. **Booking before payment** — booking is created in PENDING state, confirmed
   only after payment verification. This prevents orphaned payments.
5. **Webhook + verify endpoint** — belt and suspenders approach. Verify gives
   instant confirmation, webhook handles async/delayed events.
6. **Idempotent payment initiation** — prevents double charges from race conditions
7. **Status state machines** — clear, auditable transitions for every entity
