/**
 * InteractiveMap.jsx — Extracted Map Component
 *
 * Responsibilities:
 *   - Leaflet map lifecycle (init, cleanup)
 *   - Render event layers (corridor, incidents, risks, access, bases, drawings)
 *   - Node click → Zustand selectNode → sidebar detail
 *   - Base layer switching with theme adaptation
 *   - Drawing tools integration (Leaflet.Draw + Turf.js)
 *   - Sentinel-2 overlay toggle
 *   - Map click mode (incident placement)
 */
import { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react'
import useAppStore, { useActiveEvent } from '../../store/useAppStore.js'
import useMapDraw, { DrawToolbar, DrawingsList } from '../../hooks/useMapDraw.jsx'
import {
  renderEventToMap, SEVERITY, ICON_MAP, COPERNICUS_INSTANCE
} from '../../data/events.js'
import { t } from '../../data/i18n.js'

// ─── Tile Layer Factory ───────────────────────────────────────

const TILES = {
  osm: (L) => L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
  dark: (L) => L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 20 }),
  darklabel: (L) => L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }),
  hot: (L) => L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', { maxZoom: 19 }),
  esri: (L) => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
  topo: (L) => L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 }),
}

function mkTile(L, id, theme) {
  if (id === 'osm' && theme === 'dark') return TILES.dark(L)
  return (TILES[id] || TILES.osm)(L)
}

// ─── Component ────────────────────────────────────────────────

