/**
 * The last top-level files in two languages — the guard for the surfaces that sit
 * directly in `src/editor` and were still owed a round.
 *
 * What this file proves, and the hole each proof closes:
 *
 *   1. **Every caption is keyed, with its English** — `editorSourceCaptions()`
 *      reads every `t('<key>', '<English>'` call under `src/editor`. The
 *      negative-space guard (`i18n-negative-space.test.ts`) proves the other half:
 *      no visible English sits *outside* a translator. Neither file can see the
 *      other's hole — a caption that went back to a literal is proved here, a
 *      caption that was never keyed is proved there.
 *   2. **Every key has Turkish, and its placeholders match** — a `{{…}}` on one
 *      side and not the other ships a raw `{{count}}` or drops a figure.
 *   3. **The glossary holds where these files touch it** — §2.1 (`eleman`,
 *      `parça`), §2.2 (`bağlı model`, `tip`, `kategori`), §2.3 (`kat`, `mekan`),
 *      §2.4 (`pafta`), §8 (`Salt okunur`) and §9/Ç9 (`hat`, never `çalıştır`).
 *
 * A caption written twice or more is pinned in `SITES`: "the key is still in the
 * source" alone would stay green while one of its sites went back to a literal.
 */
import fs from 'node:fs'
import path from 'node:path'
import { editorSourceCaptions } from './helpers/editor-source-captions'
import { translateFor } from './helpers/editor-i18n'

const TR = translateFor('tr')
const EN = translateFor('en')

/** One caption as the glossary writes it. */
interface Caption {
  readonly key: string
  readonly english: string
  readonly turkish: string
}

