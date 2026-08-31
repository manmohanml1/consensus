# CQ-106: PWA installability and responsive acceptance

**Milestone:** 0.2.1  
**Type:** feature  
**Depends on:** CQ-105
**GitHub:** [#8](https://github.com/manmohanml1/consensus/issues/8)

Finish the installable mobile shell and collect release evidence at the supported phone, tablet, and desktop widths.

## Scope

- web app manifest, install icons, theme/background colors, and standalone display behavior;
- safe-area and browser-chrome behavior on iOS Safari and Android Chromium;
- 320, 390, 768, 1024, and 1440 CSS-pixel overflow and key-action checks;
- 200% zoom, keyboard, screen-reader labels, and reduced-motion verification;
- a documented manual device-test checklist and screenshots.

**Done when:** install metadata validates, the core flow works without gesture-only controls at every target width, automated checks pass, manual device findings are recorded, and remaining polish is split into linked follow-up issues.

## Implementation status

Manifest metadata, generated 192px/512px icons, standalone/mobile metadata, safe-area layout support, supported-width browser checks, and the manual device runbook are present on `main`, including the installable shell merged in PR #9. HTTPS home-screen installation and physical iOS/Android checks remain Preview acceptance tasks.
