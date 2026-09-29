import React, { useState, useMemo, useCallback } from 'react';
import Header from '../header/Header.jsx';
import PriceTrendChart from './PriceTrendChart.jsx';
import AnalyticsFilterBar from './AnalyticsFilterBar.jsx';
import MarketTableCard from './MarketTableCard.jsx';
import { useCropAnalytics } from './useCropAnalytics';
import {
  formatUSh,
  slugify,
  downloadCsv,
  buildChartData,
} from './analyticsHelpers';
import styles from './analytics.module.css';

const CustomTooltip = React.memo(({ active, payload, label, tooltipMarketLabel }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className={styles.tooltipCard} style={{ background: '#1e293b', color: '#fff', padding: '10px', borderRadius: '8px' }}>
      <strong>{label}</strong>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
        {tooltipMarketLabel}
      </div>
      {payload.map((entry) => {
        if (entry.value === null || entry.value === undefined) return null;

        return (
          <div
            key={entry.dataKey}
            style={{
              display: 'flex',
              justify: 'space-between',
              gap: '12px',
              color: entry.color || '#38bdf8',
              fontSize: '13px',
              margin: '2px 0',
            }}
          >
            <span>{entry.name || entry.dataKey}:</span>
            <strong>{formatUSh(entry.value)}</strong>
          </div>
        );
      })}
    </div>
  );
});

