import { useState } from 'react'
import styles from './registration.module.css'
import { fetchJson } from '../lib/api'

function SignupForm() {
    const [role, setRole] = useState('farmer')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [contact, setContact] = useState('')
    const [email, setEmail] = useState('')
    const [location, setLocation] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [assignedRegion, setAssignedRegion] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleRoleSelect = (selectedRole) => {
        setRole(selectedRole)

        if (selectedRole === 'farmer') {
            setAssignedRegion('')
        }
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            setLoading(false)
            return
        }

        const username = `${firstName.trim()}${lastName.trim() ? `.${lastName.trim()}` : ''}`.replace(/\s+/g, '.').toLowerCase()

        try {
            const requestBody = {
                username,
                email,
                password,
                is_agent: role === 'agent',
                farmer_location: role === 'farmer' ? location.trim() : '',
            }

            if (role === 'agent') {
                requestBody.assigned_region = assignedRegion.trim()
            }

            await fetchJson('/auth/register/', {
                method: 'POST',
                body: JSON.stringify(requestBody),
            })

            if (role === 'farmer' && location.trim()) {
                localStorage.setItem('farmerLocation', location.trim())
            }

            setSuccess('Account created successfully. You can now log in.')
        } catch (requestError) {
            setError(requestError.message || 'Unable to create account.')
        } finally {
            setLoading(false)
        }
    }

    return(

        <div className={styles.signup}>

            <h1>Create your Beyi Account</h1>

            <div className={styles.roleSwitcher}>
                <button
                    type="button"
                    onClick={() => handleRoleSelect('farmer')}
                    className={`${styles.roleButton} ${role === 'farmer' ? styles.roleButtonActive : ''}`}
                >
                    I'M A FARMER
                </button>
                <button
                    type="button"
                    onClick={() => handleRoleSelect('agent')}
                    className={`${styles.roleButton} ${role === 'agent' ? styles.roleButtonActive : ''}`}
                >
                    I'M AN AGENT (OPTIONAL)
                </button>
            </div>

            <form  className={styles.form} onSubmit={handleSubmit}>

                <label htmlFor="name">First Name</label>
                <input type="text" id="name" name="name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />

                <label htmlFor="surname">Last Name</label>
                <input type="text" id="surname" name="surname" required value={lastName} onChange={(event) => setLastName(event.target.value)} />

                <label htmlFor="contact">Phone Number</label>
                <input type="tel" id="contact" name="contact" required value={contact} onChange={(event) => setContact(event.target.value)} />

                <label htmlFor="email">Email Address</label>
                <input type="email" id="email" name="email" required value={email} onChange={(event) => setEmail(event.target.value)} />

                {role === 'farmer' && (
                    <>
                        <label htmlFor="location">Your Location</label>
                        <input
                            type="text"
                            id="location"
                            name="location"
                            placeholder="District, town, or village"
                            required
                            value={location}
                            onChange={(event) => setLocation(event.target.value)}
                        />
                    </>
                )}

                <label htmlFor="password">Password</label>
                <input type="password" id="password" name="password" required value={password} onChange={(event) => setPassword(event.target.value)} />

                <label htmlFor="password">Confirm Password</label>
                <input type="password" id="password" name="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />

                {role === 'agent' && (
                    <>
                        <label htmlFor="region">Assigned Region</label>
                        <input type="text" id="region" name="region" required value={assignedRegion} onChange={(event) => setAssignedRegion(event.target.value)} />
                    </>
                )}

                {error && <p>{error}</p>}
                {success && <p>{success}</p>}

                <button type="submit" disabled={loading}>{loading ? 'CREATING...' : 'CREATE ACCOUNT'}</button>
                <p>already have an account? <a href="/auth">LogIn</a></p>
            </form>

            <form className={styles.form2} action="">

                <label htmlFor="username"> UserName</label>
                <input type="text" id="username" name="username" required/>

                <label htmlFor="password">Password</label>
                <input type="password" id="password" name="password" required/>

            </form>
        </div>
    )

}

export default SignupForm;