import '@analogjs/vitest-angular/setup-zone';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// Initializes Angular's TestBed once per worker. Defaults to zoneless change
// detection — the OloType component uses signals + OnPush so this matches
// production behavior without dragging in a full zone.js + zone.js/testing
// init that has to be carefully ordered against vite's module graph.
setupTestBed();
