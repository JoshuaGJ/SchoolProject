// src/components/analytics/AnalyticsFilterBar.jsx
import React, { useId } from 'react';
import { TIMEFRAME_OPTIONS, PRICE_TYPE_OPTIONS } from './analyticsHelpers';
import styles from './analytics.module.css';

const AnalyticsFilterBar = ({
  primaryInput,
  setPrimaryInput,
  secondaryInput,
  setSecondaryInput,
  handlePrimarySubmit,
  handleSecondarySubmit,
  availableCrops,
  fetchingCropsList,
  loadingPrices,
  timeframe,
  setTimeframe,
  priceType,
  setPriceType,
}) => {
  const dataListId = useId();
  const primaryId = useId();
  const secondaryId = useId();

  return (
    <section className={styles.filterBar}>
      {/* PRIMARY CROP INPUT */}
      <form onSubmit={handlePrimarySubmit} className={styles.filterField}>
        <label htmlFor={primaryId}>Primary Crop (Chart View)</label>
        <div className={styles.inputWithSpinner}>
          <input
            id={primaryId}
            list={dataListId}
            className={styles.filterInput}
            value={primaryInput}
            onChange={(e) => setPrimaryInput(e.target.value)}
            placeholder={fetchingCropsList ? 'Loading database...' : 'Pick primary crop...'}
            disabled={fetchingCropsList}
          />
          <button type="submit" className={styles.secondaryButton} disabled={loadingPrices}>
            Load Primary
          </button>
        </div>
      </form>

      {/* SECONDARY CROP INPUT */}
      <form onSubmit={handleSecondarySubmit} className={styles.filterField}>
        <label htmlFor={secondaryId}>Comparison Crop (Table View)</label>
        <div className={styles.inputWithSpinner}>
          <input
            id={secondaryId}
            list={dataListId}
            className={styles.filterInput}
            value={secondaryInput}
            onChange={(e) => setSecondaryInput(e.target.value)}
            placeholder={fetchingCropsList ? 'Loading database...' : 'Pick comparison crop...'}
            disabled={fetchingCropsList}
          />
          <button type="submit" className={styles.secondaryButton} disabled={loadingPrices}>
            Load Compare
          </button>
        </div>
      </form>

      {/* AUTOCOMPLETE DATALIST */}
      <datalist id={dataListId}>
        {availableCrops.map((cropName) => (
          <option key={cropName} value={cropName} />
        ))}
      </datalist>

      {/* TIMEFRAME SWITCH */}
      <div className={styles.timeframeGroup}>
        <span className={styles.switchLabel}>Timeframe</span>
        <div className={styles.switchButtons}>
          {TIMEFRAME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.switchButton} ${
                timeframe === opt.value ? styles.switchButtonActive : ''
              }`}
              onClick={() => setTimeframe(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* PRICE TYPE SWITCH */}
      <div className={styles.switchGroup}>
        <span className={styles.switchLabel}>View Type</span>
        <div className={styles.switchButtons}>
          {PRICE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.switchButton} ${
                priceType === opt.value ? styles.switchButtonActive : ''
              }`}
              onClick={() => setPriceType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default React.memo(AnalyticsFilterBar);