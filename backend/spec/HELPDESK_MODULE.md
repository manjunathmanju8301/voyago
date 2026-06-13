# Voyago — Helpdesk Module

## Overview

The Helpdesk module provides **AI-powered customer support** using Mastra.
Users can chat with an AI assistant that answers FAQs, helps with bookings,
and provides real-time support. It also supports traditional ticket-based
support for complex issues.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  USER                                             │
│  - Opens chat widget in frontend                  │
│  - Types message or selects FAQ                   │
│  - Sends to POST /api/v1/helpdesk/chat            │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  BACKEND (NestJS + Mastra)                        │
│                                                  │
│  - Receives chat message                          │
│  - Forwards to Mastra AI agent                    │
│  - Agent has access to FAQ knowledge base          │
│  - Agent can answer questions about Voyago         │
│  - Agent can help with booking queries             │
│  - Returns AI response to frontend                 │
└─────────────────────────────────────────────────┘
```

---

## Mastra Integration

### What is Mastra

Mastra is an AI agent framework. For this project, it provides:
- Chat-based AI assistant
- Knowledge base for FAQs
- Context-aware responses
- Conversation memory

### Setup

```ts
// src/modules/helpdesk/mastra/agent.ts

import { Mastra } from '@mastra/core';

const mastra = new Mastra({
    // Agent configuration
});

// The agent is configured with:
// 1. Voyago FAQ knowledge base
// 2. Booking context awareness
// 3. Response guidelines
```

### Agent Capabilities

| Capability | Description |
|-----------|-------------|
| FAQ Answers | Answer common questions about Voyago |
| Booking Help | Guide users through booking flow |
| Payment Support | Help with payment issues |
| Cancellation | Explain cancellation policies |
| Refund Info | Provide refund status and process |
| General Support | Handle general inquiries |

---

## Chat Flow

### 1. User Sends Message

```json
POST /api/v1/helpdesk/chat
{
    "message": "How do I cancel my booking?",
    "conversationId": "conv_abc123"  // optional — for continuing thread
}
```

### 2. Backend Processes

```ts
async processChat(dto: ChatDto, user: IUserPayload) {
    // 1. Get or create conversation
    const conversation = dto.conversationId
        ? await this.getConversation(dto.conversationId)
        : await this.createConversation(user.id);

    // 2. Save user message
    await this.saveMessage(conversation.id, 'user', dto.message);

    // 3. Get conversation history for context
    const history = await this.getConversationHistory(conversation.id);

    // 4. Send to Mastra agent
    const response = await this.mastraAgent.chat({
        message: dto.message,
        history,
        context: {
            userId: user.id,
            userBookings: await this.getUserBookings(user.id),
        },
    });

    // 5. Save assistant response
    await this.saveMessage(conversation.id, 'assistant', response);

    // 6. Return response
    return {
        conversationId: conversation.id,
        message: response,
        suggestions: this.getSuggestions(response),
    };
}
```

### 3. Response to User

```json
{
    "success": true,
    "message": "Helpdesk chat request completed",
    "data": {
        "conversationId": "conv_abc123",
        "message": "To cancel your booking, follow these steps:\n\n1. Go to 'My Bookings' in your dashboard\n2. Find the booking you want to cancel\n3. Click 'Cancel Booking'\n4. Confirm the cancellation\n\nRefund will be processed within 5-7 business days. Would you like me to help you cancel a specific booking?",
        "suggestions": [
            "Cancel my hotel booking",
            "What is the refund policy?",
            "Talk to a human agent"
        ]
    }
}
```

---

## Conversation Management

### Conversation Model

```ts
interface Conversation {
    id: string;
    userId: string;
    status: 'active' | 'resolved' | 'escalated';
    createdAt: Date;
    updatedAt: Date;
}

interface ChatMessage {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: Date;
}
```

### Storage

Conversations and messages can be stored in MongoDB:

```prisma
// Add to prisma/schema.prisma

model Conversation {
    id        String   @id @default(auto()) @map("_id") @db.ObjectId
    userId    String
    status    String   @default("active")
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    messages  ChatMessage[]
}

