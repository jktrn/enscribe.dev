'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { type FunctionComponent, useCallback, useEffect, useState } from 'react'
import Calendar, {
  type Props as ActivityCalendarProps,
} from 'react-activity-calendar'

// Adopted from https://github.com/grubersjoe/react-github-calendar
// Copyright (c) 2019 Jonathan Gruber, MIT License

interface Props extends Omit<ActivityCalendarProps, 'data' | 'theme'> {
  username: string
}

async function fetchCalendarData(username: string): Promise<ApiResponse> {
  const response = await fetch(
    `https://github-contributions-api.jogruber.de/v4/${username}?y=last`,
  )
  const data: ApiResponse | ApiErrorResponse = await response.json()

  if (!response.ok) {
    throw Error(
      `Fetching GitHub contribution data for "${username}" failed: ${
        (data as ApiErrorResponse).error
      }`,
    )
  }

  return data as ApiResponse
}

const GithubCalendar: FunctionComponent<Props> = ({ username, ...props }) => {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
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
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <img
          src="/static/images/bento/bento-discord-futon.svg"
          alt="Error"
          width={0}
          height={0}
          className="bento-lg:w-48 h-auto w-24"
        />
        <p className="bento-lg:w-64 text-muted-foreground w-48 text-center text-sm">
          This component is down. Please email me!
        </p>
      </div>
    )
  }

  if (loading || !data) {
    return <Skeleton className="size-full" />
  }

  return (
    <>
      <div className="[&_.react-activity-calendar\\_\\_legend-month]:text-foreground/80 hidden w-fit sm:block">
        <Calendar
          data={selectLastNDays(data.contributions, 133)}
          theme={{
            dark: ['#23211e', '#E9D3B6'],
          }}
          colorScheme="dark"
          blockSize={20}
          blockMargin={6}
          blockRadius={0}
          {...props}
          maxLevel={4}
          hideTotalCount
          hideColorLegend
        />
      </div>
      <div className="[&_.react-activity-calendar\\_\\_legend-month]:text-foreground/80 w-fit sm:hidden">
        <Calendar
          data={selectLastNDays(data.contributions, 60)}
          theme={{
            dark: ['#23211e', '#E9D3B6'],
          }}
          colorScheme="dark"
          blockSize={20}
          blockMargin={6}
          blockRadius={0}
          {...props}
          maxLevel={4}
          hideTotalCount
          hideColorLegend
        />
      </div>
    </>
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

const selectLastNDays = (contributions: Activity[], days: number) => {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - days)

  return contributions.filter((activity) => {
    const activityDate = new Date(activity.date)
    return activityDate >= startDate && activityDate <= today
  })
}

export default GithubCalendar
