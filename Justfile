help:
    just -l

test:
    pnpm vitest run

build:
    pnpm run build

dev:
    pnpm run dev

run TARGET:
    pnpm run {{TARGET}}

# Fetch Metrix data for specified season(s), or current season if none specified
fetch-metrix-season *SEASONS:
    pnpm tsx scripts/fetch-metrix-data.ts {{SEASONS}}
