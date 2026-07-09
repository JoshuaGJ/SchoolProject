import React, { useEffect, useState } from 'react';
import styles from './favorites.module.css';
import { fetchJson } from '../lib/api';

const FAVORITES_CHANGED_EVENT = 'beyi:favorites-changed';

const toFavoriteIds = (data) => {
  const favorites = Array.isArray(data?.pinned_crops) ? data.pinned_crops : [];
  return favorites.map((crop) => String(crop.id));
};

const toFavoriteItems = (data) => {
  return Array.isArray(data?.pinned_crops) ? data.pinned_crops : [];
};

const getCropId = (crop) => crop?.cropId ?? crop?.crop_id ?? crop?.id ?? null;

export const FavoriteToggle = ({ cropId, cropName, className = '' }) => {
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadFavorites = async (isActive = true) => {
    try {
      const data = await fetchJson('/user/favorites/');
      if (isActive) {
        setFavoriteIds(toFavoriteIds(data));
      }
    } catch {
      if (isActive) {
        setFavoriteIds([]);
      }
    } finally {
      if (isActive) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    loadFavorites(isMounted);

    const handleRefresh = () => loadFavorites(isMounted);
    window.addEventListener(FAVORITES_CHANGED_EVENT, handleRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleRefresh);
    };
  }, []);

  if (!cropId) {
    return null;
  }

  const isFavorite = favoriteIds.includes(String(cropId));

  const handleToggle = async () => {
    if (saving) {
      return;
    }

    setSaving(true);

    try {
      await fetchJson('/user/pin-crop/', {
        method: 'POST',
        body: JSON.stringify({ crop_id: cropId }),
      });
      await loadFavorites(true);
      window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
    } catch (requestError) {
      console.error('Failed to update favorites:', requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`${styles.favoriteToggle} ${isFavorite ? styles.favoriteToggleActive : ''} ${className}`}
      aria-label={isFavorite ? `Remove ${cropName || 'crop'} from favorites` : `Add ${cropName || 'crop'} to favorites`}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      disabled={loading || saving}
    >
      {isFavorite ? '❤'  : '🖤'}
    </button>
  );
};

export const FavoriteList = ({ title = 'Your Favorites', className = '', emptyMessage = 'No favorite crops yet.' }) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const loadFavorites = async (isActive = true) => {
    try {
      const data = await fetchJson('/user/favorites/');
      if (isActive) {
        setFavorites(toFavoriteItems(data));
      }
    } catch {
      if (isActive) {
        setFavorites([]);
      }
    } finally {
      if (isActive) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    loadFavorites(isMounted);

    const handleRefresh = () => loadFavorites(isMounted);
    window.addEventListener(FAVORITES_CHANGED_EVENT, handleRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleRefresh);
    };
  }, []);

  const handleUnpin = async (cropId) => {
    if (!cropId || savingId) {
      return;
    }

    setSavingId(String(cropId));

    try {
      await fetchJson('/user/pin-crop/', {
        method: 'POST',
        body: JSON.stringify({ crop_id: cropId }),
      });
      await loadFavorites(true);
      window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
    } catch (requestError) {
      console.error('Could not remove crop pin:', requestError.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className={`${styles.favoriteListCard} ${className}`}>
      {title && <h3 className={styles.favoriteTitle}>{title}</h3>}
      {loading ? (
        <p className={styles.favoriteMuted}>Loading favorites...</p>
      ) : favorites.length > 0 ? (
        <table className={styles.favoriteTable}>
          <thead>
            <tr>
              <th>Commodity</th>
              <th>Category</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {favorites.map((item) => (
              <tr key={item.id}>
                <td className={styles.favoriteBold}>{item.name}</td>
                <td className={styles.favoriteMuted}>{item.category || 'General'}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleUnpin(getCropId(item))}
                    className={styles.favoriteUnpinBtn}
                    disabled={savingId === String(getCropId(item))}
                  >
                    {savingId === String(getCropId(item)) ? 'Working...' : 'Unpin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.favoriteMuted}>{emptyMessage}</p>
      )}
    </div>
  );
};
