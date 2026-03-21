/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0a2540',
          bg: '#d1e6db', // Dim sage green for outer background
          card: '#e8f5ec', // Very light dim green for main app 
          purple: '#6e44ff',
          teal: '#00a896',
          pink: '#ff477e',
          blue: '#2a69f6'
        }
      }
    },
  },
  plugins: [],
};
