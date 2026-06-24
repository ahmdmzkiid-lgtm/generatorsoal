export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
}
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;
export declare function signToken(payload: JwtPayload): string;
export declare function verifyToken(token: string): JwtPayload;
export declare function authenticateUser(email: string, password: string): Promise<{
    token: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
} | null>;
//# sourceMappingURL=auth.d.ts.map