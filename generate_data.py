import json
from datetime import datetime
from collections import OrderedDict, defaultdict

with open('tomorrowland_tl26th_w1.json', 'r') as f:
    data = json.load(f)

stage_map = OrderedDict([
    ('MAINSTAGE', 'main'),
    ('FREEDOM BY BUDWEISER', 'freedom'),
    ('CORE', 'core'),
    ('PAPILLON', 'papillon'),
    ('CODEX', 'codex'),
    ('MOOSE BAR', 'moose'),
    ('CRYSTAL GARDEN BY ANKER', 'crystal'),
])

stage_short = {
    'main': 'MAIN',
    'freedom': 'FREEDOM',
    'core': 'CORE',
    'papillon': 'PAPILLON',
    'codex': 'CODEX',
    'moose': 'MOOSE',
    'crystal': 'CRYSTAL',
}

day_map = {
    '2026-12-11': 'd1',
    '2026-12-12': 'd2',
    '2026-12-13': 'd3',
}


def wrap_min(m):
    if m < 12 * 60:
        m += 24 * 60
    return m


groups = defaultdict(list)
for p in data['performances']:
    st = datetime.fromisoformat(p['startTime'])
    et = datetime.fromisoformat(p['endTime'])
    date = p['date']
    day = day_map[date]
    stage = stage_map[p['stage']['name']]
    sm = st.hour * 60 + st.minute
    em = et.hour * 60 + et.minute
    if et.date() > st.date():
        em += 24 * 60
    sm = wrap_min(sm)
    em = wrap_min(em)
    groups[(day, stage)].append({
        'day': day,
        'stage': stage,
        'start': sm,
        'end': em,
        'name': p['name'],
    })

perfs = []
for (day, stage), items in groups.items():
    items.sort(key=lambda x: x['start'])
    for i, item in enumerate(items):
        item['id'] = '{}-{}-{}'.format(day, stage, i)
        perfs.append(item)

perfs.sort(key=lambda x: (x['day'], x['stage'], x['start']))

# Build performance name -> first available artist image URL mapping.
img_map = {}
for p in data['performances']:
    for a in p.get('artists', []):
        if a.get('image'):
            img_map[p['name']] = a['image']
            break
img_sorted = dict(sorted(img_map.items()))


def esc(s):
    return s.replace("'", "\\'")


lines = []
lines.append('// Tomorrowland Thailand 2026 — Week 1 lineup data.')
lines.append('// Generated from official artist-lineup JSON.')
lines.append('')
lines.append("export type StageId = 'main' | 'freedom' | 'core' | 'papillon' | 'codex' | 'moose' | 'crystal';")
lines.append("export type DayId = 'd1' | 'd2' | 'd3';")
lines.append("export type Status = 'must' | 'maybe' | 'none';")
lines.append('')
lines.append('export interface Stage { id: StageId; name: string; short: string }')
lines.append('export interface Day { id: DayId; dow: string; full: string; cap: string; d: string; date: string }')
lines.append('export interface Perf { id: string; day: DayId; stage: StageId; start: number; end: number; name: string }')
lines.append('')
lines.append("export const FESTIVAL = 'TOMORROWLAND THAILAND 2026';")
lines.append("export const SITE = 'tt.h1rose.com';")
lines.append('')
lines.append('export const STAGES: Stage[] = [')
for orig, sid in stage_map.items():
    lines.append("  {{ id: '{}', name: '{}', short: '{}' }},".format(sid, orig, stage_short[sid]))
lines.append('];')
lines.append('')
lines.append('export const DAYS: Day[] = [')
lines.append("  { id: 'd1', dow: 'FRI', full: 'FRIDAY', cap: 'Friday', d: '11', date: '11.12.2026' },")
lines.append("  { id: 'd2', dow: 'SAT', full: 'SATURDAY', cap: 'Saturday', d: '12', date: '12.12.2026' },")
lines.append("  { id: 'd3', dow: 'SUN', full: 'SUNDAY', cap: 'Sunday', d: '13', date: '13.12.2026' },")
lines.append('];')
lines.append('')
lines.append('/** Official artist photos from the Tomorrowland lineup API. */')
lines.append('export const IMG: Record<string, string> = {')
for name, url in img_sorted.items():
    lines.append("  '{}': '{}',".format(esc(name), url))
lines.append('};')
lines.append('')
lines.append('/** Grid start (13:00) in minutes, px per minute in the timetable grid, px per minute in My Plan. */')
lines.append('export const S0 = 780;')
lines.append('export const PX = 1.4;')
lines.append('export const K = 1.15;')
lines.append('export const GRID_H = 720 * PX;')
lines.append('')
lines.append("export const tm = (t: number) => Math.floor(t / 100) * 60 + (t % 100);")
lines.append("export const fm = (m: number) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');")
lines.append("export const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : `${m}分`);")
lines.append('')
lines.append('export const PERFS: Perf[] = [')
for p in perfs:
    lines.append("  {{ id: '{}', day: '{}', stage: '{}', start: {}, end: {}, name: '{}' }},".format(
        p['id'], p['day'], p['stage'], p['start'], p['end'], esc(p['name'])))
lines.append('];')
lines.append('')
lines.append('export const BY: Record<string, Perf> = Object.fromEntries(PERFS.map((p) => [p.id, p]));')
lines.append('export const ST = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<StageId, Stage>;')
lines.append('export const DY = Object.fromEntries(DAYS.map((d) => [d.id, d])) as Record<DayId, Day>;')
lines.append('')
lines.append("export const GLY: Record<Status, string> = { must: '●', maybe: '○', none: '' };")
lines.append("export const NEXT: Record<Status, Status> = { none: 'must', must: 'maybe', maybe: 'none' };")
lines.append('')
lines.append('export const SEED: Record<string, Exclude<Status, \'none\'>> = {')
lines.append('};')
lines.append('')
lines.append('export interface Device { id: string; label: string; w: number; h: number }')
lines.append('export const DEVICES: Device[] = [')
lines.append("  { id: 'and', label: 'Android 1080×2400', w: 1080, h: 2400 },")
lines.append("  { id: 'ip16', label: 'iPhone 16 1179×2556', w: 1179, h: 2556 },")
lines.append("  { id: 'ip16pm', label: 'iPhone 16 Pro Max 1320×2868', w: 1320, h: 2868 },")
lines.append("  { id: 'px9', label: 'Pixel 9 1080×2424', w: 1080, h: 2424 },")
lines.append('];')

with open('src/lib/data.ts', 'w') as f:
    f.write('\n'.join(lines) + '\n')

print('Wrote src/lib/data.ts')
print('Total perfs:', len(perfs))
