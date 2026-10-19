"""Build a synthetic messy deck for testing the add-in: tests/decks/messy.pptx.

No client content: every slide is made-up text. The planted problems mirror the most common issues
found when measuring real proposals (see docs/STUDY_FINDINGS.md).
Run: python3 tests/make_test_deck.py   (needs: pip install python-pptx)
"""
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Pt

OUT = Path(__file__).parent / "decks" / "messy.pptx"


def box(slide, left, top, width, height, text, size, font="Trebuchet MS", color=None, bold=False, align=None):
    tb = slide.shapes.add_textbox(Pt(left), Pt(top), Pt(width), Pt(height))
    p = tb.text_frame.paragraphs[0]
    run = p.add_run()
    run.text = text
    run.font.size, run.font.name, run.font.bold = Pt(size), font, bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if align:
        p.alignment = align
    return tb


def main():
    prs = Presentation()
    prs.slide_width, prs.slide_height = Pt(960), Pt(540)
    blank = prs.slide_layouts[6]
    title_only = prs.slide_layouts[5]

    # 1. Reference slide: title placeholder, near the standard spot.
    s = prs.slides.add_slide(title_only)
    s.shapes.title.text = "Executive summary"
    box(s, 38, 135, 884, 300, "Sample body text at the brand size.", 12)

    # 2. ALL CAPS, bold, Office red title off position; Aptos body (deck not on the BDO theme).
    s = prs.slides.add_slide(blank)
    box(s, 60, 30, 700, 44, "OUR UNDERSTANDING OF THE PMI SCOPE", 22, color="FF0000", bold=True)
    box(s, 38, 135, 884, 200, "Body text in Aptos at 11 pt.", 11, font="Aptos")

    # 3. Previous-identity red, Office navy, justified paragraph, double spaces, tiny text.
    s = prs.slides.add_slide(blank)
    box(s, 38, 47, 884, 28, "Approach And Methodology", 26, color="ED1A3B")
    box(s, 38, 135, 420, 200, "Phase 1  covers diagnostics and the  day-one plan.", 12, color="002060", align=PP_ALIGN.JUSTIFY)
    box(s, 480, 135, 420, 200, "Body at 14 pt.", 14)
    box(s, 38, 380, 420, 30, "Tiny 7 pt note in the middle of the slide.", 7)

    # 4. Empty text box, a box running off the slide, leftover draft text, and a source line.
    s = prs.slides.add_slide(blank)
    box(s, 38, 47, 884, 28, "Commercials", 26, color="E81A3B")
    box(s, 38, 135, 300, 100, "", 12)
    box(s, 800, 200, 300, 100, "This box runs off the right edge.", 12)
    box(s, 38, 260, 600, 40, "Professional fee: INR XX lakh, start date TBD", 12)
    box(s, 38, 515, 600, 20, "Source: synthetic test data", 8)

    # 5. No title at all.
    s = prs.slides.add_slide(blank)
    box(s, 38, 300, 884, 60, "Only body text, low on the slide.", 12)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT)
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
