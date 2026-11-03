import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {pagesBase} from './scripts/pages-base.mjs';
export default defineConfig({plugins:[react()],base:pagesBase(process.env.OPTILAB_PAGES_TARGET)});
