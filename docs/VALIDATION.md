# Delivery verification

Verified September 20, 2026 on Windows with Node 24.20.0, pnpm 12.5.1, and installed Google Chrome.

| Check | Result | Scope |
| --- | --- | --- |
| `pnpm test` | 24 passed | Terrain/spawns, movement, action costs, facing, elevation, line of sight, charging, friendly fire, revival, inventory, status duration, AI legality, saves, gear, secondary jobs, CT forecasts, and campaign completion |
| `pnpm test:e2e` | 10 passed | Actual visible browser controls and touch/keyboard interactions |
| `pnpm build` | Passed | Strict TypeScript check and Vite production bundle |
| Production preview | Passed | Compiled assets, native WebGPU, complete scene, enabled controls, keyboard movement, no console errors |
| Native WebGPU | Passed | Actual initialized backend reported WebGPU; screenshot visually reviewed |
| Forced WebGL2 | Passed | Actual WebGL2 backend; scene and legal movement through UI |
| Forced WebGL1 | Passed | Actual WebGL1 context using isolated r162 renderer; scene and legal movement through UI |

## Gameplay evidence

The engine’s complete-campaign test plays all five encounters through legal moves, abilities, item use, CT advancement, and enemy decisions. It earns XP/JP and rewards, purchases upgrades using earned crowns, trains by replaying the opening encounter when needed, and reaches `finished: true` with all five chapters cleared. No enemy health or victory flags are altered in that test. Defeats remain defeats; training and retries use the same public game rules.

The browser walkthrough separately plays the entire opening battle by clicking the real Move, ability, target, facing, and confirmation controls, then claims rewards and verifies the next chapter, money, and level progression. Other browser tests render all five authored scenes and verify the final reward/ending flow from an imported, validated victory fixture. This distinguishes a full engine campaign from the full opening browser battle and ending integration test.

## Browser coverage

1. Native WebGPU, job/secondary changes, learning, equipment/charm purchase, and reload persistence.
2. 393 × 852 touch viewport, grid movement, undo, Rally targeting, and an active-turn save/resume.
3. WebGL2 fallback scene and movement.
4. WebGL1 fallback scene and movement.
5. Full opening battle, victory, reward claim, and chapter unlock through visible controls.
6. Defeat, retry with original supplies, and retreat without unearned rewards.
7. Invalid-save recovery, field guide, and difficulty settings.
8. All five scenes, travel, validated save import, final ending, reward claim, and save export.
9. 852 × 393 landscape touch layout without document overflow.
10. Keyboard movement and facing while focus starts on a navigation control.

Both phone orientations retain the battlefield and a separate scrollable command panel. Nameplates avoid one another and do not intercept movement selection. The final visual review includes the town, river, mobile layouts, fallback screenshots, and production bundle.

The Samsung S26 and RTX 4070 Super are design targets. The tests use browser viewport/touch emulation and the available machine’s graphics adapter; they do not establish a measured frame-rate guarantee on those exact physical devices.

Screenshots are in [screenshots/](screenshots/). Playwright generates additional screenshots and traces locally under the ignored `test-results/` and `playwright-report/` directories; CI uploads its own verification artifacts.
