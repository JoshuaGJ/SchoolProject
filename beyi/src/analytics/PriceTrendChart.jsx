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

/**
 * PriceTrendChart Component
 *
 * @param {Array} data - Chart dataset array
 * @param {Array} displayCrops - Array of crop names to display as lines
 * @param {string} primaryCropName - Main crop being focused on (rendered thicker)
 * @param {'wholesale' | 'retail' | 'both'} priceType - Currently selected price filter
 * @param {Function} resolveMetricKey - Helper (cropName, priceType) => dataKey string
 */
export default function PriceTrendChart({
  data = [],
  displayCrops = [],
  primaryCropName = '',
  priceType = 'wholesale',
  resolveMetricKey = (crop, type) => `${crop}_${type}`,
  xAxisKey = 'label',
  yAxisFormatter = (value) => value,
  tooltipContent = null,
}) {
  const lineColors = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const renderChartLines = () => {
    if (!displayCrops || displayCrops.length === 0) return [];

    return displayCrops.flatMap((cropName, index) => {
      const lineColor = lineColors[index % lineColors.length];
      const isPrimary = cropName === primaryCropName;

      if (priceType === 'both' && isPrimary) {
        return [
          <Line
            key={`${cropName}-wholesale`}
            type="monotone"
            dataKey={resolveMetricKey(cropName, 'wholesale')}
            name={`${cropName} (Wholesale)`}
            stroke={lineColor}
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
          />,
          <Line
            key={`${cropName}-retail`}
            type="monotone"
            dataKey={resolveMetricKey(cropName, 'retail')}
            name={`${cropName} (Retail)`}
            stroke={lineColor}
            strokeDasharray="6 4"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />,
        ];
      }

      const activePriceKey = priceType === 'retail' ? 'retail' : 'wholesale';
      return [
        <Line
          key={cropName}
          type="monotone"
          dataKey={resolveMetricKey(cropName, activePriceKey)}
          name={cropName}
          stroke={lineColor}
          strokeWidth={isPrimary ? 3 : 2}
          dot={false}
          isAnimationActive={false}
        />,
      ];
    });
  };

  return (
    <div style={{ width: '100%', height: 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey={xAxisKey} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tickFormatter={yAxisFormatter} />
          {tooltipContent ? <Tooltip content={tooltipContent} /> : <Tooltip />}
          <Legend />
          {renderChartLines()}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
