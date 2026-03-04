# RavenQuest Profit Planner

## Current State

The app has Internet Identity login already wired up. The backend has an `AccessControl` module with admin/user roles. The `setPrice`, `clearPrice`, and `clearAll` backend functions are currently open to any caller (no auth check). The Price Book panel has a "Local" / "Guild (Shared)" toggle. Local mode uses localStorage only. Guild mode syncs to/from the backend shared price store.

## Requested Changes (Diff)

### Add

1. **Admin-only guard on backend price mutations** -- `setPrice`, `clearPrice`, and `clearAll` must only be callable by the app admin (the deployer/owner principal). Any non-admin call should trap with "Unauthorized: Admin only".

2. **"Admin" visual indicator in the UI** -- When the logged-in principal is the admin, show a small gold "Admin" badge next to their principal ID in the header auth button area.

3. **Lock Price Book editing behind admin login** -- In the Price Book panel and all inline price inputs:
   - If the user is NOT logged in as admin: price inputs and edit controls are read-only (disabled). Show a tooltip/note: "Log in as admin to edit prices."
   - If the user IS logged in as admin: editing works as normal.
   - Local mode (localStorage) remains fully editable by anyone without login -- the restriction only applies to Guild (Shared) mode writes.

4. **"Read-only" mode banner in Price Book panel** -- When guild mode is active and the user is not admin, show a subtle info banner: "Prices are managed by the guild admin. Log in to edit." with a Login button inline.

### Modify

- `main.mo`: Add `AccessControl.isAdmin` check to `setPrice`, `clearPrice`, and `clearAll`.
- `PriceBookPanel` component: disable edit controls when in guild mode and not admin.
- Inline price inputs in Crafting tab (`InlinePriceInput`, `MarketPriceInput`): when guild mode is active and user is not admin, render as read-only display values instead of editable inputs.
- `AuthButton` in `App.tsx`: show "Admin" gold badge when logged in as admin.

### Remove

Nothing removed.

## Implementation Plan

1. Update `main.mo`: add `if (not AccessControl.isAdmin(accessControlState, caller))` guard to `setPrice`, `clearPrice`, and `clearAll` with trap message "Unauthorized: Admin only".
2. Regenerate backend types (backend.d.ts stays the same, no signature changes).
3. Add `useIsAdmin` hook in frontend that checks if the logged-in identity's principal matches the admin principal fetched from the backend (use `isAdmin` query if available, or check against a known admin principal via `getAdminPrincipal` -- add this query to backend if needed).
4. Update `PriceBookPanel`: import `useIsAdmin`, disable all edit/save/clear controls when `guildMode && !isAdmin`. Show read-only banner.
5. Update `InlinePriceInput` and `MarketPriceInput` in CraftingCalculator: when guild mode is active and not admin, render a plain text display instead of an input.
6. Update `AuthButton`: show gold "Admin" badge when `isAdmin` is true.
7. Add a `getAdminPrincipal` query to the backend that returns the admin principal (so the frontend can check).