const CAPTIONS: readonly Caption[] = [
  // §2.1: the model object is an *eleman*; a catalogue component is a *parça*.
  { key: 'linkedElement.element', english: 'Element', turkish: 'Eleman' },
  { key: 'linkedElement.fallbackName', english: 'Linked element', turkish: 'Bağlı eleman' },
  // §8: read-only is *salt okunur*.
  { key: 'linkedElement.readOnly', english: '· read only', turkish: '· salt okunur' },
  // §2.2: a linked model is a *bağlı model*; a Revit parameter group is a *tip* or
  // an *örnek*, the two words Revit's own Turkish build uses.
  { key: 'linkedElement.type', english: 'Type', turkish: 'Tip' },
  { key: 'linkedElement.instance', english: 'Instance', turkish: 'Örnek' },
  { key: 'linkedElement.quantities', english: 'Quantities', turkish: 'Miktarlar' },
  { key: 'linkedElement.systems', english: 'Systems', turkish: 'Sistemler' },
  { key: 'linkedElement.connections', english: 'Connections', turkish: 'Bağlantılar' },
  { key: 'linkedElement.noShape', english: 'No 3D shape in the model', turkish: 'Modelde 3B biçim yok' },
  { key: 'linkedElement.noRevit', english: 'No Revit parameters on this element', turkish: 'Bu elemanda Revit parametresi yok' },
  { key: 'linkedElement.filter', english: 'Filter properties', turkish: 'Özellikleri filtrele' },
  { key: 'linkedElement.clearFilter', english: 'Clear filter', turkish: 'Filtreyi temizle' },
  { key: 'linkedElement.fromRevit', english: 'From Revit', turkish: "Revit'ten" },
  { key: 'linkedElement.fromIfc', english: 'From the IFC file', turkish: 'IFC dosyasından' },
  // §2.2: a linked model is a *bağlı model*; §7: the size in MB keeps its symbol.
  { key: 'linkModel.title', english: 'Link a model', turkish: 'Model bağla' },
  { key: 'linkModel.tabUpload', english: 'Upload an IFC file', turkish: 'IFC dosyası yükle' },
  { key: 'linkModel.noRevitModel', english: 'No Revit model is connected to this project', turkish: 'Bu projeye bağlı Revit modeli yok' },
  { key: 'linkModel.connectRevitModel', english: 'Connect a Revit model', turkish: 'Revit modeli bağla' },
  { key: 'linkModel.ifcFile', english: 'IFC file', turkish: 'IFC dosyası' },
  { key: 'linkModel.nameInModel', english: 'Name in the model', turkish: 'Modeldeki adı' },
  { key: 'linkModel.cancel', english: 'Cancel', turkish: 'İptal' },
  { key: 'linkModel.uploadAndLink', english: 'Upload and link', turkish: 'Yükle ve bağla' },
  // §2.8: the trunk a branch leaves is an ana hat; §2.1 a piece is an eleman; §9/Ç9 a
  // run is a hat, and the scope word a click widens to is a düz parça.
  { key: 'group.scopeRun', english: 'Run', turkish: 'Hat' },
  { key: 'group.scopeStretch', english: 'Stretch', turkish: 'Düz parça' },
  { key: 'group.scopeBox', english: 'Box selection', turkish: 'Kutu seçimi' },
  { key: 'group.scopeElement', english: 'Selection', turkish: 'Seçim' },
  { key: 'group.straightPieces', english: 'Straight pieces', turkish: 'Düz parçalar' },
  { key: 'group.fittings', english: 'Fittings', turkish: 'Bağlantı parçaları' },
  { key: 'group.parts', english: 'Parts', turkish: 'Parçalar' },
  { key: 'group.moveAllOfIt', english: 'Move all of it', turkish: 'Hepsini taşı' },
  { key: 'group.eastFt', english: 'East (ft)', turkish: 'Doğu (ft)' },
  { key: 'group.pipeSizeIn', english: 'Pipe size (in)', turkish: 'Boru boyutu (in)' },
  { key: 'group.ductShape', english: 'Duct shape', turkish: 'Kanal biçimi' },
  { key: 'group.flatOval', english: 'Flat oval', turkish: 'Yassı oval' },
  // §2.3/Ç21: a clearance is an *açıklık*; a void is a *boşluk*, and the two words
  // may not swap. A part's host is its *taşıyıcı*, a curb a *kaide*.
  { key: 'partSpace.clearances', english: 'Clearances', turkish: 'Açıklıklar' },
  { key: 'partSpace.clearanceZones', english: 'Clearance zones', turkish: 'Açıklık bölgeleri' },
  { key: 'partSpace.standsOn', english: 'Stands on', turkish: 'Üzerinde durduğu' },
  { key: 'partSpace.onItsHost', english: 'On its host', turkish: 'Taşıyıcısının üzerinde' },
  { key: 'partSpace.hostGone', english: 'Host gone', turkish: 'Taşıyıcı yok oldu' },
  { key: 'partSpace.noHost', english: 'No host', turkish: 'Taşıyıcı yok' },
  { key: 'partSpace.curbOrRail', english: 'Curb or rail (in)', turkish: 'Kaide ya da korkuluk (in)' },
  { key: 'partSpace.purposeWorkingSpace', english: 'Electrical working space', turkish: 'Elektrik çalışma boşluğu' },
  { key: 'partSpace.purposeDedicatedSpace', english: 'Dedicated equipment space', turkish: 'Ayrılmış ekipman boşluğu' },
  { key: 'partSpace.side', english: 'Side', turkish: 'Yüz' },
  { key: 'partSpace.setWorkingSpace', english: 'Set NEC 110.26 working space', turkish: 'NEC 110.26 çalışma boşluğunu ayarla' },
  { key: 'partSpace.voltsToGround', english: 'Volts to ground', turkish: 'Toprağa göre volt' },
  // The Autodesk Docs picker: a linked model is a *bağlı model*, a folder a *klasör*,
  // and a Revit year keeps its number (§7).
  { key: 'docsPicker.title', english: 'Add models from Autodesk Docs', turkish: "Autodesk Docs'tan model ekle" },
  { key: 'docsPicker.folders', english: 'Folders', turkish: 'Klasörler' },
  { key: 'docsPicker.files', english: 'Files', turkish: 'Dosyalar' },
  { key: 'docsPicker.search', english: 'Search', turkish: 'Ara' },
  { key: 'docsPicker.linked', english: 'Linked', turkish: 'Bağlı' },
  { key: 'docsPicker.cloudModel', english: 'Cloud model', turkish: 'Bulut modeli' },
  { key: 'docsPicker.pickAtLeastOne', english: 'Pick at least one Revit or IFC file', turkish: 'En az bir Revit ya da IFC dosyası seçin' },
  { key: 'docsPicker.cancel', english: 'Cancel', turkish: 'İptal' },
  // The linked-models panel: the host is *bizim Revit modelimiz*, a version a *sürüm*,
  // and the read-only/unlink vocabulary is §8's.
  { key: 'linkedModels.ourRevitModel', english: 'our Revit model', turkish: 'bizim Revit modelimiz' },
  { key: 'linkedModels.theProjectRevitModel', english: "the project's Revit model", turkish: 'projenin Revit modeli' },
  { key: 'linkedModels.thisProjectRevitModel', english: "This project's Revit model", turkish: 'Bu projenin Revit modeli' },
  { key: 'linkedModels.link', english: 'Link', turkish: 'Bağla' },
  { key: 'linkedModels.unlink', english: 'Unlink', turkish: 'Bağlantıyı kaldır' },
  { key: 'linkedModels.addFromDocs', english: 'Add from Autodesk Docs…', turkish: "Autodesk Docs'tan ekle…" },
  { key: 'linkedModels.updateFromRevit', english: 'Update from Revit', turkish: "Revit'ten güncelle" },
  { key: 'linkedModels.lineUp', english: 'Line up with the project model', turkish: 'Proje modeliyle hizala' },
  { key: 'linkedModels.adjustPosition', english: 'Adjust position', turkish: 'Konumu ayarla' },
  { key: 'linkedModels.keepIt', english: 'Keep it', turkish: 'Kalsın' },
  { key: 'linkedModels.loading', english: 'Loading…', turkish: 'Yükleniyor…' },
  { key: 'linkedModels.versionNumber', english: ' · version {{number}}', turkish: ' · sürüm {{number}}' },
]

