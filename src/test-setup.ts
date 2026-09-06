import { loadCityTail } from '@/engine/city-table'

/**
 * Tests assert the steady state: the whole city table. The window before the
 * tail arrives is covered in `src/engine/city-table.test.ts`.
 */
await loadCityTail()
