import { z } from 'zod';

export const envSchema = z.object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().optional(),
    POSTGRESQL_URL: z.string().optional(),
    REDIS_HOST: z.string().optional().default('localhost'),
    REDIS_PORT: z.coerce.number().optional().default(6379),
    CORS_ORIGIN: z.string().optional().default('*'),
    CLERK_SECRET_KEY: z.string().optional(),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    MASTRA_API_KEY: z.string().optional(),
    GEOAPIFY_API_KEY: z.string().optional(),
}).passthrough().refine((data) => {
    if (data.NODE_ENV !== 'test') {
        if (!data.DATABASE_URL) return false;
    }
    return true;
}, {
    message: "DATABASE_URL is required when NODE_ENV is not 'test'",
    path: ['DATABASE_URL'],
});

export type TEnv = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) => {
    const result = envSchema.safeParse(config);
    if (!result.success) {
        const errors = JSON.stringify(result.error.format(), null, 2);
        throw new Error(`Invalid environment variables:\n${errors}`);
    }
    return result.data;
};
