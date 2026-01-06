/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    darkMode: 'class',
    theme: {
        screens: {
            'xs': '425px',     // Mobile grande
            'sm': '640px',     // Mobile landscape
            'md': '768px',     // Tablet portrait
            'lg': '1024px',    // Tablet landscape / Laptop
            'xl': '1280px',    // Desktop
            '2xl': '1536px',   // Desktop grande
            '3xl': '1920px',   // Ultrawide
        },
        extend: {
            colors: {
                // Backgrounds
                'bg-primary': '#0F0F1A',
                'bg-secondary': '#1A1A2E',
                'bg-tertiary': '#16213E',

                // Brand colors - OpenEnergies (same as Fenix)
                'fenix': {
                    50: '#ECFDF5',
                    100: '#D1FAE5',
                    200: '#A7F3D0',
                    300: '#6EE7B7',
                    400: '#34D399',
                    500: '#10B981',  // Primary
                    600: '#059669',
                    700: '#047857',
                    800: '#065F46',
                    900: '#064E3B',
                    950: '#022C22',
                },

                // Solar/Energy accent
                'solar': {
                    50: '#FFFBEB',
                    100: '#FEF3C7',
                    200: '#FDE68A',
                    300: '#FCD34D',
                    400: '#FBBF24',
                    500: '#F59E0B',  // Secondary
                    600: '#D97706',
                    700: '#B45309',
                    800: '#92400E',
                    900: '#78350F',
                },
            },

            fontFamily: {
                sans: ['Outfit', 'system-ui', 'sans-serif'],
                mono: ['Fira Code', 'ui-monospace', 'monospace'],
            },

            fontSize: {
                'display': ['clamp(2rem, 5vw, 3rem)', { lineHeight: '1.1', fontWeight: '700' }],
                'h1': ['clamp(1.5rem, 4vw, 2.25rem)', { lineHeight: '1.2', fontWeight: '700' }],
                'h2': ['clamp(1.25rem, 3vw, 1.5rem)', { lineHeight: '1.3', fontWeight: '600' }],
                'h3': ['clamp(1.125rem, 2.5vw, 1.25rem)', { lineHeight: '1.4', fontWeight: '600' }],
            },

            borderRadius: {
                '4xl': '2rem',
            },

            boxShadow: {
                'glow-sm': '0 0 10px rgba(16, 185, 129, 0.2)',
                'glow': '0 0 20px rgba(16, 185, 129, 0.3)',
                'glow-lg': '0 0 30px rgba(16, 185, 129, 0.4)',
                'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            },

            backdropBlur: {
                'xs': '2px',
            },

            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'pulse-slow': 'pulse 3s infinite',
            },

            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/typography'),
    ],
}
