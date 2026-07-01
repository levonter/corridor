/**
 * InteractiveMap.jsx — MapLibre GL + Leaflet Hybrid
 *
 * Base tiles: MapLibre GL JS (WebGL, vector/raster, CDN loaded)
 * Overlays: Leaflet (circleMarkers, polylines, popups, draw tools)
 * Bridge: maplibre-gl-leaflet plugin (L.maplibreGL)
 *
 * NO API KEY REQUIRED — uses OSM raster tiles + CartoDB styles
 */
import { useRef, useEffect, useState, useMemo, memo } from 'react'
import useAppStore, { useActiveEvent } from '../../store/useAppStore.js'
import useMapDraw, { DrawToolbar, DrawingsList } from '../../hooks/useMapDraw.jsx'
import { renderEventToMap, SEVERITY, ICON_MAP, COPERNICUS_INSTANCE } from '../../data/events.js'
import { t } from '../../data/i18n.js'

// ─── CDN Loader: MapLibre GL + Leaflet Bridge ────────────────

let _mlLoaded = false
let _mlPromise = null

function loadMapLibreGL() {
  if (_mlLoaded && window.maplibregl && window.L?.maplibreGL) return Promise.resolve()
  if (_mlPromise) return _mlPromise

  _mlPromise = new Promise((resolve, reject) => {
    // 1. MapLibre GL CSS
    if (!document.querySelector('link[href*="maplibre-gl"]')) {
      const css = document.createElement('link')
      css.rel = 'stylesheet'
      css.href = 'https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.css'
      document.head.appendChild(css)
    }
    // 2. MapLibre GL JS
    const loadML = () => new Promise((res, rej) => {
      if (window.maplibregl) return res()
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.js'
      s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
    // 3. maplibre-gl-leaflet bridge
    const loadBridge = () => new Promise((res, rej) => {
      if (window.L?.maplibreGL) return res()
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js'
      s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })

    loadML()
      .then(loadBridge)
      .then(() => { _mlLoaded = true; resolve() })
      .catch(e => { console.warn('MapLibre load failed, falling back to raster:', e); resolve() })
  })
  return _mlPromise
}

// ─── MapLibre Style Definitions (no API key) ─────────────────

/** Inline raster style: OSM tiles rendered via MapLibre WebGL */
function osmRasterStyle() {
  return {
    version: 8,
    name: 'OSM Raster',
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm-tiles' }],
  }
}

function darkRasterStyle() {
  return {
    version: 8,
    name: 'Dark',
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      },
    },
    layers: [{ id: 'carto-dark', type: 'raster', source: 'carto-dark' }],
  }
}

function darkNoLabelsStyle() {
  return {
    version: 8,
    name: 'Dark (no labels)',
    sources: {
      'carto-dark-nolabel': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© CARTO © OSM',
      },
    },
    layers: [{ id: 'carto-dark-nolabel', type: 'raster', source: 'carto-dark-nolabel' }],
  }
}

function hotStyle() {
  return {
    version: 8, name: 'HOT Humanitarian',
    sources: { hot: { type: 'raster', tiles: ['https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap (HOT)' } },
    layers: [{ id: 'hot', type: 'raster', source: 'hot' }],
  }
}

function esriStyle() {
  return {
    version: 8, name: 'ESRI Satellite',
    sources: { esri: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: '© Esri' } },
    layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
  }
}

function topoStyle() {
  return {
    version: 8, name: 'OpenTopoMap',
    sources: { topo: { type: 'raster', tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 17, attribution: '© OpenTopoMap' } },
    layers: [{ id: 'topo', type: 'raster', source: 'topo' }],
  }
}

const ML_STYLES = {
  osm: osmRasterStyle,
  dark: darkNoLabelsStyle,
  darklabel: darkRasterStyle,
  hot: hotStyle,
  esri: esriStyle,
  topo: topoStyle,
}

function getMLStyle(id, theme) {
  if (id === 'osm' && theme === 'dark') return darkRasterStyle()
  return (ML_STYLES[id] || ML_STYLES.osm)()
}

