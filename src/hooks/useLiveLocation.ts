import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLng } from '@/types'

export type LocationStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unsupported' | 'error'

export interface LocationState {
  status: LocationStatus
  position: LatLng | null
  /** metres, from the browser */
  accuracy: number | null
  /** degrees clockwise from north, null when the device has no compass */
  heading: number | null
  /** GPS speed in m/s */
  speed: number | null
  /** device clock at the last fix */
  at: number
  error?: string
}

const INITIAL: LocationState = {
  status: 'idle',
  position: null,
  accuracy: null,
  heading: null,
  speed: null,
  at: 0,
}

interface OrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

/**
 * Standort und Blickrichtung in Echtzeit.
 *
 * Peilungen kommen aus drei Quellen, nach Verlässlichkeit sortiert: der
 * GPS-Kurs während der Bewegung, `deviceorientationabsolute` und das einfache
 * `deviceorientation`-Ereignis mit iOS' `webkitCompassHeading`. iOS verlangt
 * für die Abfrage eine Nutzerhandlung, deshalb muss `enable()` aus einem Klick
 * kommen.
 */
export function useLiveLocation() {
  const [state, setState] = useState<LocationState>(INITIAL)
  const watchId = useRef<number | null>(null)
  const orientationAttached = useRef(false)
  const headingRef = useRef<{ value: number | null; at: number }>({ value: null, at: 0 })

  const handleOrientation = useCallback((event: Event) => {
    const e = event as OrientationEvent
    let heading: number | null = null
    if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
      heading = e.webkitCompassHeading
    } else if (e.absolute === true && typeof e.alpha === 'number' && e.alpha !== null) {
      heading = (360 - e.alpha) % 360
    }
    if (heading === null) return
    headingRef.current = { value: heading, at: Date.now() }
    setState((prev) => (prev.status === 'live' ? { ...prev, heading } : prev))
  }, [])

  const attachOrientation = useCallback(() => {
    if (orientationAttached.current || typeof window === 'undefined') return
    orientationAttached.current = true
    const target = window as Window & { DeviceOrientationEvent?: unknown }
    if (!target.DeviceOrientationEvent) return
    window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener, true)
    window.addEventListener('deviceorientation', handleOrientation as EventListener, true)
  }, [handleOrientation])

  const enable = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ ...INITIAL, status: 'unsupported' })
      return
    }
    setState((prev) => ({ ...prev, status: prev.position ? prev.status : 'requesting' }))

    const OrientationCtor = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
      .DeviceOrientationEvent
    if (OrientationCtor?.requestPermission) {
      try {
        const granted = await OrientationCtor.requestPermission()
        if (granted === 'granted') attachOrientation()
      } catch {
        /* Abfrage abgelehnt; GPS allein reicht weiterhin */
      }
    } else {
      attachOrientation()
    }

    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords
        const freshOrientation = Date.now() - headingRef.current.at < 4000 ? headingRef.current.value : null
        setState({
          status: 'live',
          position: [latitude, longitude],
          accuracy,
          heading:
            typeof heading === 'number' && !Number.isNaN(heading) && (speed ?? 0) > 0.7
              ? heading
              : freshOrientation,
          speed: typeof speed === 'number' ? speed : null,
          at: pos.timestamp,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState((prev) => ({ ...prev, status: 'denied', error: 'Standortfreigabe wurde abgelehnt.' }))
        } else {
          setState((prev) => ({ ...prev, status: 'error', error: err.message }))
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    )
  }, [attachOrientation])

  const disable = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current)
    }
    watchId.current = null
    setState(INITIAL)
  }, [])

  useEffect(() => {
    return () => {
      if (watchId.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current)
      }
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener, true)
      window.removeEventListener('deviceorientation', handleOrientation as EventListener, true)
      orientationAttached.current = false
    }
  }, [handleOrientation])

  return { ...state, enable, disable }
}

/** Smoothed compass value for the heading cone, ignoring jitter and wrap-around. */
export function useSmoothedHeading(raw: number | null, fallback = 0): number {
  const [value, setValue] = useState(fallback)
  const target = useRef(fallback)
  const current = useRef(fallback)

  useEffect(() => {
    if (raw === null) return
    target.current = raw
  }, [raw])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      let delta = target.current - current.current
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      current.current = (current.current + delta * 0.14 + 360) % 360
      setValue(current.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return value
}
