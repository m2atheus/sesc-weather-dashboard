import type { Sensor } from './types'

export const variables = {
  temperature: {
    title: 'Temperatura',
    key: 'outdoor_temperature_c',
    unit: '°C',
    color: 'var(--plot-temperature)',
  },
  humidity: {
    title: 'Umidade relativa',
    key: 'outdoor_humidity_pct',
    unit: '%',
    color: 'var(--plot-humidity)',
  },
  wind: {
    title: 'Velocidade do vento',
    key: 'wind_speed_ms',
    unit: 'm/s',
    color: 'var(--plot-wind)',
  },
  rain: {
    title: 'Chuva acumulada no dia',
    key: 'daily_rain_mm',
    unit: 'mm',
    color: 'var(--plot-rain)',
  },
  pressure: {
    title: 'Pressão relativa',
    key: 'relative_pressure_hpa',
    unit: 'hPa',
    color: 'var(--plot-pressure)',
  },
  absolutePressure: {
    title: 'Pressão absoluta',
    key: 'absolute_pressure_hpa',
    unit: 'hPa',
    color: 'var(--plot-pressure)',
  },
  solar: {
    title: 'Radiação solar',
    key: 'solar_radiation_wm2',
    unit: 'W/m²',
    color: 'var(--plot-solar)',
  },
} satisfies Record<
  string,
  { title: string; key: Sensor; unit: string; color: string }
>
export type Variable = keyof typeof variables
