import React, { createContext, useState, useContext, ReactNode } from 'react';

interface UserContextType {
    username: string;
    isAdmin: boolean;
    setUser: (username: string, isAdmin: boolean) => void;
    clearUser: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
    children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
    const [username, setUsername] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);

    const setUser = (username: string, isAdmin: boolean) => {
        setUsername(username);
        setIsAdmin(isAdmin);
    };

    const clearUser = () => {
        setUsername('');
        setIsAdmin(false);
    };

    return (
        <UserContext.Provider value={{ username, isAdmin, setUser, clearUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};