# mdgc-sd data contract

**Status: draft, for discussion with Zach.**

The JSON files that [mdgc-sd](https://mdgc-sd.vercel.app/) publishes, so this site can show the Social Days data that isn't in Metrix: official prize winners, round logistics, and Club Champs rules. Part of the [Social Days integration plan](README.md).

## How it's used

- This site's scheduled sync (twice a day) fetches the files and commits them alongside the raw Metrix data. Pages are built from the committed copies.
- Nothing fetches them from a browser, so no CORS headers are needed.
- When the operational side moves to club-owned Cloudflare services, the same files move with it; only the base URL changes.

## Rules

- **Public data only.** No emails, phone numbers, U18 details, payment data, or anything not already shown on a public page.
- **Keyed by Metrix ID.** Seasons, social days and players are identified by their Metrix IDs (as strings), not by labels like `s2` or `rd-01`.
- **Versioned.** Every file has `"version": 1` and a `generatedAt` timestamp (ISO 8601, UTC). A breaking change bumps the version and the path (`/data/v2/…`); adding a field doesn't.
- **Dates** are `YYYY-MM-DD`, in Melbourne local time.
- Readers ignore fields they don't recognise.

## Files

### Season index

`GET https://mdgc-sd.vercel.app/data/v1/seasons.json`

```json
{
  "version": 1,
  "generatedAt": "2026-10-22T05:00:00Z",
  "seasons": [
    { "metrixId": "3525269", "name": "MDGC 2026 Social Days", "url": "/data/v1/seasons/3525269.json" },
    { "metrixId": "3647062", "name": "MDGC 2026 Social Days S2", "url": "/data/v1/seasons/3647062.json" }
  ]
}
```

### Season

`GET https://mdgc-sd.vercel.app/data/v1/seasons/{seasonMetrixId}.json`

```json
{
  "version": 1,
  "generatedAt": "2026-10-22T05:00:00Z",
  "season": {
    "metrixId": "3647062",
    "name": "MDGC 2026 Social Days S2",
    "playerMeetingTimes": ["7:50am", "10:20am"]
  },
  "rounds": [
    {
      "round": 1,
      "metrixId": "3647171",
      "date": "2026-07-05",
      "venue": "Werribee",
      "organiser": "Volunteer Name",
      "meetingPoint": "near Tee 1",
      "cancelled": false,
      "notes": null,
      "prizes": {
        "status": "published",
        "publishedAt": "2026-07-05T07:12:00Z",
        "winners": [
          {
            "prize": "Div A Handicap",
            "type": "handicap",
            "divisions": ["A"],
            "name": "Player One",
            "metrixUserId": "100001",
            "detail": "Net 50.29, Raw 55 (-9)"
          },
          {
            "prize": "Div A/B/X/Z CTB",
            "type": "ctb",
            "divisions": ["A", "B", "X", "Z"],
            "name": "Player Two",
            "metrixUserId": "100002",
            "detail": "Hole 1"
          }
        ],
        "notes": [
          "Player Three also led Div C Handicap but won Div C/D CTB, so Div C Handicap passed to Player Four."
        ]
      }
    }
  ]
}
```

| Field | Notes |
|---|---|
| `rounds[].round` | 1-based round number within the season |
| `rounds[].metrixId` | The social day's Metrix competition ID |
| `rounds[].venue` | Display name. This site maps the Metrix course to its own course pages, so this is informational |
| `rounds[].organiser` | The volunteer's name, as already shown on mdgc-sd. `null` if not yet assigned |
| `rounds[].meetingPoint` | Free text, or `null` |
| `rounds[].cancelled` | `true` if the round won't go ahead |
| `rounds[].notes` | Public free text, or `null` |
| `prizes.status` | `pending` (not yet published), `published`, or `overridden` (published, then manually corrected) |
| `prizes.publishedAt` | When the current winners were published; `null` while pending |
| `winners[].prize` | Display label |
| `winners[].type` | `handicap` or `ctb`, so this site doesn't have to parse the label |
| `winners[].divisions` | Division letters the prize covers |
| `winners[].name` | As shown on Metrix |
| `winners[].metrixUserId` | Lets this site link a winner to their results without matching names. `null` if unknown |
| `winners[].detail` | Display text |
| `prizes.notes` | Public explanations, such as a prize passing to the next player |

### Club Champs rules

`GET https://mdgc-sd.vercel.app/data/v1/club-champs/{year}.json`

```json
{
  "version": 1,
  "generatedAt": "2026-10-22T05:00:00Z",
  "eventDate": "2026-11-22",
  "qualifyingSeasonMetrixId": "3647062",
  "fieldSize": 80,
  "minimumRounds": 3,
  "countingRounds": 8,
  "places": { "A": 24, "B": 20, "C": 14, "D": 14, "Female": 8 },
  "finalsPlaces": { "A": 12, "B": 10, "C": 7, "D": 7, "Female": 4 },
  "femalePlayers": [{ "metrixUserId": "100003" }],
  "femaleMinimumRoundsExemptions": [{ "metrixUserId": "100003" }],
  "membershipOverrides": [{ "metrixUserId": "100004", "member": true }],
  "divisionOverrides": [{ "metrixUserId": "100005", "division": "D" }]
}
```

This site works out the ladder itself, from the Metrix season ladder, each round's divisions, and these rules.

## Open questions

- **Female players list.** It identifies individual players. Are they happy for it to be public? If not, this site keeps linking to mdgc-sd's ladder instead.
- **Rebuild on publish.** Should publishing prizes trigger an immediate rebuild of this site (a Cloudflare Pages deploy hook), or is the twice-daily sync soon enough?
- **Missing fields.** Is there anything else in mdgc-sd's data that the public pages should show?
- **Earlier seasons.** Can mdgc-sd publish 2026 Season 1 in the same shape?
