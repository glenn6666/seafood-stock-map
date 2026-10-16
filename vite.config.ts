import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {fileURLToPath} from "node:url";
export default defineConfig({
 root:"web",base:"/seafood-stock-map/",
 plugins:[react(),tailwindcss()],
 resolve:{alias:{"@":fileURLToPath(new URL("./web/src",import.meta.url))}},
 build:{outDir:"../dist",emptyOutDir:true},
});