function InteractiveMap({
  mapClickMode = false,
  onMapClick = null,
  mapClickMarkerRef = null,
  onMapRefsReady = null,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const baseLayerRef = useRef(null)
  const sentinelLayerRef = useRef(null)
  const eventLayersRef = useRef({})
  const infraLayersRef = useRef({})
  const [mapReady, setMapReady] = useState(false)

  // Store selectors (minimal subscriptions for perf)
  const theme = useAppStore(s => s.theme)
  const baseLayerId = useAppStore(s => s.baseLayerId)
  const sentinel2 = useAppStore(s => s.sentinel2)
  const mapAnims = useAppStore(s => s.mapAnims)
  const dataLayers = useAppStore(s => s.dataLayers)
  const activeEventId = useAppStore(s => s.activeEventId)
  const lang = useAppStore(s => s.lang)
  const activeEvent = useActiveEvent()

  // Draw tools
  const draw = useMapDraw(mapRef, leafletRef, mapReady)

  // Expose refs to parent
  useEffect(() => {
    if (onMapRefsReady && mapRef.current && leafletRef.current) {
      onMapRefsReady({ map: mapRef.current, L: leafletRef.current })
    }
  }, [mapReady])

  // ─── Init Leaflet ─────────────────────────────────────
  const initStartedRef = useRef(false)
  useEffect(() => {
    if (mapRef.current || initStartedRef.current) return
    initStartedRef.current = true

    import('leaflet').then(mod => {
      if (mapRef.current) return // double-check after async
      const L = mod.default || mod
      leafletRef.current = L

      // Fix default icon paths
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!containerRef.current) return // container unmounted
      const map = L.map(containerRef.current, { zoomControl: true })
        .setView(activeEvent?.region?.center || [9.5, 30.5], activeEvent?.region?.zoom || 6)

      mapRef.current = map

      // Initial base layer
      const bl = mkTile(L, baseLayerId, theme)
      bl.addTo(map)
      baseLayerRef.current = bl

      // Render event layers with click-to-sidebar
      if (activeEvent) {
        const layers = renderEventToMap(L, activeEvent, mapAnims, true)
        Object.entries(layers).forEach(([k, l]) => {
          if (dataLayers[k] !== false) l.addTo(map)
        })
        eventLayersRef.current = layers
        if (activeEvent.region?.bounds) {
          map.fitBounds(activeEvent.region.bounds, { padding: [30, 30] })
        }
      }

      // Register global viewDetail handler for popup buttons
      window.__cpViewDetail = (type, id) => {
        useAppStore.getState().selectNode(type, id)
        // Scroll to incident in sidebar
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
      // Force tile load after container is sized
      setTimeout(() => { map.invalidateSize(); }, 100)
      setTimeout(() => { map.invalidateSize(); }, 500)
    })

    return () => {
      delete window.__cpViewDetail
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      initStartedRef.current = false
    }
  }, []) // mount only

  // ─── Map Click for Incident Placement ───────────────
  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L) return

    const handler = (e) => {
      if (!mapClickMode) return
      const { lat, lng } = e.latlng
      if (onMapClick) onMapClick(+lat.toFixed(4), +lng.toFixed(4))

      // Show preview marker
      if (mapClickMarkerRef?.current) map.removeLayer(mapClickMarkerRef.current)
      const marker = L.circleMarker([lat, lng], {
        radius: 12, fillColor: '#C9A84C', color: '#FFF', weight: 3, fillOpacity: 0.7,
      }).addTo(map)
      if (mapClickMarkerRef) mapClickMarkerRef.current = marker
    }
    map.on('click', handler)
    return () => map.off('click', handler)
  }, [mapClickMode])

  // ─── Re-render Event Layers on Active Event Change ──
  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !activeEvent) return

    // Clean old layers
    Object.values(eventLayersRef.current).forEach(l => {
      try { map.removeLayer(l) } catch {}
    })

    // Render new
    const layers = renderEventToMap(L, activeEvent, mapAnims, true)
    Object.entries(layers).forEach(([k, l]) => {
      if (dataLayers[k] !== false) l.addTo(map)
    })
    eventLayersRef.current = layers

    // Fly to event region
    if (activeEvent.region?.bounds) {
      map.fitBounds(activeEvent.region.bounds, { padding: [30, 30], animate: true })
    } else if (activeEvent.region?.center) {
      map.setView(activeEvent.region.center, activeEvent.region.zoom || 2, { animate: true, duration: 1 })
    }

    setTimeout(() => map.invalidateSize(), 200)
  }, [activeEventId, activeEvent?.incidents?.length, activeEvent?.corridor?.length])

  // ─── Base Layer Switching ───────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L) return
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current)
    const layer = mkTile(L, baseLayerId, theme)
    layer.addTo(map)
    layer.bringToBack()
    baseLayerRef.current = layer
  }, [baseLayerId, theme])

  // ─── Sentinel-2 Toggle ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L) return
    if (sentinelLayerRef.current) {
      map.removeLayer(sentinelLayerRef.current)
      sentinelLayerRef.current = null
    }
    if (sentinel2) {
      const s = L.tileLayer.wms('https://sh.dataspace.copernicus.eu/ogc/wms/' + COPERNICUS_INSTANCE, {
        layers: 'TRUE-COLOR', tileSize: 512, format: 'image/png',
        transparent: true, maxcc: 30, minZoom: 6, maxZoom: 16,
        time: '2025-10-01/2026-02-12',
      })
      s.addTo(map)
      sentinelLayerRef.current = s
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

  // ─── Invalidate on resize ──────────────────────────
  const invalidateSize = useCallback(() => {
    setTimeout(() => mapRef.current?.invalidateSize(), 200)
  }, [])

  // Expose imperative methods
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__cpMapInvalidate = invalidateSize
      window.__cpMapFlyTo = (lat, lng, zoom = 9) => mapRef.current?.setView([lat, lng], zoom)
      window.__cpMapFitBounds = (bounds, opts) => mapRef.current?.fitBounds(bounds, opts)
      window.__cpMapGetBounds = () => mapRef.current?.getBounds()
    }
    return () => {
      delete window.__cpMapInvalidate
      delete window.__cpMapFlyTo
      delete window.__cpMapFitBounds
      delete window.__cpMapGetBounds
    }
  }, [mapReady])

  // ─── Rerender layers when map anims toggle ──────────
  useEffect(() => {
    if (!mapReady || !activeEvent) return
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L) return
    Object.values(eventLayersRef.current).forEach(l => {
      try { map.removeLayer(l) } catch {}
    })
    const layers = renderEventToMap(L, activeEvent, mapAnims, true)
    Object.entries(layers).forEach(([k, l]) => {
      if (dataLayers[k] !== false) l.addTo(map)
    })
    eventLayersRef.current = layers
  }, [mapAnims])

  // ─── Render ─────────────────────────────────────────

  const _ = (k) => t(k, lang)
  const sortedIncidents = useMemo(() => [...(activeEvent?.incidents || [])].sort((a, b) => a.dt.localeCompare(b.dt)), [activeEvent?.incidents])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Leaflet Container */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', cursor: mapClickMode ? 'crosshair' : 'grab' }}
      />

      {/* Map Title Bar */}
      <div style={{ position: 'absolute', top: 12, left: 44, zIndex: 1000, pointerEvents: 'none', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 'calc(var(--fs)*.65)', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', background: 'var(--glass)', padding: '6px 16px', borderRadius: 6 }}>
          Humanitarian Corridor Map
        </span>
        {(activeEvent?.incidents || []).filter(i => i.s === 'critical').length > 0 && (
          <span style={{ fontSize: 'calc(var(--fs)*.6)', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '4px 12px', borderRadius: 6, fontWeight: 700, letterSpacing: '.06em' }}>
            {(activeEvent.incidents || []).filter(i => i.s === 'critical').length} Critical
          </span>
        )}
      </div>

      {/* Map Click Mode Banner */}
      {mapClickMode && (
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 1000, background: 'var(--accent)', color: '#FFF', padding: '6px 14px', borderRadius: 8, fontWeight: 700, animation: 'pulse 1.5s infinite' }}>
          {_('clickMap')}
        </div>
      )}

      {/* Drawing Mode Banner */}
      {draw.drawingMode && (
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--accent)', color: '#FFF', padding: '6px 18px', borderRadius: 8, fontWeight: 700, fontSize: 'calc(var(--fs)*.72)', animation: 'pulse 1.5s infinite', display: 'flex', alignItems: 'center', gap: 8 }}>
          ✏️ Drawing: {draw.drawingMode}
          <button
            onClick={draw.stopDraw}
            style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#FFF', cursor: 'pointer', borderRadius: 5, padding: '2px 8px', fontFamily: 'inherit', fontWeight: 700 }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Draw Toolbar */}
      <DrawToolbar draw={draw} style={{ top: 14, right: 14 }} />

      {/* Map Action Buttons (Warning + Print) */}
      {!mapClickMode && !draw.drawingMode && (
        <div style={{ position: 'absolute', top: 14, right: 56, zIndex: 999, display: 'flex', gap: 5, flexDirection: 'column' }}>
          <button
            onClick={() => { useAppStore.getState().setDetailOpen(true); useAppStore.getState().setDetailTab('incidents') }}
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--glass-strong)', cursor: 'pointer', fontSize: 'calc(var(--fs)*1)' }}
          >⚠️</button>
          <button
            onClick={() => window.print()}
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--glass-strong)', cursor: 'pointer', fontSize: 'calc(var(--fs)*1)' }}
          >🖨️</button>
        </div>
      )}

      {/* Timeline Bar */}
      {sortedIncidents.length > 0 && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: 8, background: 'var(--glass-strong)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '10px 18px', alignItems: 'center', boxShadow: 'var(--shadow-md)' }}>
          <span style={{ fontSize: 'calc(var(--fs)*.72)', color: 'var(--text-muted)', fontWeight: 700, marginRight: 6 }}>
            {_('timeline')}
          </span>
          {sortedIncidents.map(inc => (
            <div
              key={inc.id}
              title={inc.ti}
              onClick={() => window.__cpMapFlyTo?.(inc.a, inc.o)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '4px 8px', borderRadius: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 'calc(var(--fs)*1.3)' }}>
                {ICON_MAP[inc.tp] || '⚠️'}
              </span>
              <span style={{ fontSize: 'calc(var(--fs)*.62)', marginTop: 3, fontWeight: 700, color: (SEVERITY[inc.s] || SEVERITY.medium).color }}>
                {inc.dt.slice(5)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Export DrawingsList for use in sidebar
export { DrawingsList }

export default memo(InteractiveMap)
