import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export default function PriceTrendChart({
  data = [],
  displayCrops = [],
  primaryCropName = '',
  priceType = 'wholesale',
  resolveMetricKey = (crop, type) => `${crop}_${type}`,
  yAxisKey = 'label',
  tooltipContent = null,
}) {
  const cropPalette = [
    { wholesale: '#0ea5e9', retail: '#0284c7' },
    { wholesale: '#10b981', retail: '#059669' },
    { wholesale: '#f59e0b', retail: '#d97706' },
    { wholesale: '#8b5cf6', retail: '#7c3aed' },
  ];

  const renderChartLines = () => {
    if (!displayCrops || displayCrops.length === 0) return [];

    return displayCrops.flatMap((cropName, index) => {
      const palette = cropPalette[index % cropPalette.length];
      const isPrimary = cropName === primaryCropName;
      const lines = [];

      // Wholesale line
      if (priceType === 'wholesale' || priceType === 'both') {
        lines.push(
          <Line
            key={`${cropName}-wholesale`}
            type="monotone"
            dataKey={resolveMetricKey(cropName, 'wholesale')}
            name={`${cropName} (Wholesale)`}
            stroke={palette.wholesale}
            strokeWidth={isPrimary ? 3 : 2}
            connectNulls
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        );
      }

      // Retail line
      if (priceType === 'retail' || priceType === 'both') {
        lines.push(
          <Line
            key={`${cropName}-retail`}
            type="monotone"
            dataKey={resolveMetricKey(cropName, 'retail')}
            name={`${cropName} (Retail)`}
            stroke={palette.retail}
            strokeDasharray="5 5"
            strokeWidth={isPrimary ? 2.5 : 1.5}
            connectNulls
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        );
      }

      return lines;
    });
  };

  return (
    /* Outer container with horizontal overflow scrolling */
    <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
      {/* MinWidth ensures the chart expands horizontally if price range grows */}
      <div style={{ minWidth: 700, width: '100%', height: 450 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            layout="vertical"
            data={data}
            margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
          >
            {/* Grid lines: horizontal = true (month separators), vertical = false (removes vertical price lines) */}
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#cbd5e1" />

            {/* X-AXIS: Starts at 0 */}
            <XAxis
              type="number"
              domain={[0, 'dataMax + 1000']}
              tickFormatter={(val) => `USh ${val / 1000}k`}
              tickLine={false}
              axisLine={{ stroke: '#94a3b8' }}
            />

            {/* Y-AXIS: Month Labels */}
            <YAxis
              type="category"
              dataKey={yAxisKey}
              tickLine={false}
              axisLine={{ stroke: '#94a3b8' }}
            />

            {tooltipContent ? <Tooltip content={tooltipContent} /> : <Tooltip />}
            <Legend />
            {renderChartLines()}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}