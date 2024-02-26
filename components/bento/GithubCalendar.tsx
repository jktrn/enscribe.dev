'use client'

import React, { FunctionComponent, useCallback, useEffect, useState } from 'react'
import Calendar, { type Props as ActivityCalendarProps } from 'react-activity-calendar'

// Adopted from https://github.com/grubersjoe/react-github-calendar
// Copyright (c) 2019 Jonathan Gruber, MIT License

interface Props extends Omit<ActivityCalendarProps, 'data' | 'theme'> {
    username: string
}

async function fetchCalendarData(username: string): Promise<ApiResponse> {
    const response = await fetch(
        `https://github-contributions-api.jogruber.de/v4/${username}?y=last`
    )
    const data: ApiResponse | ApiErrorResponse = await response.json()

    if (!response.ok) {
        throw Error(
            `Fetching GitHub contribution data for "${username}" failed: ${
                (data as ApiErrorResponse).error
            }`
        )
    }

    return data as ApiResponse
}
const GithubCalendar: FunctionComponent<Props> = ({ username, ...props }) => {
    const [data, setData] = useState<ApiResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const fetchData = useCallback(() => {
        setLoading(true)
        setError(null)
        fetchCalendarData(username)
            .then(setData)
            .catch(setError)
            .finally(() => setLoading(false))
    }, [username])

    useEffect(fetchData, [fetchData])

    if (error) {
        return <div>Fetch failed! Contact @jktrn immediately.</div>
    }

    if (loading || !data) {
        return
    }

    return (
        <Calendar
            data={selectLastNDays(data.contributions)}
            theme={{
                dark: ['#1A1A1A', '#E9D3B6'],
            }}
            {...props}
            // @ts-expect-error
            maxLevel={4}
        />
    )
}

interface Activity {
    date: string
    count: number
    level: 0 | 1 | 2 | 3 | 4
}

interface ApiResponse {
    total: {
        [year: number]: number
        [year: string]: number
    }
    contributions: Array<Activity>
}

interface ApiErrorResponse {
    error: string
}

const DAYS_TO_SHOW = 133

const selectLastNDays = (contributions) => {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - DAYS_TO_SHOW)

    return contributions.filter((activity) => {
        const activityDate = new Date(activity.date)
        return activityDate >= startDate && activityDate <= today
    })
}

export default GithubCalendar
