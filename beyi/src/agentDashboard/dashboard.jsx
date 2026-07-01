import React, { useEffect, useState } from 'react';
import styles from './dashboard.module.css';
import { fetchJson } from '../lib/api';

const formatPrice = (value) => {
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
        return value ?? '—';
    }
    return `USh ${numberValue.toLocaleString()}`;
};

const normalizePrice = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : NaN;
};

const calculateAverage = (records) => {
    const prices = records
        .map((record) => normalizePrice(record.retail_price ?? record.wholesale_price))
        .filter((price) => Number.isFinite(price) && price > 0);

    if (!prices.length) {
        return null;
    }

    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
};

const formatPlainPrice = (value) => {
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
        return '0';
    }

    return numberValue.toLocaleString();
};

function Dashboard() {
    const [marketName, setMarketName] = useState(() => localStorage.getItem('agentAssignedRegion') || localStorage.getItem('agentMarketName') || '');
    const [locationMessage, setLocationMessage] = useState('');
    const [capturedLocation, setCapturedLocation] = useState('');

    const [cropOptions, setCropOptions] = useState([]);
    const [priceRecords, setPriceRecords] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [loadingCrops, setLoadingCrops] = useState(false);
    const [error, setError] = useState('');

    const [newCropName, setNewCropName] = useState('');
    const [newCropPrice, setNewCropPrice] = useState('');
    const [newCropUnit, setNewCropUnit] = useState('kg');
    const [priceSearch, setPriceSearch] = useState('');

    const [historyAverage, setHistoryAverage] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [formMessage, setFormMessage] = useState('');

    const [editingRowId, setEditingRowId] = useState(null);
    const [editingPrice, setEditingPrice] = useState('');
    const [inlineMessage, setInlineMessage] = useState('');

    const [pendingAction, setPendingAction] = useState(null);
    const [warningBox, setWarningBox] = useState(null);
    const [saving, setSaving] = useState(false);

    const marketContext = marketName.trim();

    useEffect(() => {
        localStorage.setItem('agentMarketName', marketContext);
    }, [marketContext]);

    useEffect(() => {
        let isMounted = true;

        const loadCropOptions = async () => {
            try {
                setLoadingCrops(true);
                const data = await fetchJson('/crops/');
                if (isMounted) {
                    setCropOptions(Array.isArray(data) ? data : []);
                }
            } catch (requestError) {
                if (isMounted) {
                    setError(requestError.message || 'Unable to load crops.');
                    setCropOptions([]);
                }
            } finally {
                if (isMounted) {
                    setLoadingCrops(false);
                }
            }
        };

        loadCropOptions();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadCurrentPrices = async () => {
            if (!marketContext) {
                if (isMounted) {
                    setPriceRecords([]);
                    setLoadingRecords(false);
                }

                return;
            }

            try {
                setLoadingRecords(true);
                setError('');

                const data = await fetchJson(`/prices/search/?market__name=${encodeURIComponent(marketContext)}`);

                if (isMounted) {
                    const records = Array.isArray(data) ? data : (data?.results || []);
                    setPriceRecords(records);
                }
            } catch (requestError) {
                if (isMounted) {
                    setError(requestError.message || 'Unable to load market prices.');
                    setPriceRecords([]);
                }
            } finally {
                if (isMounted) {
                    setLoadingRecords(false);
                }
            }
        };

        loadCurrentPrices();

        return () => {
            isMounted = false;
        };
    }, [marketContext]);


    useEffect(() => {
        let isMounted = true;

        const loadHistoryAverage = async () => {
            if (!newCropName.trim()) {
                setHistoryAverage(null);
                return;
            }

            const exactMatch = cropOptions.some((crop) => crop.name.toLowerCase() === newCropName.trim().toLowerCase());
            if (!exactMatch) {
                setHistoryAverage(null);
                return;
            }

            try {
                setHistoryLoading(true);
                const data = await fetchJson(`/prices/analytics/?crop=${encodeURIComponent(newCropName.trim())}`);
                if (!isMounted) {
                    return;
                }

                setHistoryAverage(calculateAverage(Array.isArray(data) ? data : []));
            } catch {
                if (isMounted) {
                    setHistoryAverage(null);
                }
            } finally {
                if (isMounted) {
                    setHistoryLoading(false);
                }
            }
        };

        loadHistoryAverage();

        return () => {
            isMounted = false;
        };
    }, [newCropName, cropOptions]);

    const currentPrices = priceRecords.map((record) => ({
        id: record.id,
        cropName: record.crop?.name || 'Unknown crop',
        cropCategory: record.crop?.category || 'Uncategorized',
        priceValue: Number(record.retail_price ?? record.wholesale_price ?? 0),
        marketName: record.market?.name || marketContext,
        marketRegion: record.market?.region_location || '',
        marketVillage: record.market?.village || '',
        timestamp: record.timestamp,
    }));

    const filteredCurrentPrices = currentPrices.filter((record) => {
        if (!priceSearch.trim()) {
            return true;
        }

        return record.cropName.toLowerCase().includes(priceSearch.trim().toLowerCase());
    });

    const visibleCurrentPrices = filteredCurrentPrices.slice(0, 5);

    const validatePriceAgainstHistory = (cropName, priceValue, cropAverage) => {
        if (!Number.isFinite(priceValue) || priceValue <= 0 || !Number.isFinite(cropAverage) || cropAverage <= 0) {
            return null;
        }

        const deviationRatio = Math.abs(priceValue - cropAverage) / cropAverage;
        const obviousTypo = priceValue > cropAverage * 10 || priceValue < cropAverage * 0.1;

        if (deviationRatio > 0.3 || obviousTypo) {
            return `You entered USh ${formatPlainPrice(priceValue)}/kg. Historical average for ${cropName} is USh ${formatPlainPrice(cropAverage)}/kg. Are you sure this isn't a typo?`;
        }

        return null;
    };

    

    const executeAction = async (action) => {
        setSaving(true);
        setError('');
        setInlineMessage('');
        setFormMessage('');

        try {
            const response = await fetchJson('/agent/market-action/', {
                method: 'POST',
                body: JSON.stringify(action),
            });

            if (response?.message) {
                setFormMessage(response.message);
                setInlineMessage(response.message);
            }

            if (action.action === 'log_price') {
            // Find out if this crop record already exists in our table layout
            setPriceRecords(prevRecords => {
                const matchIndex = prevRecords.findIndex(
                    record => record.crop?.name?.toLowerCase() === action.crop_name.toLowerCase()
                );

                if (matchIndex !== -1) {
                    // Update existing record inline dynamically
                    const updated = [...prevRecords];
                    updated[matchIndex] = {
                        ...updated[matchIndex],
                        retail_price: action.price, // update whichever price column your backend targets
                        wholesale_price: action.price,
                        timestamp: new Date().toISOString()
                    };
                    return updated;
                } else {
                    // If it's a completely new crop entry, create a mock UI row wrapper until full page refresh
                    const newMockRecord = {
                        id: response?.id || Date.now(), // fallback temporary key
                        crop: { name: action.crop_name, category: 'Updated' },
                        market: { name: marketContext },
                        retail_price: action.price,
                        timestamp: new Date().toISOString()
                    };
                    return [newMockRecord, ...prevRecords];
                }
            });
        }

            setWarningBox(null);
            setPendingAction(null);
            setEditingRowId(null);
            setEditingPrice('');

           
        } catch (requestError) {
            setError(requestError.message || 'Unable to save price.');
        } finally {
            setSaving(false);
        }
    };

    const requestConfirmation = (action, cropName, priceValue, cropAverage, confirmationType) => {
        const priceWarning = validatePriceAgainstHistory(cropName, priceValue, cropAverage);

        // Format the price cleanly for the message (e.g., USh 3,500)
        const formattedPrice = `USh ${Number(priceValue).toLocaleString()}`;

        setPendingAction(action);
        setWarningBox({
            title: confirmationType === 'edit' ? 'Confirm price change' : 'Confirm crop price entry',
            // 🌟 FIXED: Embeds the actual crop name and typed price if there's no layout warning
            message: priceWarning || `Please confirm entering ${formattedPrice}/kg for ${cropName} before saving it.`,
        });

        return true;
    };

    const handleMarketLoad = async () => {
        setMarketName((currentValue) => currentValue.trim());
        setLocationMessage(`Loading prices for ${marketContext || 'your market'}...`);

        try {
            const refreshed = await fetchJson(`/prices/search/?market__name=${encodeURIComponent(marketContext)}`);
            setPriceRecords(Array.isArray(refreshed) ? refreshed : []);
            setLocationMessage(`Loaded prices for ${marketContext}.`);
        } catch (requestError) {
            setLocationMessage(requestError.message || 'Unable to load market prices.');
        }
    };

    const captureLocation = () => {
        if (!navigator.geolocation) {
            setLocationMessage('Geolocation is not supported by this browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setCapturedLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                setLocationMessage('Location captured securely.');
            },
            () => {
                setLocationMessage('Unable to capture your location. Please allow location access.');
            }
        );
    };

    const handleAddCropSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setFormMessage('');

        const selectedCrop = cropOptions.find((crop) => crop.name.toLowerCase() === newCropName.trim().toLowerCase());
        if (!selectedCrop) {
            setError('Please choose a crop from the dropdown list.');
            return;
        }

        const parsedPrice = normalizePrice(newCropPrice);
        if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
            setError('Enter a valid crop price.');
            return;
        }

        const action = {
            action: 'log_price',
            market_name: marketContext,
            crop_name: selectedCrop.name,
            price: parsedPrice,
            unit: newCropUnit,
        };

        requestConfirmation(action, selectedCrop.name, parsedPrice, historyAverage, 'add');
    };

    const handleConfirmWarning = async () => {
        if (!pendingAction) {
            return;
        }

        await executeAction(pendingAction);
        setNewCropPrice('');
        setWarningBox(null);
        setPendingAction(null);
    };

    const handleCancelWarning = () => {
        setWarningBox(null);
        setPendingAction(null);
    };

    const startInlineEdit = (record) => {
        setInlineMessage('');
        setEditingRowId(record.id);
        setEditingPrice(String(record.priceValue || ''));
    };

    const cancelInlineEdit = () => {
        setEditingRowId(null);
        setEditingPrice('');
    };

    const handleInlineSave = async (record) => {
        const parsedPrice = normalizePrice(editingPrice);
        if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
            setInlineMessage('Enter a valid numeric price.');
            return;
        }

    const originalRecord = priceRecords.find(r => r.id === record.id);
    const correctUnit = originalRecord?.unit || 'kg';

        const action = {
            action: 'log_price',
            market_name: marketContext,
            crop_name: record.cropName,
            price: parsedPrice,
            unit: correctUnit|| 'kg',
        };

        const currentAverage = await (async () => {
            try {
                const data = await fetchJson(`/prices/analytics/?crop=${encodeURIComponent(record.cropName)}`);
                return calculateAverage(Array.isArray(data) ? data : []);
            } catch {
                return null;
            }
        })();

        requestConfirmation(action, record.cropName, parsedPrice, currentAverage, 'edit');
    };

    return (
        <div className={styles.dash}>
            <header className={styles.head}>
                <div className={styles.headerTopRow}>
                    <div>
                        <h1>Welcome Market Agent</h1>

                        <p className={styles.subtitle}>Mobile-first price capture and editing for {marketContext || 'your market'}.</p>
                        
                       
                        {!marketContext && (
                            <div className={styles.setupCard}>
                                <input 
                                    type="text" 
                                    placeholder="Enter your assigned Market Name (e.g., Nakasero)" 
                                    value={marketName}
                                    onChange={(e) => setMarketName(e.target.value)} 
                                    className={styles.setupInput}
                                />
                            </div>
                        )}
                        
                    </div>
                    <div className={styles.marketPill}>
                        Profile market: <strong>{marketContext || 'Not set'}</strong>
                    </div>
                </div>
            </header>

            

            <main className={styles.pdash}>
                <section className={styles.addcrop}>
                    <h3>Add New Crop Price</h3>
                    <form onSubmit={handleAddCropSubmit} className={styles.formBlock}>
                        <label htmlFor="crop-name">Crop Name</label>
                        <input
                            id="crop-name"
                            name="name"
                            type="text"
                            list="crop-options"
                            placeholder={loadingCrops ? 'Loading crop list...' : 'Start typing to search crops'}
                            value={newCropName}
                            onChange={(event) => setNewCropName(event.target.value)}
                            autoComplete="off"
                            required
                        />
                        <datalist id="crop-options">
                            {cropOptions.map((crop) => (
                                <option key={crop.id} value={crop.name} />
                            ))}
                        </datalist>

                        <label htmlFor="cprice">Crop Price</label>
                        <input
                            id="cprice"
                            type="number"
                            name="cprice"
                            step="1"
                            min="0"
                            placeholder="0"
                            value={newCropPrice}
                            onChange={(event) => setNewCropPrice(event.target.value)}
                            required
                        />

                        <label htmlFor="unit">Unit</label>
                        <input
                            id="unit"
                            type="text"
                            placeholder="e.g kg"
                            name="unit"
                            value={newCropUnit}
                            onChange={(event) => setNewCropUnit(event.target.value)}
                        />

                        <button type="submit" disabled={saving || historyLoading}>
                            {saving ? 'Saving...' : 'Add'}
                        </button>

                        {historyLoading && (
                            <p className={styles.helperText}>Checking historical crop prices...</p>
                        )}

                        {formMessage && <p className={styles.successText}>{formMessage}</p>}
                        {error && <p className={styles.errorText}>{error}</p>}
                    </form>
                </section>

                <section className={styles.plist}>
                    <h3>Current Prices</h3>
                    <input
                        type="text"
                        className={styles.priceSearchInput}
                        placeholder="Search crop in current prices"
                        value={priceSearch}
                        onChange={(event) => setPriceSearch(event.target.value)}
                    />
                    <div className={styles.tableHeaderRow}>
                        <span>Crop</span>
                        <span>Price</span>
                        <span>Action</span>
                    </div>

                    <div className={styles.priceList}>
                        {loadingRecords && <p className={styles.helperText}>Loading current prices...</p>}
                        {!loadingRecords && error && <p className={styles.errorText}>{error}</p>}
                        {!loadingRecords && !error && priceSearch.trim() && filteredCurrentPrices.length === 0 && (
                            <p className={styles.helperText}>No current prices match your search.</p>
                        )}

                        {!loadingRecords && !error && currentPrices.length === 0 && (
                            <p className={styles.helperText}>No current prices loaded for this market.</p>
                        )}

                        {!loadingRecords && visibleCurrentPrices.map((record) => {
                            const isEditing = editingRowId === record.id;

                            return (
                                <div key={record.id} className={`${styles.priceRow} ${isEditing ? styles.priceRowActive : ''}`}>
                                    {!isEditing ? (
                                        <button
                                            type="button"
                                            className={styles.priceRowButton}
                                            onClick={() => startInlineEdit(record)}
                                        >
                                            <span>
                                                <strong>{record.cropName}</strong>
                                                <small className={styles.rowMeta}>
                                                    {record.marketName}
                                                    {record.marketVillage ? ` • ${record.marketVillage}` : ''}
                                                </small>
                                            </span>
                                            <span className={styles.rowPrice}>{formatPrice(record.priceValue)}</span>
                                            <span className={styles.rowActionHint}>Edit</span>
                                        </button>
                                    ) : (
                                        <div className={styles.priceRowEdit}>
                                            <div>
                                                <strong>{record.cropName}</strong>
                                                <small className={styles.rowMeta}>Tap save to log a new current price.</small>
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={editingPrice}
                                                onChange={(event) => setEditingPrice(event.target.value)}
                                                className={styles.inlinePriceInput}
                                            />
                                            <div className={styles.inlineActions}>
                                                <button type="button" className={styles.inlineSaveBtn} onClick={() => handleInlineSave(record)} disabled={saving}>
                                                    ✓
                                                </button>
                                                <button type="button" className={styles.inlineCancelBtn} onClick={cancelInlineEdit}>
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {!loadingRecords && filteredCurrentPrices.length > 5 && (
                            <p className={styles.helperText}>Showing the first 5 matching crops. Narrow your search to see more.</p>
                        )}
                    </div>

                    {inlineMessage && <p className={styles.successText}>{inlineMessage}</p>}
                </section>
            </main>

            <section className={styles.locationCard}>
                <div>
                    <h3>Market Location</h3>
                    <p className={styles.helperText}>This dashboard uses your assigned region from the agent profile.</p>
                </div>
                <div className={styles.locationSummary}>
                    <p><strong>Assigned region:</strong> {marketContext || 'Not set'}</p>
                    <div className={styles.locationActions}>
                        <button type="button" className={styles.locbtn} onClick={captureLocation}>
                            📍 Use My Current Location
                        </button>
                        <button type="button" className={styles.applyMarketBtn} onClick={handleMarketLoad}>
                            Refresh Market Prices
                        </button>
                    </div>
                </div>
                {capturedLocation && <p className={styles.helperText}>Captured location: {capturedLocation}</p>}
                {locationMessage && <p className={styles.helperText}>{locationMessage}</p>}
            </section>

            {warningBox && (
                <div className={styles.warningOverlay} role="presentation">
                    <section className={styles.warningBox} role="alertdialog" aria-modal="true" aria-labelledby="price-confirm-title">
                        <h3 id="price-confirm-title">{warningBox.title || 'Confirm action'}</h3>
                        <p>{warningBox.message}</p>
                        <div className={styles.warningActions}>
                            <button type="button" className={styles.inlineSaveBtn} onClick={handleConfirmWarning} disabled={saving}>
                                Continue
                            </button>
                            <button type="button" className={styles.inlineCancelBtn} onClick={handleCancelWarning}>
                                Cancel
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
