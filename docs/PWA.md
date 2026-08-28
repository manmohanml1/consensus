# Progressive web app acceptance

Consensus is mobile-first and installable, but installation is a progressive enhancement. The browser experience remains complete when installation is unavailable or declined.

## Current install boundary

- The app publishes a standards-based manifest, standalone display preference, dark theme/background colors, and 192px/512px generated icons.
- No service worker, offline cache, background sync, push notification, or install-prompt interception is included in milestone 0.2.1.
- HTTPS is required outside localhost for an installable release. The first meaningful install check therefore happens on the approved Preview deployment.
- Room state is local in 0.2.1. Installing the app does not make a room durable or synchronized.

## Manual device checklist

Record device model, operating-system version, browser version, commit SHA, URL, and result for each run.

### iOS Safari

1. Open the HTTPS Preview in Safari.
2. Use Share → Add to Home Screen and confirm the Consensus name/icon.
3. Launch from the home screen and confirm standalone presentation, safe-area spacing, readable status-bar contrast, and no clipped action controls.
4. Complete setup, candidate review, at least one ballot choice, undo, and result navigation.
5. Repeat with increased text size and Reduce Motion enabled.

### Android Chromium

1. Open the HTTPS Preview and use the browser’s install action when offered.
2. Confirm the Consensus name/icon and standalone launch.
3. Rotate once to ensure the portrait preference degrades safely rather than clipping content.
4. Complete the same critical decision path with gesture controls and then with buttons only.
5. Enable system animation reduction and repeat the card transition.

### Tablet and desktop

Check 768px, 1024px, and 1440px layouts, keyboard-only completion, visible focus, 200% browser zoom, and pointer-based drag. Installation is optional; a normal tab must retain all capabilities.

## Evidence record

Attach phone and desktop screenshots to the implementing pull request. Record failures as GitHub issues with reproduction steps, viewport/device, expected behavior, actual behavior, and severity. Release-critical failures block Preview acceptance.

## Deferred capabilities

Offline caching needs an explicit data freshness and service-worker recovery design because stale venue or room data can mislead a group. Push notifications require durable subscriptions, consent, expiration, abuse controls, and server-side storage. Both remain out of scope until their roadmap value and privacy costs are validated.
