"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "An interactive stacked bar chart"

const chartConfig = {
  shipments: {
    label: "Total Shipments",
  },
  delivered: {
    label: "Delivered",
    color: "hsl(142, 71%, 45%)",
  },
  inTransit: {
    label: "In Transit",
    color: "hsl(217, 91%, 60%)",
  },
  other: {
    label: "Pending / Planned",
    color: "hsl(47, 100%, 68%)",
  },
} satisfies ChartConfig

interface ChartData {
  date: string
  delivered: number
  inTransit: number
  other: number
}

export function ChartAreaInteractive({ data }: { data: ChartData[] }) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("12m")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("6m")
    }
  }, [isMobile])

  const filteredData = data.filter((item) => {
    const date = new Date(item.date + "-01T00:00:00")
    const referenceDate = new Date()
    let monthsToSubtract = 2
    if (timeRange === "12m") {
      monthsToSubtract = 11
    } else if (timeRange === "9m") {
      monthsToSubtract = 8
    } else if (timeRange === "6m") {
      monthsToSubtract = 5
    }
    const startDate = new Date(referenceDate)
    startDate.setMonth(startDate.getMonth() - monthsToSubtract)
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)
    return date >= startDate && date <= referenceDate
  })

  const totalShipments = React.useMemo(() => {
    return filteredData.reduce((acc, curr) => acc + curr.delivered + curr.inTransit + curr.other, 0)
  }, [filteredData])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="flex items-baseline gap-2">
          Total Shipments
          <span className="text-sm font-normal text-muted-foreground">
            {totalShipments.toLocaleString()}
          </span>
        </CardTitle>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="3m">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="6m">Last 6 months</ToggleGroupItem>
            <ToggleGroupItem value="9m">Last 9 months</ToggleGroupItem>
            <ToggleGroupItem value="12m">Last 12 months</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 12 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="3m" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="6m" className="rounded-lg">
                Last 6 months
              </SelectItem>
              <SelectItem value="9m" className="rounded-lg">
                Last 9 months
              </SelectItem>
              <SelectItem value="12m" className="rounded-lg">
                Last 12 months
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          id="shipments-bar-chart"
          config={chartConfig}
          className="aspect-auto h-[280px] w-full"
          style={{ minWidth: '100%', minHeight: '280px' }}
        >
          <BarChart data={filteredData} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tickFormatter={(value) => {
                const date = new Date(value + "-01T00:00:00")
                const month = date.toLocaleDateString("en-US", { month: "short" })
                const year = date.toLocaleDateString("en-US", { year: "2-digit" })
                return `${month} '${year}`
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              allowDecimals={false}
              width={30}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value + "-01T00:00:00").toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="delivered"
              stackId="a"
              fill="var(--color-delivered)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="inTransit"
              stackId="a"
              fill="var(--color-inTransit)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="other"
              stackId="a"
              fill="var(--color-other)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