// ─── Leaflet raster fallback (if MapLibre fails to load) ─────

const RASTER_TILES = {
  osm: (L) => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
  dark: (L) => L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 20 }),
  darklabel: (L) => L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }),
  hot: (L) => L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 19 }),
  esri: (L) => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
  topo: (L) => L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 }),
}

function mkFallbackTile(L, id, theme) {
  if (id === 'osm' && theme === 'dark') return RASTER_TILES.dark(L)
  return (RASTER_TILES[id] || RASTER_TILES.osm)(L)
}

// ─── Component ────────────────────────────────────────────────

function InteractiveMap({ mapClickMode = false, onMapClick = null, mapClickMarkerRef = null, onMapRefsReady = null }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const baseLayerRef = useRef(null)
  const sentinelLayerRef = useRef(null)
  const eventLayersRef = useRef({})
  const initStartedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)

  const theme = useAppStore(s => s.theme)
  const baseLayerId = useAppStore(s => s.baseLayerId)
  const sentinel2 = useAppStore(s => s.sentinel2)
  const mapAnims = useAppStore(s => s.mapAnims)
  const dataLayers = useAppStore(s => s.dataLayers)
  const activeEventId = useAppStore(s => s.activeEventId)
  const lang = useAppStore(s => s.lang)
  const activeEvent = useActiveEvent()
  const draw = useMapDraw(mapRef, leafletRef, mapReady)

  useEffect(() => {
    if (onMapRefsReady && mapRef.current && leafletRef.current) {
      onMapRefsReady({ map: mapRef.current, L: leafletRef.current })
    }
  }, [mapReady])

  // ─── Init Leaflet + MapLibre Base ───────────────────
  useEffect(() => {
    if (mapRef.current || initStartedRef.current) return
    initStartedRef.current = true

    import('leaflet').then(async (mod) => {
      if (mapRef.current) return
      const L = mod.default || mod
      leafletRef.current = L

      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!containerRef.current) return
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false, // we add our own
      }).setView(activeEvent?.region?.center || [9.5, 30.5], activeEvent?.region?.zoom || 6)
      
      // Custom attribution
      L.control.attribution({ prefix: false })
        .addAttribution('© <a href="https://maplibre.org">MapLibre</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
        .addTo(map)
      
      mapRef.current = map

      // Try MapLibre GL base layer
      let useMapLibre = false
      try {
        await loadMapLibreGL()
        if (window.L?.maplibreGL) {
          const style = getMLStyle(baseLayerId, theme)
          const gl = L.maplibreGL({ style, noWrap: true }).addTo(map)
          baseLayerRef.current = gl
          useMapLibre = true
        }
      } catch (e) {
        console.warn('MapLibre GL init failed:', e)
      }

      // Fallback to raster tiles
      if (!useMapLibre) {
        const bl = mkFallbackTile(L, baseLayerId, theme)
        bl.addTo(map)
        baseLayerRef.current = bl
      }

      // Render event layers
      if (activeEvent) {
        const layers = renderEventToMap(L, activeEvent, mapAnims, true)
        Object.entries(layers).forEach(([k, l]) => {
          if (dataLayers[k] !== false) l.addTo(map)
        })
        eventLayersRef.current = layers
        if (activeEvent.region?.bounds) map.fitBounds(activeEvent.region.bounds, { padding: [30, 30] })
      }

      // Global viewDetail handler
      window.__cpViewDetail = (type, id) => {
        useAppStore.getState().selectNode(type, id)
        if (type === 'incident') {
          setTimeout(() => {
            const el = document.querySelector(`[data-inc-id="${id}"]`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              el.style.boxShadow = '0 0 0 2px var(--accent)'
              setTimeout(() => { el.style.boxShadow = '' }, 2000)
            }
          }, 100)
        }
      }

      setMapReady(true)
      setTimeout(() => map.invalidateSize(), 100)
      setTimeout(() => map.invalidateSize(), 500)
    })

    return () => {
      delete window.__cpViewDetail
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      initStartedRef.current = false
    }
  }, [])

  // ─── Map Click for Incident Placement ───────────────
  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current
    if (!map || !L) return
    const handler = (e) => {
      if (!mapClickMode) return
      const { lat, lng } = e.latlng
      if (onMapClick) onMapClick(+lat.toFixed(4), +lng.toFixed(4))
      if (mapClickMarkerRef?.current) map.removeLayer(mapClickMarkerRef.current)
      const marker = L.circleMarker([lat, lng], { radius: 12, fillColor: '#C9A84C', color: '#FFF', weight: 3, fillOpacity: 0.7 }).addTo(map)
      if (mapClickMarkerRef) mapClickMarkerRef.current = marker
    }
    map.on('click', handler)
    return () => map.off('click', handler)
  }, [mapClickMode])

  // ─── Re-render Event Layers ─────────────────────────
  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current
    if (!map || !L || !activeEvent) return
    Object.values(eventLayersRef.current).forEach(l => { try { map.removeLayer(l) } catch {} })
    const layers = renderEventToMap(L, activeEvent, mapAnims, true)
    Object.entries(layers).forEach(([k, l]) => { if (dataLayers[k] !== false) l.addTo(map) })
    eventLayersRef.current = layers
    if (activeEvent.region?.bounds) map.fitBounds(activeEvent.region.bounds, { padding: [30, 30], animate: true })
    else if (activeEvent.region?.center) map.setView(activeEvent.region.center, activeEvent.region.zoom || 2, { animate: true, duration: 1 })
    setTimeout(() => map.invalidateSize(), 200)
  }, [activeEventId, activeEvent?.incidents?.length, activeEvent?.corridor?.length])

  // ─── Base Layer Switching (MapLibre or Raster) ──────
  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current
    if (!map || !L) return
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current)

    if (_mlLoaded && L.maplibreGL) {
      const style = getMLStyle(baseLayerId, theme)
      const gl = L.maplibreGL({ style, noWrap: true }).addTo(map)
      gl.bringToBack?.()
      baseLayerRef.current = gl
    } else {
      const layer = mkFallbackTile(L, baseLayerId, theme)
      layer.addTo(map); layer.bringToBack()
      baseLayerRef.current = layer
    }
  }, [baseLayerId, theme])

  // ─── Sentinel-2 Toggle ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current
    if (!map || !L) return
    if (sentinelLayerRef.current) { map.removeLayer(sentinelLayerRef.current); sentinelLayerRef.current = null }
    if (sentinel2) {
      const s = L.tileLayer.wms('https://sh.dataspace.copernicus.eu/ogc/wms/' + COPERNICUS_INSTANCE, {
        layers: 'TRUE-COLOR', tileSize: 512, format: 'image/png', transparent: true, maxcc: 30, minZoom: 6, maxZoom: 16, time: '2025-10-01/2026-02-12',
      })
      s.addTo(map); sentinelLayerRef.current = s
    }
  }, [sentinel2])

  // ─── Data Layer Toggle ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    Object.entries(dataLayers).forEach(([k, visible]) => {
      const layer = eventLayersRef.current[k]
      if (!layer) return
      if (visible && !map.hasLayer(layer)) layer.addTo(map)
      else if (!visible && map.hasLayer(layer)) map.removeLayer(layer)
    })
  }, [dataLayers])

  // ─── Re-render on animation toggle ─────────────────
  useEffect(() => {
    if (!mapReady || !activeEvent) return
    const map = mapRef.current, L = leafletRef.current
    if (!map || !L) return
    Object.values(eventLayersRef.current).forEach(l => { try { map.removeLayer(l) } catch {} })
    const layers = renderEventToMap(L, activeEvent, mapAnims, true)
    Object.entries(layers).forEach(([k, l]) => { if (dataLayers[k] !== false) l.addTo(map) })
    eventLayersRef.current = layers
  }, [mapAnims])

  // ─── Expose imperative methods ──────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__cpMapInvalidate = () => setTimeout(() => mapRef.current?.invalidateSize(), 200)
      window.__cpMapFlyTo = (lat, lng, zoom = 9) => mapRef.current?.setView([lat, lng], zoom)
      window.__cpMapFitBounds = (bounds, opts) => mapRef.current?.fitBounds(bounds, opts)
      window.__cpMapGetBounds = () => mapRef.current?.getBounds()
    }
    return () => { delete window.__cpMapInvalidate; delete window.__cpMapFlyTo; delete window.__cpMapFitBounds; delete window.__cpMapGetBounds }
  }, [mapReady])

  // ─── Render ─────────────────────────────────────────
  const _ = (k) => t(k, lang)
  const sortedIncidents = useMemo(() => [...(activeEvent?.incidents || [])].sort((a, b) => a.dt.localeCompare(b.dt)), [activeEvent?.incidents])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: mapClickMode ? 'crosshair' : 'grab' }} />

      {/* Title */}
      <div style={{ position: 'absolute', top: 12, left: 44, zIndex: 1000, pointerEvents: 'none', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 'calc(var(--fs)*.65)', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', background: 'var(--glass)', padding: '6px 16px', borderRadius: 6 }}>Humanitarian Corridor Map</span>
        {(activeEvent?.incidents || []).filter(i => i.s === 'critical').length > 0 && (
          <span style={{ fontSize: 'calc(var(--fs)*.6)', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '4px 12px', borderRadius: 6, fontWeight: 700, letterSpacing: '.06em' }}>{(activeEvent.incidents || []).filter(i => i.s === 'critical').length} Critical</span>
        )}
      </div>

      {mapClickMode && <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 1000, background: 'var(--accent)', color: '#FFF', padding: '6px 14px', borderRadius: 8, fontWeight: 700, animation: 'pulse 1.5s infinite' }}>{_('clickMap')}</div>}

      {draw.drawingMode && <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--accent)', color: '#FFF', padding: '6px 18px', borderRadius: 8, fontWeight: 700, fontSize: 'calc(var(--fs)*.72)', animation: 'pulse 1.5s infinite', display: 'flex', alignItems: 'center', gap: 8 }}>✏️ Drawing: {draw.drawingMode} <button onClick={draw.stopDraw} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#FFF', cursor: 'pointer', borderRadius: 5, padding: '2px 8px', fontFamily: 'inherit', fontWeight: 700 }}>Cancel</button></div>}

      <DrawToolbar draw={draw} style={{ top: 14, right: 14 }} />

      {!mapClickMode && !draw.drawingMode && (
        <div style={{ position: 'absolute', top: 14, right: 56, zIndex: 999, display: 'flex', gap: 5, flexDirection: 'column' }}>
          <button onClick={() => { useAppStore.getState().setDetailOpen(true); useAppStore.getState().setDetailTab('incidents') }} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--glass-strong)', cursor: 'pointer', fontSize: 'calc(var(--fs)*1)' }}>⚠️</button>
          <button onClick={() => window.print()} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--glass-strong)', cursor: 'pointer', fontSize: 'calc(var(--fs)*1)' }}>🖨️</button>
        </div>
      )}

      {sortedIncidents.length > 0 && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: 8, background: 'var(--glass-strong)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '10px 18px', alignItems: 'center', boxShadow: 'var(--shadow-md)' }}>
          <span style={{ fontSize: 'calc(var(--fs)*.72)', color: 'var(--text-muted)', fontWeight: 700, marginRight: 6 }}>{_('timeline')}</span>
          {sortedIncidents.map(inc => (
            <div key={inc.id} title={inc.ti} onClick={() => window.__cpMapFlyTo?.(inc.a, inc.o)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontSize: 'calc(var(--fs)*1.3)' }}>{ICON_MAP[inc.tp] || '⚠️'}</span>
              <span style={{ fontSize: 'calc(var(--fs)*.62)', marginTop: 3, fontWeight: 700, color: (SEVERITY[inc.s] || SEVERITY.medium).color }}>{inc.dt.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { DrawingsList }
export default memo(InteractiveMap)
