# Voyago — Auth & Users Module

## Overview

Authentication is handled by **Clerk** on the frontend. The backend's role is to
**verify Clerk session tokens** and **sync user data** to MongoDB. This keeps auth
logic simple and secure — no password hashing, no JWT secret management, no
session storage.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  FRONTEND (React + Clerk SDK)                    │
│                                                  │
│  - User signs in via Clerk UI                     │
│  - Clerk returns session token                    │
│  - Frontend stores token in memory/localStorage   │
│  - Frontend sends token in Authorization header   │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  BACKEND (NestJS + Clerk SDK)                    │
│                                                  │
│  - ClerkAuthGuard verifies Bearer token           │
│  - Extracts userId, email, role from token        │
│  - Upserts user in MongoDB on first request       │
│  - Attaches user to request object                │
│  - @Public() skips auth for open endpoints        │
└─────────────────────────────────────────────────┘
```

---

## Clerk Integration

### ClerkAuthGuard

```ts
// src/common/guards/clerk-auth.guard.ts

@Injectable()
export class ClerkAuthGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // 1. Check if route is public
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        // 2. Extract token from Authorization header
        const request = context.switchToHttp().getRequest();
        const authorization = request.headers.authorization;
        if (!authorization) {
            throw new UnauthorizedException('Missing authorization header');
        }

        const [type, token] = authorization.split(' ');
        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException('Invalid authorization header format');
        }

        // 3. Verify token with Clerk SDK
        try {
            const client = createClerkClient({
                secretKey: process.env.CLERK_SECRET_KEY,
            });
            const payload = await client.verifyToken(token);

            // 4. Attach user to request
            request.user = {
                id: payload.sub,
                email: (payload as Record<string, unknown>).email || '',
                role: (payload as Record<string, unknown>).role || 'CUSTOMER',
            };
            return true;
        } catch (error) {
            throw new UnauthorizedException('Invalid session token');
        }
    }
}
```

### @Public() Decorator

```ts
// src/common/decorators/public.decorator.ts

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Usage: Apply to any route that doesn't require authentication.

```ts
@Public()
@Get('health')
healthCheck() {
    return { status: 'ok' };
}
```

### @Roles() Decorator

```ts
// src/common/decorators/roles.decorator.ts

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

Usage: Restrict routes to specific user roles.

```ts
@Roles('ADMIN')
@Patch('users/:id/role')
async updateUserRole() { ... }
```

### @CurrentUser() Decorator

```ts
// src/common/decorators/current-user.decorator.ts

export const CurrentUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);
```

Usage: Extract authenticated user from request.

```ts
@Get('me')
getMe(@CurrentUser() user: IUserPayload) {
    return { userId: user.id, email: user.email, role: user.role };
}
```

---

## User Model (MongoDB)

```prisma
// prisma/schema.prisma

model User {
    id        String   @id @default(auto()) @map("_id") @db.ObjectId
    email     String   @unique
    name      String
    role      String   @default("CUSTOMER")
    isActive  Boolean  @default(true)
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
}
```

### User Roles

```ts
enum UserRole {
    CUSTOMER = 'CUSTOMER',   // Default — can book, search, manage own bookings
    SELLER = 'SELLER',       // Can list properties, manage inventory
    ADMIN = 'ADMIN',         // Full access — manage users, payments, reports
}
```

---

## Auth Flow — Detailed

### 1. First-Time User

```
User signs up via Clerk UI (email, Google, GitHub)
  ↓
Clerk creates account, returns session token
  ↓
Frontend sends request with Bearer token
  ↓
ClerkAuthGuard verifies token → extracts userId, email
  ↓
Check MongoDB: does user with this Clerk ID exist?
  ↓
No → Upsert user in MongoDB:
    {
        clerkId: "user_abc123",
        email: "user@example.com",
        name: "John Doe",
        role: "CUSTOMER",
        isActive: true
    }
  ↓
