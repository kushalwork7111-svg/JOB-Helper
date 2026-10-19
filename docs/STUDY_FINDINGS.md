# What we found in real proposals (October 2026)

27 recent DVCS proposal decks (584 slides) were measured automatically for formatting only. The files were read in a temporary workspace and never stored in this repository. This page holds **counts only**: no client names, figures or slide text.

## The most common problems

| # | Problem | How often | What the add-in does |
|---|---|---|---|
| 1 | **Deck not built on the BDO 2023 template.** Text that follows the theme then shows in Aptos or Calibri, not Trebuchet MS. | 20 of 27 decks (12 on the plain "Office Theme") | Brand check names the off-brand fonts; **Fix all** / **Change fonts** set Trebuchet MS |
| 2 | **Titles in mixed case.** Of 263 titles, 102 are ALL CAPS, 81 Title Case and only 79 sentence case (the BDO standard). | 26 of 27 decks | **Unify titles** converts to sentence case, keeping acronyms (BDO, PMI, EBITDA, FY26…) |
| 3 | **Titles drift.** 42% of content-slide titles sit somewhere other than the deck's own usual spot. Title sizes range from 16 to 37 pt, and 47 titles are bold. | every deck | **Unify titles** sets the template position, 26 pt, not bold |
| 4 | **Wrong reds.** Titles in Office "Red" #FF0000 instead of BDO red #E81A3B (42 content titles). The previous identity's red #ED1A3B / #EC1A3A appears 172 times. Office dark red #C00000 333 times, navy #002060 209 times. | most decks | **Snap colours** maps them to the nearest BDO colour |
| 5 | **Empty text boxes** left on slides | 1,771 boxes in 20 decks | **Remove empty text boxes** (lists them, deletes only after you confirm) |
| 6 | **Shapes hanging off the slide** | 308 shapes in 23 decks | Flagged in Brand check |
| 7 | **Double spaces** inside text | 318 boxes in 24 decks | **Tidy text** fixes them |
| 8 | **Justified paragraphs** (guidelines ask for left-aligned blocks) | 622 paragraphs | **Tidy text** left-aligns them |
| 9 | **Leftover draft text** (XX, TBD, [ ], DRAFT) | 10 of 27 decks | Flagged in Brand check (needs a human to fill in) |
| 10 | **No page numbers.** Only 73 of 584 slides carry a slide-number field. | almost every deck | Reminder in Brand check (Insert → Header & Footer) |
| 11 | **Very small text.** 12% of text is under 9 pt, and 33% under 10 pt. | most decks | Brand check flags text under 9 pt outside the footer band |
| 12 | Hidden slides (2 decks) and speaker notes left in (8 decks) | — | Reminder in Brand check |
| 13 | Mixed currency and unit styles (Cr / crore / Cr., INR / ₹ / Rs., lakh / lac) | across decks | Phase 4 "house terms", once you choose the house style |
| 14 | Slide size not 16:9 widescreen | 2 decks | Not fixable from an add-in. Start from the BDO template |
| 15 | A deck built on another firm's template | 1 deck | Brand check flags its fonts |

## What practice says about sizes

- In each deck, the most common body-text size is **9 to 12 pt** (9 pt is most frequent). The template's default of 16 pt is rarely used in proposals.
- Tables mostly use 13–14 pt.

## Method

Each deck was opened with `python-pptx`, and every text run, title placeholder, shape position, colour and alignment was counted. The analysis scripts stay outside the repo because they ran on confidential files. Only the numbers above were kept.
