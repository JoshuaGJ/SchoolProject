import { Link } from 'react-router-dom';
import React, { useState, useEffect, useRef } from 'react';
import styles from './searchdash.module.css';
import { useTheme } from '../ThemeContext';
import { fetchJson } from '../lib/api';

const formatPrice = (value) => {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return value ?? '—';
  }

  return `USh ${numberValue.toLocaleString()}`;
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) {
    return 'Recently';
  }

  const publishedAt = new Date(timestamp);
  const diffMs = Date.now() - publishedAt.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

const Searchdash = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [detail, setDetail] = useState(null);
  const popoverRef = useRef(null); // The "sticky note" for our box
  const [priceRecords, setPriceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setSelectedMarket(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPriceRecords = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await fetchJson('/prices/search/');

        if (isMounted) {
          setPriceRecords(Array.isArray(data) ? data : []);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(requestError.message || 'Unable to load market data.');
          setPriceRecords([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPriceRecords();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleMarketClick = (index, e) => {
    e.stopPropagation();
    setSelectedMarket(selectedMarket === index ? null : index);
  };
  const lower = searchTerm.toLowerCase();

  const normalizedRecords = priceRecords.map((record) => ({
    id: record.id,
    marketName: record.market?.name ?? 'Unknown market',
    region: record.market?.region_location ?? '',
    village: record.market?.village ?? '',
    cropName: record.crop?.name ?? 'Unknown crop',
    category: record.crop?.category ?? '',
    wholesalePrice: record.wholesale_price,
    retailPrice: record.retail_price,
    updated: formatRelativeTime(record.timestamp),
    timestamp: record.timestamp,
  }));

  const filteredMarketData = normalizedRecords.filter((record) =>
    [record.marketName, record.cropName, record.region, record.village, String(record.wholesalePrice), String(record.retailPrice), record.updated]
      .join(' ')
      .toLowerCase()
      .includes(lower)
  );

  const relatedCrops = Array.from(
    normalizedRecords.reduce((cropMap, record) => {
      if (!cropMap.has(record.cropName)) {
        cropMap.set(record.cropName, {
          name: record.cropName,
          price: formatPrice(record.retailPrice ?? record.wholesalePrice),
        });
      }

      return cropMap;
    }, new Map()).values()
  ).slice(0, 3);

  const nearbyMarkets = Array.from(
    normalizedRecords.reduce((marketMap, record) => {
      if (!marketMap.has(record.marketName)) {
        marketMap.set(record.marketName, {
          id: record.id,
          name: record.marketName,
          district: record.region,
          village: record.village,
          price: formatPrice(record.retailPrice ?? record.wholesalePrice),
          cropName: record.cropName,
        });
      }

      return marketMap;
    }, new Map()).values()
  ).filter((market) =>
    [market.name, market.district, market.village, market.price, market.cropName]
      .join(' ')
      .toLowerCase()
      .includes(lower)
  );

  const detailRecord = detail || null;

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.dashboardHeader}>
        <div className={styles.brand}>Beyi</div>
        <div className={styles.searchContainer}>
          <form onSubmit={(e) => e.preventDefault()} className={styles.searchForm}>
            <input
              type="text"
              className={styles.searchBar}
              placeholder="Search for commodities, markets, or prices"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="button" className={styles.clearBtn} onClick={() => setSearchTerm('')}>
              Clear
            </button>
          </form>
        </div>
        <div>
          <button onClick={toggleTheme} className={styles.themeToggle}>
            {isLightTheme ? 'Dark' : 'Light'} Theme
          </button>
          <Link to="/auth" className={styles.authLinks}>Login / Signup</Link>
        </div>
      </header>

      <main className={styles.dashboardGrid}>
        {/* Left Column */}
        <section className={styles.columnHero}>
          <div className={styles.heroCard}>
            <span className={styles.label}>Primary Commodity</span>
            <h2 className={styles.commodityTitle}>
              {normalizedRecords[0]?.cropName || 'No crop data'}
            </h2>
            <div className={styles.priceDisplay}>
              <span className={styles.priceValue}>
                {normalizedRecords[0] ? formatPrice(normalizedRecords[0].retailPrice ?? normalizedRecords[0].wholesalePrice) : '—'}
              </span>
            </div>
            <div className={styles.sparklineContainer}>
              <span className={styles.unit}>
                {normalizedRecords[0]?.marketName ? `Market: ${normalizedRecords[0].marketName}` : 'Unit kg'}
              </span>
            </div>
          </div>

          <div className={styles.dataCard}>
            <h3 className={styles.cardTitle}>Related Crops</h3>
            <ul className={styles.cropList}>
              {relatedCrops.map((crop) => (
                <li key={crop.name} className={styles.cropItem}>
                  <span>{crop.name}</span>
                  <span className={styles.cropPrice}>{crop.price}</span>
                </li>
              ))}
            </ul>
          </div>

        </section>

        {/* Center Column */}
        <section className={styles.columnCenter}>
          <div className={styles.dataCard}>
            <h3 className={styles.cardTitle}>Market Comparison</h3>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th>Market Name</th>
                  <th>Price</th>
                  <th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="3" className={styles.muted}>Loading market prices...</td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan="3" className={styles.muted}>{error}</td>
                  </tr>
                )}
                {!loading && !error && filteredMarketData.map((market, index) => (
                  <tr
                    key={`${market.id}-${index}`}
                    className={styles.clickableRow}
                    onClick={(e) => handleMarketClick(index, e)}
                  >
                    <td>
                      {market.marketName}
                      {selectedMarket === index && (
                        <div ref={popoverRef} className={styles.marketPopover} onClick={(e) => e.stopPropagation()}>
                          <h4>{market.marketName} Details</h4>
                          <p>Crop: {market.cropName}</p>
                          <p>Status: <span className={styles.textEmerald}>Open</span></p>
                          <p>Latest price: {formatPrice(market.retailPrice ?? market.wholesalePrice)}</p>
                          <p>Updated: {market.updated}</p>
                          <hr className={styles.divider} />
                          <button className={styles.directionBtn}>
                            Get Directions
                          </button>
                        </div>
                      )}
                    </td>
                    <td className={styles.bold}>{formatPrice(market.retailPrice ?? market.wholesalePrice)}</td>
                    <td className={styles.muted}>{market.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            

        </section>

        {/* Right Column */}
        <aside className={styles.columnSidebar}>
         
             <div className={`${styles.dataCard} ${styles.mb20}`}>
            <h3 className={styles.cardTitle}>Nearby Markets</h3>
            <ul className={styles.listItems}>
                {!loading && !error && nearbyMarkets.map((market) => (
                  <li key={`${market.name}-${market.district}`}>
                    <a onClick={() => setDetail(market)}>
                      <h4>{market.name}</h4>
                      <p>{market.district} {market.village ? `• ${market.village}` : ''}</p>
                      <p><b>{market.price}</b></p>
                    </a>
                  </li>
                ))}
                {!loading && !error && nearbyMarkets.length === 0 && <li>No nearby markets found.</li>}
            </ul>
          </div>
          {detailRecord && (
            <div className={styles.dataCard}>
              <h3 className={styles.cardTitle}>Market Details</h3>
              <p><b>{detailRecord.name}</b></p>
              <p>{detailRecord.district}{detailRecord.village ? ` — ${detailRecord.village}` : ''}</p>
              <p>Price: {detailRecord.price}</p>
              <p>Crop: {detailRecord.cropName}</p>
              <button className={styles.directionBtn} onClick={() => setDetail(null)}>Close</button>
            </div>
          )}
          
        </aside>
      </main>
    </div>
  );
};

export default Searchdash;