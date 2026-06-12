export enum UserRole {
    CUSTOMER = 'CUSTOMER',
    SELLER = 'SELLER',
    ADMIN = 'ADMIN',
}

export interface IUserPayload {
    id: string;
    email: string;
    role: UserRole;
}

export interface IJwtPayload {
    sub: string;
    email: string;
    role: UserRole;
}
