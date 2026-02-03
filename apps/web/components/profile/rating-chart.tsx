'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@workspace/ui/components/chart';
import { useSidebar } from '@workspace/ui/components/sidebar';

interface RatingPoint {
  date: string;
  rating: number;
}

interface ChartProps {
  data: RatingPoint[];
}

export default function UserRatingChart({ data }: ChartProps) {
  const { isMobile } = useSidebar();
  return (
    <ChartContainer
      id="user-rating"
      config={{
        rating: { label: 'Rating', color: 'hsl(120, 70%, 50%)' },
      }}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
        <LineChart
          data={data}
          margin={{
            top: 10,
            right: isMobile ? 10 : 30,
            left: isMobile ? 5 : 20,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 12 }} />
          <YAxis
            domain={['dataMin - 100', 'dataMax + 100']}
            tick={{ fontSize: isMobile ? 10 : 12 }}
          />
          <ChartTooltip
            content={<ChartTooltipContent />}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            type="monotone"
            dataKey="rating"
            stroke="var(--color-rating)"
            strokeWidth={3}
            dot={{ r: isMobile ? 2 : 3 }}
            activeDot={{ r: isMobile ? 5 : 6 }}
            name="Rating"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