model ChatMessage {
    id             String   @id @default(auto()) @map("_id") @db.ObjectId
    conversationId String
    role           String   // "user", "assistant", "system"
    content        String
    createdAt      DateTime @default(now())

    conversation   Conversation @relation(fields: [conversationId], references: [id])
}
```

---

## FAQ Knowledge Base

### Pre-defined FAQs

The agent has access to a knowledge base of common questions:

```ts
const FAQ_KNOWLEDGE_BASE = [
    {
        category: 'Booking',
        questions: [
            {
                q: 'How do I book a hotel?',
                a: 'Search for hotels by city and dates, select a room, and proceed to payment. Your booking is confirmed instantly after payment.',
            },
            {
                q: 'Can I book for someone else?',
                a: 'Yes, you can book for anyone. Just enter their details during the booking process.',
            },
            {
                q: 'How do I search for flights?',
                a: 'Go to Flights, enter your origin, destination, and travel date. You\'ll see available flights with prices and schedules.',
            },
        ],
    },
    {
        category: 'Payment',
        questions: [
            {
                q: 'What payment methods are accepted?',
                a: 'We accept UPI, credit/debit cards, net banking, and wallets through our secure payment partner Razorpay.',
            },
            {
                q: 'Is my payment secure?',
                a: 'Yes, all payments are processed through Razorpay with bank-level encryption. We never store your card details.',
            },
        ],
    },
    {
        category: 'Cancellation',
        questions: [
            {
                q: 'How do I cancel a booking?',
                a: 'Go to My Bookings, find the booking, and click Cancel. Refund depends on the cancellation policy.',
            },
            {
                q: 'What is the refund policy?',
                a: 'Refund varies by service. Hotels: free cancellation up to 24h before check-in. Flights: depends on airline policy. Check your booking details for specific terms.',
            },
            {
                q: 'How long does a refund take?',
                a: 'Refunds are processed within 5-7 business days to your original payment method.',
            },
        ],
    },
    {
        category: 'Account',
        questions: [
            {
                q: 'How do I create an account?',
                a: 'Click Sign Up on the top right. You can register with email, Google, or GitHub.',
            },
            {
                q: 'How do I update my profile?',
                a: 'Go to Settings > Profile to update your name, phone number, and other details.',
            },
        ],
    },
];
```

### Smart Suggestions

After each AI response, the system generates contextual suggestions:

```ts
private getSuggestions(response: string): string[] {
    const suggestions: string[] = [];

    if (response.includes('cancel')) {
        suggestions.push('View my bookings', 'What is the refund policy?');
    }
    if (response.includes('payment')) {
        suggestions.push('My payment failed', 'Request a refund');
    }
    if (response.includes('book')) {
        suggestions.push('Search hotels', 'Search flights');
    }

    return suggestions.slice(0, 3);
}
```

---

## Support Tickets

For complex issues that AI can't resolve, users can create support tickets.

### Ticket Status Flow

```
    ┌───────┐
    │  OPEN  │
    └───┬───┘
        │
        ↓
┌────────────────┐
│  IN_PROGRESS   │
└───┬────────┬───┘
    │        │
    ↓        ↓
┌────────┐ ┌─────────┐
│CLOSED  │ │ESCALATED│
└────────┘ └─────────┘
```

### Ticket Model

```prisma
model SupportTicket {
    id          String   @id @default(auto()) @map("_id") @db.ObjectId
    userId      String
    subject     String
    description String
    category    String   // "booking", "payment", "technical", "other"
    status      String   @default("open")
    priority    String   @default("medium")  // "low", "medium", "high", "urgent"
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
}
```

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/v1/helpdesk/chat | Yes | Send chat message |
| GET | /api/v1/helpdesk/conversations | Yes | List user conversations |
| GET | /api/v1/helpdesk/conversations/:id | Yes | Get conversation with messages |
| POST | /api/v1/helpdesk/tickets | Yes | Create support ticket |
| GET | /api/v1/helpdesk/tickets/:id | Yes | Get ticket status |
| PATCH | /api/v1/helpdesk/tickets/:id | Yes | Update ticket |

---

## Controller Implementation

```ts
@ApiTags('Helpdesk')
@Controller('helpdesk')
export class HelpdeskController {
    constructor(private readonly helpdeskService: HelpdeskService) {}

