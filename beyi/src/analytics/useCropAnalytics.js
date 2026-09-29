// src/hooks/useCropAnalytics.js
import { useState, useEffect } from 'react';
import { fetchJson } from '../lib/api';

export const useCropAnalytics = (activeTargets) => {
  const [availableCrops, setAvailableCrops] = useState([]);
  const [fetchingCropsList, setFetchingCropsList] = useState(true);
  const [recordsCache, setRecordsCache] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [error, setError] = useState('');

  // 1. Fetch crop directory list with AbortController memory-leak protection
  useEffect(() => {
    const controller = new AbortController();

    const fetchCropsList = async () => {
      try {
        setFetchingCropsList(true);
        setError('');
        let data;
        try {
          data = await fetchJson('/crops/', { signal: controller.signal });
        } catch (e) {
          if (controller.signal.aborted) return;
          data = await fetchJson('/prices/crops/', { signal: controller.signal });
        }

        if (controller.signal.aborted) return;

        let names = [];
        if (Array.isArray(data)) {
          names = data.map((item) => (typeof item === 'string' ? item : item?.name));
        } else if (data && Array.isArray(data.results)) {
          names = data.results.map((item) => (typeof item === 'string' ? item : item?.name));
        }

        const cleanNames = Array.from(new Set(names.filter(Boolean)));
        setAvailableCrops(cleanNames);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Failed to load crops list:', err);
          setError('Failed to fetch available crops list from backend.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setFetchingCropsList(false);
        }
      }
    };

    fetchCropsList();
    return () => controller.abort();
  }, []);

  // 2. Fetch prices on-demand with cancellation protection
  useEffect(() => {
    if (!activeTargets || !activeTargets.length) return;

    const uncached = activeTargets.filter((crop) => crop && !recordsCache[crop]);
    if (!uncached.length) return;

    const controller = new AbortController();

    const fetchCropPrices = async () => {
      setLoadingPrices(true);
      setError('');

      try {
        const newEntries = {};
        await Promise.all(
          uncached.map(async (crop) => {
            const data = await fetchJson(
              `/prices/search/?search=${encodeURIComponent(crop)}`,
              { signal: controller.signal }
            );

            let records = [];
            if (Array.isArray(data)) records = data;
            else if (data && Array.isArray(data.results)) records = data.results;

            newEntries[crop] = records.map((record) => ({
              id: record.id,
              marketName: record.market?.name ?? 'Unknown market',
              region: record.market?.region_location ?? '',
              village: record.market?.village ?? '',
              cropName: record.crop?.name ?? crop,
              category: record.crop?.category ?? '',
              wholesalePrice: Number(record.wholesale_price) || 0,
              retailPrice: Number(record.retail_price) || 0,
              timestamp: record.timestamp,
            }));
          })
        );

        if (!controller.signal.aborted) {
          setRecordsCache((prev) => ({ ...prev, ...newEntries }));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Error fetching crop price records:', err);
          setError('Failed to fetch market data for selected crop(s).');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingPrices(false);
        }
      }
    };

    fetchCropPrices();
    return () => controller.abort();
  }, [activeTargets, recordsCache]);

  return {
    availableCrops,
    fetchingCropsList,
    recordsCache,
    loadingPrices,
    error,
    setError,
  };
};