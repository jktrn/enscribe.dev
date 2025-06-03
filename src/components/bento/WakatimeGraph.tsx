'use client'

import React, { useState, useEffect } from 'react'
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { getLanguageIcon } from '@/components/bento/LanguageIcons'

interface Language {
  name: string
  hours: number
  fill: string
}

interface Props {
  omitLanguages?: string[]
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
] as const

const WAKATIME_API_URL =
  'https://wakatime.com/share/@jktrn/ef6e633b-589d-44f2-9ae6-0eb93445cf2a.json'
const MAX_LANGUAGES = 7
const ICON_SIZE = 20
const CIRCLE_RADIUS = 16

const chartConfig: ChartConfig = {
  hours: {
    label: 'Hours',
    color: 'var(--primary)',
  },
  label: {
    color: 'var(--muted-foreground)',
  },
  ...CHART_COLORS.reduce(
    (acc, color, index) => ({
      ...acc,
      [`language${index}`]: { label: `Language ${index + 1}`, color },
    }),
    {},
  ),
}

const CustomYAxisTick = ({ x, y, payload }: any) => {
  const icon = getLanguageIcon(payload.value.toLowerCase())
  const centerX = x - 15
  const centerY = y

  return (
    <g transform={`translate(${centerX},${centerY})`}>
      <title>{payload.value}</title>
      <rect
        x={-CIRCLE_RADIUS}
        y={-CIRCLE_RADIUS}
        width={CIRCLE_RADIUS * 2}
        height={CIRCLE_RADIUS * 2}
        fill="var(--border)"
        fillOpacity="0.5"
      />
      <foreignObject
        width={ICON_SIZE}
        height={ICON_SIZE}
        x={-ICON_SIZE / 2}
        y={-ICON_SIZE / 2}
      >
        <div className="flex h-full w-full items-center justify-center p-0.5">
          {icon ? (
            React.cloneElement(
              icon as React.ReactElement,
              {
                size: ICON_SIZE - 2,
                className: 'text-foreground',
              } as any,
            )
          ) : (
            <span className="text-foreground text-sm font-medium">
              {payload.value.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </foreignObject>
    </g>
  )
}

const LoadingSkeleton = () => (
  <div className="size-full rounded-3xl p-6">
    <div className="space-y-1.5">
      {Array.from({ length: MAX_LANGUAGES }).map((_, index) => (
        <div key={index} className="flex items-center gap-x-2">
          <Skeleton className="size-8" />
          <div className="flex-1">
            <Skeleton
              className="h-8"
              style={{ width: `${100 * Math.pow(0.75, index)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
)

const useWakatimeData = (omitLanguages: string[]) => {
  const [languages, setLanguages] = useState<Language[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(WAKATIME_API_URL)
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`)
        }

        const data = await response.json()
        const processedLanguages = data.data
          .filter(
            (lang: { name: string }) => !omitLanguages.includes(lang.name),
          )
          .slice(0, MAX_LANGUAGES)
          .map((lang: { name: string; hours: number }, index: number) => ({
            name: lang.name,
            hours: Number(lang.hours.toFixed(2)),
            fill: CHART_COLORS[index % CHART_COLORS.length],
          }))

        setLanguages(processedLanguages)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'An unexpected error occurred',
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [omitLanguages])

  return { languages, isLoading, error }
}

const WakatimeGraph = ({ omitLanguages = [] }: Props) => {
  const { languages, isLoading, error } = useWakatimeData(omitLanguages)

  if (isLoading) return <LoadingSkeleton />
  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-3xl p-4">
        <div className="text-center">
          <p className="text-destructive">Error loading data</p>
          <p className="text-muted-foreground text-sm">Please email me!</p>
        </div>
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="size-full p-4">
      <BarChart
        accessibilityLayer
        data={languages}
        layout="vertical"
        margin={{
          left: 0,
          right: 0,
          top: 4,
          bottom: 4,
        }}
        width={undefined}
        height={undefined}
      >
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          axisLine={false}
          width={45}
          tick={<CustomYAxisTick />}
        />
        <XAxis type="number" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="hours" radius={[0, 0, 0, 0]} isAnimationActive={false}>
          <LabelList
            dataKey="hours"
            position="right"
            formatter={(value: number) => `${Math.round(value)}h`}
            className="fill-foreground/80 font-medium"
            fontSize={13}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export default WakatimeGraph