Yes → Return existing user
  ↓
Attach user to request object
  ↓
Route handler executes with @CurrentUser() user
```

### 2. Returning User

```
User sends request with Bearer token
  ↓
ClerkAuthGuard verifies token → extracts userId
  ↓
Check MongoDB: user exists → attach to request
  ↓
Route handler executes
```

### 3. Token Refresh

Clerk handles token refresh automatically on the frontend. The backend always
receives a valid token — if it's expired, Clerk's `verifyToken` will reject it
and the user needs to re-authenticate.

---

## API Endpoints

### Auth Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/v1/auth/me | Yes | Get current user from token |
| POST | /api/v1/auth/sync | Yes | Sync Clerk user to MongoDB |

### User Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/v1/users/me | Yes | Get own profile |
| PATCH | /api/v1/users/me | Yes | Update own profile |
| GET | /api/v1/users/:id | Yes (ADMIN) | Get user by ID |
| PATCH | /api/v1/users/:id/role | Yes (ADMIN) | Update user role |

---

## Controller Implementation

### Auth Controller

```ts
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get('me')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperation.AUTH_ME })
    async getMe(@CurrentUser() user: IUserPayload) {
        const data = await this.authService.getOrCreateUser(user);
        return { message: ME_SUCCESS, data };
    }

    @Post('sync')
    @HttpCode(200)
    @ApiOperation({ summary: 'Sync Clerk user to database' })
    async syncUser(@CurrentUser() user: IUserPayload) {
        const data = await this.authService.syncUser(user);
        return { message: 'User synced successfully', data };
    }
}
```

### Users Controller

```ts
@ApiTags('Users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('me')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperation.USERS_GET_ME })
    async getMe(@CurrentUser() user: IUserPayload) {
        const data = await this.usersService.findByClerkId(user.id);
        return { message: GET_ME_SUCCESS, data };
    }

    @Patch('me')
    @HttpCode(200)
    @ApiOperation({ summary: ApiOperation.USERS_UPDATE_ME })
    async updateMe(
        @CurrentUser() user: IUserPayload,
        @Body() dto: UpdateUserDto,
    ) {
        const data = await this.usersService.updateProfile(user.id, dto);
        return { message: UPDATE_ME_SUCCESS, data };
    }

    @Get(':id')
    @Roles('ADMIN')
    @HttpCode(200)
    @ApiOperation({ summary: 'Get user by ID (admin only)' })
    async getUser(@Param('id') id: string) {
        const data = await this.usersService.findById(id);
        return { message: 'User retrieved successfully', data };
    }

    @Patch(':id/role')
    @Roles('ADMIN')
    @HttpCode(200)
    @ApiOperation({ summary: 'Update user role (admin only)' })
    async updateRole(
        @Param('id') id: string,
        @Body() dto: UpdateRoleDto,
    ) {
        const data = await this.usersService.updateRole(id, dto.role);
        return { message: 'User role updated successfully', data };
    }
}
```

---

## DTOs

### UpdateUserDto

```ts
class UpdateUserDto {
    @IsString() @IsOptional()
    name?: string;

    @IsString() @IsOptional()
    @Matches(/^\+?[1-9]\d{1,14}$/)
    phone?: string;
}
```

### UpdateRoleDto

```ts
class UpdateRoleDto {
    @IsEnum(UserRole)
    role!: UserRole;
}
```

---

## Service Implementation

### AuthService

```ts
@Injectable()
export class AuthService {
    constructor(
        @InjectPinoLogger(AuthService.name)
        private readonly logger: PinoLogger,
    ) {}

    async getOrCreateUser(user: IUserPayload) {
        const existing = await this.mongo.user.findUnique({
            where: { clerkId: user.id },
        });

        if (existing) return existing;

        // Auto-create on first request
        const created = await this.mongo.user.create({
            data: {
                clerkId: user.id,
                email: user.email,
                name: user.email.split('@')[0], // Default name from email
                role: user.role ?? 'CUSTOMER',
            },
        });

        this.logger.info(`New user created: ${created.id}`);
        return created;
    }

