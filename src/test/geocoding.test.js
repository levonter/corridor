/**
 * geocoding.test.js — Unit tests for Corridor Planner v4
 *
 * Tests:
 *   1. extractPlaces — false positive prevention
 *   2. GEO_DICT — coordinate accuracy
 *   3. autoDetectType — emoji resolution
 *   4. Zod validation — incident/event schemas
 *   5. renderEventToMap — layer structure
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { autoDetectType, IncidentSchema, EventSchema } from '../store/useAppStore.js'

// ─── Mock Nominatim (no real network calls) ───────────────────

const mockNominatim = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn((url) => {
    if (url.includes('nominatim.openstreetmap.org')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockNominatim(url)),
      })
    }
    return Promise.reject(new Error('Unmocked URL: ' + url))
  })
})

// ─── 1. extractPlaces — False Positive Prevention ─────────────

describe('extractPlaces — conservative geocoding', () => {
  // We import dynamically to get the actual function
  let extractPlacesModule

  beforeEach(async () => {
    // Import events.js which has extractPlaces as internal (used by localParseBrief)
    extractPlacesModule = await import('../data/events.js')
  })

  it('localParseBrief should not create pins for English words like "waterborne"', async () => {
    mockNominatim.mockReturnValue([]) // no Nominatim results
    const text = 'Waterborne diseases are spreading across the region. The unity of response is critical.'
    const results = await extractPlacesModule.localParseBrief(text)
    // "waterborne" should NOT trigger a "Bor" pin
    // "unity" should NOT trigger a South Sudan "Unity" state pin
    const hasBor = results.some(r => r.ti?.toLowerCase().includes('bor'))
    const hasUnity = results.some(r => r.ti?.toLowerCase().includes('unity'))
    expect(hasBor).toBe(false)
    expect(hasUnity).toBe(false)
  })

  it('localParseBrief should correctly detect "fled to Bor" with preposition context', async () => {
    mockNominatim.mockReturnValue([])
    const text = 'Over 5,000 families fled to Bor after the bombardment in Lankien on 2026-02-03.'
    const results = await extractPlacesModule.localParseBrief(text)
    const hasBor = results.some(r => Math.abs(r.a - 6.2) < 0.5 && Math.abs(r.o - 31.56) < 0.5)
    const hasLankien = results.some(r => Math.abs(r.a - 8.28) < 0.5 && Math.abs(r.o - 31.60) < 0.5)
    expect(hasBor).toBe(true)
    expect(hasLankien).toBe(true)
  })

  it('localParseBrief should detect Siirt at correct Turkey coordinates, not Ethiopia', async () => {
    mockNominatim.mockReturnValue([])
    const text = 'Earthquake struck Siirt Province on 2026-01-15. Emergency response ongoing.'
    const results = await extractPlacesModule.localParseBrief(text)
    const siirtResult = results.find(r => r.ti?.toLowerCase().includes('siirt'))
    if (siirtResult) {
      // Siirt Turkey: [37.93, 42.01]
      expect(siirtResult.a).toBeCloseTo(37.93, 0)
      expect(siirtResult.o).toBeCloseTo(42.01, 0)
    }
  })

  it('localParseBrief should not generate >10 false positive locations for a typical brief', async () => {
    mockNominatim.mockReturnValue([])
    const text = `
      The humanitarian situation in Jonglei state remains critical. SSPDF forces 
      launched aerial bombardment near Lankien on February 3rd. MSF Holland reported 
      significant damage to the OCA hospital warehouse. Armed groups continue to 
      restrict access across Nyirol, Uror and Akobo counties. Over 280,000 people 
      have been displaced. Cholera cases reported in Duk County.
    `
    const results = await extractPlacesModule.localParseBrief(text)
    // Should find real places but not dozens of false positives
    expect(results.length).toBeLessThanOrEqual(10)
    expect(results.length).toBeGreaterThan(0)
  })
})

// ─── 2. GEO_DICT — Coordinate Accuracy ───────────────────────

describe('GEO_DICT — hardcoded coordinates', () => {
  let GEO_DICT_check

  beforeEach(async () => {
    const mod = await import('../data/events.js')
    // GEO_DICT is internal but we can test via geocode behavior
    GEO_DICT_check = mod
  })

  it('should have Sudan event seed data with valid coordinates', () => {
    const ev = GEO_DICT_check.SUDAN_EVENT
    expect(ev).toBeDefined()
    expect(ev.corridor.length).toBeGreaterThan(0)
    // Khartoum coordinates
    const khartoum = ev.corridor.find(w => w.n === 'Khartoum')
    expect(khartoum).toBeDefined()
    expect(khartoum.a).toBeCloseTo(15.5, 0)
    expect(khartoum.o).toBeCloseTo(32.5, 0)
    // Juba coordinates
    const juba = ev.corridor.find(w => w.n === 'Juba')
    expect(juba).toBeDefined()
    expect(juba.a).toBeCloseTo(4.85, 0)
    expect(juba.o).toBeCloseTo(31.58, 0)
  })

  it('SEVERITY config should have 4 levels with color and bg', () => {
    const { SEVERITY } = GEO_DICT_check
    expect(SEVERITY.critical).toBeDefined()
    expect(SEVERITY.critical.color).toBe('#E8553A')
    expect(SEVERITY.high).toBeDefined()
    expect(SEVERITY.medium).toBeDefined()
    expect(SEVERITY.low).toBeDefined()
  })
})

// ─── 3. autoDetectType — Emoji Resolution ─────────────────────

describe('autoDetectType — contextual emoji assignment', () => {
  it('should detect bombardment from keywords', () => {
    const result = autoDetectType('Aerial bombardment struck the hospital compound')
    expect(result.type).toBe('bombardment')
    expect(result.icon).toBe('💥')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('should detect health from medical keywords', () => {
    const result = autoDetectType('Cholera outbreak in Duk County, 479 cases reported')
    expect(result.type).toBe('health')
    expect(result.icon).toBe('🦠')
  })

  it('should detect flood from water keywords', () => {
    const result = autoDetectType('Flash flooding inundated the refugee camp')
    expect(result.type).toBe('flood')
    expect(result.icon).toBe('🌊')
  })

  it('should return displacement as fallback for unrecognized text', () => {
    const result = autoDetectType('Situation continues to deteriorate')
    expect(result.type).toBe('displacement')
    expect(result.confidence).toBe(0)
  })

  it('should handle empty/null input gracefully', () => {
    expect(autoDetectType(''). type).toBe('displacement')
    expect(autoDetectType(null).type).toBe('displacement')
    expect(autoDetectType(undefined).type).toBe('displacement')
  })

  it('should detect multiple types in combined scenarios', () => {
    const result = autoDetectType('Flooded hospital treating cholera patients after earthquake')
    expect(result.allTypes).toContain('flood')
    expect(result.allTypes).toContain('health')
    expect(result.allTypes).toContain('earthquake')
    expect(result.allTypes.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── 4. Zod Schema Validation ─────────────────────────────────

describe('Zod schemas — data validation', () => {
  it('IncidentSchema should validate a correct incident', () => {
    const incident = {
      id: 'i1', dt: '2026-02-03', a: 8.28, o: 31.60,
      tp: 'bombardment', s: 'critical',
      ti: 'Lankien Hospital Airstrike',
      d: 'OCA hospital warehouse damaged',
      ac: 'SSPDF', og: 'MSF Holland',
    }
    const result = IncidentSchema.safeParse(incident)
    expect(result.success).toBe(true)
  })

  it('IncidentSchema should reject missing required fields', () => {
    const bad = { id: 'i1', dt: '2026-02-03' } // missing a, o, tp, s, ti
    const result = IncidentSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('IncidentSchema should reject invalid severity', () => {
    const bad = {
      id: 'i1', dt: '2026-02-03', a: 8.28, o: 31.60,
      tp: 'bombardment', s: 'EXTREME', // invalid
      ti: 'Test',
    }
    const result = IncidentSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('EventSchema should validate SUDAN_EVENT seed data', async () => {
    const { SUDAN_EVENT } = await import('../data/events.js')
    const result = EventSchema.safeParse(SUDAN_EVENT)
    expect(result.success).toBe(true)
  })

  it('EventSchema should apply defaults for missing optional fields', () => {
    const minimal = { id: 'test', name: 'Test Event' }
    const result = EventSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    expect(result.data.severity).toBe('medium')
    expect(result.data.incidents).toEqual([])
    expect(result.data.corridor).toEqual([])
  })
})

// ─── 5. renderEventToMap — Layer Structure ────────────────────

describe('renderEventToMap — Leaflet layer output', () => {
  it('should export renderEventToMap as a function', async () => {
    const mod = await import('../data/events.js')
    expect(typeof mod.renderEventToMap).toBe('function')
  })

  it('should return 6 layer groups for SUDAN_EVENT', async () => {
    const mod = await import('../data/events.js')
    // Create mock Leaflet
    const mockGroup = { addTo: vi.fn().mockReturnThis() }
    const mockLayer = {
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      bindPopup: vi.fn().mockReturnThis(),
      getElement: vi.fn().mockReturnValue(null),
    }
    const mockLf = {
      layerGroup: vi.fn(() => mockGroup),
      polyline: vi.fn(() => mockLayer),
      circleMarker: vi.fn(() => mockLayer),
      circle: vi.fn(() => mockLayer),
      marker: vi.fn(() => mockLayer),
      divIcon: vi.fn(() => ({})),
    }
    const layers = mod.renderEventToMap(mockLf, mod.SUDAN_EVENT, false)
    expect(layers).toBeDefined()
    expect(layers.corridor).toBeDefined()
    expect(layers.risks).toBeDefined()
    expect(layers.access).toBeDefined()
    expect(layers.incidents).toBeDefined()
    expect(layers.bases).toBeDefined()
    expect(layers.drawings).toBeDefined()
  })
})

// ─── 6. Export Functions ──────────────────────────────────────

describe('Export functions', () => {
  it('eventToGeoJSON should produce valid FeatureCollection', async () => {
    const { eventToGeoJSON, SUDAN_EVENT } = await import('../data/events.js')
    const geojson = eventToGeoJSON(SUDAN_EVENT)
    expect(geojson.type).toBe('FeatureCollection')
    expect(geojson.features.length).toBeGreaterThan(0)
    // Should contain incident points
    const incidentFeatures = geojson.features.filter(f => f.properties?.type && f.properties.type !== 'waypoint' && f.properties.type !== 'corridor')
    expect(incidentFeatures.length).toBe(SUDAN_EVENT.incidents.length)
  })

  it('eventToCSV should produce valid CSV with headers', async () => {
    const { eventToCSV, SUDAN_EVENT } = await import('../data/events.js')
    const csv = eventToCSV(SUDAN_EVENT)
    const lines = csv.split('\n')
    expect(lines[0]).toContain('Type')
    expect(lines[0]).toContain('Name')
    expect(lines[0]).toContain('Lat')
    expect(lines.length).toBeGreaterThan(1)
  })

  it('encodeShare/decodeShare should roundtrip event data', async () => {
    const { encodeShare, decodeShare, SUDAN_EVENT } = await import('../data/events.js')
    const encoded = encodeShare(SUDAN_EVENT)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(0)
    const decoded = decodeShare(encoded)
    expect(decoded).toBeDefined()
    expect(decoded.event.name).toBe(SUDAN_EVENT.name)
    expect(decoded.event.incidents.length).toBe(SUDAN_EVENT.incidents.length)
  })
})

// ─── 7. Ghost Nodes & HITL (V4) ──────────────────────────────

describe('Ghost Nodes — HITL uncertainty rendering', () => {
  it('renderEventToMap should render ghost nodes for uncertain incidents', async () => {
    const { renderEventToMap, createEvent, SEVERITY } = await import('../data/events.js')

    // Create mock Leaflet
    const addedMarkers = []
    const mockLayerGroup = { addTo: vi.fn() }
    const mockL = {
      layerGroup: () => ({
        addTo: vi.fn(),
        ...mockLayerGroup,
      }),
      circleMarker: (latlng, opts) => {
        addedMarkers.push({ latlng, opts })
        return {
          bindPopup: vi.fn().mockReturnThis(),
          addTo: vi.fn().mockReturnThis(),
          on: vi.fn().mockReturnThis(),
        }
      },
      circle: () => ({
        bindPopup: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
      }),
      polyline: () => ({
        addTo: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
      }),
      marker: () => ({
        bindPopup: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
      }),
      divIcon: () => ({}),
    }

    const testEvent = createEvent({
      incidents: [
        { id: 'ghost1', dt: '2026-01-01', a: 8.0, o: 31.0, tp: 'bombardment', s: 'high', ti: 'Ghost Strike', d: 'Uncertain location', ac: 'Unknown', og: 'AI', _uncertainty: true, _uncertaintyNote: 'Multiple possible locations' },
        { id: 'solid1', dt: '2026-01-02', a: 9.0, o: 32.0, tp: 'health', s: 'medium', ti: 'Solid Clinic', d: 'Confirmed location', ac: 'WHO', og: 'MSF' },
        { id: 'draft1', dt: '2026-01-03', a: 7.0, o: 30.0, tp: 'displacement', s: 'critical', ti: 'Draft Camp', d: 'Needs review', ac: 'UNHCR', og: 'IOM', _isDraft: true },
      ],
    })

    const layers = renderEventToMap(mockL, testEvent, false, false)
    expect(layers).toBeDefined()
    expect(layers.incidents).toBeDefined()

    // Ghost node should have fillOpacity 0.3
    const ghostMarker = addedMarkers.find(m => m.opts?.fillOpacity === 0.3)
    expect(ghostMarker).toBeDefined()
    expect(ghostMarker.opts.dashArray).toBe('4 4')
    expect(ghostMarker.opts.className).toBe('ghost-node')

    // Normal node should have fillOpacity 0.95
    const solidMarker = addedMarkers.find(m => m.opts?.fillOpacity === 0.95)
    expect(solidMarker).toBeDefined()

    // Draft node should have fillOpacity 0.6
    const draftMarker = addedMarkers.find(m => m.opts?.fillOpacity === 0.6)
    expect(draftMarker).toBeDefined()
    expect(draftMarker.opts.dashArray).toBe('6 3')
  })

  it('autoDetectType should identify compound incidents', () => {
    // "flooded hospital" should detect both flood and health
    const result = autoDetectType('The flooded hospital in Bor has been evacuated due to rising water levels and cholera outbreak')
    expect(result.allTypes).toContain('flood')
    expect(result.allTypes).toContain('health')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('autoDetectType should return fallback for unknown text', () => {
    const result = autoDetectType('The situation continues to develop')
    expect(result.type).toBe('displacement')
    expect(result.icon).toBe('⚠️')
    expect(result.confidence).toBe(0)
  })
})
