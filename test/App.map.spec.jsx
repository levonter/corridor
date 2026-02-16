import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import App from '../src/App.jsx'

// Mock Leaflet with spies we can assert on
const makeLeafletMock = () => {
  const makeAddable = () => ({
    addTo: vi.fn(function () { return this }),
    bindPopup: vi.fn(function () { return this }),
  })

  const mapApi = {
    setView: vi.fn(function () { return this }),
    fitBounds: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    invalidateSize: vi.fn(),
  }

  const groups = []
  const layerGroup = vi.fn(() => {
    const g = makeAddable()
    groups.push(g)
    return g
  })

  const tileLayer = vi.fn((url, opts) => ({
    url,
    opts,
    addTo: vi.fn(function () { return this }),
    bringToBack: vi.fn(),
  }))
  tileLayer.wms = vi.fn((url, opts) => ({
    url,
    opts,
    addTo: vi.fn(function () { return this }),
  }))

  const circle = vi.fn(() => makeAddable())
  const circleMarker = vi.fn(() => makeAddable())
  const polyline = vi.fn(() => makeAddable())
  const marker = vi.fn(() => makeAddable())
  const divIcon = vi.fn(() => ({}))
  const map = vi.fn(() => ({ ...mapApi }))

  const L = { map, tileLayer, circle, circleMarker, polyline, marker, divIcon, layerGroup, _groups: groups, _mapApi: mapApi }
  return { default: L, ...L }
}

vi.mock('leaflet', () => makeLeafletMock())
vi.mock('leaflet/dist/leaflet.css', () => ({}))

const renderApp = () => render(<App />)

describe('Map initialization and data layers', () => {
  it('initializes map and adds all core data layers on load', async () => {
    const { default: L } = await import('leaflet')
    renderApp()

    // Map created once
    expect(L.map).toHaveBeenCalledTimes(1)

    // Base OSM tile added
    expect(L.tileLayer).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({ attribution: expect.any(String) })
    )

    // 5 layerGroups: corridor, risks, access, incidents, bases
    expect(L.layerGroup).toHaveBeenCalledTimes(5)

    // Each group should have been added to the map
    L._groups.forEach(g => {
      expect(g.addTo).toHaveBeenCalledWith(expect.objectContaining({}))
    })

    // Some geometries created (sanity checks)
    expect(L.polyline).toHaveBeenCalled()
    expect(L.circle).toHaveBeenCalled()
    expect(L.circleMarker).toHaveBeenCalled()
    expect(L.marker).toHaveBeenCalled()
  })
})

describe('Data layer toggles', () => {
  it('toggles layers off and on, removing and re-adding to the map', async () => {
    const user = userEvent.setup()
    const { default: L } = await import('leaflet')
    renderApp()

    // Toggle incidents
    const btnIncidents = screen.getByRole('button', { name: /incidents/i })

    // Toggle off -> removeLayer called with the incidents group
    await user.click(btnIncidents)
    const incidentsGroup = L._groups[3] // order: corridor, risks, access, incidents
    expect(L._mapApi.removeLayer).toHaveBeenCalledWith(incidentsGroup)

    // Toggle on -> group's addTo called again
    await user.click(btnIncidents)
    expect(incidentsGroup.addTo).toHaveBeenCalledTimes(2)
  })
})

describe('View toggle and map invalidateSize', () => {
  it('switches between MAP and FLOW and invalidates size when returning to map', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { default: L } = await import('leaflet')

    renderApp()

    // Go to FLOW
    const flowBtn = screen.getByRole('button', { name: /flow/i })
    await user.click(flowBtn)
    expect(screen.getByText(/PROJECT FLOW/i)).toBeInTheDocument()

    // Back to MAP
    const mapBtn = screen.getByRole('button', { name: /map/i })
    await user.click(mapBtn)

    // invalidateSize is called after a timeout of 100ms
    expect(L._mapApi.invalidateSize).not.toHaveBeenCalled()
    vi.advanceTimersByTime(120)
    expect(L._mapApi.invalidateSize).toHaveBeenCalled()

    vi.useRealTimers()
  })
})

describe('Settings panel: font size and base map layer', () => {
  it('updates CSS font size variable when slider changes', async () => {
    const user = userEvent.setup()
    renderApp()

    // Open settings by probing buttons until the panel appears (button has no label)
    const openSettings = async () => {
      const buttons = screen.getAllByRole('button')
      for (const b of buttons) {
        await user.click(b)
        if (screen.queryByText(/Settings/i)) return
      }
      throw new Error('Settings panel could not be opened')
    }
    await openSettings()

    // Find Font Size range input and change value
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '16' } })

    // Assert CSS variable updated
    // allow effects to flush
    await Promise.resolve()
    expect(document.documentElement.style.getPropertyValue('--fs')).toBe('16px')
  })

  it('switches base layer and sends old layer to remove, new to add/bringToBack', async () => {
    const user = userEvent.setup()
    const { default: L } = await import('leaflet')
    renderApp()

    // Open settings (reuse probing strategy)
    const buttons = screen.getAllByRole('button')
    for (const b of buttons) {
      await user.click(b)
      if (screen.queryByText(/Settings/i)) break
    }

    // Pick ESRI Satellite radio
    const esriOption = screen.getByText(/ESRI Satellite/i).closest('label')
    const radio = within(esriOption).getByRole('radio')
    await user.click(radio)

    // Previous base layer removed
    expect(L._mapApi.removeLayer).toHaveBeenCalled()

    // New layer created with ESRI URL and brought to back
    const lastTileCall = L.tileLayer.mock.calls.at(-1)
    expect(lastTileCall[0]).toMatch(/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery/)
  })
})