/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{html,ts}',
    ],
    theme: {
        extend: {
            colors: {
                bg: {
                    base: '#FBFCFE',
                    panel: '#FFFFFF',
                    subtle: '#F2F6FC',
                    elevated: '#E8EEF8',
                },
                navy: {
                    primary: '#1A3462',
                    deep: '#0F1F3D',
                    mid: '#2D5FA8',
                },
                gold: {
                    accent: '#C9A96E',
                    light: '#E8D4A0',
                    dark: '#A88A53',
                },
                ink: {
                    primary: '#1A2744',
                    secondary: '#4B5B7A',
                    muted: '#8FA3C8',
                },
                line: {
                    subtle: '#E1E8F2',
                    medium: '#CCD8ED',
                    accent: 'rgba(201,169,110,0.5)',
                },
                state: {
                    success: '#16A34A',
                    error: '#DC2626',
                    warning: '#D97706',
                },
            },
            fontFamily: {
                display: ['"Clash Display"', 'system-ui', 'sans-serif'],
                sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
            },
            borderRadius: {
                sm: '8px',
                md: '12px',
                lg: '16px',
                xl: '24px',
                '2xl': '32px',
            },
            boxShadow: {
                'card-sm': '0 1px 2px rgba(26,39,68,0.06)',
                'card-md': '0 4px 12px rgba(26,39,68,0.08)',
                'card-lg': '0 12px 32px rgba(26,39,68,0.10)',
                'gold-glow': '0 0 32px rgba(201,169,110,0.35)',
                'navy-glow': '0 0 32px rgba(26,52,98,0.18)',
            },
            backgroundImage: {
                'gradient-navy-gold': 'linear-gradient(135deg, #1A3462 0%, #C9A96E 100%)',
                'mesh-light': 'radial-gradient(at 80% 0%, rgba(232,212,160,0.35) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(232,238,248,0.6) 0px, transparent 50%)',
            },
            transitionTimingFunction: {
                'out-soft': 'cubic-bezier(0.16, 1, 0.3, 1)',
            },
        },
    },
    plugins: [],
};
