import { invoke } from "./bridge"

export const getCurrentWindow = () => {
  return {
    minimize: () => invoke<void>("window_minimize"),
    maximize: () => invoke<void>("window_maximize"),
    close: () => invoke<void>("window_close"),
  }
}
