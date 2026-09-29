// src/components/analytics/MarketTableCard.jsx
import React from 'react';
import { formatDateLabel, formatUSh } from './analyticsHelpers';
import styles from './analytics.module.css';

const MarketTableCard = ({
  cropName,
  history,
  limit,
  setLimit,
  loadingPrices,
  fallbackLabel,
}) => {
  return (
    <article className={styles.sideCard}>
      <div className={styles.tableCardHeader}>
        <h3>{cropName || fallbackLabel}</h3>
        <span className={styles.recordBadge}>{history.length} total records</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Market / Location</th>
              <th>Wholesale</th>
              <th>Retail</th>
            </tr>
          </thead>
          <tbody>
            {history.length ? (
              history.slice(0, limit).map((row, idx) => (
                <tr key={`${row.id || idx}-${row.timestamp}`}>
                  <td>
                    <strong>{formatDateLabel(row.timestamp)}</strong>
                  </td>
                  <td>
                    {row.marketName}
                    {row.region ? <small> ({row.region})</small> : null}
                  </td>
                  <td>{formatUSh(row.wholesalePrice)}</td>
                  <td>{formatUSh(row.retailPrice)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className={styles.tableEmpty}>
                  {loadingPrices ? 'Loading...' : 'No price records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {history.length > limit && (
        <div className={styles.tableFooter}>
          <button
            type="button"
            className={styles.loadMoreButton}
            onClick={() => setLimit((prev) => prev + 5)}
          >
            Load 5 More ({history.length - limit} remaining)
          </button>
        </div>
      )}
    </article>
  );
};

export default React.memo(MarketTableCard);