/**
 * useMapDraw — Leaflet.Draw + Turf.js drawing tools
 * 
 * Lets users draw on the map:
 *   - Polygon  → incident zone, access denied area, flood extent
 *   - Circle   → risk zone, buffer radius
 *   - Polyline → custom route, movement path
 *   - Rectangle→ bounding box selection
 *   - Marker   → single point placement (draggable)
 * 
 * All drawn shapes stored as GeoJSON with computed properties
 * (area, perimeter, centroid via Turf.js)
 * 
 * Dependencies:
 *   - leaflet-draw (loaded via CDN — no npm install needed)
 *   - @turf/turf (loaded via CDN fallback from useCorridorSpatial)
 * 
 * Usage in App.jsx:
 *   const { startDraw, stopDraw, drawings, removeDrawing, drawingMode } = useMapDraw(mapRef)
 *   
 *   <button onClick={() => startDraw('polygon')}>Draw Zone</button>
 *   <button onClick={() => startDraw('circle')}>Draw Circle</button>
 *   <button onClick={() => startDraw('corridor')}>Draw Route</button>
 *   <button onClick={() => startDraw('marker')}>Place Pin</button>
 */

import { useState, useRef, useCallback, useEffect } from 'react'

// ═══════════════════════════════════════════════
// CDN LOADER — Leaflet.Draw
// ═══════════════════════════════════════════════
let _drawLoaded = false

async function loadLeafletDraw() {
  if (_drawLoaded) return
  if (window.L?.Draw) { _drawLoaded = true; return }
  
  // Load CSS
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css'
  document.head.appendChild(link)
  
  // Load JS
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js'
    s.onload = () => { _drawLoaded = true; resolve() }
    s.onerror = () => reject(new Error('Failed to load Leaflet.Draw'))
    document.head.appendChild(s)
  })
}

// Turf loader (reuse from spatial hook)
let _turf = null
async function loadTurf() {
  if (_turf) return _turf
  if (window.turf) { _turf = window.turf; return _turf }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js'
    s.onload = () => { _turf = window.turf; resolve(_turf) }
    s.onerror = () => reject(new Error('Failed to load Turf.js'))
    document.head.appendChild(s)
  })
}

// ═══════════════════════════════════════════════
// DRAWING STYLES
// ═══════════════════════════════════════════════
const DRAW_STYLES = {
  polygon: {
    shapeOptions: {
      color: '#C9A84C',
      weight: 2,
      fillColor: '#C9A84C',
      fillOpacity: 0.15,
      dashArray: '6 3'
    }
  },
  circle: {
    shapeOptions: {
      color: '#E8553A',
      weight: 2,
      fillColor: '#E8553A',
      fillOpacity: 0.12,
      dashArray: '8 4'
    }
  },
  polyline: {
    shapeOptions: {
      color: '#5AAE7A',
      weight: 3,
      opacity: 0.8,
      dashArray: '10 6'
    }
  },
  rectangle: {
    shapeOptions: {
      color: '#4BA8CC',
      weight: 2,
      fillColor: '#4BA8CC',
      fillOpacity: 0.1,
      dashArray: '6 3'
    }
  }
}

