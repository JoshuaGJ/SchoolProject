import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './header.module.css';
import { useTheme } from '../ThemeContext'; // 🌟 Importing your custom context hook
import { fetchJson } from '../lib/api';

const Header = () => {
  const { isLightTheme, toggleTheme } = useTheme(); // 🌟 Extracting global variables
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const data = await fetchJson('/auth/user-profile/'); 
        if (data && data.full_name) {
          setUser({
            name: data.full_name,
            initials: data.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
          });
        }
      } catch (err) {
        console.error("Header Profile Sync Error:", err.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  return (
    <header className={`${styles.globalHeader} ${isLightTheme ? styles.lightMode : styles.darkMode}`}>
      {/* Left End: Brand Logo */}
      <div className={styles.brand} onClick={() => navigate('/landing')}>
        Beyi
      </div>
      
      {/* Right End: Theme Toggle & User Account Wrapper */}
      <div className={styles.headerActions}>
        <button 
          onClick={toggleTheme} 
          className={styles.themeToggle}
          aria-label="Toggle visual interface theme"
        >
          {/* 🌟 Dynamic Icon matching active state */}
          {isLightTheme ? '🌙' : '☀️'}
        </button>

        {loading ? (
          <div className={styles.avatarLoading}>⏳</div>
        ) : user ? (
          <>
            <Link to="/analytics" className={styles.authLinks}>Analytics</Link>
            <div className={styles.profileMenu} onClick={() => navigate('/profile')}>
              <span className={styles.headerUserName}>{user.name}</span>
              <div className={styles.avatarPlaceholder} title="View Profile">
                {user.initials}
              </div>
            </div>
          </>
        ) : (
          <>
            <Link to="/analytics" className={styles.authLinks}>Analytics</Link>
            <Link to="/auth" className={styles.authLinks}>Login / Signup</Link>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;