import "@/styles/base.css";
import "./site.css";
import { hydrateRoot, createRoot } from "react-dom/client";
import { installErrorReporting } from "@/lib/report";
import { Site, type PageKey } from "./Site";
import type { SiteLang } from "./content";

installErrorReporting();
const root = document.getElementById("root")!;
const l = document.documentElement.lang;
const lang: SiteLang = l === "pl" || l === "ru" ? l : "en";
const page = (root.dataset.page ?? "") as PageKey;
// пререндеренная страница «оживает»; в dev-режиме (пустой корень) — обычная отрисовка
if (root.firstElementChild) hydrateRoot(root, <Site lang={lang} page={page} />);
else createRoot(root).render(<Site lang={lang} page={page} />);
