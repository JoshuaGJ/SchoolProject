import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './login.module.css'
import { fetchJson } from '../lib/api'

function Login(){
    const navigate = useNavigate();
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        try {
            const tokens = await fetchJson('/auth/login/', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            localStorage.setItem('accessToken', tokens.access);
            localStorage.setItem('refreshToken', tokens.refresh);
            navigate(tokens.role === 'agent' ? '/dash' : '/home');
        } catch (requestError) {
            setError(requestError.message || 'Unable to log in.');
        } finally {
            setLoading(false);
        }
    }

    return(
        <>
             <div className={styles.login}>
                <h1>Welcome Back</h1>
                <form className={styles.form} onSubmit={handleSubmit}>

                        <label htmlFor="email"> Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />

                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />

                        {error && <p>{error}</p>}

                        <button type='submit' disabled={loading}>
                            {loading ? 'Logging in...' : 'LOGIN'}
                        </button>

                        <a href='/signup'>Sign up?</a>

                 </form>
             </div>
             
        </>
    )
}

export default Login