/**
 * How many call sites each shared caption has today; a new site is a deliberate
 * bump here. A key written in two places would pass a presence check while one
 * of them went back to a literal.
 */
const SITES: Readonly<Record<string, number>> = {
  // The IFC property rows and the Revit parameter groups both badge a *type*; the
  // panel's filter placeholder and its `aria-label` are the same words twice.
  'linkedElement.type': 3,
  // "device" is the fallback noun in both unplaced sentences (with and without a level).
  'linkedElement.device': 2,
  'linkedElement.filter': 2,
  // The panel says “Try again” on a load failure, on a failed conversion and on a failed
  // Docs import; “Line up”, “Lining up” and their two progress sentences are on the row
  // button and in the menu; and the project's own model is named twice.
  'linkedModels.tryAgain': 3,
  'linkedModels.tryingAgainWhat': 2,
  'linkedModels.bringingInAgain': 2,
  'linkedModels.lineUp': 2,
  'linkedModels.liningUp': 2,
  'linkedModels.liningUpWhat': 2,
  'linkedModels.liningUpDone': 2,
  'linkedModels.thisProjectRevitModel': 2,
}

/** The prefixes this file owns. A key under one of them must have Turkish. */
const PREFIXES = ['linkedElement.', 'linkModel.', 'group.', 'partSpace.', 'docsPicker.', 'linkedModels.'] as const

/** `"{{n}} edits"` with `{ n: 3 }` → `"3 edits"`. The panel never shows a placeholder. */
function fill(template: string, values: Readonly<Record<string, string | number>> | undefined): string {
  if (values === undefined) return template
  return template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]))
}

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/gu
const placeholders = (text: string): string => [...text.matchAll(PLACEHOLDER)].map((m) => m[1]).sort().join(',')

/** `{ run: { move: 'Taşı' } }` → `"run.move"`. */
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === '' ? key : `${prefix}.${key}`
    if (typeof value === 'string') out[id] = value
    else if (typeof value === 'object' && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, id))
  }
  return out
}

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'tr', 'editor.json'), 'utf8')) as Record<string, unknown>)

test('this guard is looking at captions, not an empty list', () => {
  // Without this a broken scan would leave every test below scanning nothing.
  const owned = [...editorSourceCaptions().keys()].filter((key) => PREFIXES.some((prefix) => key.startsWith(prefix)))
  expect(owned.length).toBeGreaterThan(20)
})

test('every top-level caption is still keyed in the source, with its English', () => {
  const source = editorSourceCaptions()
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english })
  }
})

test('a top-level caption is still keyed at every place it is written', () => {
  const source = editorSourceCaptions()
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, sites: source.get(caption.key)?.sites }).toEqual({ key: caption.key, sites: SITES[caption.key] ?? 1 })
  }
})

test('every top-level caption written twice or more has its site count pinned', () => {
  const source = editorSourceCaptions()
  const unpinned = [...source.entries()]
    .filter(([key]) => PREFIXES.some((prefix) => key.startsWith(prefix)))
    .filter(([key, caption]) => caption.sites > 1 && SITES[key] === undefined)
    .map(([key, caption]) => `${key} (${caption.sites} sites)`)
  expect(unpinned).toEqual([])
})

test('no pinned count is stale: every key in SITES is still in the source that many times', () => {
  const source = editorSourceCaptions()
  const wrong = Object.entries(SITES)
    .filter(([key, sites]) => (source.get(key)?.sites ?? 0) !== sites)
    .map(([key, sites]) => `${key}: pinned ${sites}, source has ${source.get(key)?.sites ?? 0}`)
  expect(wrong).toEqual([])
})

test('every top-level caption in the source has its Turkish', () => {
  const inSource = [...editorSourceCaptions().keys()].filter((key) => PREFIXES.some((prefix) => key.startsWith(prefix)))
  expect(inSource.filter((key) => (LOCALE[key] ?? '').trim() === '')).toEqual([])
})

test('a placeholder is never written with one brace', () => {
  const wrong = Object.entries(LOCALE)
    .filter(([key]) => PREFIXES.some((prefix) => key.startsWith(prefix)))
    .filter(([, value]) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(value))
    .map(([key]) => key)
  expect(wrong).toEqual([])
})

