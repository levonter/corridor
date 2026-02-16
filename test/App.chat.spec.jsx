import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import App from '../src/App.jsx'

// Leaflet is not the focus here; minimal mock to satisfy init
vi.mock('leaflet', () => {
  const noopAddable = () => ({ addTo: vi.fn(function () { return this }), bindPopup: vi.fn(function(){ return this }) })
  const map = vi.fn(() => ({ setView: vi.fn(function(){ return this }), fitBounds: vi.fn(), removeLayer: vi.fn(), invalidateSize: vi.fn() }))
  const layerGroup = vi.fn(() => noopAddable())
  const tileLayer = vi.fn(() => ({ addTo: vi.fn(function(){ return this }), bringToBack: vi.fn() }))
  tileLayer.wms = vi.fn(() => ({ addTo: vi.fn(function(){ return this }) }))
  const circle = vi.fn(() => noopAddable())
  const circleMarker = vi.fn(() => noopAddable())
  const polyline = vi.fn(() => noopAddable())
  const marker = vi.fn(() => noopAddable())
  const divIcon = vi.fn(() => ({}))
  const L = { map, layerGroup, tileLayer, circle, circleMarker, polyline, marker, divIcon }
  return { default: L, ...L }
})
vi.mock('leaflet/dist/leaflet.css', () => ({}))

describe('AI Chat', () => {
  it('sends user message and appends assistant response, updating UI', async () => {
    const user = userEvent.setup()

    // Mock fetch response from AI
    const mockJson = { content: [{ type: 'text', text: 'Hello from AI. Route via Waat.' }] }
    global.fetch = vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue(mockJson) })

    render(<App />)

    const input = screen.getByPlaceholderText(/Ask about the corridor/i)
    await user.type(input, 'What is the safest route to Lankien?')
    await user.keyboard('{Enter}')

    // User bubble appears
    expect(await screen.findByText(/What is the safest route to Lankien\?/i)).toBeInTheDocument()

    // Thinking placeholder appears while loading
    expect(screen.getByText(/Thinking/i)).toBeInTheDocument()

    // Assistant message appended after fetch resolves
    expect(await screen.findByText(/Hello from AI\. Route via Waat\./i)).toBeInTheDocument()

    // Placeholder disappears
    expect(screen.queryByText(/Thinking/i)).not.toBeInTheDocument()

    // fetch called with expected endpoint
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/anthropic\.com\/v1\/messages/), expect.any(Object))
  })
})