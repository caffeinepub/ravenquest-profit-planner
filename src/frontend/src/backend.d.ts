import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface GrowingClaim {
    itemId: bigint;
    claimedAt: bigint;
    claimedBy: Principal;
    itemName: string;
    landSize: string;
    quantity: bigint;
    category: string;
}
export interface UserProfile {
    name: string;
}
export interface PriceEntry {
    itemId: bigint;
    lastUpdatedAt: bigint;
    updatedBy: Principal;
    itemName: string;
    price: number;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    clearAll(): Promise<void>;
    clearPrice(itemId: bigint): Promise<void>;
    getAdminPrincipal(): Promise<Principal | null>;
    getAttributions(): Promise<Array<[bigint, string]>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getClaims(): Promise<Array<GrowingClaim>>;
    getMyClaims(): Promise<Array<GrowingClaim>>;
    getPrices(): Promise<Array<[bigint, PriceEntry]>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    removeClaim(itemId: bigint): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setClaim(itemId: bigint, itemName: string, category: string, landSize: string, quantity: bigint): Promise<void>;
    setPrice(itemId: bigint, itemName: string, price: number): Promise<void>;
}
