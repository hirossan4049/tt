// Lineup + schedule data. Set times, dates and stage names are placeholder data
// carried over from the design handoff (Timetable Planner v3).

export type StageId = 'main' | 'freedom' | 'core' | 'atmos' | 'elixir';
export type DayId = 'd1' | 'd2' | 'd3';
export type Status = 'must' | 'maybe' | 'none';

export interface Stage { id: StageId; name: string; short: string }
export interface Day { id: DayId; dow: string; full: string; cap: string; d: string; date: string }
export interface Perf { id: string; day: DayId; stage: StageId; start: number; end: number; name: string }

export const FESTIVAL = 'TOMORROWLAND THAILAND 2026';
export const SITE = 'tt.h1rose.com';

export const STAGES: Stage[] = [
  { id: 'main', name: 'MAINSTAGE', short: 'MAIN' },
  { id: 'freedom', name: 'FREEDOM', short: 'FREEDOM' },
  { id: 'core', name: 'CORE', short: 'CORE' },
  { id: 'atmos', name: 'ATMOSPHERE', short: 'ATMOS' },
  { id: 'elixir', name: 'ELIXIR', short: 'ELIXIR' },
];

export const DAYS: Day[] = [
  { id: 'd1', dow: 'FRI', full: 'FRIDAY', cap: 'Friday', d: '11', date: '11.12.2026' },
  { id: 'd2', dow: 'SAT', full: 'SATURDAY', cap: 'Saturday', d: '12', date: '12.12.2026' },
  { id: 'd3', dow: 'SUN', full: 'SUNDAY', cap: 'Sunday', d: '13', date: '13.12.2026' },
];

type Slot = [number, number, string];
const D1: Record<StageId, Slot[]> = {
  main: [[1600, 1715, 'KSHMR'], [1715, 1830, 'Steve Aoki'], [1830, 1950, 'Afrojack'], [1950, 2120, 'Armin van Buuren'], [2120, 2250, 'Dimitri Vegas & Like Mike'], [2250, 2350, 'Alan Walker'], [2350, 2450, 'Martin Garrix'], [2450, 2600, 'Hardwell']],
  freedom: [[1600, 1730, 'Mattn'], [1730, 1900, 'NERVO'], [1900, 2030, 'Boris Brejcha'], [2030, 2145, 'Charlotte de Witte'], [2145, 2245, 'Vini Vici'], [2245, 2400, 'Amelie Lens'], [2400, 2600, 'Adam Beyer']],
  core: [[1600, 1800, 'Mochakk'], [1800, 2000, 'Kölsch'], [2000, 2200, 'Tale Of Us'], [2200, 2400, 'Anyma'], [2400, 2600, 'Solomun']],
  atmos: [[1700, 1830, 'Joris Voorn'], [1830, 2000, 'Paul Kalkbrenner'], [2000, 2130, 'Reinier Zonneveld'], [2130, 2300, 'I Hate Models'], [2300, 2430, 'Sara Landry'], [2430, 2600, 'Indira Paganotto']],
  elixir: [[1600, 1730, 'Yotto'], [1730, 1900, 'Ben Böhmer'], [1900, 2030, 'Lane 8'], [2030, 2200, 'Massano'], [2200, 2330, 'Argy'], [2330, 2500, 'Agents Of Time']],
};

/** Wikipedia article titles used to look up CC/PD artist photos on Wikimedia Commons. */
export const WIKI: Record<string, string> = {
  'Martin Garrix': 'Martin_Garrix', 'Alan Walker': 'Alan_Walker_(music_producer)', 'Vini Vici': 'Vini_Vici', 'Armin van Buuren': 'Armin_van_Buuren',
  Hardwell: 'Hardwell', Afrojack: 'Afrojack', 'Steve Aoki': 'Steve_Aoki', KSHMR: 'KSHMR', 'Dimitri Vegas & Like Mike': 'Dimitri_Vegas_&_Like_Mike',
  NERVO: 'Nervo_(duo)', 'Boris Brejcha': 'Boris_Brejcha', 'Charlotte de Witte': 'Charlotte_de_Witte', 'Amelie Lens': 'Amelie_Lens', 'Adam Beyer': 'Adam_Beyer',
  'Kölsch': 'Kölsch_(musician)', 'Tale Of Us': 'Tale_of_Us', Anyma: 'Anyma_(musician)', Solomun: 'Solomun', 'Joris Voorn': 'Joris_Voorn',
  'Paul Kalkbrenner': 'Paul_Kalkbrenner', 'Reinier Zonneveld': 'Reinier_Zonneveld', 'Ben Böhmer': 'Ben_Böhmer', 'Lane 8': 'Lane_8',
  'Indira Paganotto': 'Indira_Paganotto', 'Sara Landry': 'Sara_Landry',
};

/** Grid start (16:00) in minutes, px per minute in the timetable grid, px per minute in My Plan. */
export const S0 = 960;
export const PX = 1.4;
export const K = 1.15;
export const GRID_H = 600 * PX;

export const tm = (t: number) => Math.floor(t / 100) * 60 + (t % 100);
export const fm = (m: number) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
export const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : `${m}分`);

export const PERFS: Perf[] = (() => {
  const pool: string[] = [];
  STAGES.forEach((s) => D1[s.id].forEach((x) => pool.push(x[2])));
  const out: Perf[] = [];
  DAYS.forEach((d, di) => {
    let k = 0;
    STAGES.forEach((s) =>
      D1[s.id].forEach((x, i) => {
        const name = di === 0 ? x[2] : pool[(k + di * 11) % pool.length];
        k++;
        out.push({ id: `${d.id}-${s.id}-${i}`, day: d.id, stage: s.id, start: tm(x[0]), end: tm(x[1]), name });
      }),
    );
  });
  return out;
})();

export const BY: Record<string, Perf> = Object.fromEntries(PERFS.map((p) => [p.id, p]));
export const ST = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<StageId, Stage>;
export const DY = Object.fromEntries(DAYS.map((d) => [d.id, d])) as Record<DayId, Day>;

export const GLY: Record<Status, string> = { must: '●', maybe: '○', none: '' };
export const NEXT: Record<Status, Status> = { none: 'must', must: 'maybe', maybe: 'none' };

export const SEED: Record<string, Exclude<Status, 'none'>> = {
  'd1-main-3': 'must', 'd1-freedom-3': 'must', 'd1-freedom-4': 'must', 'd1-main-5': 'must', 'd1-main-6': 'must',
  'd1-freedom-5': 'maybe', 'd1-core-3': 'maybe', 'd1-elixir-2': 'maybe', 'd2-core-2': 'must', 'd2-main-4': 'maybe',
};

export interface Device { id: string; label: string; w: number; h: number }
export const DEVICES: Device[] = [
  { id: 'and', label: 'Android 1080×2400', w: 1080, h: 2400 },
  { id: 'ip16', label: 'iPhone 16 1179×2556', w: 1179, h: 2556 },
  { id: 'ip16pm', label: 'iPhone 16 Pro Max 1320×2868', w: 1320, h: 2868 },
  { id: 'px9', label: 'Pixel 9 1080×2424', w: 1080, h: 2424 },
];
