help:
    just -l

build:
    pnpm run build

dev:
    pnpm run dev

run TARGET:
    pnpm run {{TARGET}}

# Fetch Metrix data for specified season(s), or current season if none specified
fetch-metrix-season *SEASONS:
    pnpm tsx scripts/fetch-metrix-data.ts {{SEASONS}}

# Fetch product inventory from Square (requires SQUARE_ACCESS_TOKEN env var)
fetch-square-inventory:
    pnpm tsx scripts/fetch-square-inventory.ts
