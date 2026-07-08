import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './profiledash.module.css';
import { useTheme } from '../ThemeContext';
import { fetchJson } from '../lib/api';

const ProfileDash = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  // State management for user details
  const [profile, setProfile] = useState({
    fullName: 'GGUBYA JOSHUA JUSTIN',
    role: 'Market Analyst / Agent',
    email: '',
    joinedDate: 'Joined Oct 2025',
    farmerLocation: localStorage.getItem('farmerLocation') || 'Kampala',
  });

  const [pinnedCrops, setPinnedCrops] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedLocation, setEditedLocation] = useState(profile.farmerLocation);
  const [loading, setLoading] = useState(true);

  // Fetch verified profile metadata and pinned entries on mount
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        // Step 1: Grab user preference and info wrappers
        const userData = await fetchJson('/auth/user-profile/'); // Adjust path to your profile endpoint
        if (userData) {
          setProfile(prev => ({
            ...prev,
            fullName: userData.full_name || prev.fullName,
            email: userData.email,
            role: userData.role || prev.role,
          }));
        }

        // Step 2: Grab full favorites array list to populate the catalog table
        const favorites = await fetchJson('/crops/my-favorites/'); // Fallback endpoint
        if (Array.isArray(favorites)) {
          setPinnedCrops(favorites);
        }
      } catch (err) {
        console.error("Error loading profile layout dashboard:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  const handleSaveLocation = () => {
    localStorage.setItem('farmerLocation', editedLocation.trim());
    setProfile(prev => ({ ...prev, farmerLocation: editedLocation.trim() }));
    setIsEditing(false);
  };

  const handleUnpinRow = async (cropId) => {
    try {
      await fetchJson('/user/pin-crop/', {
        method: 'POST',
        body: JSON.stringify({ crop_id: cropId }),
      });
      // Filter out immediately from local state view matrix
      setPinnedCrops(prev => prev.filter(item => item.id !== cropId));
    } catch (err) {
      console.error("Could not remove crop pin:", err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  return (
    <div className={styles.profileContainer}>
      {/* Universal Dashboard Header Layer */}
      <header className={styles.profileHeader}>
        <div className={styles.brand} onClick={() => navigate('/searchdash')}>Beyi</div>
        <div className={styles.navLinks}>
          <Link to="/searchdash" className={styles.backLink}>← Back to Market Dashboard</Link>
          <button onClick={toggleTheme} className={styles.themeToggle}>
            {isLightTheme ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </header>

      <main className={styles.profileGrid}>
        {/* Left Column Card: User Core Meta */}
        <section className={styles.profileCard}>
          <div className={styles.avatarCircle}>
            {profile.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <h2 className={styles.profileName}>{profile.fullName}</h2>
          <span className={styles.roleBadge}>{profile.role}</span>
          <p className={styles.mutedText}>{profile.email || "no-email@beyi.com"}</p>
          <p className={styles.joinDate}>{profile.joinedDate}</p>
          
          <hr className={styles.divider} />
          
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Log Out Account
          </button>
        </section>

        {/* Right Column Card: Operational Preferences */}
        <section className={styles.profileCard}>
          <h3 className={styles.cardTitle}>Operational Settings</h3>
          
          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>Primary Tracking Location</label>
            {isEditing ? (
              <div className={styles.inlineEditGroup}>
                <input 
                  type="text" 
                  value={editedLocation} 
                  onChange={(e) => setEditedLocation(e.target.value)} 
                  className={styles.profileInput}
                />
                <button onClick={handleSaveLocation} className={styles.saveBtn}>Save</button>
              </div>
            ) : (
              <div className={styles.inlineDisplayGroup}>
                <p className={styles.settingValue}>📍 {profile.farmerLocation}</p>
                <button onClick={() => setIsEditing(true)} className={styles.editBtn}>Edit</button>
              </div>
            )}
            <small className={styles.helperText}>Used to highlight nearby markets automatically inside your search feed.</small>
          </div>
        </section>

        {/* Bottom Full-Width Section: Pinned Watchlist */}
        <section className={`${styles.profileCard} ${styles.fullWidthCard}`}>
          <h3 className={styles.cardTitle}>Your Pinned Commodities Watchlist</h3>
          {pinnedCrops.length > 0 ? (
            <table className={styles.watchlistTable}>
              <thead>
                <tr>
                  <th>Commodity</th>
                  <th>Category</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pinnedCrops.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.boldText}>{item.crop?.name || item.name}</td>
                    <td className={styles.mutedText}>{item.crop?.category || 'General'}</td>
                    <td>
                      <button 
                        onClick={() => handleUnpinRow(item.id)} 
                        className={styles.unpinActionBtn}
                      >
                        Unpin ❌
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.mutedText}>You have not pinned any primary crop commodities to your active feed matrix yet.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default ProfileDash;