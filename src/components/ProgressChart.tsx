import { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { ValidatedClassifier } from '../lib/validation'
import type { ClassificationSnapshot, ClassLetter } from '../types/index'
import { classFor } from '../lib/rules'

const CLASS_BANDS = [
  { label: 'GM', threshold: 95, color: '#eab308' },
  { label: 'M', threshold: 85, color: '#a855f7' },
  { label: 'A', threshold: 75, color: '#3b82f6' },
  { label: 'B', threshold: 60, color: '#22c55e' },
  { label: 'C', threshold: 40, color: '#f97316' },
  { label: 'D', threshold: 2, color: '#ef4444' },
]

const SCORE_POINT_COLORS: Record<ClassLetter, string> = {
  GM: '#eab308',
  M: '#a855f7',
  A: '#3b82f6',
  B: '#22c55e',
  C: '#f97316',
  D: '#ef4444',
  U: '#9ca3af',
}

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

function dateToNum(date: string): number {
  return new Date(date + 'T00:00:00').getTime()
}

function formatDate(val: number): string {
  return new Date(val).toLocaleDateString('en-US', { year: '2-digit', month: 'short' })
}

interface ScoreDatum {
  x: number
  pct: number
  flag: string
  code: string
  cname: string | undefined
}

interface Props {
  classifiers: ValidatedClassifier[]
  history: ClassificationSnapshot[]
}

export default function ProgressChart({ classifiers, history }: Props) {
  const [showAll, setShowAll] = useState(false)
  const isDark = useIsDark()

  const gridColor = isDark ? '#374151' : '#e5e7eb'
  const textColor = isDark ? '#9ca3af' : '#6b7280'
  const tooltipBg = isDark ? '#1f2937' : 'white'
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb'
  const tooltipColor = isDark ? '#f3f4f6' : '#111827'

  // Sort ascending so Line renders correctly left-to-right
  const scoreData: ScoreDatum[] = [...classifiers]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => ({
      x: dateToNum(c.date),
      pct: c.percent,
      flag: c.flag,
      code: c.classifierCode,
      cname: c.classifierName,
    }))

  const lineData = history.map((h) => ({
    x: dateToNum(h.date),
    avg: h.percent,
  }))

  const allXValues = [...scoreData.map((d) => d.x), ...lineData.map((d) => d.x)]
  const minX = allXValues.length > 0 ? Math.min(...allXValues) : Date.now()
  const maxX = allXValues.length > 0 ? Math.max(...allXValues) : Date.now()
  const xPad = (maxX - minX) * 0.05 || 86400000

  const renderTooltip = useCallback(
    (props: TooltipProps<number, string>) => {
      const { active, payload, label } = props
      if (!active || !payload?.length) return null

      const scoreItem = payload.find((p) => p.dataKey === 'pct')
      const avgItem = payload.find((p) => p.dataKey === 'avg')

      return (
        <div
          style={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            color: tooltipColor,
            fontFamily: 'inherit',
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 4,
            lineHeight: 1.6,
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: 2 }}>{formatDate(label as number)}</p>
          {scoreItem && (
            <p style={{ color: SCORE_POINT_COLORS[classFor(Number(scoreItem.value))] }}>
              {(scoreItem.payload as ScoreDatum).code}: {Number(scoreItem.value).toFixed(2)}%
            </p>
          )}
          {avgItem && (
            <p style={{ color: '#0ea5e9' }}>
              Classification: {Number(avgItem.value).toFixed(2)}%
            </p>
          )}
        </div>
      )
    },
    [tooltipBg, tooltipBorder, tooltipColor],
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Score history</p>
        <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="rounded"
          />
          Show all scores
        </label>
      </div>

      <div className="h-72 w-full rounded-md border border-gray-200 dark:border-gray-700 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 48, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[minX - xPad, maxX + xPad]}
              tickFormatter={formatDate}
              scale="time"
              tick={{ fontSize: 11, fill: textColor }}
            />
            <YAxis
              domain={[0, 110]}
              tick={{ fontSize: 11, fill: textColor }}
              tickFormatter={(v: number) => `${v}%`}
              width={40}
            />
            <Tooltip content={renderTooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />

            {CLASS_BANDS.map((band) => (
              <ReferenceLine
                key={band.label}
                y={band.threshold}
                stroke={band.color}
                strokeDasharray="4 2"
                label={{ value: band.label, position: 'right', fontSize: 10, fill: band.color }}
              />
            ))}

            {/*
             * strokeWidth=0 renders only dots, no connecting line.
             * Line's tooltip uses nearest-x detection across the full chart width,
             * so the tooltip fires reliably without needing pixel-perfect hover over a dot.
             * (Scatter's tooltip uses exact x-value matching which fails with unique timestamps.)
             */}
            <Line
              data={scoreData}
              dataKey="pct"
              strokeWidth={0}
              isAnimationActive={false}
              legendType="none"
              dot={(props: unknown) => {
                const p = props as { cx: number; cy: number; payload: ScoreDatum }
                const color = SCORE_POINT_COLORS[classFor(p.payload.pct)]
                return <circle key={`dot-${p.payload.x}`} cx={p.cx} cy={p.cy} r={5} fill={color} opacity={0.85} />
              }}
              activeDot={(props: unknown) => {
                const p = props as { cx: number; cy: number; payload: ScoreDatum }
                const color = SCORE_POINT_COLORS[classFor(p.payload.pct)]
                return (
                  <circle
                    key={`adot-${p.payload.x}`}
                    cx={p.cx}
                    cy={p.cy}
                    r={7}
                    fill={color}
                    stroke="white"
                    strokeWidth={2}
                    opacity={0.95}
                  />
                )
              }}
            />

            <Line
              name="Classification %"
              data={lineData}
              dataKey="avg"
              type="monotone"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
              activeDot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
