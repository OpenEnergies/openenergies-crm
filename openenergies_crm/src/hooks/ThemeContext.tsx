import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from './useSession';
import { supabase } from '@lib/supabase';
import { toast } from 'react-hot-toast';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { userId, themePreference, refetchSession } = useSession();
    const [theme, setThemeState] = useState<Theme>('dark');

    // Initialize theme from session or localStorage
    useEffect(() => {
        if (themePreference) {
            setThemeState(themePreference);
        } else {
            const savedTheme = localStorage.getItem('theme') as Theme;
            if (savedTheme) {
                setThemeState(savedTheme);
            }
        }
    }, [themePreference]);

    // Apply theme to document
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const setTheme = async (newTheme: Theme) => {
        setThemeState(newTheme);

        if (userId) {
            try {
                const { error } = await supabase
                    .from('usuarios_app')
                    .update({ theme_preference: newTheme })
                    .eq('user_id', userId);

                if (error) throw error;

                // Refetch session so other components get the updated preference
                refetchSession();
            } catch (error: any) {
                console.error('Error persisting theme preference:', error.message);
                toast.error('No se pudo guardar la preferencia de tema en la base de datos.');
            }
        }
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
