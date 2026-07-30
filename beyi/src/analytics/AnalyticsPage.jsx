import React, { useEffect, useMemo, useState } from 'react';
import Header from '../header/Header.jsx';
import { fetchJson } from '../lib/api';
import PriceTrendChart from './PriceTrendChart.jsx';
import styles from './analytics.module.css';

const TIMEFRAME_OPTIONS = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: '5Y', value: '5Y' },
];

const PRICE_TYPE_OPTIONS = [
  { label: 'Wholesale', value: 'wholesale' },
  { label: 'Retail', value: 'retail' },
  { label: 'Both', value: 'both' },
];

const formatUSh = (value) => {
  if (value === null || value === undefined || value === '') return 'USh 0';
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return `USh ${value}`;
  return `USh ${numberValue.toLocaleString()}`;
};

const formatDateLabel = (value) => {
  if (!value) return 'Unknown period';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-UG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const getTimeframeWindowDays = (timeframe) => {
  const mapping = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '5Y': 1825,
  };

  return mapping[timeframe] ?? 90;
};

const buildCsv = (rows) => {
  const header = ['timestamp', 'crop', 'category', 'wholesale_price', 'retail_price', 'market_name', 'region'];
  const lines = rows.map((row) => [
    row.timestamp ?? '',
    row.cropName ?? '',
    row.category ?? '',
    row.wholesalePrice ?? '',
    row.retailPrice ?? '',
    row.marketName ?? '',
    row.region ?? '',
  ].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','));

  return [header.join(','), ...lines].join('\n');
};

