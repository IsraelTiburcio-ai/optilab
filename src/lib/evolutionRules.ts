import type {Game} from '../data';
import type {EvolutionStage} from '../data/companions';

export type UnlockStage = 2 | 3;
export interface EvolutionRule {stage: UnlockStage; uniqueGames:number; distinctGyms:number}
/** Add a version and change CURRENT_RULE_VERSION for future thresholds; keep old versions. */
export const EVOLUTION_RULE_SETS: Readonly<Record<number,readonly EvolutionRule[]>> = {
  1:[{stage:2,uniqueGames:6,distinctGyms:2},{stage:3,uniqueGames:18,distinctGyms:4}],
};
export const CURRENT_RULE_VERSION = 1;
export const EVOLUTION_RULES = EVOLUTION_RULE_SETS[CURRENT_RULE_VERSION];
export interface PracticeEvidence {gameId: string; practicedAt: string}
export interface EvolutionMilestone {stage: UnlockStage; ruleVersion:number; unlockedAt: string; practice: PracticeEvidence[]}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function validPracticeDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,19) === value.slice(0,19);
}
export function practiceEvidence(practiced: unknown, catalog: readonly Game[]): PracticeEvidence[] {
  if (!object(practiced)) return [];
  return catalog.filter(g => validPracticeDate(practiced[g.repo])).map(g => ({gameId:g.repo, practicedAt:practiced[g.repo] as string}));
}
export function practiceMetrics(practice: readonly PracticeEvidence[], catalog: readonly Game[]) {
  const ids = new Set(practice.map(p => p.gameId));
  const known = catalog.filter(g => ids.has(g.repo));
  return {uniqueGames: known.length, distinctGyms:new Set(known.map(g => g.gimnasio)).size};
}
const eligible = (practice: readonly PracticeEvidence[], stage: UnlockStage, catalog: readonly Game[], version = CURRENT_RULE_VERSION) => {
  const rule = EVOLUTION_RULE_SETS[version]?.find(r => r.stage === stage);
  if (!rule) return false;
  const metrics = practiceMetrics(practice, catalog);
  return metrics.uniqueGames >= rule.uniqueGames && metrics.distinctGyms >= rule.distinctGyms;
};
export function parseMilestones(value: unknown, catalog: readonly Game[]): EvolutionMilestone[] {
  if (!Array.isArray(value)) return [];
  const valid = new Map<UnlockStage, EvolutionMilestone>();
  for (const milestone of value) {
    if (!object(milestone) || (milestone.stage !== 2 && milestone.stage !== 3) || typeof milestone.ruleVersion !== 'number' || !Number.isSafeInteger(milestone.ruleVersion) || !EVOLUTION_RULE_SETS[milestone.ruleVersion] || !validPracticeDate(milestone.unlockedAt) ||
        !Array.isArray(milestone.practice) || milestone.practice.length > catalog.length) continue;
    const entries = milestone.practice;
    if (!entries.every(p => object(p) && typeof p.gameId === 'string' && catalog.some(g => g.repo === p.gameId) && validPracticeDate(p.practicedAt))) continue;
    if (new Set(entries.map(p => p.gameId)).size !== entries.length || !eligible(entries as PracticeEvidence[], milestone.stage, catalog,milestone.ruleVersion)) continue;
    valid.set(milestone.stage, {stage:milestone.stage,ruleVersion:milestone.ruleVersion,unlockedAt:milestone.unlockedAt,practice:entries.map(p=>({gameId:p.gameId as string,practicedAt:p.practicedAt as string}))});
  }
  // A valid final milestone also contains the evidence for its preceding stage.
  const final = valid.get(3);
  if (final && !valid.has(2) && eligible(final.practice,2,catalog,final.ruleVersion)) valid.set(2, {...final,stage:2});
  return [...valid.values()].sort((a,b)=>a.stage-b.stage);
}
export function reconcileMilestones(practiced: unknown, previous: unknown, catalog: readonly Game[], now = new Date().toISOString()) {
  const milestones = parseMilestones(previous, catalog);
  const evidence = practiceEvidence(practiced, catalog);
  if (!validPracticeDate(now)) return milestones;
  for (const rule of EVOLUTION_RULES) if (!milestones.some(m => m.stage === rule.stage) && eligible(evidence, rule.stage, catalog)) {
    milestones.push({stage:rule.stage,ruleVersion:CURRENT_RULE_VERSION,unlockedAt:now,practice:evidence.map(p=>({...p}))});
  }
  return milestones.sort((a,b)=>a.stage-b.stage);
}
export function evolutionProgress(practiced: unknown, milestones: readonly EvolutionMilestone[], catalog: readonly Game[]) {
  const stage: EvolutionStage = milestones.some(m=>m.stage===3) ? 3 : milestones.some(m=>m.stage===2) ? 2 : 1;
  const metrics = practiceMetrics(practiceEvidence(practiced,catalog),catalog);
  return {stage, ...metrics, nextRule:EVOLUTION_RULES.find(r=>r.stage===stage+1) || null};
}
