import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './header.module.css';
import { useTheme } from '../ThemeContext';
import { fetchJson } from '../lib/api';

const Header = () => {
  const { isLightTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const token = localStorage.getItem('accessToken');
      const cachedName = localStorage.getItem('userName') || localStorage.getItem('fullName') || '';
      
      if (!token) {
        if (cachedName) {
          setUser({
            name: cachedName,
            initials: cachedName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
          });
        } else {
          setUser(null);
        }
        setLoading(false);
        return;
      }

      try {
        const data = await fetchJson('/auth/user-profile/');
        
        const resolvedName = data?.full_name || data?.fullName || data?.name || data?.username || cachedName;

        if (resolvedName) {
          setUser({
            name: resolvedName,
            initials: resolvedName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
          });
          localStorage.setItem('userName', resolvedName);
        } else {
          setUser({ name: 'User', initials: 'U' });
        }
      } catch (err) {
        console.error("Failed to fetch verified user profile info:", err.message);
        if (cachedName) {
          setUser({
            name: cachedName,
            initials: cachedName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
          });
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  return (
    <header className={styles.globalHeader}>
      {/* Left End: Brand Logo */}
      <div className={styles.brand} onClick={() => navigate('/searchdash')}>
        Beyi
      </div>
      
      {/* Right End: Theme Toggle & User Account Wrapper */}
      <div className={styles.headerActions}>
        <button 
          onClick={toggleTheme} 
          className={styles.themeToggle}
          aria-label="Toggle visual interface theme"
        >
          {isLightTheme ? '🌙' : '☀️'}
        </button>

        {loading ? (
          <div className={styles.avatarLoading}>⏳</div>
        ) : user ? (
          <div className={styles.profileMenu} onClick={() => navigate('/profile')}>
            <span className={styles.headerUserName}>{user.name}</span>
            <div className={styles.avatarPlaceholder} title="View Profile">
              {user.initials}
            </div>
          </div>
        ) : (
          <Link to="/login" className={styles.authLinks}>Login / Signup</Link>
        )}
      </div>
    </header>
  );
};

export default Header;