// ═══════════════════════════════════════════════
// HELPER: Convert Leaflet layer → GeoJSON + Turf props
// ═══════════════════════════════════════════════
async function layerToFeature(layer, drawType) {
  const T = await loadTurf()
  const id = 'draw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  
  // Circle (special case — Leaflet circles aren't standard GeoJSON)
  if (drawType === 'circle') {
    const center = layer.getLatLng()
    const radiusM = layer.getRadius()
    const radiusKm = Math.round(radiusM / 100) / 10
    
    // Create Turf circle polygon (64 vertices)
    const turfCircle = T.circle([center.lng, center.lat], radiusKm, {
      units: 'kilometers', steps: 64
    })
    const areaKm2 = Math.round(T.area(turfCircle) / 1e6 * 100) / 100
    
    return {
      id,
      type: 'circle',
      geometry: turfCircle.geometry,
      properties: {
        drawType: 'circle',
        centerLat: center.lat,
        centerLng: center.lng,
        radiusKm,
        areaKm2,
        label: '',
        severity: 'medium',
        category: 'custom' // user can change: risk_zone, access_denied, flood_extent, etc.
      },
      layer // keep reference for map manipulation
    }
  }
  
  // Marker (point)
  if (drawType === 'marker') {
    const ll = layer.getLatLng()
    return {
      id,
      type: 'marker',
      geometry: { type: 'Point', coordinates: [ll.lng, ll.lat] },
      properties: {
        drawType: 'marker',
        lat: ll.lat,
        lng: ll.lng,
        label: '',
        severity: 'medium',
        category: 'incident'
      },
      layer
    }
  }
  
  // Polygon / Rectangle
  if (drawType === 'polygon' || drawType === 'rectangle') {
    const latlngs = layer.getLatLngs()[0] // outer ring
    const coords = latlngs.map(ll => [ll.lng, ll.lat])
    coords.push(coords[0]) // close ring
    
    const polygon = T.polygon([coords])
    const areaKm2 = Math.round(T.area(polygon) / 1e6 * 100) / 100
    const perimeterKm = Math.round(T.length(T.lineString(coords), { units: 'kilometers' }) * 10) / 10
    const centroid = T.centroid(polygon)
    
    return {
      id,
      type: drawType,
      geometry: polygon.geometry,
      properties: {
        drawType,
        areaKm2,
        perimeterKm,
        centroidLat: centroid.geometry.coordinates[1],
        centroidLng: centroid.geometry.coordinates[0],
        vertexCount: latlngs.length,
        label: '',
        severity: 'medium',
        category: 'custom'
      },
      layer
    }
  }
  
  // Polyline (corridor/route)
  if (drawType === 'polyline' || drawType === 'corridor') {
    const latlngs = layer.getLatLngs()
    const coords = latlngs.map(ll => [ll.lng, ll.lat])
    
    const line = T.lineString(coords)
    const lengthKm = Math.round(T.length(line, { units: 'kilometers' }) * 10) / 10
    const midpoint = T.along(line, lengthKm / 2, { units: 'kilometers' })
    
    return {
      id,
      type: 'polyline',
      geometry: line.geometry,
      properties: {
        drawType: 'polyline',
        lengthKm,
        midpointLat: midpoint.geometry.coordinates[1],
        midpointLng: midpoint.geometry.coordinates[0],
        vertexCount: latlngs.length,
        label: '',
        category: 'corridor'
      },
      layer
    }
  }
  
  return null
}

