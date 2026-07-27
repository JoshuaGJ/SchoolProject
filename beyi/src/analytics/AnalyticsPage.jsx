import React, { useEffect, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Header from '../header/Header.jsx';
import { fetchJson } from '../lib/api';
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
  if (value === null || value === undefined || value === '') {
    return 'USh 0';
  }

  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    return `USh ${value}`;
  }

  return `USh ${numberValue.toLocaleString()}`;
};

const formatDateLabel = (value) => {
  if (!value) {
    return 'Unknown period';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-UG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const buildCsv = (rows) => {
  const header = ['period', 'crop', 'wholesale_price', 'retail_price', 'market_name', 'record_count'];
  const lines = rows.map((row) => [
    row.period ?? '',
    row['crop__name'] ?? '',
    row.wholesale_price ?? '',
    row.retail_price ?? '',
    row.market_name ?? '',
    row.record_count ?? '',
  ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));

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

const buildChartData = (rows) => {
  const periodMap = new Map();

  rows.forEach((row) => {
    const periodKey = row.period;
    const cropName = row['crop__name'];
    const cropKey = slugify(cropName);
    const current = periodMap.get(periodKey) || {
      period: periodKey,
      label: formatDateLabel(periodKey),
    };

    current[`${cropKey}_wholesale`] = row.wholesale_price;
    current[`${cropKey}_retail`] = row.retail_price;
    periodMap.set(periodKey, current);
  });

  return Array.from(periodMap.values()).sort((left, right) => new Date(left.period) - new Date(right.period));
};

const formatRatio = (ratio) => {
  if (ratio === null || ratio === undefined) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
};

const AnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState('3M');
  const [priceType, setPriceType] = useState('both');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('');
  const [compareCrops, setCompareCrops] = useState([]);
  const [cropInput, setCropInput] = useState('');
  const [regionInput, setRegionInput] = useState('');
  const [marketInput, setMarketInput] = useState('');
  const [compareInput, setCompareInput] = useState('');

  useEffect(() => {
    let active = true;

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams();
        params.set('timeframe', timeframe);
        params.set('price_type', priceType);

        if (selectedCrop) {
          params.set('crop', selectedCrop);
          params.set('arbitrage_crop', selectedCrop);
        }

        if (selectedRegion) {
          params.set('region', selectedRegion);
        }

        if (selectedMarket) {
          params.set('market', selectedMarket);
        }

        if (compareCrops.length) {
          params.set('compare_crops', compareCrops.join(','));
        }

        const data = await fetchJson(`/analytics/?${params.toString()}`);

        if (!active) {
          return;
        }

        setAnalytics(data);

        if (!selectedCrop && data?.filters?.selected_crop) {
          setSelectedCrop(data.filters.selected_crop);
          setCropInput(data.filters.selected_crop);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || 'Unable to load analytics data.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadAnalytics();

    return () => {
      active = false;
    };
  }, [timeframe, priceType, selectedCrop, selectedRegion, selectedMarket, compareCrops]);

  const availableCrops = analytics?.filters?.available_crops || [];
  const availableRegions = analytics?.filters?.available_regions || [];
  const availableMarkets = analytics?.filters?.available_markets || [];
  const chartRows = analytics?.chart?.rows || [];
  const chartData = buildChartData(chartRows);
  const displayCrops = compareCrops.length ? compareCrops : (analytics?.chart?.crops || []);
  const primaryCropName = selectedCrop || analytics?.filters?.selected_crop || displayCrops[0] || '';
  const primaryCropKey = primaryCropName ? slugify(primaryCropName) : '';

  const filteredCropOptions = availableCrops.filter((crop) =>
    crop.name.toLowerCase().includes(cropInput.toLowerCase())
  );

  const filteredRegionOptions = availableRegions.filter((region) =>
    region.toLowerCase().includes(regionInput.toLowerCase())
  );

  const filteredMarketOptions = availableMarkets.filter((market) =>
    [market.name, market.region_location].join(' ').toLowerCase().includes(marketInput.toLowerCase())
  );

  const addCompareCrop = (nextCrop) => {
    const normalizedCrop = nextCrop.trim();
    if (!normalizedCrop || compareCrops.includes(normalizedCrop)) {
      return;
    }

    setCompareCrops((current) => [...current, normalizedCrop].slice(0, 4));
    setCompareInput('');
  };

  const removeCompareCrop = (cropName) => {
    setCompareCrops((current) => current.filter((crop) => crop !== cropName));
  };

  const exportCurrentView = () => {
    if (!chartRows.length) {
      return;
    }

    downloadCsv(`beyi-analytics-${timeframe.toLowerCase()}.csv`, chartRows);
  };

  const resolveMetricKey = (cropName, metric) => `${slugify(cropName)}_${metric}`;
  const tooltipMarketLabel = selectedMarket || selectedRegion || 'Filtered market basket';

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
            <button type="button" onClick={exportCurrentView} className={styles.primaryButton} disabled={!chartRows.length}>
              Export CSV
            </button>
            <span className={styles.heroNote}>Live insights update as filters change.</span>
          </div>
        </section>

        <section className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Highest Price Surge</span>
            <strong className={styles.kpiValue}>{analytics?.kpis?.highest_price_surge?.crop || '—'}</strong>
            <p className={styles.kpiMeta}>
              {analytics?.kpis?.highest_price_surge
                ? `${analytics.kpis.highest_price_surge.percentage_change}% in the last 7 days`
                : 'Waiting for enough data to calculate movement.'}
            </p>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Most Affordable Hub</span>
            <strong className={styles.kpiValue}>
              {analytics?.kpis?.most_affordable_hub?.market_name || '—'}
            </strong>
            <p className={styles.kpiMeta}>
              {analytics?.kpis?.most_affordable_hub
                ? `${analytics.kpis.most_affordable_hub.region_location} · ${formatUSh(analytics.kpis.most_affordable_hub.average_wholesale)}`
                : 'Comparing staple markets across the active filter set.'}
            </p>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Price Stability Indicator</span>
            <strong className={styles.kpiValue}>{analytics?.kpis?.price_stability?.crop || '—'}</strong>
            <p className={styles.kpiMeta}>
              {analytics?.kpis?.price_stability
                ? `${analytics.kpis.price_stability.price_range} shilling spread across the last 30 days`
                : 'No stability signal yet.'}
            </p>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>Total Tracked Entries</span>
            <strong className={styles.kpiValue}>{analytics?.kpis?.total_tracked_entries ?? 0}</strong>
            <p className={styles.kpiMeta}>Rows included in the current filtered analytics view.</p>
          </article>
        </section>

        <section className={styles.filterBar}>
          <div className={styles.filterField}>
            <label htmlFor="crop-filter">Crop / Commodity</label>
            <input
              id="crop-filter"
              list="crop-options"
              className={styles.filterInput}
              value={cropInput}
              onChange={(event) => setCropInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  setSelectedCrop(cropInput.trim());
                }
              }}
              placeholder="Search crops and press Enter"
            />
            <datalist id="crop-options">
              {filteredCropOptions.map((crop) => (
                <option key={crop.id} value={crop.name} label={crop.category} />
              ))}
            </datalist>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="region-filter">Region / District</label>
            <input
              id="region-filter"
              list="region-options"
              className={styles.filterInput}
              value={regionInput}
              onChange={(event) => setRegionInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  setSelectedRegion(regionInput.trim());
                }
              }}
              placeholder="Filter by region"
            />
            <datalist id="region-options">
              {filteredRegionOptions.map((region) => (
                <option key={region} value={region} />
              ))}
            </datalist>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="market-filter">Market</label>
            <input
              id="market-filter"
              list="market-options"
              className={styles.filterInput}
              value={marketInput}
              onChange={(event) => setMarketInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  setSelectedMarket(marketInput.trim());
                }
              }}
              placeholder="Kalerwe, Nakasero, Owino..."
            />
            <datalist id="market-options">
              {filteredMarketOptions.map((market) => (
                <option key={market.id} value={market.name} label={market.region_location} />
              ))}
            </datalist>
          </div>

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

          <div className={styles.timeframeGroup}>
            <span className={styles.switchLabel}>Timeframe</span>
            <div className={styles.switchButtons}>
              {TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.switchButton} ${timeframe === option.value ? styles.switchButtonActive : ''}`}
                  onClick={() => setTimeframe(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        <section className={styles.chartGrid}>
          <article className={styles.chartCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Live Trend</span>
                <h2 className={styles.sectionTitle}>Wholesale vs. Retail price movement</h2>
              </div>
              <p className={styles.sectionHint}>Tooltip context uses the current market filter: {tooltipMarketLabel}</p>
            </div>

            <div className={styles.chartStage}>
              {loading ? (
                <div className={styles.loadingState}>Loading chart data...</div>
              ) : chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 24, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickMargin={12} />
                    <YAxis tickFormatter={(value) => `USh ${value / 1000}k`} width={72} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }

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
                    }} />
                    <Legend />

                    {displayCrops.map((cropName, index) => {
                      const safeKey = slugify(cropName);
                      const lineColor = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444'][index % 4];

                      if (priceType === 'both' && cropName === primaryCropName) {
                        return (
                          <React.Fragment key={cropName}>
                            <Line
                              type="monotone"
                              dataKey={resolveMetricKey(cropName, 'wholesale')}
                              name={`${cropName} Wholesale`}
                              stroke={lineColor}
                              strokeWidth={3}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey={resolveMetricKey(cropName, 'retail')}
                              name={`${cropName} Retail`}
                              stroke={lineColor}
                              strokeDasharray="6 4"
                              strokeWidth={2}
                              dot={false}
                            />
                          </React.Fragment>
                        );
                      }

                      const priceKey = priceType === 'retail' ? 'retail' : 'wholesale';

                      return (
                        <Line
                          key={cropName}
                          type="monotone"
                          dataKey={resolveMetricKey(cropName, priceKey)}
                          name={cropName}
                          stroke={lineColor}
                          strokeWidth={cropName === primaryCropName ? 3 : 2}
                          dot={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.emptyState}>No chart data matches the current filters.</div>
              )}
            </div>

            <div className={styles.comparePills}>
              {displayCrops.length ? displayCrops.map((crop) => (
                <span key={crop} className={styles.comparePill}>{crop}</span>
              )) : <span className={styles.comparePillMuted}>No crop selected</span>}
            </div>
          </article>

          <aside className={styles.sideStack}>
            <article className={styles.sideCard}>
              <div className={styles.sectionHeaderCompact}>
                <div>
                  <span className={styles.sectionEyebrow}>Arbitrage</span>
                  <h2 className={styles.sectionTitle}>Market spread on the same date</h2>
                </div>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Market</th>
                      <th>Wholesale</th>
                      <th>Retail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.arbitrage?.rows?.length ? analytics.arbitrage.rows.map((row) => (
                      <tr key={`${row.market__name}-${row.market__region_location}`}>
                        <td>
                          <strong>{row.market__name}</strong>
                          <span>{row.market__region_location}{row.market__village ? ` · ${row.market__village}` : ''}</span>
                        </td>
                        <td>{formatUSh(row.wholesale_price)}</td>
                        <td>{formatUSh(row.retail_price)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="3" className={styles.tableEmpty}>Select a crop to surface same-day market arbitrage.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className={styles.sideCard}>
              <div className={styles.sectionHeaderCompact}>
                <div>
                  <span className={styles.sectionEyebrow}>Volatility</span>
                  <h2 className={styles.sectionTitle}>Most unstable commodities</h2>
                </div>
              </div>

              <div className={styles.listStack}>
                {analytics?.volatility?.length ? analytics.volatility.map((item, index) => (
                  <div key={item['crop__name']} className={styles.rankRow}>
                    <div>
                      <strong>{index + 1}. {item['crop__name']}</strong>
                      <span>{item['crop__category']} · {item.observation_count} points</span>
                    </div>
                    <strong>{formatUSh(item.price_range)}</strong>
                  </div>
                )) : <div className={styles.tableEmpty}>No volatility rankings available yet.</div>}
              </div>
            </article>

            <article className={styles.sideCard}>
              <div className={styles.sectionHeaderCompact}>
                <div>
                  <span className={styles.sectionEyebrow}>Seasonality</span>
                  <h2 className={styles.sectionTitle}>Peak predictor</h2>
                </div>
              </div>

              <div className={styles.listStack}>
                {analytics?.seasonal_insights?.length ? analytics.seasonal_insights.map((item) => (
                  <div key={item.crop} className={styles.seasonRow}>
                    <div className={styles.seasonHeader}>
                      <strong>{item.crop}</strong>
                      <span>{item.status}</span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${formatRatio(item.ratio)}%` }} />
                    </div>
                    <small>{formatUSh(item.recent_average)} vs {formatUSh(item.baseline_average)}</small>
                  </div>
                )) : <div className={styles.tableEmpty}>Seasonal context appears after enough history loads.</div>}
              </div>
            </article>
          </aside>
        </section>

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
              onChange={(event) => setCompareInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addCompareCrop(compareInput);
                }
              }}
            />
            <datalist id="compare-crop-options">
              {availableCrops.map((crop) => (
                <option key={`compare-${crop.id}`} value={crop.name} label={crop.category} />
              ))}
            </datalist>
            <button type="button" className={styles.secondaryButton} onClick={() => addCompareCrop(compareInput)}>
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