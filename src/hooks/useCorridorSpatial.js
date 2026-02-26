/**
 * useCorridorSpatial — Client-side spatial analysis with Turf.js
 * 
 * No database required. Works with in-memory data.
 * When migrating to PostGIS, these become server-side calls — 
 * but the Turf.js version stays as instant client preview.
 * 
 * Dependencies: @turf/turf (npm install @turf/turf)
 * CDN fallback: https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js
 */

// ═══════════════════════════════════════════════
// TURF.JS IMPORT (with CDN fallback)
// ═══════════════════════════════════════════════
let turf = null

export async function loadTurf() {
  if (turf) return turf
  if (window.turf) { turf = window.turf; return turf }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js'
    s.onload = () => { turf = window.turf; resolve(turf) }
    s.onerror = () => reject(new Error('Failed to load Turf.js'))
    document.head.appendChild(s)
  })
}

// ═══════════════════════════════════════════════
// CORE SPATIAL FUNCTIONS
// ═══════════════════════════════════════════════

/**
 * Create a buffer polygon around a corridor route
 * @param {Array} waypoints - [{a: lat, o: lng}, ...] or [[lng, lat], ...]
 * @param {number} bufferKm - Buffer distance in km (default: 10)
 * @returns {Object} GeoJSON Polygon (or null)
 */
export async function computeCorridorBuffer(waypoints, bufferKm = 10) {
  const T = await loadTurf()
  if (!waypoints || waypoints.length < 2) return null
  
  try {
    // Convert to [lng, lat] coords
    const coords = waypoints.map(p => 
      Array.isArray(p) ? p : [p.o || p.lng, p.a || p.lat]
    )
    
    const line = T.lineString(coords)
    const buffered = T.buffer(line, bufferKm, { units: 'kilometers' })
    return buffered
  } catch (e) {
    console.warn('Buffer computation failed:', e)
    return null
  }
}

/**
 * Check if a point is inside a buffer polygon
 * @param {number} lat 
 * @param {number} lng 
 * @param {Object} bufferPolygon - GeoJSON Polygon from computeCorridorBuffer
 * @returns {boolean}
 */
export async function isPointInBuffer(lat, lng, bufferPolygon) {
  if (!bufferPolygon) return false
  const T = await loadTurf()
  try {
    return T.booleanPointInPolygon(T.point([lng, lat]), bufferPolygon)
  } catch { return false }
}

/**
 * Filter incidents that fall within a corridor's buffer zone
 * @param {Array} incidents - [{lat, lng, ...}] or [{a, o, ...}]
 * @param {Object} bufferPolygon - GeoJSON Polygon
 * @returns {Array} incidents with added `distanceToCorridorKm` field
 */
export async function filterIncidentsInBuffer(incidents, corridorCoords, bufferKm = 10) {
  const T = await loadTurf()
  if (!incidents?.length || !corridorCoords?.length) return []
  
  const coords = corridorCoords.map(p => 
    Array.isArray(p) ? p : [p.o || p.lng, p.a || p.lat]
  )
  const line = T.lineString(coords)
  const buffered = T.buffer(line, bufferKm, { units: 'kilometers' })
  
  return incidents
    .map(inc => {
      const lat = inc.lat ?? inc.a
      const lng = inc.lng ?? inc.o
      if (lat == null || lng == null) return null
      
      const pt = T.point([lng, lat])
      const inBuffer = T.booleanPointInPolygon(pt, buffered)
      
      // Calculate distance to corridor line
      const nearest = T.nearestPointOnLine(line, pt, { units: 'kilometers' })
      const distKm = Math.round(nearest.properties.dist * 100) / 100
      
      return {
        ...inc,
        inBuffer,
        distanceToCorridorKm: distKm
      }
    })
    .filter(Boolean)
    .filter(inc => inc.inBuffer)
    .sort((a, b) => a.distanceToCorridorKm - b.distanceToCorridorKm)
}

/**
 * Compute risk score for a corridor (0.0 - 1.0)
 * Mirrors the PostGIS corridor_risk_score() function
 * @param {Array} incidents - incidents already filtered by buffer
 * @returns {number} 0.0 (safe) to 1.0 (critical)
 */
export function computeRiskScore(incidentsInBuffer) {
  if (!incidentsInBuffer?.length) return 0
  
  const weights = {
    CRITICAL: 0.25, critical: 0.25,
    HIGH: 0.15, high: 0.15,
    MEDIUM: 0.08, medium: 0.08,
    LOW: 0.03, low: 0.03
  }
  
  const raw = incidentsInBuffer.reduce((sum, inc) => {
    const sev = inc.severity || inc.s || 'medium'
    return sum + (weights[sev] || 0.05)
  }, 0)
  
  return Math.min(1.0, Math.round(raw * 100) / 100)
}

/**
 * Compute corridor length in km
 * @param {Array} waypoints - [{a, o}, ...] or [[lng, lat], ...]
 * @returns {number} length in km
 */
export async function computeCorridorLength(waypoints) {
  const T = await loadTurf()
  if (!waypoints || waypoints.length < 2) return 0
  
  const coords = waypoints.map(p => 
    Array.isArray(p) ? p : [p.o || p.lng, p.a || p.lat]
  )
  
  const line = T.lineString(coords)
  return Math.round(T.length(line, { units: 'kilometers' }))
}

/**
 * Get a point at a specific percentage along the corridor
 * Useful for placing labels, progress markers
 * @param {Array} waypoints 
 * @param {number} percent - 0 to 1
 * @returns {{lat, lng}} or null
 */
export async function pointAlongCorridor(waypoints, percent = 0.5) {
  const T = await loadTurf()
  if (!waypoints || waypoints.length < 2) return null
  
  const coords = waypoints.map(p => 
    Array.isArray(p) ? p : [p.o || p.lng, p.a || p.lat]
  )
  
  const line = T.lineString(coords)
  const len = T.length(line, { units: 'kilometers' })
  const pt = T.along(line, len * percent, { units: 'kilometers' })
  const [lng, lat] = pt.geometry.coordinates
  return { lat, lng }
}

/**
 * Convert buffer polygon to Leaflet-compatible coordinates
 * @param {Object} bufferGeoJSON 
 * @returns {Array} [[lat, lng], ...]
 */
export function bufferToLeafletCoords(bufferGeoJSON) {
  if (!bufferGeoJSON?.geometry?.coordinates) return []
  // GeoJSON Polygon: [[[lng, lat], ...]]
  return bufferGeoJSON.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])
}

// ═══════════════════════════════════════════════
// REACT HOOK (optional, for component use)
// ═══════════════════════════════════════════════

/**
 * React hook that combines all spatial operations for a corridor
 * 
 * Usage:
 *   const { bufferPolygon, nearbyIncidents, riskScore, lengthKm } = 
 *     useCorridorSpatial(corridor.waypoints, allIncidents, 10)
 */
export function useCorridorSpatialData(corridorWaypoints, allIncidents, bufferKm = 10) {
  // This is a synchronous snapshot calculator — no useState needed
  // Call it in useMemo or useEffect in your component
  
  return {
    computeBuffer: () => computeCorridorBuffer(corridorWaypoints, bufferKm),
    filterIncidents: () => filterIncidentsInBuffer(allIncidents, corridorWaypoints, bufferKm),
    getRiskScore: async () => {
      const filtered = await filterIncidentsInBuffer(allIncidents, corridorWaypoints, bufferKm)
      return computeRiskScore(filtered)
    },
    getLength: () => computeCorridorLength(corridorWaypoints),
    getPointAt: (pct) => pointAlongCorridor(corridorWaypoints, pct)
  }
}
