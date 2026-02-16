import "./style.css";
import { showModeSelect } from "./screens.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
showModeSelect(app);
