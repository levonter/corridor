/**
 * api.js — TanStack Query wrappers for Corridor Planner
 *
 * Handles:
 *   - Universal AI provider calls (Anthropic, OpenAI-compat, Gemini)
 *   - Nominatim geocoding with intelligent caching
 *   - Brief analysis with optimistic UI support
 */
import { QueryClient, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import useAppStore from '../store/useAppStore.js'
import {
  BRIEF_ANALYSIS_PROMPT, buildSystemPrompt, localParseBrief, setGeoBias
} from '../data/events.js'

// ─── Query Client (singleton) ─────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 min — geocoding, AI results
      gcTime: 30 * 60 * 1000,      // 30 min cache retention
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// ─── Universal AI Call ────────────────────────────────────────

export async function callAI(messages, system = null, maxTokens = 1024) {
  const store = useAppStore.getState()
  const prov = store.aiProviders.find(p => p.id === store.activeProvider)
  if (!prov?.key) throw new Error('No API key configured for ' + (prov?.name || 'provider'))
  const model = store.activeModel

  if (prov.id === 'anthropic') {
    const r = await fetch(prov.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': prov.key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: system || undefined, messages }),
    })
    const d = await r.json()
    if (d.error) throw new Error(d.error.message)
    return (d.content || []).map(b => b.text || '').join('')
  }

  if (prov.id === 'google') {
    const url = prov.url.replace('{model}', model) + '?key=' + prov.key
    const parts = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: parts,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    })
    const d = await r.json()
    if (d.error) throw new Error(d.error.message)
    return d.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  // OpenAI-compatible: GPT, DeepSeek, Grok
  const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages
  const r = await fetch(prov.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + prov.key },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: msgs }),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error?.message || JSON.stringify(d.error))
  return d.choices?.[0]?.message?.content || ''
}

// ─── Geocoding with TanStack Query Cache ──────────────────────

