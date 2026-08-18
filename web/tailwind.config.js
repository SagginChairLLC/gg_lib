/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
    theme: {
        extend: {
            borderRadius: {
                DEFAULT: 'var(--radius)',
            },
            colors: {
                primary: {
                    DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
                    foreground: 'hsl(var(--primary-foreground))',
                },
            },
        },
    },
    plugins: [],
};