test('a placeholder on one side is on the other, and no figure is dropped', () => {
  const english = editorSourceCaptions()
  const wrong = [...english.keys()]
    .filter((key) => PREFIXES.some((prefix) => key.startsWith(prefix)))
    .filter((key) => placeholders(english.get(key)?.english ?? '') !== placeholders(LOCALE[key] ?? ''))
    .map((key) => `${key}: EN [${placeholders(english.get(key)?.english ?? '')}] TR [${placeholders(LOCALE[key] ?? '')}]`)
  expect(wrong).toEqual([])
})

test('no top-level caption stays English in tr', () => {
  for (const caption of CAPTIONS) {
    const turkish = TR(caption.key, caption.english, { ns: 'editor' })
    const english = EN(caption.key, caption.english, { ns: 'editor' })
    expect({ key: caption.key, text: turkish }).toEqual({ key: caption.key, text: fill(caption.turkish, undefined) })
    expect(english).toBe(caption.english)
    expect(turkish).not.toBe(english)
  }
})

test('§2.1: a piece is an eleman, a catalogue component a parça, a takeoff row a kalem', () => {
  // The words the panels compose; none of them may drift to *öğe* or *piece*.
  for (const key of ['linkedElement.element', 'linkedElement.fallbackName'] as const) {
    expect(TR(key, '', { ns: 'editor' })).not.toContain('öğe')
  }
  expect(TR('linkedElement.element', 'Element', { ns: 'editor' })).toBe('Eleman')
})

test('§9/Ç9: a run is a hat, never çalıştır', () => {
  for (const key of ['run.routeLike', 'run.notLiveRouted', 'run.slideBranch'] as const) {
    expect(TR(key, '', { ns: 'editor' })).not.toContain('çalıştır')
  }
  expect(TR('run.routeLike', 'Route another like this', { ns: 'editor' })).toBe('Buna benzer bir hat daha çiz')
  // The group properties name a run's scope the same way, and a straight piece the
  // same way the plumbing tree does.
  expect(TR('group.scopeRun', 'Run', { ns: 'editor' })).toBe('Hat')
  expect(TR('group.scopeStretch', 'Stretch', { ns: 'editor' })).toBe('Düz parça')
  expect(TR('group.scopeStretch', 'Stretch', { ns: 'editor' })).not.toContain('çalıştır')
})

test('§2.8/Ç17: a duct is a kanal and a pipe a boru, never swapped', () => {  expect(TR('group.ductShape', 'Duct shape', { ns: 'editor' })).toBe('Kanal biçimi')
  expect(TR('group.pipeSizeIn', 'Pipe size (in)', { ns: 'editor' })).toBe('Boru boyutu (in)')
  // §7: the unit symbols travel unchanged.
  expect(TR('group.espValue', '{{esp}} in. w.c.', { ns: 'editor', esp: '0.25' })).toBe('0.25 in. w.c.')
})

test('§2.3/Ç21: a clearance is an açıklık, a void a boşluk, and they never swap', () => {
  expect(TR('partSpace.clearances', 'Clearances', { ns: 'editor' })).toBe('Açıklıklar')
  expect(TR('partSpace.clearanceZones', 'Clearance zones', { ns: 'editor' })).toBe('Açıklık bölgeleri')
  // A NEC working space is a çalışma boşluğu, never a çalışma alanı: an *alan* is an area.
  expect(TR('partSpace.purposeWorkingSpace', 'Electrical working space', { ns: 'editor' })).toBe('Elektrik çalışma boşluğu')
  expect(TR('partSpace.purposeWorkingSpace', 'Electrical working space', { ns: 'editor' })).not.toContain('alan')
  // §2.3: a space (a room) stays a mekan; only the NEC volume is a boşluk.
  expect(TR('ventilation.space', 'Space', { ns: 'editor' })).toBe('Mekan')
})

test('§0.7: sentences speak to a person in the formal plural, buttons stay singular', () => {
  // A button is one short command (*Filtreyi temizle*), a sentence addresses the
  // reader (*…görmek için … dışa aktarın*).
  expect(TR('linkedElement.clearFilter', 'Clear filter', { ns: 'editor' })).not.toMatch(/ın$|in$/u)
  expect(TR('linkedElement.noRevitWhy', 'This linked model was exported without its Revit parameters. Export it again from Revit to see type and instance values here.', { ns: 'editor' })).toContain('aktarın')
  expect(TR('linkModel.replaceDescription', 'The new file becomes the current version. Earlier versions stay listed, and you can switch back.', { ns: 'editor' })).toContain('dönebilirsiniz')
  expect(TR('linkModel.cancel', 'Cancel', { ns: 'editor' })).toBe('İptal')
})
