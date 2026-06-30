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
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [searchFeedback, setSearchFeedback] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [detail, setDetail] = useState(null);
  const popoverRef = useRef(null);
  const [priceRecords, setPriceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const farmerLocation = (localStorage.getItem('farmerLocation') || '').trim().toLowerCase();

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

  // --- Load data with optional search parameter ---
  const loadPriceRecords = async (searchQuery = '') => {
    try {
      setLoading(true);
      setError('');
      
      // Build the URL with search param if provided
      const url = searchQuery 
        ? `/prices/search/?search=${encodeURIComponent(searchQuery)}` 
        : '/prices/search/';
      
      console.log('🔄 Fetching from:', url); // Debug
      const data = await fetchJson(url);
      console.log('📦 Data received:', data); // Debug
      
     let recordsArray = [];
      if (Array.isArray(data)) {
        recordsArray = data;
      } else if (data && Array.isArray(data.results)) {
        recordsArray = data.results;
      }
      
      setPriceRecords(recordsArray);
      
      // Update feedback based on results count
      const resultCount = recordsArray.length;
      if (searchQuery && resultCount === 0) {
        setSearchFeedback(`😕 No crops found for "${searchQuery}".`);
      } else if (searchQuery) {
        setSearchFeedback(`✅ Found ${resultCount} crop${resultCount !== 1 ? 's' : ''} matching "${searchQuery}".`);
      } else {
        setSearchFeedback('Showing all available crops.');
      }
      
    } catch (requestError) {
      console.error('❌ Error loading data:', requestError);
      setError(requestError.message || 'Unable to load market data.');
      setPriceRecords([]);
      setSearchFeedback('❌ Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  // --- Initial load on mount ---
  useEffect(() => {
    let isMounted = true;

    const loadInitial = async () => {
      if (!isMounted) return;
      await loadPriceRecords('');
    };

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, []);

  // --- Handle search submission ---
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    
    const nextSearchTerm = searchTerm.trim();
    setActiveSearchTerm(nextSearchTerm);
    setIsSearching(true);
    
    if (nextSearchTerm) {
      setSearchFeedback(`🔍 Searching for "${nextSearchTerm}"...`);
    } else {
      setSearchFeedback('Loading all crops...');
    }
    
    loadPriceRecords(nextSearchTerm).finally(() => {
      setIsSearching(false);
    });
  };

  const handleMarketClick = (index, e) => {
    e.stopPropagation();
    setSelectedMarket(selectedMarket === index ? null : index);
  };

  // --- Normalize records ---
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

 // --- Get unique crop-market pairs with the absolute latest record ---
  const currentMarketRecords = Array.from(
    normalizedRecords.reduce((marketMap, record) => {
      // 🔧 FIX: Create a composite key combining market AND crop name
      const compositeKey = `${record.marketName}-${record.cropName}`;
      
      const existing = marketMap.get(compositeKey);
      if (!existing || new Date(record.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
        marketMap.set(compositeKey, record);
      }
      return marketMap;
    }, new Map()).values()
  );

  // --- Apply search filter to the fully retained data matrix ---
  const lower = activeSearchTerm.toLowerCase();
  
  const filteredMarketData = currentMarketRecords.filter((record) =>
    [record.cropName, record.category, record.marketName, record.region, record.village]
      .join(' ')
      .toLowerCase()
      .includes(lower)
  );
  
  const limitedMarketData = filteredMarketData.slice(0, 7);

  // --- Related Crops (filtered by search) ---
  const relatedCrops = Array.from(
    filteredMarketData.reduce((cropMap, record) => {
      if (!cropMap.has(record.cropName)) {
        cropMap.set(record.cropName, {
          name: record.cropName,
          price: formatPrice(record.retailPrice ?? record.wholesalePrice),
        });
      }
      return cropMap;
    }, new Map()).values()
  ).slice(0, 3);

  // --- Nearby Markets (filtered by search) ---
  const nearbyMarkets = filteredMarketData
    .map((record) => ({
      id: record.id,
      name: record.marketName,
      district: record.region,
      village: record.village,
      price: formatPrice(record.retailPrice ?? record.wholesalePrice),
      cropName: record.cropName,
      isNearby: farmerLocation ? 
        [record.marketName, record.region, record.village].join(' ').toLowerCase().includes(farmerLocation) : 
        false,
    }))
    .sort((left, right) => {
      if (!farmerLocation) return 0;
      if (left.isNearby && !right.isNearby) return -1;
      if (!left.isNearby && right.isNearby) return 1;
      return left.name.localeCompare(right.name);
    });
  const limitedNearbyMarkets = nearbyMarkets.slice(0, 4);

  const detailRecord = detail || null;
  const primaryCommodity = filteredMarketData[0];

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.dashboardHeader}>
        <div className={styles.brand}>Beyi</div>
        <div className={styles.searchContainer}>
          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <input
              type="text"
              className={styles.searchBar}
              placeholder="Search crops and press Enter"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search for crops"
            />
            <button type="submit" className={styles.clearBtn} disabled={isSearching}>
              {isSearching ? '⏳' : 'Enter'}
            </button>
          </form>
          {searchFeedback && (
            <p className={`${styles.searchFeedback} ${isSearching ? styles.searching : ''}`} aria-live="polite">
              {searchFeedback}
            </p>
          )}
        </div>
        <div>
          <button onClick={toggleTheme} className={styles.themeToggle}>
            {isLightTheme ? '🌙' : '☀️'} {isLightTheme ? 'Dark' : 'Light'}
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
              {primaryCommodity?.cropName || 
               (activeSearchTerm ? `No crops found for "${activeSearchTerm}"` : 'No crop data')}
            </h2>
            <div className={styles.priceDisplay}>
              <span className={styles.priceValue}>
                {primaryCommodity ? 
                  formatPrice(primaryCommodity.retailPrice ?? primaryCommodity.wholesalePrice) : 
                  '—'}
              </span>
            </div>
            <div className={styles.sparklineContainer}>
              <span className={styles.unit}>
                {primaryCommodity?.marketName ? 
                  `Market: ${primaryCommodity.marketName}` : 
                  'Unit kg'}
              </span>
            </div>
          </div>

          <div className={styles.dataCard}>
            <h3 className={styles.cardTitle}>
              Related Crops
              {activeSearchTerm && (
                <span className={styles.resultCount}>
                  ({relatedCrops.length})
                </span>
              )}
            </h3>
            {relatedCrops.length > 0 ? (
              <ul className={styles.cropList}>
                {relatedCrops.map((crop) => (
                  <li key={crop.name} className={styles.cropItem}>
                    <span>{crop.name}</span>
                    <span className={styles.cropPrice}>{crop.price}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>No related crops found.</p>
            )}
          </div>
        </section>

        {/* Center Column */}
        <section className={styles.columnCenter}>
          <div className={styles.dataCard}>
            <h3 className={styles.cardTitle}>
              Market Comparison
              {activeSearchTerm && (
                <span className={styles.resultCount}>
                  ({filteredMarketData.length} market{filteredMarketData.length !== 1 ? 's' : ''})
                </span>
              )}
            </h3>
            {!loading && !error && filteredMarketData.length === 0 && activeSearchTerm && (
              <div className={styles.noResults}>
                <p>No markets found for "{activeSearchTerm}"</p>
                <p className={styles.muted}>Try searching for a different crop name.</p>
              </div>
            )}
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
                {!loading && !error && limitedMarketData.length === 0 && !activeSearchTerm && (
                  <tr>
                    <td colSpan="3" className={styles.muted}>No market data available.</td>
                  </tr>
                )}
                {!loading && !error && limitedMarketData.map((market, index) => (
                  <tr
                    key={`${market.id}-${index}`}
                    className={styles.clickableRow}
                    onClick={(e) => handleMarketClick(index, e)}
                  >
                    <td className={styles.marketCell}>
                      {market.marketName}
                      {farmerLocation && 
                        [market.marketName, market.region, market.village].join(' ').toLowerCase().includes(farmerLocation) && (
                          <span className={styles.nearbyBadge}>📍 Nearby</span>
                        )
                      }
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
            <h3 className={styles.cardTitle}>
              Nearby Markets
              {activeSearchTerm && (
                <span className={styles.resultCount}>
                  ({nearbyMarkets.length})
                </span>
              )}
            </h3>
            <ul className={styles.listItems}>
              {!loading && !error && limitedNearbyMarkets.map((market) => (
                <li key={`${market.name}-${market.district}`} className={styles.marketListItem}>
                  <a onClick={() => setDetail(market)} className={styles.marketLink}>
                    <h4>
                      {market.name}
                      {market.isNearby && (
                        <span className={styles.nearbyBadge}>📍 Nearby</span>
                      )}
                    </h4>
                    <p>
                      {market.district} 
                      {market.village ? ` • ${market.village}` : ''}
                    </p>
                    <p><b>{market.price}</b></p>
                  </a>
                </li>
              ))}
              {!loading && !error && limitedNearbyMarkets.length === 0 && (
                <li className={styles.noResults}>
                  {activeSearchTerm ? 
                    `No nearby markets found for "${activeSearchTerm}".` : 
                    'No nearby markets available.'}
                </li>
              )}
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