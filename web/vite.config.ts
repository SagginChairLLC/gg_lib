import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
    base: command === 'build' ? './' : undefined,
    // Fixed port so the fxmanifest hot-reload ui_page always finds THIS app —
    // 5173 belongs to gg_taxijob's dev server.
    server: { port: 5180 },
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
}));
