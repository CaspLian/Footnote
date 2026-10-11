# Figma critique before implementation

**Gate: confirmed pass.** The independent reviewer verified all four corrections against recaptured screenshots and the live editable Figma canvas before Expo implementation began. This gate covers the design design, not native runtime behavior.

The complete editable English flow and recovery states were built before app code. An independent reviewer accepted the palette, typography, evidence hierarchy and scrolling composition, and required four corrections.

- Billing correction now has a selected state; insurer review opens its own draft with explicit no-denial sample language.
- Empty intake offers manual entry; documents-added intake offers verification.
- Verification uses Statement balance and After bill adjustments, with the original bill totals alongside the fields.
- Narration and glossary rows have at least 48px hit regions. Narration has a linked play/stop design state.

Live verification confirmed the corrected amount labels, insurer draft linkage, 48px glossary/narration containers and narration state linkage. The recorded canvas evidence is in `design/critique-fix-audit.json`.

Figma has no flattened screen images. All screens use editable text, source excerpts, component instances, token-bound colors and auto layout. Main flow and Spanish entry/review are linked. Native implementation and runtime verification are a separate pass; their evidence will be added by the coordinating implementation agent.

## Personal / family revision
The new editable mobile + desktop flow uses proportional Geist only, warm paper surfaces and useful whitespace. Paper elevation, inset evidence and compact text actions replace the repeated full-width button/card pattern. Onboarding gathers local region/coverage/explanation context, profiles cover dependents, and the processing view describes local work truthfully. Welcome, Home and desktop Review composition captures were inspected; no clipping or overlap, all text is Geist, and no flattened UI images exist. Primary teal was corrected at the reusable component.
