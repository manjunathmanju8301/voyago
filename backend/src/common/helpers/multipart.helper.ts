import { BadRequestException } from '@nestjs/common';
import { join } from 'node:path';
import type { FastifyRequest } from 'fastify';
import type { IMultipartResult } from '@/types/index.js';

export const parseMultipartForm = async (
    req: FastifyRequest,
    requiredFields: string[],
): Promise<IMultipartResult> => {
    const tempDir = join(process.cwd(), 'temp');
    const result = await req.saveRequestFiles({ tmpdir: tempDir });

    const fields: Record<string, string> = {};

    for (const [key, value] of Object.entries(result.values)) {
        if (value && typeof value === 'object' && 'value' in value) {
            fields[key] = String(value.value);
        }
    }

    for (const field of requiredFields) {
        if (!fields[field]) {
            await req.cleanRequestFiles();
            throw new BadRequestException(`${field} is required`);
        }
    }

    const filePaths = result.files.map(f => f.filepath);

    return { fields, filePaths };
};