    async syncUser(user: IUserPayload) {
        return this.mongo.user.upsert({
            where: { clerkId: user.id },
            update: { email: user.email },
            create: {
                clerkId: user.id,
                email: user.email,
                name: user.email.split('@')[0],
                role: user.role ?? 'CUSTOMER',
            },
        });
    }
}
```

### UsersService

```ts
@Injectable()
export class UsersService {
    constructor(
        @InjectPinoLogger(UsersService.name)
        private readonly logger: PinoLogger,
    ) {}

    async findByClerkId(clerkId: string) {
        const user = await this.mongo.user.findUnique({
            where: { clerkId },
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async updateProfile(clerkId: string, dto: UpdateUserDto) {
        const user = await this.findByClerkId(clerkId);
        return this.mongo.user.update({
            where: { id: user.id },
            data: dto,
        });
    }

    async findById(id: string) {
        const user = await this.mongo.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async updateRole(id: string, role: UserRole) {
        const user = await this.findById(id);
        return this.mongo.user.update({
            where: { id: user.id },
            data: { role },
        });
    }
}
```

---

## Guards Setup

### Global Registration (AppModule)

```ts
@Module({
    imports: [
        // ...
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(SanitizeMiddleware)
            .forRoutes('*');
    }
}
```

Guards are registered per-module or per-controller, not globally, so public
routes like `/health` and `/hotels/search` don't require auth.

### Per-Controller Registration

```ts
@Module({
    imports: [ClerkModule],
    controllers: [BookingsController],
    providers: [BookingsService, ClerkAuthGuard, RolesGuard],
})
export class BookingsModule {}
```

---

## API Response Format

### GET /api/v1/auth/me

```json
{
    "success": true,
    "message": "User fetched successfully",
    "data": {
        "id": "usr_abc123",
        "clerkId": "user_abc123",
        "email": "john@example.com",
        "name": "John Doe",
        "role": "CUSTOMER",
        "isActive": true,
        "createdAt": "2026-01-15T10:30:00Z",
        "updatedAt": "2026-06-10T14:20:00Z"
    }
}
```

### GET /api/v1/users/me

```json
{
    "success": true,
    "message": "Profile retrieved successfully",
    "data": {
        "id": "usr_abc123",
        "clerkId": "user_abc123",
        "email": "john@example.com",
        "name": "John Doe",
        "role": "CUSTOMER",
        "isActive": true
    }
}
```

---

## Module Structure

```
src/modules/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   └── dto/
│       ├── index.ts
│       └── sync-user.dto.ts
├── users/
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.module.ts
│   └── dto/
│       ├── index.ts
│       ├── update-user.dto.ts
│       └── update-role.dto.ts
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret key |
| `CLERK_PUBLISHABLE_KEY` | Frontend only | Clerk frontend key |

---

## Implementation Checklist

### Phase 1: Core Auth
- [ ] Ensure ClerkAuthGuard is working (already implemented)
- [ ] Create AuthService with getOrCreateUser
- [ ] Create AuthController with /me and /sync endpoints
- [ ] Create AuthModule

### Phase 2: User Management
- [ ] Create UsersService with CRUD operations
- [ ] Create UsersController with profile endpoints
- [ ] Create UpdateUserDto and UpdateRoleDto
- [ ] Create UsersModule

### Phase 3: Polish
- [ ] Add admin-only endpoints (get user, update role)
- [ ] Add user listing endpoint (admin)
- [ ] Add Swagger documentation
- [ ] Add profile image upload (via Cloudinary)
- [ ] Write unit tests

### Phase 4: Advanced
- [ ] Add user preferences (language, currency)
- [ ] Add booking history endpoint
- [ ] Add activity log
