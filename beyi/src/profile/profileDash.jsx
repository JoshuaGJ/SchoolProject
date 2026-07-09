import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './profiledash.module.css';
import { useTheme } from '../ThemeContext';
import { fetchJson } from '../lib/api';
import { FavoriteList } from '../favorites/Favorites.jsx';

const ProfileDash = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  // State management for user details
  const [profile, setProfile] = useState({
    fullName: '',
    role: '',
    email: '',
    joinedDate: '',
    farmerLocation:'',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedLocation, setEditedLocation] = useState(profile.farmerLocation);

  const formatJoinedDate = (isoString) => {
    if (!isoString) return 'Member';
    const date = new Date(isoString);
    return `Joined ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  };

  // Fetch verified profile metadata and pinned entries on mount
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Step 1: Grab user preference and info wrappers
        const userData = await fetchJson('/auth/user-profile/'); // Adjust path to your profile endpoint
        if (userData) {
          setProfile(prev => ({
            ...prev,
            fullName: userData.full_name || 'N/A',
            email: userData.email,
            role: userData.role || 'Farmer',
            joinedDate: formatJoinedDate(userData.date_joined),
            farmerLocation: userData.Market || 'N/A',
          }));
          setEditedLocation(localStorage.getItem('farmerLocation') || 'Kampala');
        }

      } catch (err) {
        console.error("Error loading profile layout dashboard:", err.message);
      }
    };

    fetchProfileData();
  }, []);

  const handleSaveLocation = () => {
    localStorage.setItem('farmerLocation', editedLocation.trim());
    setProfile(prev => ({ ...prev, farmerLocation: editedLocation.trim() }));
    setIsEditing(false);
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
        <div className={styles.brand} onClick={() => navigate('/home')}>Beyi</div>
        <div className={styles.navLinks}>
          <Link to="/home" className={styles.backLink}>← Back to Market </Link>
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
          <FavoriteList title="Your Pinned Commodities Watchlist" />
        </section>
      </main>
    </div>
  );
};

export default ProfileDash;