/**
 * Tick-Orchestrierung (M9.3-Ausgliederung aus world.ts): die Reihenfolge der
 * Subsysteme innerhalb eines Sim-Ticks (siehe ARCHITECTURE.md):
 * Unterhalt/Bankrott -> Actions -> Route -> abgeleitete M8-Layer (Netze,
 * Verschmutzung) -> Wachstum -> Demografie/Migration/Ereignisse ->
 * Arbeitszuweisung -> Produktion -> Markt -> Handel.
 * Kein Verhalten: reine Auslagerung, Golden-Master bleibt gleich.
 */
import { applyAction } from './actions';
import { runGrowthTick } from './growth';
import { runDemographicsTick, runMigration, computeMaxDebt } from './demographics';
import { assignWorkers } from './employment';
import { runProductionTick } from './production';
import { updateMarket } from './market';
import { runTradeTick } from './trade';
import { recomputePollution } from './pollution';
import { recomputeSupply } from './networks';
import { runEventTick } from './events';
import { FINANCE } from '../data/cities';
import type { World } from './world';

/** Ein Sim-Tick: Unterhalt für den Bestand, dann Actions, dann Route auswerten. */
export function runWorldTick(world: World): void {
  world.lastRejected = null;
  world.maxDebt = computeMaxDebt(world); // Kreditlimit aktuell halten (Actions!)
  world.treasury -= world.upkeepPerTick; // Bestand zu Tickbeginn, Bautick selbst gratis
  // Bankrott-Prüfung (M7.4): jeder Tick, Kasse unter Grenze -> blockiert Bau
  if (world.treasury < FINANCE.bankruptcyTreasuryLimit) {
    world.bankrupt = true;
  } else if (world.treasury >= 0) {
    world.bankrupt = false;
  }
  let roadsChanged = false;
  let routeDirty = false;
  if (world.queue.length > 0) {
    for (const action of world.queue) {
      applyAction(world, action);
      if (action.kind === 'buildRoad' || action.kind === 'demolishRoad') roadsChanged = true;
      if (action.kind === 'foundCity') {
        world.commuteDirty = true;
        world.supplyDirty = true;
      }
      if (action.kind === 'requestRoute' || action.kind === 'clearRoute') routeDirty = true;
    }
    world.tileRev++;
    world.queue = [];
  }
  if (roadsChanged) {
    world.recomputeUpkeep(); // wirkt ab dem nächsten Tick
    world.commuteDirty = true;
    world.supplyDirty = true;
    world.roadRev++; // Pfad-Cacheinvalidierung nur für Straßen (M9.2)
  }
  if (routeDirty && world.routeRequest !== null) {
    const { from, to } = world.routeRequest;
    world.routeRequest = null;
    if (from < 0 || to < 0) {
      world.route = null;
    } else {
      const result = world.pathfinder.findPath(world.routeContext(), from, to);
      world.route =
        result === null || result.path.length === 0
          ? null
          : { path: result.path, timeTicks: result.timeTicks, rev: world.tileRev };
    }
  }
  // M8.4/M8.3: abgeleitete Layer (Versorgung, Verschmutzung) neu, vor Wachstum
  world.measure('networks', () => {
    if (world.supplyDirty) {
      recomputeSupply(world);
      world.supplyDirty = false;
    }
    if (world.pollutionDirty) {
      recomputePollution(world);
      world.pollutionDirty = false;
    }
  });
  world.measure('growth', () => runGrowthTick(world, world.rng));
  if (world.measure('demographics', () => runDemographicsTick(world, world.rng, world.tick + 1))) { // abschliessender Tick
    runMigration(world, world.rng);
    world.commuteDirty = true;
    runEventTick(world, world.rng); // M8.5: Ereignisse deterministisch im Intervall
  }
  world.syncPopulation();
  // Arbeitsplatz-Zuweisung bei jeder relevanten Änderung (Städte, Gebäude,
  // Bevölkerung, Strassen) – sonst bleibt die letzte Zuweisung stehen.
  if (world.commuteDirty) {
    world.commute = world.measure('employment', () => assignWorkers(world));
    world.commuteDirty = false;
  }
  const flows = world.measure('production', () => runProductionTick(world));
  world.measure('market', () => updateMarket(world, flows));
  world.measure('trade', () => runTradeTick(world));
  world.tick++;
}
