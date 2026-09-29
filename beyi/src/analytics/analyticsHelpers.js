// src/utils/analyticsHelpers.js

export const TIMEFRAME_OPTIONS = [
  { label: '1M', value: '1M', days: 30 },
  { label: '3M', value: '3M', days: 90 },
  { label: '6M', value: '6M', days: 180 },
  { label: '1Y', value: '1Y', days: 365 },
  { label: '5Y', value: '5Y', days: 1825 },
];

export const PRICE_TYPE_OPTIONS = [
  { label: 'Wholesale', value: 'wholesale' },
  { label: 'Retail', value: 'retail' },
  { label: 'Both', value: 'both' },
];

export const formatUSh = (value) => {
  if (value === null || value === undefined || value === '') return 'USh 0';
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return `USh ${value}`;
  return `USh ${numberValue.toLocaleString()}`;
};

export const formatDateLabel = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-UG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const getTimeframeWindowDays = (timeframe) => {
  const option = TIMEFRAME_OPTIONS.find((opt) => opt.value === timeframe);
  return option ? option.days : 90;
};

/**
 * Sanitizes strings against CSV Injection (Formula Injection)
 */
const sanitizeCsvCell = (val) => {
  const str = String(val ?? '');
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  const cleanStr = dangerousPrefixes.some((prefix) => str.startsWith(prefix))
    ? `'${str}`
    : str;
  return `"${cleanStr.replaceAll('"', '""')}"`;
};

export const buildCsv = (rows) => {
  const header = ['timestamp', 'crop', 'category', 'wholesale_price', 'retail_price', 'market_name', 'region'];
  const lines = rows.map((row) =>
    [
      row.timestamp ?? '',
      row.cropName ?? '',
      row.category ?? '',
      row.wholesalePrice ?? '',
      row.retailPrice ?? '',
      row.marketName ?? '',
      row.region ?? '',
    ]
      .map(sanitizeCsvCell)
      .join(',')
  );

  return [header.join(','), ...lines].join('\n');
};

export const downloadCsv = (filename, rows) => {
  if (!rows || !rows.length) return;
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

// src/analytics/analyticsHelpers.js

export const buildChartData = (recordsCache, activeCrops = []) => {
  if (!recordsCache || !activeCrops.length) return [];
  
  const periodMap = new Map();

  activeCrops.forEach((cropName) => {
    const cropKey = slugify(cropName);
    const records = recordsCache[cropName] || [];

    records.forEach((record) => {
      if (!record.timestamp) return;
      const periodKey = record.timestamp.split('T')[0];

      const current = periodMap.get(periodKey) || {
        period: periodKey,
        label: formatDateLabel(periodKey),
      };

      current[`${cropKey}_wholesale`] = Number(record.wholesalePrice) || null;
      current[`${cropKey}_retail`] = Number(record.retailPrice) || null;

      periodMap.set(periodKey, current);
    });
  });

  return Array.from(periodMap.values()).sort(
    (a, b) => new Date(a.period) - new Date(b.period)
  );
};

export const filterHistoryByTimeframe = (history, timeframe) => {
  if (!history || !history.length) return [];
  
  const latestDate = history.reduce((latest, record) => {
    if (!record.timestamp) return latest;
    const dateVal = new Date(record.timestamp).getTime();
    return dateVal > latest ? dateVal : latest;
  }, 0);

  const windowDays = getTimeframeWindowDays(timeframe);
  const cutoffDate = latestDate ? new Date(latestDate - windowDays * 86400000) : null;

  return history.filter((record) => {
    if (!record.timestamp) return false;
    const recDate = new Date(record.timestamp);
    return !cutoffDate || recDate >= cutoffDate;
  });
};