async function nominatimGeocode(placeName, viewbox) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=3${viewbox ? `&viewbox=${viewbox}&bounded=0` : ''}`
  const r = await fetch(url, { headers: { 'User-Agent': 'CorridorPlanner/4.0' } })
  if (!r.ok) throw new Error('Nominatim HTTP ' + r.status)
  return r.json()
}

/**
 * Geocode a place name — uses query cache to avoid duplicate requests
 * Cache key: ['geocode', placeName, viewbox]
 * Stale time: 1 hour (locations don't move)
 */
export function useGeocode(placeName, viewbox) {
  return useQuery({
    queryKey: ['geocode', placeName?.toLowerCase()?.trim(), viewbox || ''],
    queryFn: () => nominatimGeocode(placeName, viewbox),
    enabled: !!placeName?.trim(),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  })
}

/** Imperative geocode with cache check */
export async function geocodeCached(placeName, viewbox) {
  const key = ['geocode', placeName?.toLowerCase()?.trim(), viewbox || '']
  const cached = queryClient.getQueryData(key)
  if (cached) return cached

  const result = await nominatimGeocode(placeName, viewbox)
  queryClient.setQueryData(key, result)
  return result
}

// ─── Brief Analysis Mutation ──────────────────────────────────

/**
 * useBriefAnalysis — TanStack mutation for brief parsing
 * 
 * Flow:
 *   1. User pastes brief → optimistic: run localParseBrief immediately
 *   2. If API key exists → call AI in background
 *   3. If AI succeeds → replace optimistic results
 *   4. If AI fails → keep local parse results
 */
export function useBriefAnalysis() {
  const qc = useQueryClient()
  const store = useAppStore.getState

  return useMutation({
    mutationKey: ['analyzeBrief'],
    mutationFn: async ({ text, eventId }) => {
      const state = store()
      const apiKey = state.aiProviders.find(p => p.id === state.activeProvider)?.key

      // Always start with local parse for immediate feedback
      const localResults = await localParseBrief(text, (pct) => {
        state.replaceChatLastMessage(eventId, `🔍 Geocoding locations... ${pct}%`)
      })

      // If no API key, return local results
      if (!apiKey) {
        return { incidents: localResults, source: 'Local Parser + Nominatim' }
      }

      // Try AI parse
      try {
        const raw = await callAI(
          [{ role: 'user', content: BRIEF_ANALYSIS_PROMPT + ' ' + text }],
          null,
          2048
        )
        const match = raw.match(/\[[\s\S]*\]/)
        if (match) {
          const parsed = JSON.parse(match[0])
          const aiIncidents = parsed
            .filter(p => typeof p.a === 'number' && typeof p.o === 'number')
            .map((p, i) => ({
              id: 'ai_' + Date.now() + '_' + i,
              dt: p.dt || new Date().toISOString().slice(0, 10),
              a: p.a,
              o: p.o,
              tp: p.tp || 'displacement',
              s: p.s || 'medium',
              ti: p.ti || 'AI Detected',
              d: p.d || '',
              ac: p.ac || 'Unknown',
              og: p.og || 'AI',
              _uncertainty: p.uncertainty || false,
              _uncertaintyNote: p.uncertainty_note || null,
            }))
          const provName = state.aiProviders.find(p => p.id === state.activeProvider)?.name || 'AI'
          return {
            incidents: aiIncidents,
            source: `${provName} (${state.activeModel})`,
          }
        }
        // AI returned no JSON — use local results
        return { incidents: localResults, source: 'Local Parser (AI returned no JSON)' }
      } catch (e) {
        // AI failed — use local results
        return { incidents: localResults, source: `Local Parser (${e.message})` }
      }
    },

    onMutate: async ({ text, eventId }) => {
      // Optimistic: show "analyzing" message
      const state = store()
      state.addChatMessage(eventId, 'a', '🔍 Analyzing text... extracting locations and incidents.')
    },

    onSuccess: (data, { eventId }) => {
      const state = store()
      const count = state.addIncidentsBulk(data.incidents)
      state.addChatMessage(
        eventId,
        'a',
        count > 0
          ? `🗺️ Mapped ${count} incident(s) via ${data.source}. Check the map!`
          : `No new incidents extracted via ${data.source}. Include place names like cities, towns, or regions.`
      )
      // Update region bias for future geocoding
      const ev = state.events.find(e => e.id === eventId)
      if (ev?.region) setGeoBias(ev.region)
    },

    onError: (error, { eventId }) => {
      store().addChatMessage(eventId, 'a', '❌ Analysis failed: ' + error.message)
    },
  })
}

// ─── Chat Mutation ────────────────────────────────────────────

export function useChatSend() {
  return useMutation({
    mutationFn: async ({ message, eventId }) => {
      const state = useAppStore.getState()
      const ev = state.events.find(e => e.id === eventId)
      const history = [...(state.chatHistory[eventId] || []), { role: 'user', content: message }]
      const response = await callAI(history.slice(-12), buildSystemPrompt(ev))
      return { response, history }
    },
    onMutate: ({ message, eventId }) => {
      const state = useAppStore.getState()
      state.addChatMessage(eventId, 'u', message)
      state.addChatHistory(eventId, [{ role: 'user', content: message }])
    },
    onSuccess: ({ response, history }, { eventId }) => {
      const state = useAppStore.getState()
      state.addChatMessage(eventId, 'a', response || '—')
      state.addChatHistory(eventId, [{ role: 'assistant', content: response }])
    },
    onError: (error, { eventId }) => {
      useAppStore.getState().addChatMessage(eventId, 'a', '❌ ' + error.message)
    },
  })
}

// ─── Test AI Connection ───────────────────────────────────────

export async function testAIConnection() {
  try {
    const result = await callAI([{ role: 'user', content: 'Reply OK' }], null, 20)
    return { success: true, message: result }
  } catch (e) {
    return { success: false, message: e.message }
  }
}

// ─── Infrastructure (Overpass) ────────────────────────────────

export function useInfrastructure(type, bounds, enabled) {
  return useQuery({
    queryKey: ['infra', type, bounds?.toBBoxString?.() || ''],
    queryFn: async () => {
      const { buildOverpassQuery } = await import('../data/events.js')
      const q = buildOverpassQuery(type, bounds)
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(q),
      })
      return r.json()
    },
    enabled: !!enabled && !!bounds,
    staleTime: 10 * 60 * 1000, // 10 min
  })
}
