# 🧭 Voyago

> **One platform to book everything — travel, stay & entertainment**

---

## 📋 Project Overview

Voyago is a unified booking platform that lets you search, compare, and book across multiple categories — **buses, trains, flights, hotels, and movies** — all in one place. It features an **AI-powered helpdesk** built with [Mastra](https://mastra.ai) that can answer FAQs, process bookings via chat, and provide real-time support.

---

## ✨ Features

- **🔐 Authentication** — Powered by Clerk with support for social logins (Google, GitHub, etc.)
- **🚌✈️🚆 Book Anything** — Buses, trains, flights, hotels, and movies from a single interface
- **🤖 AI Helpdesk** — Chatbot built with Mastra for booking via conversation, FAQs, and customer support
- **🪑 Real-Time Availability** — Live seat and room availability across all categories
- **💳 Payments & Management** — Secure payments and full booking management dashboard

---

## 🛠️ Tech Stack

### Frontend
React, TypeScript, Vite, Shadcn UI, Tailwind CSS, Redux Toolkit, TanStack Query, Clerk, Mastra Client, React Router, Axios, Zod, React Hook Form

### Backend
NestJS, Fastify, TypeScript, Prisma, Mastra

### Database
MongoDB (primary), PostgreSQL (payments & bookings)

### Cache
Redis

### Auth
Clerk

### Containerization
Podman

### Package Manager
pnpm

---

## 📁 Project Structure

```
voyago/
├── frontend/         ← React + Vite app
└── backend/          ← NestJS + Fastify API
```

---

## API Routes

Backend API routes are documented in detail in the [backend/routes.md](./backend/routes.md) file.
This file is updated as new modules are added.

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20
- pnpm (install globally: `npm install -g pnpm`)

### Clone & Install

```bash
git clone <repo-url>
cd voyago
```

#### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

#### Backend

```bash
cd backend
pnpm install
pnpm dev
```

---

## 🌐 Environment Variables

### Frontend (`.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |

---

## 🤝 Contributing

This is a team project. Please follow the established conventions and open a PR for any changes.

---

## 📄 License

[MIT](LICENSE)