    @Post('chat')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperation.HELPDESK_CHAT })
    async chat(
        @CurrentUser() user: IUserPayload,
        @Body() dto: ChatDto,
    ) {
        const data = await this.helpdeskService.processChat(dto, user);
        return { message: HELPDESK_CHAT_SUCCESS, data };
    }

    @Get('conversations')
    @HttpCode(200)
    @ApiOperation({ summary: 'List user conversations' })
    async listConversations(@CurrentUser() user: IUserPayload) {
        const data = await this.helpdeskService.listConversations(user.id);
        return { message: 'Conversations retrieved', data };
    }

    @Get('conversations/:id')
    @HttpCode(200)
    @ApiOperation({ summary: 'Get conversation with messages' })
    async getConversation(
        @CurrentUser() user: IUserPayload,
        @Param('id') id: string,
    ) {
        const data = await this.helpdeskService.getConversation(id, user.id);
        return { message: 'Conversation retrieved', data };
    }

    @Post('tickets')
    @HttpCode(201)
    @ApiOperation({ summary: ApiOperation.HELPDESK_CREATE_TICKET })
    async createTicket(
        @CurrentUser() user: IUserPayload,
        @Body() dto: CreateTicketDto,
    ) {
        const data = await this.helpdeskService.createTicket(dto, user.id);
        return { message: HELPDESK_TICKET_CREATED, data };
    }

    @Get('tickets/:id')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperation.HELPDESK_GET_TICKET })
    async getTicket(
        @CurrentUser() user: IUserPayload,
        @Param('id') id: string,
    ) {
        const data = await this.helpdeskService.getTicket(id, user.id);
        return { message: HELPDESK_TICKET_RETRIEVED, data };
    }

    @Patch('tickets/:id')
    @HttpCode(200)
    @ApiOperation({ summary: 'Update support ticket' })
    async updateTicket(
        @CurrentUser() user: IUserPayload,
        @Param('id') id: string,
        @Body() dto: UpdateTicketDto,
    ) {
        const data = await this.helpdeskService.updateTicket(id, dto, user.id);
        return { message: 'Ticket updated', data };
    }
}
```

---

## DTOs

### ChatDto

```ts
class ChatDto {
    @IsString() @IsNotEmpty()
    message: string;                   // User's message

    @IsString() @IsOptional()
    conversationId?: string;           // For continuing existing conversation
}
```

### CreateTicketDto

```ts
class CreateTicketDto {
    @IsString() @IsNotEmpty()
    subject: string;

    @IsString() @IsNotEmpty()
    description: string;

    @IsEnum(['booking', 'payment', 'technical', 'other'])
    category: string;

    @IsEnum(['low', 'medium', 'high', 'urgent'])
    @IsOptional()
    priority?: string = 'medium';
}
```

### UpdateTicketDto

```ts
class UpdateTicketDto {
    @IsEnum(['open', 'in_progress', 'resolved', 'closed'])
    @IsOptional()
    status?: string;

    @IsString() @IsOptional()
    comment?: string;                   // Admin note
}
```

---

## API Response Format

### Chat Response

```json
{
    "success": true,
    "message": "Helpdesk chat request completed",
    "data": {
        "conversationId": "conv_abc123",
        "message": "I'd be happy to help you with that! To cancel your hotel booking, go to My Bookings in your dashboard, find the booking, and click Cancel. The refund will be processed within 5-7 business days.",
        "suggestions": [
            "Cancel my hotel booking",
            "What is the refund policy?",
            "Talk to a human agent"
        ]
    }
}
```

### Ticket Response

```json
{
    "success": true,
    "message": "Support ticket created successfully",
    "data": {
        "ticketId": "tk_abc123",
        "subject": "Payment not received",
        "status": "open",
        "priority": "medium",
        "createdAt": "2026-07-15T10:30:00Z"
    }
}
```

---

## Module Structure

```
src/modules/helpdesk/
├── dto/
│   ├── index.ts
│   ├── chat.dto.ts
│   ├── create-ticket.dto.ts
│   └── update-ticket.dto.ts
├── types/
│   ├── index.ts
│   └── helpdesk.types.ts
├── data/
│   └── faq-knowledge-base.ts       ← FAQ content
├── mastra/
│   └── agent.ts                    ← Mastra AI agent setup
├── helpdesk.service.ts
├── helpdesk.controller.ts
├── helpdesk.module.ts
└── index.ts
```

---

## Implementation Checklist

### Phase 1: Chat Core
- [ ] Set up Mastra agent configuration
- [ ] Create FAQ knowledge base
- [ ] Create ChatDto
- [ ] Implement chat processing in HelpdeskService
- [ ] Wire up chat endpoint

### Phase 2: Conversations
- [ ] Create Conversation and ChatMessage models in Prisma
- [ ] Implement conversation CRUD
- [ ] Add conversation history to agent context
- [ ] Add smart suggestions

### Phase 3: Tickets
- [ ] Create SupportTicket model in Prisma
- [ ] Implement ticket CRUD
- [ ] Add ticket status management
- [ ] Add admin ticket list endpoint

### Phase 4: Polish
- [ ] Add Swagger documentation
- [ ] Add FAQ search endpoint
- [ ] Add conversation rating (thumbs up/down)
- [ ] Add escalation to human agent flow
- [ ] Write unit tests
