# Frontend Verification Checklist — Alumni Atlas (DA3)

**Component Ownership:** Person 01 / Sagarika Kaistha — Frontend Experience  
**Branch:** `da3-frontend`  
**Target Repository:** `alumni-atlas-my-work`

This document records the manual and functional verification of the user-facing website, presentation quality, interactive states, and alignment with the confirmed API contract.

---

## 1. Page Structure & Navigation

- [x] **Header & Branding:** Logo displays "a. Alumni Vector" with correct styling and link.
- [x] **Network Connection Badge:** Shows `● Connected` when live backend is accessible; falls back to `○ Unavailable` when offline.
- [x] **Primary Navigation:** "How it works" smooth scrolls to explanation; "Browse all alumni" toggles full browse mode.
- [x] **Network Art Constellation:** Animated orbital visualization with interactive category satellites ("Alumni", "Mentoring", "Your next job").
- [x] **Motion Controls:** "Pause animation" / "Play animation" toggle updates `aria-pressed` and respects `prefers-reduced-motion`.

---

## 2. Discovery & Search Form

- [x] **Mode Tabs:** Switching between `Alumni`, `Mentoring`, and `Jobs` updates input placeholder, art accent, and filter parameters.
- [x] **Natural-Language Input:** Supports everyday language goals (e.g. *"someone who can help with my machine learning project"*).
- [x] **Quick Examples:** Preset example queries ("Alumni in AI", "Portfolio mentoring", "Cloud internships") populate the search field and initiate search.
- [x] **Filter Drawer:** "Add filters" reveals exact dropdown filters for:
  - Record type (`kind`)
  - Department (dynamically loaded from `/api/facets`)
  - Skill (dynamically loaded from `/api/facets`)
  - Location (dynamically loaded from `/api/facets`)
  - Data source (`synthetic` boolean: All / Non-synthetic / Synthetic demo)
- [x] **Clear Filters:** Resets all filter dropdowns cleanly.

---

## 3. Live Search & Browse States

- [x] **Loading State:**
  - Submit button shows "Searching…" with animated spinner.
  - Results container sets `aria-busy="true"`.
  - Status indicator displays "Finding connections…".
  - "Show 5 more" displays "Loading…" when fetching paginated records.
- [x] **Empty Results State:**
  - Clean card with `welcome-symbol` ("◎") and descriptive text: *"No matches found. Try a broader description, different keywords, or clear some filters."*
  - Footnote explanation is hidden when zero results are found.
  - Heading updates to "Best matches" and announces 0 results.
- [x] **Error State:**
  - Dedicated `#error` banner is shown with the exact backend/network message.
  - Status indicator displays *"Search could not complete."*
  - Old results are cleared so users aren't confused by stale data.
- [x] **No-Connection / Offline State:**
  - Header badge switches to `○ Unavailable` without crashing the page.
  - Network summary displays `"Service unavailable"` instead of getting stuck on `"Loading network…"`.
  - Network error message appears in the notice banner (`#notice`) with a user-friendly instruction to verify the backend server.

---

## 4. Result Cards & Ranking

- [x] **Result Cap:** Returns at most 5 results per page in adherence with the system design.
- [x] **Relevance Ranks:** Displays rank numbers (`01`, `02`, `03`...) for search matches, or `↗` for general browsing.
- [x] **Provenance Transparency:** Every card explicitly labels record origin:
  - `"Demo"` badge for synthetic records (`synthetic: true`).
  - `"Original record"` badge for migrated records (`neo4j-migration`).
  - No simulated AI match percentages or fake scores are shown.
- [x] **Tag List:** Displays up to 5 skill tags, uppercase department tag, and location tag.
- [x] **View Details Action:** Opens accessible `<dialog id="details">` modal for the specific record.

---

## 5. Details Modal & Navigation

- [x] **Record Header:** Displays kind and provenance eyebrow, full title, and complete description.
- [x] **Full Tags:** Displays all skills, department, and location.
- [x] **Related Action Button:** Provides 1-click discovery:
  - Jobs: *"Find alumni with these skills ↗"*
  - Alumni: *"Find related opportunities ↗"*
- [x] **Connected Records:** If relationships exist from the source dataset, lists directional connection links (`←` / `→`) that load the related record in place.
- [x] **Original Graph Data:** Expandable `<details>` accordion displaying raw `source_properties` JSON for migrated records.
- [x] **Modal Accessibility:** Backdrop blur, click-outside to close, Escape key support, close button (`×`).

---

## 6. Admin Panel & Local Testing

- [x] **Collapsible Admin Drawer:** Kept closed by default with warning about token privacy.
- [x] **Form Validation:** Client-side validation enforcing kind, title (max 160 chars), description (20–4000 chars), and synthetic checkbox.
- [x] **Token Authentication:** Passes Bearer token in `Authorization` header to protected endpoints.

---

## 7. Responsive & Accessibility Testing

- [x] **Desktop (> 1100px):** Two-column intro layout with constellation art side-by-side with intro copy. 3-column filter grid.
- [x] **Tablet (760px - 1100px):** Scaled typography and flexible card grid.
- [x] **Mobile (< 760px):** Single-column stacked layout, full-width inputs, touch-friendly tap targets (min 44px), rank hidden on mobile cards to maximize readability.
- [x] **Reduced Motion:** Fully pauses CSS animations when preferred by the user system or via manual toggle.
