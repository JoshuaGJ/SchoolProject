import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './home.module.css';
import Header from '../header/Header.jsx';
import { fetchJson } from '../lib/api';

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

const Home = () => {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadSnapshot = async () => {
      try {
        const data = await fetchJson('/analytics/?timeframe=3M&price_type=both');
        if (active) {
          setSnapshot(data);
        }
      } catch (error) {
        if (active) {
          setSnapshot({ error: true });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadSnapshot();

    return () => {
      active = false;
    };
  }, []);

  const commodityName = snapshot?.chart?.crops?.[0] || snapshot?.kpis?.highest_price_surge?.crop || 'Market basket';
  const marketName = snapshot?.kpis?.most_affordable_hub?.market_name || 'Regional hub';
  const wholesaleValue = snapshot?.kpis?.most_affordable_hub?.average_wholesale ?? snapshot?.kpis?.highest_price_surge?.latest_price;
  const trendValue = snapshot?.kpis?.highest_price_surge?.percentage_change;
  const trendDirection = trendValue === undefined || trendValue === null ? null : (trendValue >= 0 ? 'up' : 'down');

  return (
    <div className={styles.landingContainer}>
      {/* Shared Modular Navigation Header */}
      <Header />

      {/* 🌟 HERO WRAPPER SECTION */}
      <section className={styles.heroSection}>
        {/* Left Column: Immediate Value Messaging */}
        <div className={styles.heroTextContent}>
          <div className={styles.sloganBadge}>
            💡 Stop Guessing Market Rates. Start Tracking Smarter.
          </div>
          <h1 className={styles.mainHeadline}>
            Real-Time Commodity Prices <br />
            <span className={styles.highlightText}>At Your Fingertips.</span>
          </h1>
          <p className={styles.subText}>
            Beyi is a transparent agricultural data analytics platform built to clear up market obscurity in Uganda. 
            We sync fluctuating prices across regional hubs to empower agricultural stakeholders with accurate baseline data.
          </p>
          <div className={styles.ctaButtonGroup}>
            <button onClick={() => navigate('/signup')} className={styles.primaryCta}>
              Get Started Free
            </button>
            <button onClick={() => navigate('/home')} className={styles.secondaryCta}>
              Explore Live Prices
            </button>
            <button onClick={() => navigate('/analytics')} className={styles.secondaryCta}>
              View Analytics
            </button>
          </div>
        </div>

        {/* Right Column: Pre-Auth Live Preview Module */}
        <div className={styles.heroWidgetCard}>
          <h3 className={styles.widgetTitle}>Quick Price Checker</h3>
          <div className={styles.widgetRow}>
            <label className={styles.widgetLabel}>Commodity Index</label>
            <input type="text" value={loading ? 'Loading initial analytics…' : commodityName} readOnly className={styles.widgetInput} />
          </div>
          <div className={styles.widgetRow}>
            <label className={styles.widgetLabel}>Tracked Market Location</label>
            <input type="text" value={loading ? 'Loading market data…' : marketName} readOnly className={styles.widgetInput} />
          </div>
          <div className={styles.priceDisplay}>
            <span className={styles.priceLabel}>Current Average Wholesale Value</span>
            <h2 className={styles.actualPrice}>{loading ? 'Loading…' : `${formatUSh(wholesaleValue)} `}<small>/ Bunch</small></h2>
          </div>
          <div className={styles.trendIndicator}>
            {loading ? (
              <span className={styles.upTrend}>Loading trend…</span>
            ) : (
              <>
                <span className={trendDirection === 'up' ? styles.upTrend : styles.downTrend}>
                  {trendDirection === 'up' ? '▲' : '▼'} {trendValue !== null && trendValue !== undefined ? `${Math.abs(trendValue)}%` : 'No data'}
                </span>{' '}
                index variation from last week
              </>
            )}
          </div>
        </div>
      </section>

      {/* 🌟 DETAILED SYSTEM INFORMATION SECTION */}
      <section className={styles.infoSection}>
        <div className={styles.infoSectionHeader}>
          <h2 className={styles.sectionTitle}>How the Platform Works</h2>
          <p className={styles.sectionSubtitle}>
            Our web platform connects field agents directly to decentralized market tables, distributing actionable insights instantly.
          </p>
        </div>

        <div className={styles.infoGrid}>
          {/* Feature 1: Real-Time Synchronization */}
          <div className={styles.infoCard}>
            <div className={styles.iconCircle}>⚡</div>
            <h3 className={styles.cardTitle}>Real-Time Synchronization</h3>
            <p className={styles.cardText}>
              Field agents log wholesale and retail figures straight from active stalls. These data metrics populate your search feed instantaneously, ensuring you never reference outdated rates.
            </p>
          </div>

          {/* Feature 2: Customizable Commodity Pinning */}
          <div className={styles.infoCard}>
            <div className={styles.iconCircle}>★</div>
            <h3 className={styles.cardTitle}>Personalized Watchlists</h3>
            <p className={styles.cardText}>
              Pin primary commodities like Matooke, Maize, or Beans directly to your active dashboard workspace. Filter out alternative background noise to monitor specific trend paths.
            </p>
          </div>

          {/* Feature 3: Historical Analytics Matrix */}
          <div className={styles.infoCard}>
            <div className={styles.iconCircle}>📈</div>
            <h3 className={styles.cardTitle}>Historical Trend Mapping</h3>
            <p className={styles.cardText}>
              Analyze price charts over weeks or months to pinpoint cyclical supply surges. Anticipate seasonal dips and structure negotiation windows with absolute confidence.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;