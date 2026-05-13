import { useState } from 'react'
import {
  ComposedChart,
  Scatter,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ValidatedClassifier } from '../lib/validation'
import type { ClassificationSnapshot } from '../types/index'

const CLASS_BANDS = [
  { label: 'GM', threshold: 95, color: '#eab308' },
  { label: 'M', threshold: 85, color: '#a855f7' },
  { label: 'A', threshold: 75, color: '#3b82f6' },
  { label: 'B', threshold: 60, color: '#22c55e' },
  { label: 'C', threshold: 40, color: '#f97316' },
  { label: 'D', threshold: 2, color: '#ef4444' },
]

function dateToNum(date: string): number {
  return new Date(date + 'T00:00:00').getTime()
}

interface Props {
  classifiers: ValidatedClassifier[]
  history: ClassificationSnapshot[]
}

export default function ProgressChart({ classifiers, history }: Props) {
  const [showAll, setShowAll] = useState(false)

  const scatterData = classifiers.map((c) => ({
    x: dateToNum(c.date),
    y: c.percent,
    flag: c.flag,
    code: c.classifierCode,
    name: c.classifierName,
  }))

  const lineData = history.map((h) => ({
    x: dateToNum(h.date),
    avg: h.percent,
  }))

  const allXValues = [
    ...scatterData.map((d) => d.x),
    ...lineData.map((d) => d.x),
  ]
  const minX = allXValues.length > 0 ? Math.min(...allXValues) : Date.now()
  const maxX = allXValues.length > 0 ? Math.max(...allXValues) : Date.now()
  const xPad = (maxX - minX) * 0.05 || 86400000

  function formatDate(val: number): string {
    return new Date(val).toLocaleDateString('en-US', { year: '2-digit', month: 'short' })
  }

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
          <ComposedChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[minX - xPad, maxX + xPad]}
              tickFormatter={formatDate}
              scale="time"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={[0, 110]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${v}%`}
              width={40}
            />
            <Tooltip
              labelFormatter={(val: number) => formatDate(val)}
              formatter={(val: number, name: string) => [`${val.toFixed(2)}%`, name]}
            />
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

            <Scatter
              name="Classifiers"
              data={scatterData}
              dataKey="y"
              fill="#6366f1"
              opacity={0.7}
              shape="circle"
            />

            <Line
              name="Rolling avg"
              data={lineData}
              dataKey="avg"
              type="monotone"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
