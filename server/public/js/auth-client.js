const AuthClient = {
    getToken() {
        return localStorage.getItem('auth_token');
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    async logout() {
        const token = this.getToken();
        if (!token) return;

        try {
            await fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Error during logout:', error);
        } finally {
            localStorage.removeItem('auth_token');
            window.location.reload();
        }
    },

    async getCurrentUser() {
        const token = this.getToken();
        if (!token) return null;

        try {
            const response = await fetch('/auth/user', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('auth_token');
                    return null;
                }
                throw new Error('Failed to get user data');
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    },

    login() {
        window.location.href = '/auth/discord';
    }
};