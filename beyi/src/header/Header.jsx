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
      
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // 🔄 Request user profile details from the backend securely
        // Match this path to wherever your authenticated user endpoint lives
        const data = await fetchJson('/auth/user-profile/'); 
        
        if (data && data.full_name) {
          setUser({
            name: data.full_name,
            initials: data.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
          });
        } else {
          // Fallback if full_name wasn't returned cleanly
          setUser({ name: 'User', initials: 'U' });
        }
      } catch (err) {
        console.error("Failed to fetch verified user profile info:", err.message);
        // If the token is invalid/expired, log them out locally
        setUser(null);
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