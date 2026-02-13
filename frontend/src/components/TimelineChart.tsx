import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { AnalysisReport } from '../types'

interface TimelineChartProps {
  report: AnalysisReport
}

export default function TimelineChart({ report }: TimelineChartProps) {
  // Generate timeline data points based on shift duration
  const hours = report.fatigueAnalysis.metrics.hoursOnDuty
  
  // Create data points for the timeline
  const timelineData = Array.from({ length: Math.ceil(hours) }, (_, i) => {
    const hour = i + 1
    // Simulate fatigue increase over time (in real app, this would come from actual data)
    const fatigueValue = report.fatigueAnalysis.score + (hour > 6 ? (hour - 6) * 5 : 0)
    return {
      hour: `${hour}:00`,
      fatigue: Math.min(100, fatigueValue),
    }
  })

  // Mark critical events from timeline
  const criticalEvents = report.summary.timeline.filter(e => 
    e.severity === 'high' || e.severity === 'critical'
  )

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={timelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <Line 
            type="monotone" 
            dataKey="fatigue" 
            stroke="#f59e0b" 
            strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 4 }}
          />
          {criticalEvents.map((event, index) => {
            const eventHour = parseInt(event.timestamp.split(':')[0])
            return (
              <ReferenceLine
                key={index}
                x={`${eventHour}:00`}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{ value: '⚠️', position: 'top' }}
              />
            )
          })}
          <XAxis 
            dataKey="hour" 
            tick={{ fontSize: 12 }}
            interval={Math.ceil(hours / 8)}
          />
          <YAxis 
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            label={{ value: 'Fatigue Score', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value: number) => [`${value.toFixed(0)}/100`, 'Fatigue Score']}
            labelFormatter={(label) => `Time: ${label}`}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 text-sm text-gray-600">
        <p className="mb-2">Timeline markers:</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-amber-500"></span>
            Fatigue trend
          </span>
          {criticalEvents.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="w-4 h-0.5 bg-red-500 border-dashed border-red-500"></span>
              Critical events
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
