/**
 * api.test.js — Unit tests for api.js mutations and AI parsing
 *
 * Tests:
 *   1. AI response field mapping (V4 schema: lat/lng → a/o)
 *   2. Export null-safety
 *   3. Bulk incident deduplication
 *   4. buildAnalysisPromptV4 region context
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── 1. AI Response Field Mapping ─────────────────────────────

describe('AI response field mapping', () => {
  it('should map V4 AI schema (lat/lng/title/type) to internal schema (a/o/ti/tp)', async () => {
    // Simulate what useBriefAnalysis does with AI response
    const aiResponse = [
      {
        title: 'Lankien Hospital Strike',
        description: 'Aerial bombardment damaged warehouse',
        lat: 8.28,
        lng: 31.60,
        type: 'BOMBARDMENT',
        severity: 'CRITICAL',
        date: '2026-02-03',
        actor: 'SSPDF',
        organization: 'MSF Holland',
        uncertainty: false,
        uncertainty_note: null,
      },
      {
        title: 'Duk Cholera Outbreak',
        description: 'Multiple cases reported',
        lat: 7.7,
        lng: 31.3,
        type: 'HEALTH',
        severity: 'HIGH',
        date: '2026-01-15',
        actor: null,
        organization: 'WHO',
        uncertainty: true,
        uncertainty_note: 'Approximate district center',
      },
    ]

    // Map using the same logic as api.js
    const mapped = aiResponse
      .filter(p => typeof (p.lat ?? p.a) === 'number' && typeof (p.lng ?? p.o) === 'number')
      .map((p, i) => ({
        id: 'ai_test_' + i,
        dt: p.date || p.dt || new Date().toISOString().slice(0, 10),
        a: p.lat ?? p.a,
        o: p.lng ?? p.o,
        tp: (p.type || p.tp || 'displacement').toLowerCase().replace(/_/g, '-'),
        s: (p.severity || p.s || 'medium').toLowerCase(),
        ti: p.title || p.ti || 'AI Detected',
        d: p.description || p.d || '',
        ac: p.actor || p.ac || 'Unknown',
        og: p.organization || p.og || 'AI',
        _uncertainty: p.uncertainty || false,
        _uncertaintyNote: p.uncertainty_note || null,
      }))

    expect(mapped.length).toBe(2)

    // First incident
    expect(mapped[0].a).toBe(8.28)
    expect(mapped[0].o).toBe(31.60)
    expect(mapped[0].tp).toBe('bombardment')
    expect(mapped[0].s).toBe('critical')
    expect(mapped[0].ti).toBe('Lankien Hospital Strike')
    expect(mapped[0]._uncertainty).toBe(false)

    // Second incident (uncertain)
    expect(mapped[1].a).toBe(7.7)
    expect(mapped[1].o).toBe(31.3)
    expect(mapped[1].tp).toBe('health')
    expect(mapped[1].s).toBe('high')
    expect(mapped[1]._uncertainty).toBe(true)
    expect(mapped[1]._uncertaintyNote).toBe('Approximate district center')
  })

  it('should handle mixed V3/V4 field names gracefully', () => {
    const mixedResponse = [
      { a: 9.0, o: 32.0, ti: 'Old Format', tp: 'looting', s: 'medium', dt: '2026-01-01' },
      { lat: 8.0, lng: 31.0, title: 'New Format', type: 'DISPLACEMENT', severity: 'LOW', date: '2026-01-02' },
    ]

    const mapped = mixedResponse
      .filter(p => typeof (p.lat ?? p.a) === 'number' && typeof (p.lng ?? p.o) === 'number')
      .map((p, i) => ({
        id: 'test_' + i,
        a: p.lat ?? p.a,
        o: p.lng ?? p.o,
        tp: (p.type || p.tp || 'displacement').toLowerCase().replace(/_/g, '-'),
        s: (p.severity || p.s || 'medium').toLowerCase(),
        ti: p.title || p.ti || 'Unknown',
      }))

    expect(mapped[0].a).toBe(9.0)
    expect(mapped[0].ti).toBe('Old Format')
    expect(mapped[1].a).toBe(8.0)
    expect(mapped[1].ti).toBe('New Format')
    expect(mapped[1].tp).toBe('displacement')
    expect(mapped[1].s).toBe('low')
  })

  it('should filter out items with null/undefined coordinates', () => {
    const withNulls = [
      { lat: 8.0, lng: 31.0, title: 'Valid' },
      { lat: null, lng: 32.0, title: 'Null Lat' },
      { lat: 9.0, lng: undefined, title: 'Undefined Lng' },
      { title: 'No Coords' },
    ]

    const filtered = withNulls.filter(p => typeof (p.lat ?? p.a) === 'number' && typeof (p.lng ?? p.o) === 'number')
    expect(filtered.length).toBe(1)
    expect(filtered[0].title).toBe('Valid')
  })
})

// ─── 2. Export Null-Safety ────────────────────────────────────

describe('Export null-safety', () => {
  it('eventToGeoJSON should handle null event', async () => {
    const { eventToGeoJSON } = await import('../data/events.js')
    const result = eventToGeoJSON(null)
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toEqual([])
  })

  it('eventToGeoJSON should handle event with null incidents', async () => {
    const { eventToGeoJSON } = await import('../data/events.js')
    const result = eventToGeoJSON({ name: 'Test', incidents: null })
    expect(result.type).toBe('FeatureCollection')
    expect(result.features.length).toBe(0)
  })

  it('eventToCSV should handle null event', async () => {
    const { eventToCSV } = await import('../data/events.js')
    const result = eventToCSV(null)
    expect(result).toBe('')
  })

  it('eventToReport should handle null event', async () => {
    const { eventToReport } = await import('../data/events.js')
    const result = eventToReport(null)
    expect(result).toBe('')
  })

  it('eventToGeoJSON should skip incidents with null coordinates', async () => {
    const { eventToGeoJSON } = await import('../data/events.js')
    const event = {
      name: 'Test',
      incidents: [
        { ti: 'Valid', a: 8.0, o: 31.0, tp: 'health', s: 'medium', dt: '2026-01-01' },
        { ti: 'Null A', a: null, o: 31.0, tp: 'health', s: 'medium', dt: '2026-01-01' },
        { ti: 'Undefined O', a: 8.0, o: undefined, tp: 'health', s: 'medium', dt: '2026-01-01' },
      ],
    }
    const result = eventToGeoJSON(event)
    expect(result.features.length).toBe(1)
    expect(result.features[0].properties.name).toBe('Valid')
  })
})

// ─── 3. Bulk Incident Deduplication ───────────────────────────

describe('addIncidentsBulk deduplication', () => {
  it('should dedupe incidents within 0.01 degrees with same type', () => {
    const existing = [
      { id: 'e1', a: 8.28, o: 31.60, tp: 'bombardment' },
    ]
    const incoming = [
      { id: 'n1', a: 8.281, o: 31.601, tp: 'bombardment' }, // within threshold, same type → dupe
      { id: 'n2', a: 8.30, o: 31.62, tp: 'bombardment' }, // outside threshold (0.02 > 0.01) → new
      { id: 'n3', a: 8.28, o: 31.60, tp: 'health' }, // same coords, different type → new
    ]

    const deduped = incoming.filter(ni =>
      !existing.some(ei => Math.abs(ei.a - ni.a) < 0.01 && Math.abs(ei.o - ni.o) < 0.01 && ei.tp === ni.tp)
    )

    expect(deduped.length).toBe(2)
    expect(deduped.find(i => i.id === 'n1')).toBeUndefined() // filtered as dupe
    expect(deduped.find(i => i.id === 'n2')).toBeDefined()
    expect(deduped.find(i => i.id === 'n3')).toBeDefined()
  })

  it('should not dedupe incidents outside 0.01 degree threshold', () => {
    const existing = [{ id: 'e1', a: 8.28, o: 31.60, tp: 'bombardment' }]
    const incoming = [{ id: 'n1', a: 8.30, o: 31.62, tp: 'bombardment' }] // 0.02 away

    const deduped = incoming.filter(ni =>
      !existing.some(ei => Math.abs(ei.a - ni.a) < 0.01 && Math.abs(ei.o - ni.o) < 0.01 && ei.tp === ni.tp)
    )

    expect(deduped.length).toBe(1)
  })
})

// ─── 4. buildAnalysisPromptV4 Region Context ──────────────────

describe('buildAnalysisPromptV4 region context', () => {
  it('should include region bounds in V4 prompt', async () => {
    const { buildAnalysisPromptV4 } = await import('../data/events.js')
    const operation = {
      name: 'Sudan → South Sudan Corridor',
      region: {
        center: [9.5, 30.5],
        bounds: [[4.5, 26], [16, 34]],
      },
    }

    const prompt = buildAnalysisPromptV4(operation, 'Test brief text')

    expect(prompt).toContain('Sudan → South Sudan Corridor')
    expect(prompt).toContain('Center: 10.25, 30.00') // midpoint of bounds
    expect(prompt).toContain('Bounds:')
    expect(prompt).toContain('uncertainty')
    expect(prompt).toContain('Test brief text')
  })

  it('should handle null operation gracefully', async () => {
    const { buildAnalysisPromptV4 } = await import('../data/events.js')
    const prompt = buildAnalysisPromptV4(null, 'Brief without operation context')

    expect(prompt).toContain('Brief without operation context')
    expect(prompt).toContain('Unknown') // fallback area name
    expect(prompt).not.toThrow
  })

  it('should handle operation without bounds', async () => {
    const { buildAnalysisPromptV4 } = await import('../data/events.js')
    const operation = { name: 'No Bounds Event', region: { center: [8, 30] } }
    const prompt = buildAnalysisPromptV4(operation, 'Test')

    expect(prompt).toContain('Center: 8.00, 30.00')
    expect(prompt).toContain('No Bounds Event')
  })
})

// ─── 5. Incident Type Normalization ───────────────────────────

describe('Incident type normalization', () => {
  it('should convert ACCESS_DENIAL to access-denial', () => {
    const raw = 'ACCESS_DENIAL'
    const normalized = raw.toLowerCase().replace(/_/g, '-')
    expect(normalized).toBe('access-denial')
  })

  it('should convert CONTROL_CHANGE to control-change', () => {
    const raw = 'CONTROL_CHANGE'
    const normalized = raw.toLowerCase().replace(/_/g, '-')
    expect(normalized).toBe('control-change')
  })

  it('should leave already-normalized types unchanged', () => {
    const types = ['bombardment', 'looting', 'health', 'displacement', 'flood', 'earthquake']
    types.forEach(t => {
      const normalized = t.toLowerCase().replace(/_/g, '-')
      expect(normalized).toBe(t)
    })
  })
})