// ═══════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════
export default function useMapDraw(mapRef, leafletRef, mapReady) {
  const [drawings, setDrawings] = useState([])    // Array of drawn features
  const [drawingMode, setDrawingMode] = useState(null) // null | 'polygon' | 'circle' | ...
  const [ready, setReady] = useState(false)
  const handlerRef = useRef(null)
  const drawnLayersRef = useRef(null)
  
  // ── Initialize Leaflet.Draw ─────────────────
  useEffect(() => {
    if (!mapReady) return
    const map = mapRef?.current
    const L = leafletRef?.current || window.L
    if (!map || !L) return
    
    loadLeafletDraw().then(() => {
      if (!drawnLayersRef.current) {
        drawnLayersRef.current = new L.FeatureGroup()
        map.addLayer(drawnLayersRef.current)
      }
      setReady(true)
    }).catch(e => console.warn('Leaflet.Draw load failed:', e))
  }, [mapReady])
  
  // ── Start drawing ───────────────────────────
  const startDraw = useCallback((type) => {
    const map = mapRef?.current
    const L = leafletRef?.current || window.L
    if (!map || !L || !L.Draw || !ready) {
      console.warn('Draw not ready. Map:', !!map, 'L.Draw:', !!L?.Draw, 'ready:', ready)
      return
    }
    
    // Cancel any active drawing
    if (handlerRef.current) {
      try { handlerRef.current.disable() } catch {}
      handlerRef.current = null
    }
    
    setDrawingMode(type)
    
    // Create draw handler
    const opts = DRAW_STYLES[type === 'corridor' ? 'polyline' : type] || DRAW_STYLES.polygon
    
    let handler
    switch (type) {
      case 'polygon':
        handler = new L.Draw.Polygon(map, opts)
        break
      case 'circle':
        handler = new L.Draw.Circle(map, opts)
        break
      case 'polyline':
      case 'corridor':
        handler = new L.Draw.Polyline(map, {
          ...opts,
          shapeOptions: { ...opts.shapeOptions, color: type === 'corridor' ? '#D4754E' : '#5AAE7A' }
        })
        break
      case 'rectangle':
        handler = new L.Draw.Rectangle(map, opts)
        break
      case 'marker':
        handler = new L.Draw.Marker(map, {
          icon: L.divIcon({
            className: '',
            html: '<div style="width:24px;height:24px;background:#C9A84C;border:3px solid #FFF;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:move"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        })
        break
      default:
        console.warn('Unknown draw type:', type)
        return
    }
    
    handlerRef.current = handler
    handler.enable()
    
    // Listen for draw complete
    const onCreated = async (e) => {
      const layer = e.layer
      drawnLayersRef.current.addLayer(layer)
      
      // Make markers draggable
      if (type === 'marker' && layer.dragging) {
        layer.dragging.enable()
      }
      
      // Convert to GeoJSON feature with Turf properties
      const feature = await layerToFeature(layer, type)
      if (feature) {
        setDrawings(prev => [...prev, feature])
      }
      
      setDrawingMode(null)
      handlerRef.current = null
      
      // Remove one-time listener
      map.off(L.Draw.Event.CREATED, onCreated)
    }
    
    map.on(L.Draw.Event.CREATED, onCreated)
  }, [mapRef, leafletRef, ready])
  
  // ── Stop drawing ────────────────────────────
  const stopDraw = useCallback(() => {
    if (handlerRef.current) {
      try { handlerRef.current.disable() } catch {}
      handlerRef.current = null
    }
    setDrawingMode(null)
  }, [])
  
  // ── Remove a drawing ────────────────────────
  const removeDrawing = useCallback((drawingId) => {
    setDrawings(prev => {
      const found = prev.find(d => d.id === drawingId)
      if (found?.layer && drawnLayersRef.current) {
        drawnLayersRef.current.removeLayer(found.layer)
      }
      return prev.filter(d => d.id !== drawingId)
    })
  }, [])
  
  // ── Clear all drawings ──────────────────────
  const clearAll = useCallback(() => {
    if (drawnLayersRef.current) drawnLayersRef.current.clearLayers()
    setDrawings([])
  }, [])
  
  // ── Update drawing properties ───────────────
  const updateDrawing = useCallback((drawingId, props) => {
    setDrawings(prev => prev.map(d => 
      d.id === drawingId 
        ? { ...d, properties: { ...d.properties, ...props } }
        : d
    ))
  }, [])
  
  // ── Get all drawings as GeoJSON FeatureCollection ──
  const toGeoJSON = useCallback(() => {
    return {
      type: 'FeatureCollection',
      features: drawings.map(d => ({
        type: 'Feature',
        geometry: d.geometry,
        properties: d.properties
      }))
    }
  }, [drawings])
  
  // ── Get drawn marker position (for draft confirm) ──
  const getMarkerPosition = useCallback((drawingId) => {
    const d = drawings.find(d => d.id === drawingId)
    if (!d?.layer?.getLatLng) return null
    const ll = d.layer.getLatLng()
    return { lat: ll.lat, lng: ll.lng }
  }, [drawings])
  
  return {
    // State
    drawings,       // Array of {id, type, geometry, properties, layer}
    drawingMode,    // null | 'polygon' | 'circle' | 'polyline' | 'corridor' | 'marker' | 'rectangle'
    ready,          // boolean — Leaflet.Draw loaded?
    
    // Actions
    startDraw,      // (type) => start drawing
    stopDraw,       // () => cancel current draw
    removeDrawing,  // (id) => remove specific drawing
    clearAll,       // () => remove all
    updateDrawing,  // (id, {label, severity, category}) => update props
    
    // Export
    toGeoJSON,      // () => FeatureCollection of all drawings
    getMarkerPosition // (id) => {lat, lng} for draggable markers
  }
}

// ═══════════════════════════════════════════════
// DRAW TOOLBAR COMPONENT (optional)
// ═══════════════════════════════════════════════
/**
 * Render a floating draw toolbar on the map.
 * 
 * Usage:
 *   <DrawToolbar draw={draw} />
 * 
 * where draw = useMapDraw(mapRef, leafletRef)
 */
export function DrawToolbar({ draw, style }) {
  if (!draw?.ready) return null
  
  const tools = [
    { type: 'marker',    icon: '📍', label: 'Pin' },
    { type: 'polygon',   icon: '⬡',  label: 'Polygon' },
    { type: 'circle',    icon: '⊚',  label: 'Circle' },
    { type: 'corridor',  icon: '↝',  label: 'Route' },
    { type: 'rectangle', icon: '▭',  label: 'Rectangle' },
  ]
  
  const base = {
    position: 'absolute', top: 80, right: 12, zIndex: 1000,
    display: 'flex', flexDirection: 'column', gap: 3,
    background: 'var(--bg-secondary, #0C1020)', 
    border: '1px solid var(--border-primary, #1A1E35)',
    borderRadius: 10, padding: 4,
    boxShadow: '0 4px 16px rgba(0,0,0,.3)',
    ...style
  }
  
  const btnStyle = (active) => ({
    width: 36, height: 36, borderRadius: 7,
    border: active ? '2px solid #C9A84C' : '1px solid transparent',
    background: active ? '#C9A84C22' : 'transparent',
    color: active ? '#C9A84C' : 'var(--text-muted, #6B6580)',
    cursor: 'pointer', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', transition: 'all .15s ease'
  })
  
  return (
    <div style={base}>
      {tools.map(t => (
        <button
          key={t.type}
          onClick={() => draw.drawingMode === t.type ? draw.stopDraw() : draw.startDraw(t.type)}
          style={btnStyle(draw.drawingMode === t.type)}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}
      {draw.drawings.length > 0 && (
        <button
          onClick={draw.clearAll}
          style={{ ...btnStyle(false), color: '#E8553A', fontSize: 12, fontWeight: 700 }}
          title="Clear all drawings"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// DRAWING LIST COMPONENT (sidebar)
// ═══════════════════════════════════════════════
/**
 * Render a list of drawn features with metadata.
 * 
 * Usage:
 *   <DrawingsList draw={draw} onSelect={(d) => map.fitBounds(d.layer.getBounds())} />
 */
export function DrawingsList({ draw, onSelect, style }) {
  if (!draw?.drawings?.length) return null
  
  const typeIcons = {
    polygon: '⬡', circle: '⊚', polyline: '↝', corridor: '↝',
    rectangle: '▭', marker: '📍'
  }
  
  const catColors = {
    risk_zone: '#E8553A', access_denied: '#E8553A', flood_extent: '#4BA8CC',
    incident: '#C9A84C', corridor: '#5AAE7A', custom: '#A8A0B0'
  }
  
  return (
    <div style={{ fontSize: 'calc(var(--fs, 13px) * 0.72)', ...style }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-muted)' }}>
        ✏️ Drawings ({draw.drawings.length})
      </div>
      {draw.drawings.map(d => (
        <div
          key={d.id}
          onClick={() => {
            if (onSelect) onSelect(d)
            else if (d.layer?.getBounds) {
              // Auto zoom to feature
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 8px', marginBottom: 2, borderRadius: 6,
            background: 'var(--surface-card, #0E1224)',
            border: '1px solid var(--border-subtle, #1A1E35)',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: 16 }}>{typeIcons[d.type] || '?'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.properties.label || d.type.charAt(0).toUpperCase() + d.type.slice(1)}
            </div>
            <div style={{ color: 'var(--text-faint)', fontSize: '0.85em' }}>
              {d.properties.areaKm2 ? `${d.properties.areaKm2} km²` : ''}
              {d.properties.lengthKm ? `${d.properties.lengthKm} km` : ''}
              {d.properties.radiusKm ? `r: ${d.properties.radiusKm} km` : ''}
              {d.type === 'marker' ? `${d.properties.lat?.toFixed(3)}, ${d.properties.lng?.toFixed(3)}` : ''}
            </div>
          </div>
          <span
            style={{ width: 8, height: 8, borderRadius: '50%', background: catColors[d.properties.category] || '#A8A0B0' }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); draw.removeDrawing(d.id) }}
            style={{
              border: 'none', background: 'transparent', color: '#E8553A',
              cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: '0 4px'
            }}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
