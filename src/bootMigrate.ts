// Lore-first round, item 3: upgrade every stored profile before any module reads one (main.ts imports this first).
import { migrateDevice } from './profiles';
migrateDevice();
