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
  const [menuOpen, setMenuOpen] = useState(false);

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
            initials: data.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
          });
        }
      } catch (err) {
        console.error('Header Profile Sync Error:', err.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const navItems = [
    { label: 'Home', to: '/landing' },
    { label: 'Search', to: '/home' },
    { label: 'Analytics', to: '/analytics' },
  ];

  return (
    <header className={`${styles.globalHeader} ${isLightTheme ? styles.lightMode : styles.darkMode}`}>
      <div className={styles.brand} onClick={() => navigate('/landing')}>
        Beyi
      </div>

      <nav className={styles.navLinks} aria-label="Primary navigation">
        {navItems.map((item) => (
          <Link key={item.to} to={item.to} className={styles.authLinks} onClick={closeMenu}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={styles.headerActions}>
        <button
          onClick={toggleTheme}
          className={styles.themeToggle}
          aria-label="Toggle visual interface theme"
        >
          {isLightTheme ? '🌙' : '☀️'}
        </button>

        <button
          type="button"
          className={styles.menuButton}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
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

      <div id="mobile-navigation" className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}>
        {navItems.map((item) => (
          <Link key={item.to} to={item.to} className={styles.mobileNavLink} onClick={closeMenu}>
            {item.label}
          </Link>
        ))}
        {!user && <Link to="/login" className={styles.mobileNavLink} onClick={closeMenu}>Login / Signup</Link>}
      </div>
    </header>
  );
};

export default Header;