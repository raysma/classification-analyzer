import { useState, useEffect, useCallback, useMemo } from 'react'
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
  useXAxisScale,
  useYAxisScale,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
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
  const d = new Date(val)
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const year = d.getFullYear().toString().slice(2)
  return `${month} '${year}`
}

function formatFullDate(val: number): string {
  const d = new Date(val)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = d.getFullYear().toString().slice(2)
  return `${mm}/${dd}/${yy}`
}

interface ScoreDatum {
  pct: number
  flag: string
  code: string
  cname: string | undefined
}

interface ChartRow {
  x: number
  avg: number | null
  scores: ScoreDatum[]
}

interface Props {
  classifiers: ValidatedClassifier[]
  history: ClassificationSnapshot[]
}

export default function ProgressChart({ classifiers, history }: Props) {
  const [activeX, setActiveX] = useState<number | null>(null)
  const isDark = useIsDark()

  const gridColor = isDark ? '#374151' : '#e5e7eb'
  const textColor = isDark ? '#9ca3af' : '#6b7280'
  const tooltipBg = isDark ? '#1f2937' : 'white'
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb'
  const tooltipColor = isDark ? '#f3f4f6' : '#111827'

  // Single unified data array — one row per unique date X. Recharts indexes
  // every series off the chart-level `data` prop, so tooltip / activeLabel
  // matching is unambiguous. Two parallel <Line> series with their own data
  // props (where one has duplicate X values per date and the other doesn't)
  // caused the classification value in the tooltip to flicker between mid-day
  // and end-of-day values as the cursor crossed a score's vertical line.
  const chartData: ChartRow[] = useMemo(() => {
    const byX = new Map<number, ChartRow>()
    const seen = new Set<string>()

    for (const c of classifiers) {
      const key = `${c.date}:${c.classifierCode}`
      if (seen.has(key)) continue
      seen.add(key)
      const x = dateToNum(c.date)
      const row = byX.get(x) ?? { x, avg: null, scores: [] }
      row.scores.push({
        pct: c.percent,
        flag: c.flag,
        code: c.classifierCode,
        cname: c.classifierName,
      })
      byX.set(x, row)
    }

    for (const h of history) {
      const x = dateToNum(h.date)
      const row = byX.get(x) ?? { x, avg: null, scores: [] }
      row.avg = h.percent
      byX.set(x, row)
    }

    return [...byX.values()].sort((a, b) => a.x - b.x)
  }, [classifiers, history])

  const xs = chartData.map((r) => r.x)
  const minX = xs.length > 0 ? xs[0]! : Date.now()
  const maxX = xs.length > 0 ? xs[xs.length - 1]! : Date.now()
  const xPad = (maxX - minX) * 0.05 || 86400000

  const renderTooltip = useCallback(
    (props: TooltipContentProps) => {
      const { active, payload, label } = props
      if (!active || !payload?.length) return null

      const row = payload[0]?.payload as ChartRow | undefined
      if (!row) return null

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
          <p style={{ fontWeight: 600, marginBottom: 2 }}>{formatFullDate(label as number)}</p>
          {row.scores.map((score) => (
            <p key={score.code} style={{ color: SCORE_POINT_COLORS[classFor(score.pct)] }}>
              {score.code}: {score.pct.toFixed(4)}%
            </p>
          ))}
          {row.avg !== null && (
            <p style={{ color: '#0ea5e9' }}>
              Classification: {row.avg.toFixed(4)}%
            </p>
          )}
        </div>
      )
    },
    [tooltipBg, tooltipBorder, tooltipColor],
  )

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Score history</p>

      <div className="h-72 w-full rounded-md border border-gray-200 dark:border-gray-700 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 48, bottom: 8, left: 0 }}
            onMouseMove={(state: { isTooltipActive?: boolean; activeLabel?: number | string | undefined }) => {
              if (state.isTooltipActive && typeof state.activeLabel === 'number') {
                setActiveX(state.activeLabel)
              } else {
                setActiveX(null)
              }
            }}
            onMouseLeave={() => setActiveX(null)}
          >
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
            <Tooltip content={renderTooltip} isAnimationActive={false} />
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

            <Line
              name="Classification %"
              dataKey="avg"
              type="monotone"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />

            {/*
             * Score dots are drawn by a custom in-chart component rather than
             * a second <Line> series. A second Line with its own `data` prop
             * confuses Recharts' tooltip activeIndex (it ends up mapping series
             * by index instead of by X-value), and a Line whose data shares
             * `chartData` can only render one dot per row — but a single date
             * can carry multiple classifiers. ScoreDots reads the axis scales
             * via Recharts' v3 hooks, so we can project every score's (x, pct)
             * to pixels and draw one circle per classifier.
             */}
            <ScoreDots rows={chartData} activeX={activeX} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Rendered inside <ComposedChart> so the v3 scale hooks resolve against the
// chart context. Returns one <circle> per classifier, projected to pixels via
// the X (time) and Y (percent) scales.
function ScoreDots({ rows, activeX }: { rows: ChartRow[]; activeX: number | null }) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()
  if (!xScale || !yScale) return null
  return (
    <g>
      {rows.flatMap((row) =>
        row.scores.map((score) => {
          const cx = xScale(row.x)
          const cy = yScale(score.pct)
          if (cx == null || cy == null) return null
          const color = SCORE_POINT_COLORS[classFor(score.pct)]
          const isActive = row.x === activeX
          return (
            <circle
              key={`dot-${row.x}-${score.code}`}
              cx={cx}
              cy={cy}
              r={isActive ? 7 : 5}
              fill={color}
              stroke={isActive ? 'white' : 'none'}
              strokeWidth={isActive ? 2 : 0}
              opacity={isActive ? 0.95 : 0.85}
              style={{ pointerEvents: 'none' }}
            />
          )
        }),
      )}
    </g>
  )
}