const AnalyticsPage = () => {
  // Query state - Starts empty so no crops load by default
  const [selectedPrimaryCrop, setSelectedPrimaryCrop] = useState('');
  const [selectedSecondaryCrop, setSelectedSecondaryCrop] = useState('');
  const [primaryInput, setPrimaryInput] = useState('');
  const [secondaryInput, setSecondaryInput] = useState('');

  // Pagination limits
  const [primaryLimit, setPrimaryLimit] = useState(10);
  const [secondaryLimit, setSecondaryLimit] = useState(10);

  // Filters
  const [timeframe, setTimeframe] = useState('3M');
  const [priceType, setPriceType] = useState('both');

  // Active target array (only holds crops explicitly selected by the user)
  const activeTargets = useMemo(() => {
    const targets = [];
    if (selectedPrimaryCrop) targets.push(selectedPrimaryCrop);
    if (selectedSecondaryCrop && selectedSecondaryCrop !== selectedPrimaryCrop) {
      targets.push(selectedSecondaryCrop);
    }
    return targets;
  }, [selectedPrimaryCrop, selectedSecondaryCrop]);

  // Hook handling API calls and caching
  const {
    availableCrops,
    fetchingCropsList,
    recordsCache,
    loadingPrices,
    error,
  } = useCropAnalytics(activeTargets);

  // History lists for tables
  const primaryHistory = useMemo(() => {
    if (!selectedPrimaryCrop || !recordsCache[selectedPrimaryCrop]) return [];
    return [...recordsCache[selectedPrimaryCrop]].sort(
      (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
    );
  }, [selectedPrimaryCrop, recordsCache]);

  const secondaryHistory = useMemo(() => {
    if (!selectedSecondaryCrop || !recordsCache[selectedSecondaryCrop]) return [];
    return [...recordsCache[selectedSecondaryCrop]].sort(
      (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
    );
  }, [selectedSecondaryCrop, recordsCache]);

  // Build merged chart dataset for active crops
  const chartData = useMemo(
    () => buildChartData(recordsCache, activeTargets),
    [recordsCache, activeTargets]
  );

  // Form Submit Handlers
  const handlePrimarySubmit = useCallback(
    (e) => {
      if (e) e.preventDefault();
      const query = primaryInput.trim();
      if (!query) return;
      const match = availableCrops.find((c) => c.toLowerCase() === query.toLowerCase());
      setSelectedPrimaryCrop(match || query);
      setPrimaryLimit(10);
    },
    [primaryInput, availableCrops]
  );

  const handleSecondarySubmit = useCallback(
    (e) => {
      if (e) e.preventDefault();
      const query = secondaryInput.trim();
      if (!query) return;
      const match = availableCrops.find((c) => c.toLowerCase() === query.toLowerCase());
      setSelectedSecondaryCrop(match || query);
      setSecondaryLimit(10);
    },
    [secondaryInput, availableCrops]
  );

  const resolveMetricKey = useCallback(
    (cropName, metric) => `${slugify(cropName)}_${metric}`,
    []
  );

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.shell}>
        {/* HERO SECTION */}
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Market Analytics</p>
            <h1 className={styles.title}>Crop Price Intelligence</h1>
            <p className={styles.subtitle}>
              Analyze historical price trends for primary commodities and compare prices side-by-side.
            </p>
          </div>

          <div className={styles.heroActions}>
            <button
              type="button"
              onClick={() =>
                downloadCsv(`crop-analytics-${selectedPrimaryCrop}.csv`, primaryHistory)
              }
              className={styles.primaryButton}
              disabled={!primaryHistory.length || loadingPrices}
            >
              Export Primary View (CSV)
            </button>
          </div>
        </section>

        {/* CONTROLS & FILTERS */}
        <AnalyticsFilterBar
          primaryInput={primaryInput}
          setPrimaryInput={setPrimaryInput}
          secondaryInput={secondaryInput}
          setSecondaryInput={setSecondaryInput}
          handlePrimarySubmit={handlePrimarySubmit}
          handleSecondarySubmit={handleSecondarySubmit}
          availableCrops={availableCrops}
          fetchingCropsList={fetchingCropsList}
          loadingPrices={loadingPrices}
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          priceType={priceType}
          setPriceType={setPriceType}
        />

        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* GRAPH SECTION */}
        <section className={styles.chartGrid}>
          <article className={styles.chartCard}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Historical Price Trend</span>
                <h2 className={styles.sectionTitle}>
                  {activeTargets.length > 0
                    ? activeTargets.join(' vs ')
                    : 'No Crop Selected'}
                </h2>
              </div>
              <p className={styles.sectionHint}>Showing timeframe: {timeframe}</p>
            </div>

            <div className={styles.chartStage} aria-busy={loadingPrices}>
              {loadingPrices ? (
                <div className={styles.loadingState}>Fetching price data...</div>
              ) : activeTargets.length === 0 ? (
                <div className={styles.emptyState}>
                  Search and load a primary crop above to view analytics trends.
                </div>
              ) : chartData.length ? (
               <PriceTrendChart
                  data={chartData}
                  displayCrops={activeTargets}
                  primaryCropName={selectedPrimaryCrop}
                  priceType={priceType}
                  resolveMetricKey={resolveMetricKey}
                  tooltipContent={(props) => (
                    <CustomTooltip {...props} tooltipMarketLabel={`Timeframe: ${timeframe}`} />
                  )}
                  yAxisKey="label"
                />
              ) : (
                <div className={styles.emptyState}>
                  No chart records available for selected crop(s).
                </div>
              )}
            </div>
          </article>
        </section>

        {/* TABLES SECTION */}
        <section className={styles.comparisonSection}>
          <div className={styles.sectionHeaderCompact}>
            <div>
              <span className={styles.sectionEyebrow}>Price History Comparison</span>
              <h2 className={styles.sectionTitle}>Side-by-Side Market Data</h2>
            </div>
            <p className={styles.sectionHint}>
              Comparing historical price entries.
            </p>
          </div>

          <div className={styles.adjacentTablesGrid}>
            <MarketTableCard
              cropName={selectedPrimaryCrop}
              fallbackLabel="Primary Crop (Search to load)"
              history={primaryHistory}
              limit={primaryLimit}
              setLimit={setPrimaryLimit}
              loadingPrices={loadingPrices}
            />
            <MarketTableCard
              cropName={selectedSecondaryCrop}
              fallbackLabel="Comparison Crop (Optional)"
              history={secondaryHistory}
              limit={secondaryLimit}
              setLimit={setSecondaryLimit}
              loadingPrices={loadingPrices}
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default AnalyticsPage;