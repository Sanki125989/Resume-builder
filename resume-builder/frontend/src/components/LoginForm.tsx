import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { loginWithNaukri, loginWithLinkedIn } from '../services/auth';

const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const history = useHistory();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Implement login logic here
            // Example: await loginWithCredentials(email, password);
            history.push('/dashboard'); // Redirect to dashboard after successful login
        } catch (err) {
            setError('Login failed. Please check your credentials.');
        }
    };

    const handleNaukriLogin = async () => {
        try {
            await loginWithNaukri();
            history.push('/dashboard');
        } catch (err) {
            setError('Naukri login failed.');
        }
    };

    const handleLinkedInLogin = async () => {
        try {
            await loginWithLinkedIn();
            history.push('/dashboard');
        } catch (err) {
            setError('LinkedIn login failed.');
        }
    };

    return (
        <div className="login-form">
            <h2>Login</h2>
            {error && <p className="error">{error}</p>}
            <form onSubmit={handleLogin}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Login</button>
            </form>
            <button onClick={handleNaukriLogin}>Login with Naukri</button>
            <button onClick={handleLinkedInLogin}>Login with LinkedIn</button>
        </div>
    );
};

export default LoginForm;