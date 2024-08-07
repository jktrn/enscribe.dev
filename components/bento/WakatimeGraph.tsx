'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/shadcn/chart'
import { Skeleton } from '@/components/shadcn/skeleton'
import { getLanguageIcon } from '@/scripts/utils/language-icons'

interface Language {
    name: string
    hours: number
    fill: string
}

interface Props {
    username: string
    omitLanguages?: string[]
}

const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--chart-6))',
    'hsl(var(--chart-7))',
]

const chartConfig: ChartConfig = {
    hours: {
        label: 'Hours',
        color: 'hsl(var(--primary))',
    },
    label: {
        color: 'hsl(var(--muted-foreground))',
    },
}

colors.forEach((color, index) => {
    chartConfig[`language${index}`] = {
        label: `Language ${index + 1}`,
        color: color,
    }
})

const WakatimeGraph = ({ username, omitLanguages = [] }: Props) => {
    const [languages, setLanguages] = useState<Language[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        try {
            const response = await fetch(`/api/wakatime-stats?username=${username}`)
            if (!response.ok) {
                throw new Error('Failed to fetch data')
            }
            const data = await response.json()

            const filteredLanguages = data
                .filter((lang) => !omitLanguages.includes(lang.name))
                .slice(0, 7)
                .map((lang, index) => ({
                    name: lang.name,
                    hours: parseFloat(lang.hours),
                    fill: colors[index % colors.length],
                }))

            setLanguages(filteredLanguages)
            setIsLoading(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
            setIsLoading(false)
        }
    }, [username, omitLanguages])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const CustomYAxisTick = useCallback((props) => {
        const { x, y, payload } = props
        const icon = getLanguageIcon(payload.value.toLowerCase())
        return (
            <g transform={`translate(${x},${y})`}>
                <title>{payload.value}</title>
                <circle cx="-18" cy="0" r="14" fill="#1A1A1A" />
                <foreignObject width={16} height={16} x={-26} y={-8}>
                    {icon ? (
                        React.cloneElement(icon, {
                            size: 16,
                            color: '#E9D3B6',
                        })
                    ) : (
                        <text
                            x={8}
                            y={12}
                            fill="#E9D3B6"
                            fontSize="12"
                            textAnchor="middle"
                            dominantBaseline="central"
                        >
                            {payload.value.charAt(0).toUpperCase()}
                        </text>
                    )}
                </foreignObject>
            </g>
        )
    }, [])

    const memoizedLanguages = useMemo(() => languages, [languages])

    if (isLoading) return <Skeleton className="size-full rounded-3xl" />
    if (error) return <div>Error: {error}</div>

    return (
        <ChartContainer config={chartConfig} className="h-full w-full p-4">
            <BarChart accessibilityLayer data={memoizedLanguages} layout="vertical">
                <CartesianGrid horizontal={false} />
                <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    tick={<CustomYAxisTick />}
                />
                <XAxis type="number" hide />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="hours" fill="var(--color-hours)" radius={[8, 8, 8, 8]}>
                    <LabelList
                        dataKey="hours"
                        position="right"
                        formatter={(value: number) => `${value.toFixed(1)}h`}
                        className="fill-foreground"
                        fontSize={12}
                    />
                </Bar>
            </BarChart>
        </ChartContainer>
    )
}

export default React.memo(WakatimeGraph)