const downloadCsv = (filename, rows) => {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const buildChartData = (records, displayCrops = []) => {
  const periodMap = new Map();
  const selectedCropKeys = new Set((displayCrops || []).map((cropName) => slugify(cropName || '')));

  records.forEach((record) => {
    const periodKey = record.timestamp ? record.timestamp.split('T')[0] : 'Unknown';
    const cropName = record.cropName;
    const cropKey = slugify(cropName || '');
    const current = periodMap.get(periodKey) || {
      period: periodKey,
      label: formatDateLabel(periodKey),
    };

    if (cropKey && (!displayCrops?.length || selectedCropKeys.has(cropKey))) {
      current[`${cropKey}_wholesale`] = Number(record.wholesalePrice) || null;
      current[`${cropKey}_retail`] = Number(record.retailPrice) || null;
    }
    periodMap.set(periodKey, current);
  });

  return Array.from(periodMap.values()).sort((left, right) => new Date(left.period) - new Date(right.period));
};

const CustomTooltip = ({ active, payload, label, tooltipMarketLabel }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className={styles.tooltipCard}>
      <strong>{label}</strong>
      <span>{tooltipMarketLabel}</span>
      {payload.map((entry) => (
        <div key={entry.dataKey} className={styles.tooltipRow}>
          <span>{entry.name}</span>
          <strong>{formatUSh(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
};

const AnalyticsPage = () => {
  // State from new logic
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [searchFeedback, setSearchFeedback] = useState('');
  const [priceRecords, setPriceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI Filter Controls
  const [timeframe, setTimeframe] = useState('3M');
  const [priceType, setPriceType] = useState('both');
  const [compareCrops, setCompareCrops] = useState([]);
  const [compareInput, setCompareInput] = useState('');

  // 1. Core Data Fetching Function (/prices/search/ endpoint)
  const loadAnalyticsData = async (searchQuery = '', signal) => {
    try {
      setLoading(true);
      setError('');

      const url = searchQuery 
        ? `/prices/search/?search=${encodeURIComponent(searchQuery)}` 
        : '/prices/search/';

      const data = await fetchJson(url, { signal });
      
      let recordsArray = [];
      if (Array.isArray(data)) {
        recordsArray = data;
      } else if (data && Array.isArray(data.results)) {
        recordsArray = data.results;
      }

      setPriceRecords(recordsArray);

      const count = recordsArray.length;
      if (searchQuery && count === 0) {
        setSearchFeedback(`No analytics data found for "${searchQuery}".`);
      } else if (searchQuery) {
        setSearchFeedback(`Showing analytics for ${count} record${count !== 1 ? 's' : ''} matching "${searchQuery}".`);
      } else {
        setSearchFeedback('Showing overall market analytics.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching analytics data:', err);
        setError(err.message || 'Failed to load analytics data.');
        setPriceRecords([]);
        setSearchFeedback('❌ Failed to load data.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Initial Mount Effect
  useEffect(() => {
    const controller = new AbortController();
    loadAnalyticsData('', controller.signal);
    return () => controller.abort();
  }, []);

  // 3. Normalized Records Structure
  const normalizedRecords = useMemo(() => {
    return priceRecords.map((record) => ({
      id: record.id,
      marketName: record.market?.name ?? 'Unknown market',
      region: record.market?.region_location ?? '',
      village: record.market?.village ?? '',
      cropName: record.crop?.name ?? 'Unknown crop',
      cropId: record.crop?.id ?? null,
      category: record.crop?.category ?? '',
      wholesalePrice: Number(record.wholesale_price) || 0,
      retailPrice: Number(record.retail_price) || 0,
      timestamp: record.timestamp,
    }));
  }, [priceRecords]);

  // 4. Composite Deduplication (Latest Record per Market/Crop pair)
  const latestAnalyticsRecords = useMemo(() => {
    return Array.from(
      normalizedRecords.reduce((map, record) => {
        const compositeKey = `${record.marketName}-${record.cropName}`;
        const existing = map.get(compositeKey);
        if (!existing || new Date(record.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
          map.set(compositeKey, record);
        }
        return map;
      }, new Map()).values()
    );
  }, [normalizedRecords]);

  // 5. Multi-field Client-side Filter
  const filteredAnalytics = useMemo(() => {
    const lower = activeSearchTerm.toLowerCase();
    if (!lower) return latestAnalyticsRecords;

    return latestAnalyticsRecords.filter((record) =>
      [record.cropName, record.category, record.marketName, record.region, record.village]
        .join(' ')
        .toLowerCase()
        .includes(lower)
    );
  }, [latestAnalyticsRecords, activeSearchTerm]);

  const chartRecords = useMemo(() => {
    const lower = activeSearchTerm.trim().toLowerCase();
    const compareTerms = compareCrops.map((crop) => crop.trim().toLowerCase()).filter(Boolean);
    const searchTerms = [...new Set([lower, ...compareTerms].filter(Boolean))];
    const latestDate = normalizedRecords.reduce((latest, record) => {
      if (!record.timestamp) return latest;
      const dateValue = new Date(record.timestamp);
      if (Number.isNaN(dateValue.getTime())) return latest;
      return dateValue.getTime() > latest ? dateValue.getTime() : latest;
    }, 0);

    const cutoffDate = latestDate
      ? new Date(latestDate - getTimeframeWindowDays(timeframe) * 24 * 60 * 60 * 1000)
      : null;

    return normalizedRecords.filter((record) => {
      if (!record.timestamp) return false;

      const recordDate = new Date(record.timestamp);
      if (cutoffDate && !Number.isNaN(recordDate.getTime()) && recordDate.getTime() < cutoffDate.getTime()) {
        return false;
      }

      if (!searchTerms.length) return true;

      const haystack = [record.cropName, record.category, record.marketName, record.region, record.village]
        .join(' ')
        .toLowerCase();

      return searchTerms.some((term) => {
        const cropNameMatch = record.cropName.toLowerCase().includes(term);
        return cropNameMatch || haystack.includes(term);
      });
    });
  }, [normalizedRecords, activeSearchTerm, compareCrops, timeframe]);

  // Available crops list for suggestions/datalists
  const availableCrops = useMemo(() => {
    const cropSet = new Set(normalizedRecords.map((r) => r.cropName));
    return Array.from(cropSet).filter(Boolean);
  }, [normalizedRecords]);

  // Search Handler
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const query = searchTerm.trim();
    setActiveSearchTerm(query);
    loadAnalyticsData(query);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setActiveSearchTerm('');
    setTimeframe('3M');
    setPriceType('both');
    setCompareCrops([]);
    setCompareInput('');
    loadAnalyticsData('');
  };

  // Compare overlay handlers
  const addCompareCrop = (nextCrop) => {
    const normalizedCrop = nextCrop.trim();
    if (!normalizedCrop || compareCrops.includes(normalizedCrop)) return;
    setCompareCrops((current) => [...current, normalizedCrop].slice(0, 4));
    setCompareInput('');
  };

  const removeCompareCrop = (cropName) => {
    setCompareCrops((current) => current.filter((crop) => crop !== cropName));
  };

  // Display Crops configuration for Charting
  const displayCrops = useMemo(() => {
    const chartCropNames = Array.from(new Set(chartRecords.map((record) => record.cropName).filter(Boolean)));
    const nextCrops = [];

    if (compareCrops.length) {
      compareCrops.forEach((crop) => {
        const trimmedCrop = crop.trim();
        if (!trimmedCrop) return;

        const exactMatch = chartCropNames.find((candidate) => candidate.toLowerCase() === trimmedCrop.toLowerCase());
        const resolvedCrop = exactMatch || trimmedCrop;
        if (!nextCrops.includes(resolvedCrop)) {
          nextCrops.push(resolvedCrop);
        }
      });
    }

    if (activeSearchTerm.trim()) {
      const normalisedSearch = activeSearchTerm.trim().toLowerCase();
      const exactMatch = chartCropNames.find((cropName) => cropName.toLowerCase() === normalisedSearch);
      const partialMatch = chartCropNames.find((cropName) => cropName.toLowerCase().includes(normalisedSearch));
      const primaryCrop = exactMatch || partialMatch;
      if (primaryCrop && !nextCrops.includes(primaryCrop)) {
        nextCrops.unshift(primaryCrop);
      }
    }

    if (!nextCrops.length) {
      const topCrop = chartCropNames[0];
      if (topCrop) nextCrops.push(topCrop);
    }

    return nextCrops;
  }, [compareCrops, activeSearchTerm, chartRecords]);

  const primaryCropName = displayCrops[0] || '';
  const chartData = useMemo(() => buildChartData(chartRecords, displayCrops), [chartRecords, displayCrops]);

  // KPI Calculations
  const kpis = useMemo(() => {
    if (!filteredAnalytics.length) return null;

    const totalTracked = filteredAnalytics.length;
    
    // Average Retail Calculation
    const totalRetail = filteredAnalytics.reduce((sum, r) => sum + r.retailPrice, 0);
    const avgRetail = (totalRetail / totalTracked) || 0;

    // Most Affordable Hub
    const sortedByWholesale = [...filteredAnalytics].sort((a, b) => a.wholesalePrice - b.wholesalePrice);
    const cheapestHub = sortedByWholesale[0];

    return {
      totalTracked,
      avgRetail,
      cheapestHub,
    };
  }, [filteredAnalytics]);

  const exportCurrentView = () => {
    if (!filteredAnalytics.length) return;
    downloadCsv(`beyi-analytics-${timeframe.toLowerCase()}.csv`, filteredAnalytics);
  };

  const resolveMetricKey = (cropName, metric) => `${slugify(cropName)}_${metric}`;
  const tooltipMarketLabel = activeSearchTerm || 'Filtered market snapshot';

  const renderTooltip = ({ active, payload, label }) => (
    <CustomTooltip active={active} payload={payload} label={label} tooltipMarketLabel={tooltipMarketLabel} />
  );

  const activeFilterTags = useMemo(() => {
    const tags = [];
    if (activeSearchTerm) tags.push({ id: 'search', label: `Filter: ${activeSearchTerm}` });
    if (timeframe !== '3M') tags.push({ id: 'timeframe', label: `Timeframe: ${timeframe}` });
    if (priceType !== 'both') tags.push({ id: 'priceType', label: `Price type: ${priceType}` });
    if (compareCrops.length) tags.push({ id: 'compare', label: `Compare: ${compareCrops.join(', ')}` });
    return tags;
  }, [activeSearchTerm, timeframe, priceType, compareCrops]);

  const hasActiveFilters = Boolean(
    activeSearchTerm || compareCrops.length || timeframe !== '3M' || priceType !== 'both'
  );

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Analytics</p>
            <h1 className={styles.title}>Market intelligence for Ugandan agriculture</h1>
            <p className={styles.subtitle}>
              Track price movement, compare markets, and spot seasonal opportunities from the same dashboard.
            </p>
          </div>

          <div className={styles.heroActions}>
            <button
              type="button"
              onClick={exportCurrentView}
              className={styles.primaryButton}
              disabled={!filteredAnalytics.length || loading}
              aria-label="Export the current analytics view as a CSV file"
            >
              Export CSV
            </button>
            <span className={styles.heroNote}>Live insights update as filters change.</span>
          </div>
        </section>

        {/* KPI CARDS */}
        <section className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Average Retail Price</span>
            <strong className={styles.kpiValue}>
              {kpis ? formatUSh(kpis.avgRetail.toFixed(0)) : '—'}
            </strong>
            <p className={styles.kpiMeta}>Calculated across current active filter dataset.</p>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Most Affordable Hub</span>
            <strong className={styles.kpiValue}>
              {kpis?.cheapestHub?.marketName || '—'}
            </strong>
            <p className={styles.kpiMeta}>
              {kpis?.cheapestHub
                ? `${kpis.cheapestHub.region} · ${formatUSh(kpis.cheapestHub.wholesalePrice)} wholesale`
                : 'Comparing market prices across active filters.'}
            </p>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Primary Tracked Crop</span>
            <strong className={styles.kpiValue}>{primaryCropName || '—'}</strong>
            <p className={styles.kpiMeta}>Base commodity currently rendered in analytics view.</p>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Total Tracked Entries</span>
            <strong className={styles.kpiValue}>{kpis?.totalTracked ?? 0}</strong>
            <p className={styles.kpiMeta}>Deduplicated market records in current view.</p>
          </article>
        </section>

        {/* SEARCH & FILTER BAR */}
        <section className={styles.filterBar} aria-label="Analytics filters">
          <form onSubmit={handleSearchSubmit} className={styles.filterField}>
            <label htmlFor="crop-filter">Search Market Data</label>
            <div className={styles.inputWithSpinner}>
              <input
                id="crop-filter"
                list="crop-options"
                className={styles.filterInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search crop, category, market, or district..."
                aria-label="Filter analytics by crop or region"
              />
              <button
                type="submit"
                className={styles.secondaryButton}
                disabled={loading}
                aria-label="Search analytics"
              >
                Search
              </button>
            </div>
            <datalist id="crop-options">
              {availableCrops.map((cropName, idx) => (
                <option key={`${cropName}-${idx}`} value={cropName} />
              ))}
            </datalist>
          </form>

          {/* PRICE TYPE SWITCH */}
          <div className={styles.switchGroup}>
            <span className={styles.switchLabel}>Price type</span>
            <div className={styles.switchButtons}>
              {PRICE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.switchButton} ${priceType === option.value ? styles.switchButtonActive : ''}`}
                  onClick={() => setPriceType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* TIMEFRAME SWITCH */}
          <div className={styles.timeframeGroup}>
            <span className={styles.switchLabel}>Timeframe</span>
            <div className={styles.switchButtons}>
              {TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.switchButton} ${timeframe === option.value ? styles.switchButtonActive : ''}`}
                  onClick={() => setTimeframe(option.value)}
                  disabled={loading}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterActions}>
            <button type="button" className={styles.secondaryButton} onClick={resetFilters} disabled={!hasActiveFilters}>
              Clear filters
            </button>
          </div>
        </section>

        {/* ACTIVE TAGS & FEEDBACK */}
        <section className={styles.activeFiltersPanel} aria-label="Active filters">
          <div className={styles.filterTagsRow}>
            {activeFilterTags.length ? activeFilterTags.map((tag) => (
              <span key={tag.id} className={styles.activeFilterTag}>{tag.label}</span>
            )) : <span className={styles.activeFilterTagMuted}>No filters applied — showing overall market analytics.</span>}
          </div>
          {searchFeedback && <p className={styles.searchFeedback}>{searchFeedback}</p>}
        </section>

        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        {/* MAIN CHART AND DATA PANELS */}
        <section className={styles.chartGrid}>
          <article className={styles.chartCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Live Trend</span>
                <h2 className={styles.sectionTitle}>Wholesale vs. Retail price movement</h2>
              </div>
              <p className={styles.sectionHint}>Context: {tooltipMarketLabel}</p>
            </div>

            <div className={styles.chartStage} aria-busy={loading}>
              {loading ? (
                <div className={styles.loadingState} role="status" aria-live="polite">Loading chart data...</div>
              ) : chartData.length ? (
                <PriceTrendChart
                  data={chartData}
                  displayCrops={displayCrops}
                  primaryCropName={primaryCropName}
                  priceType={priceType}
                  resolveMetricKey={resolveMetricKey}
                  tooltipContent={renderTooltip}
                  xAxisKey="label"
                  yAxisFormatter={(value) => `USh ${value / 1000}k`}
                />
              ) : (
                <div className={styles.emptyState} role="status">No chart data matches the current filters.</div>
              )}
            </div>

            <div className={styles.comparePills}>
              {displayCrops.length ? displayCrops.map((crop) => (
                <span key={crop} className={styles.comparePill}>{crop}</span>
              )) : <span className={styles.comparePillMuted}>No crop selected</span>}
            </div>
          </article>

          <aside className={styles.sideStack}>
            {/* DEDUPLICATED MARKET SPREAD TABLE */}
            <article className={styles.sideCard}>
              <div className={styles.sectionHeaderCompact}>
                <div>
                  <span className={styles.sectionEyebrow}>Market Snapshot</span>
                  <h2 className={styles.sectionTitle}>Latest prices by location</h2>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Market / Crop</th>
                      <th>Wholesale</th>
                      <th>Retail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnalytics.length ? filteredAnalytics.slice(0, 10).map((row) => (
                      <tr key={`${row.id}-${row.marketName}-${row.cropName}`}>
                        <td>
                          <strong>{row.cropName}</strong>
                          <span>{row.marketName}{row.region ? ` · ${row.region}` : ''}</span>
                        </td>
                        <td>{formatUSh(row.wholesalePrice)}</td>
                        <td>{formatUSh(row.retailPrice)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="3" className={styles.tableEmpty}>No records available for the selected query.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </aside>
        </section>

        {/* OVERLAY / COMPARE CROPS */}
        <section className={styles.chipPanel}>
          <div className={styles.sectionHeaderCompact}>
            <div>
              <span className={styles.sectionEyebrow}>Overlay</span>
              <h2 className={styles.sectionTitle}>Compare crops side by side</h2>
            </div>
            <p className={styles.sectionHint}>Add up to four crops to layer into the main trend chart.</p>
          </div>

          <div className={styles.inlineComposer}>
            <input
              className={styles.filterInput}
              list="compare-crop-options"
              placeholder="Type a crop and press Enter to add it"
              value={compareInput}
              onChange={(e) => setCompareInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCompareCrop(compareInput);
                }
              }}
              aria-label="Add a crop to compare"
            />
            <datalist id="compare-crop-options">
              {availableCrops.map((cropName, idx) => (
                <option key={`compare-${idx}`} value={cropName} />
              ))}
            </datalist>
            <button type="button" className={styles.secondaryButton} onClick={() => addCompareCrop(compareInput)} disabled={loading}>
              Add crop
            </button>
          </div>

          <div className={styles.chipList}>
            {compareCrops.length ? compareCrops.map((crop) => (
              <button key={crop} type="button" className={styles.chip} onClick={() => removeCompareCrop(crop)}>
                {crop} <span>×</span>
              </button>
            )) : <span className={styles.chipGhost}>No overlay crops selected.</span>}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AnalyticsPage;