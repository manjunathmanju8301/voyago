import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchHotelsDto {
    @ApiProperty({
        description: 'City Name',
        example: 'Paris',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    city!: string;

    @ApiProperty({
        description: 'Check-in date (YYYY-MM-DD)',
        example: '2026-07-01',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    checkIn!: string;

    @ApiProperty({
        description: 'Check-out date (YYYY-MM-DD)',
        example: '2026-07-07',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    checkOut!: string;

    @ApiProperty({
        description: 'Number of guests',
        example: 1,
        required: false,
        default: 1,
    })
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    guests?: number = 1;

    @ApiProperty({
        description: 'Limit results count',
        example: 20,
        required: false,
        default: 20,
    })
    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    limit?: number = 20;
}
